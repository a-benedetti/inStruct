document.addEventListener("DOMContentLoaded", function() {
    const proteinPreparationDiv = document.getElementById("protein-preparation");
    const pdb_id = proteinPreparationDiv.getAttribute("data-pdb-id");
    const file_url = proteinPreparationDiv.getAttribute("data-file-url");

    let structureStates = {};  
    let initialStructure = null;  

    const viewer = $3Dmol.createViewer("protein-viewer", { backgroundColor: "white" });
    let proteinModel;

    // Define the navigateSteps function globally
    window.navigateSteps = function(step) {
        document.querySelectorAll(".step-section").forEach(section => {
            section.style.display = "none";
        });
        const targetStep = document.getElementById(`step-${step}`);
        if (targetStep) {
            targetStep.style.display = "block";
        }
    };

    // Submit function for Step 1
    function submitStructureSelection() {
        console.log("Submitting structure selection...");
    
        // Get selected model, chains, and ligands
        const modelSelectElem = document.getElementById("model-selection");
        const selectedModel = modelSelectElem ? modelSelectElem.value : null;
        const selectedChains = Array.from(document.querySelectorAll("#toggle-container input[type='checkbox'][id^='Chain-']:checked")).map(input => input.id.split('-')[1]);
        const selectedLigands = Array.from(document.querySelectorAll("#toggle-container input[type='checkbox'][id^='Ligand-']:checked")).map(input => input.id.split('-')[1]);
    
        console.log("Selected model:", selectedModel);
        console.log("Selected chains:", selectedChains);
        console.log("Selected ligands:", selectedLigands);
    
        // Filter the initial PDB structure based on selections
        const filteredStructure = filterPDBStructure(initialStructure, selectedModel, selectedChains, selectedLigands);
    
        // Store the filtered structure in structureStates for this step
        structureStates['step1'] = filteredStructure;
    
        // Display the filtered PDB data in a popup window
        const popupWindow = window.open("", "FilteredStructure", "width=600,height=400");
        popupWindow.document.write("<pre>" + structureStates['step1'] + "</pre>");
        popupWindow.document.title = "Filtered Structure After Step 1";
    
        // Update the viewer with the filtered structure
        updateViewer(filteredStructure);
    }
    
    // Function to filter PDB structure based on selected model, chains, and ligands
    function filterPDBStructure(pdbData, model, chains, ligands) {
        let inSelectedModel = !model; // True if no model selection
        const filteredData = pdbData.split("\n").filter(line => {
            // Check if line has enough characters
            if (line.length < 22) return false;
    
            // Handle model lines
            if (line.startsWith("MODEL")) {
                inSelectedModel = model ? line.includes(model) : true;
                return inSelectedModel;
            }
            if (!inSelectedModel) return false; // Skip lines if not in selected model
    
            // Handle ATOM and HETATM lines for chains and ligands
            const isAtom = line.startsWith("ATOM");
            const isHetatm = line.startsWith("HETATM");
            const chainId = line[21].trim();
            const resName = line.slice(17, 20).trim();
    
            if (isAtom && chains.includes(chainId)) return true;
            if (isHetatm && ligands.includes(resName)) return true;
    
            return false;
        }).join("\n");
    
        return filteredData;
    }
    
    // Function to update the viewer with filtered structure data
    function updateViewer(structureData) {
        viewer.removeAllModels();
        proteinModel = viewer.addModel(structureData, "pdb");
        viewer.setStyle({}, { cartoon: { color: "spectrum" }, stick: { color: "orange" } });
        viewer.zoomTo();  // Center the filtered structure
        viewer.render();
    }
    
    
    
    
    window.submitStructureSelection = submitStructureSelection;  // Make it globally accessible

    // Function to filter structure based on model, chains, and ligands
    function filterStructure(structureData, model, chains, ligands) {
        const filteredData = structureData.split("\n").filter(line => {
            const isModel = model ? line.startsWith("MODEL") && line.includes(model) : true;
            const isChain = chains.length ? chains.includes(line[21].trim()) : true;
            const isLigand = ligands.length && line.startsWith("HETATM") ? ligands.includes(line.slice(17, 20).trim()) : true;
            return isModel && (isChain || isLigand);
        }).join("\n");

        return filteredData;
    }

    // Function to update viewer with the selected structure and apply zoom
    function updateViewer(structureData) {
        viewer.removeAllModels();
        proteinModel = viewer.addModel(structureData, "pdb");
        viewer.setStyle({}, { cartoon: { color: "spectrum" }, stick: { color: "orange" } });
        viewer.zoomTo();  // Zoom to the newly loaded structure
        viewer.render();
    }

    // Default styling for the initial load
    function applyDefaultStyle() {
        viewer.setStyle({ hetflag: false }, { cartoon: { color: "spectrum" } });
        viewer.setStyle({ hetflag: true }, { stick: { color: "orange" } });
        viewer.render();
    }

    // Load the initial PDB data
    function loadProteinStructure(pdbData) {
        proteinModel = viewer.addModel(pdbData, "pdb");
        initialStructure = pdbData;  
        const { chains, ligands, models } = parsePDBData(pdbData);
        addToggleSections(chains, ligands, models);
        applyDefaultStyle();
        viewer.zoomTo();  // Ensure the initial structure is centered
    }

    // Parse PDB data to get available chains, ligands, and models
    function parsePDBData(pdbData) {
        const chains = new Set();
        const ligands = new Set();
        const models = new Set();
        let currentModel = 1;

        pdbData.split("\n").forEach(line => {
            if (line.startsWith("MODEL")) {
                currentModel = line.split(/\s+/)[1];
                models.add(currentModel);
            }
            if (line.startsWith("ATOM") || line.startsWith("HETATM")) {
                const chainId = line.slice(21, 22).trim();
                const resName = line.slice(17, 20).trim();
                if (line.startsWith("ATOM")) {
                    chains.add(chainId);
                } else if (line.startsWith("HETATM") && resName !== "HOH") {
                    ligands.add(resName);
                }
            }
        });

        return {
            chains: Array.from(chains),
            ligands: Array.from(ligands),
            models: Array.from(models)
        };
    }

    // Add toggle sections for chains, ligands, and models
    function addToggleSections(chains, ligands, models) {
        const toggleContainer = document.getElementById("toggle-container");
        toggleContainer.innerHTML = ""; 

        if (models.length > 1) {
            const modelSection = document.createElement("div");
            modelSection.innerHTML = "<h4>Models</h4>";
            models.forEach(model => {
                const option = document.createElement("option");
                option.value = model;
                option.textContent = model;
                document.getElementById("model-selection").appendChild(option);
            });
        }

        if (chains.length > 0) {
            const chainSection = document.createElement("div");
            chainSection.innerHTML = "<h4>Chains</h4>";
            chains.forEach(chain => addToggle(chain, "Chain", chainSection));
            toggleContainer.appendChild(chainSection);
        }

        if (ligands.length > 0) {
            const ligandSection = document.createElement("div");
            ligandSection.innerHTML = "<h4>Ligands</h4>";
            ligands.forEach(ligand => addToggle(ligand, "Ligand", ligandSection));
            toggleContainer.appendChild(ligandSection);
        }
    }

    // Add individual toggle button
    function addToggle(identifier, type, section) {
        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.checked = true;
        toggle.id = `${type}-${identifier}`;
        toggle.dataset.type = type;
        toggle.addEventListener("change", () => toggleVisibility(identifier, type, toggle.checked));

        const label = document.createElement("label");
        label.htmlFor = toggle.id;
        label.textContent = `${type} ${identifier}`;
        label.style.display = "block";

        section.appendChild(label);
        section.appendChild(toggle);
    }

    // Toggle visibility based on type (Chain, Ligand, or Model)
    function toggleVisibility(identifier, type, isVisible) {
        const selection = type === "Chain" ? { chain: identifier }
                        : type === "Ligand" ? { resn: identifier }
                        : { model: parseInt(identifier) };

        proteinModel.setStyle(selection, {});

        if (isVisible) {
            if (type === "Ligand") {
                proteinModel.setStyle(selection, { stick: { color: "orange" } });
            } else if (type === "Chain" || type === "Model") {
                proteinModel.setStyle(selection, { cartoon: { color: "spectrum" } });
            }
        }
        viewer.render();
    }

    document.getElementById("representation").addEventListener("change", function () {
        const mode = this.value;
        viewer.setStyle({}, {});

        if (mode === "ribbons") {
            viewer.setStyle({ hetflag: false }, { cartoon: { color: "spectrum" } });
            viewer.setStyle({ hetflag: true }, { stick: { color: "orange" } });
        } else if (mode === "all-atoms") {
            viewer.setStyle({ hetflag: false }, { line: { color: "lightblue" } });
            viewer.setStyle({ hetflag: true }, { stick: { color: "orange" } });
        } else if (mode === "ribbons-sidechains") {
            viewer.setStyle({ hetflag: false, sidechain: false }, { cartoon: { color: "spectrum" } });
            viewer.setStyle({ hetflag: false, sidechain: true }, { stick: { color: "spectrum" } });
            viewer.setStyle({ hetflag: true }, { stick: { color: "spectrum" } });
        }
        viewer.render();
    });

    if (file_url && file_url !== "None") {
        fetch(file_url)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Network response was not ok.");
                }
                return response.text();
            })
            .then(loadProteinStructure)
            .catch(error => console.error("Failed to load file:", error));
    } else if (pdb_id && pdb_id !== "None") {
        fetch(`https://files.rcsb.org/download/${pdb_id}.pdb`)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to load PDB data from RCSB.");
                }
                return response.text();
            })
            .then(loadProteinStructure)
            .catch(error => console.error("Failed to load PDB data:", error));
    }


    //Step2:fetch missing atoms
    function fetchMissingAtoms(pdbData) {
        fetch('/identify_missing_atoms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdb_data: pdbData })
        })
        .then(response => response.json())
        .then(missingAtoms => {
            const missingAtomsList = document.getElementById("missing-atoms-list");
            missingAtomsList.innerHTML = ""; // Clear previous contents
    
            if (missingAtoms.length === 0) {
                missingAtomsList.innerHTML = "<p>No missing atoms identified</p>";
            } else {
                missingAtoms.forEach(atom => {
                    const item = document.createElement("div");
                    item.innerHTML = `
                        <label><input type="checkbox" checked> 
                        ${atom.residue_name} ${atom.residue_id} (${atom.chain}): ${atom.missing_atoms.join(", ")}</label>
                    `;
                    missingAtomsList.appendChild(item);
                });
            }
        })
        .catch(error => console.error('Error fetching missing atoms:', error));
    }
    
    
});
