document.addEventListener('DOMContentLoaded', function () {
    const ligandRadio = document.getElementById('ligand');
    const proteinRadio = document.getElementById('protein');
    const ligandPanel = document.getElementById('ligand-panel');
    const proteinPanel = document.getElementById('protein-panel');
    const usePDB = document.getElementById('use-pdb');
    const useFile = document.getElementById('use-file');
    const pdbForm = document.getElementById('pdb-form');
    const fileForm = document.getElementById('file-form');

    // Clear all input fields and reset on page load
    window.clearInputs = function() {
        ligandRadio.checked = false;
        proteinRadio.checked = false;
        ligandPanel.style.display = 'none';
        proteinPanel.style.display = 'none';
        clearProteinInputs();
    };

    // Show/hide panels based on molecule selection
    ligandRadio.addEventListener('change', function () {
        if (ligandRadio.checked) {
            ligandPanel.style.display = 'block';
            proteinPanel.style.display = 'none';
            clearProteinInputs();
        }
    });

    proteinRadio.addEventListener('change', function () {
        if (proteinRadio.checked) {
            proteinPanel.style.display = 'block';
            ligandPanel.style.display = 'none';
            usePDB.disabled = false;
            useFile.disabled = false;
            setInactive(usePDB, useFile);
        }
    });

    // Toggle protein input forms based on selection
    usePDB.addEventListener('change', function () {
        if (usePDB.checked) {
            pdbForm.style.display = 'block';
            fileForm.style.display = 'none';
            setActive(usePDB, useFile);
        }
    });

    useFile.addEventListener('change', function () {
        if (useFile.checked) {
            fileForm.style.display = 'block';
            pdbForm.style.display = 'none';
            setActive(useFile, usePDB);
        }
    });

    // Handle the PDB ID submission
    pdbForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const formData = new FormData(pdbForm);

        fetch('/protein_processing', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const url = `/protein_preparation?pdb_id=${encodeURIComponent(data.pdb_id)}`;
                window.location.href = url;
            } else {
                alert(data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An unexpected error occurred. Please try again.');
        });
    });

    // Handle the protein file submission
    fileForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const formData = new FormData(fileForm);

        fetch('/protein_processing', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const url = `/protein_preparation?file_url=${encodeURIComponent(data.file_url)}`;
                window.location.href = url;
            } else {
                alert(data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An unexpected error occurred. Please try again.');
        });
    });

    // Helper functions for toggling protein input types
    function clearProteinInputs() {
        usePDB.checked = false;
        useFile.checked = false;
        usePDB.disabled = true;
        useFile.disabled = true;
        pdbForm.style.display = 'none';
        fileForm.style.display = 'none';
    }

    function setInactive(...elements) {
        elements.forEach(element => {
            element.nextElementSibling.classList.add('inactive');
        });
    }

    function setActive(active, inactive) {
        active.nextElementSibling.classList.remove('inactive');
        inactive.nextElementSibling.classList.add('inactive');
    }
});
