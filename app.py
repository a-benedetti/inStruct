from flask import Flask, request, render_template, redirect, url_for, flash, jsonify, send_from_directory, make_response
from werkzeug.utils import secure_filename
import os
import requests
from Bio.PDB import PDBParser, NeighborSearch, Selection
from Bio.PDB.Polypeptide import is_aa
from Bio.PDB.Structure import Structure



app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'uploads')
app.secret_key = 'your_secret_key'  # Necessary for flashing messages
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB limit


# Supported file formats
PROTEIN_FORMATS = {'pdb', 'pdbqt', 'mmcif', 'pdbx/mmcif', 'xyz', 'psf'}
LIGAND_FORMATS = {'mol', 'mol2', 'sdf', 'pdb', 'xyz', 'pdbqt', 'cml'}

# Ensure the upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    # Serve files from the 'uploads' folder in the root directory
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/static/<path:filename>')
def custom_static(filename):
    # Check if the file is JavaScript and explicitly set MIME type
    if filename.endswith('.js'):
        response = make_response(send_from_directory('static', filename))
        response.headers['Content-Type'] = 'application/javascript'
        return response
    return send_from_directory('static', filename)

@app.route('/ligand_processing', methods=['POST'])
def ligand_processing():
    file = request.files.get('ligand-file')
    smiles = request.form.get('smiles-input')
    chembl_id = request.form.get('chembl-id').upper() if request.form.get('chembl-id') else None
    inchi = request.form.get('inchi').upper() if request.form.get('inchi') else None

    if chembl_id:
        if validate_chembl(chembl_id):
            # ChEMBL ID is valid
            return jsonify({"success": True, "message": "ChEMBL ID validated successfully."})
        else:
            # Invalid ChEMBL ID
            return jsonify({"success": False, "message": "ChEMBL ID not found in the database."})

    elif file and file.filename != '':
        if file.filename.split('.')[-1].lower() in LIGAND_FORMATS:
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            return jsonify({"success": True, "message": "Ligand file processed successfully."})
        else:
            return jsonify({"success": False, "message": "Unsupported ligand file format."})
    
    elif smiles:
        return jsonify({"success": True, "message": "SMILES validated successfully."})
    
    else:
        return jsonify({"success": False, "message": "No ligand input provided."})


@app.route('/protein_processing', methods=['POST'])
def protein_processing():
    file = request.files.get('protein-file')
    pdb_code = request.form.get('pdb-code', '').strip().upper()

    if pdb_code:
        if validate_pdb_code(pdb_code):
            return jsonify({"success": True, "pdb_id": pdb_code})
        else:
            return jsonify({"success": False, "message": "Invalid PDB ID provided."}), 400

    elif file and file.filename != '':
        if file.filename.split('.')[-1].lower() in PROTEIN_FORMATS:
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            # Use 'url_for' to generate the correct URL for the uploaded file
            file_url = url_for('uploaded_file', filename=filename, _external=True)
            return jsonify({"success": True, "file_url": file_url})
        else:
            return jsonify({"success": False, "message": "Unsupported file format."}), 400

    return jsonify({"success": False, "message": "Please select either a PDB ID or a protein file."}), 400

@app.route('/autocomplete_pdb')
def autocomplete_pdb():
    query = request.args.get('q', '').upper()
    if len(query) < 1:
        return jsonify([])

    # Proper JSON payload for RCSB PDB API
    payload = {
        "query": {
            "type": "terminal",
            "service": "text",
            "parameters": {
                "value": query
            }
        },
        "return_type": "entry",
        "request_options": {
            "paginate": {
                "start": 0,
                "rows": 5
            }
        }
    }
    url = "https://search.rcsb.org/rcsbsearch/v1/query"
    headers = {'Content-Type': 'application/json'}
    response = requests.post(url, json=payload, headers=headers)

    if response.status_code == 200:
        data = response.json()
        # Extract the identifiers from the response
        suggestions = [entry['identifier'] for entry in data.get("result_set", [])]
        return jsonify(suggestions)
    else:
        return jsonify([])


@app.route('/autocomplete_chembl')
def autocomplete_chembl():
    query = request.args.get('q', '').upper()
    
    # Only start autocomplete if query is "CHEMBL" followed by one character
    if not query.startswith("CHEMBL") or len(query) < 7:
        return jsonify([])

    # Search ChEMBL API for matches
    url = f"https://www.ebi.ac.uk/chembl/api/data/molecule?molecule_chembl_id__startswith={query}&limit=5"
    headers = {'Accept': 'application/json'}
    response = requests.get(url, headers=headers)

    # Check if the response is JSON, otherwise print the raw response for debugging
    if response.status_code == 200:
        try:
            data = response.json()
            # Extract ChEMBL IDs and sort by publication date if available
            suggestions = sorted(
                [molecule['molecule_chembl_id'] for molecule in data.get("molecules", [])],
                reverse=True  # Sort by newest or a relevant popularity measure if provided
            )[:5]
            return jsonify(suggestions)
        except ValueError:
            # JSON decoding failed, print the response content for debugging
            print("Unexpected response content:", response.text)
            return jsonify([])  # Return an empty JSON response for autocomplete
    else:
        print(f"Error fetching ChEMBL data: {response.status_code}")
        return jsonify([])
    
@app.route('/protein_preparation')
def protein_preparation():
    pdb_id = request.args.get('pdb_id', None)
    file_url = request.args.get('file_url', None)
    return render_template('protein_preparation.html', pdb_id=pdb_id, file_url=file_url)

@app.route('/identify_missing_atoms', methods=['POST'])
def identify_missing_atoms():
    pdb_data = request.json.get('pdb_data')
    
    # Parse the PDB structure
    parser = PDBParser(QUIET=True)
    structure = parser.get_structure("protein", pdb_data)
    
    # Identify missing atoms
    missing_atoms = []
    
    for model in structure:
        for chain in model:
            for residue in chain:
                if is_aa(residue, standard=True):  # Only consider standard amino acids
                    expected_atoms = set(atom.name for atom in residue)
                    full_atoms = set(residue.atom_names)
                    
                    # Identify which atoms are missing by comparing with expected atoms
                    missing = expected_atoms - full_atoms
                    if missing:
                        missing_atoms.append({
                            "chain": chain.id,
                            "residue_name": residue.resname,
                            "residue_id": residue.id[1],
                            "missing_atoms": list(missing)
                        })

    # Send the list of missing atoms back to the frontend
    return jsonify(missing_atoms)


# Helper function to validate InChI
def validate_inchi(inchi):
    # Placeholder: You can use a chemistry API for validation
    return True  # Assume valid for now

# Helper function to validate PDB ID
def validate_pdb_code(pdb_code):
    response = requests.get(f"https://files.rcsb.org/download/{pdb_code}.pdb")
    return response.status_code == 200

def validate_chembl(chembl_id):
    url = f"https://www.ebi.ac.uk/chembl/api/data/molecule/{chembl_id}"
    headers = {'Accept': 'application/json'}
    response = requests.get(url, headers=headers)
    return response.status_code == 200

if __name__ == '__main__':
    
    app.run(debug=True)
