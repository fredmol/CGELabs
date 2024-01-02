const { ipcRenderer } = require('electron');
const fs = require('fs');
const resultsDirectory = '/var/lib/cge/results';

function scrollToBottom(element) {
    requestAnimationFrame(() => {
        element.scrollTop = element.scrollHeight;
    });
}

// Modify this function to check for the report.txt file
function setupResultsPage() {
    console.log('Setting up results page');
    ipcRenderer.invoke('get-results').then(resultFolders => {
        const tableBody = document.getElementById('resultsTable').querySelector('tbody');
        tableBody.innerHTML = ''; // Clear existing rows
        resultFolders.forEach(folderInfo => {
            const row = tableBody.insertRow();
            const cellName = row.insertCell();
            const cellLink = row.insertCell();
            cellName.textContent = folderInfo.name;

            if (folderInfo.reportExists) {
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = 'Open Report';
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    // Handle opening of report.txt
                    ipcRenderer.send('open-file', `${resultsDirectory}/${folderInfo.name}/report.txt`);
                });
                cellLink.appendChild(link);
            } else {
                cellLink.textContent = 'No report available. Likely the analysis failed or was stopped prematurely.';
            }
        });
    });
}

function setupVirusPage() {
    const beginAnalysisButton = document.getElementById('beginVirusAnalysis');
    const fileInput = document.getElementById('virusFileInput');
    const experimentNameInput = document.getElementById('virusExperimentName');
    const outputElement = document.getElementById('virusOutput');

    if (beginAnalysisButton) {
        beginAnalysisButton.addEventListener('click', () => {
            const filePath = fileInput.files[0].path;
            const experimentName = experimentNameInput.value;

            if (filePath && experimentName) {
                ipcRenderer.send('run-virus-command', filePath, experimentName);
            } else {
                console.log("File or experiment name not provided");
            }
        });

        ipcRenderer.on('virus-command-output', (event, { stdout, stderr }) => {
            if (outputElement) {
                if (stdout) {
                    outputElement.textContent += stdout + '\n';
                }
                if (stderr) {
                    outputElement.textContent += stderr + '\n';
                }
                scrollToBottom(outputElement);
            }
        });

        ipcRenderer.on('virus-complete-success', () => {
            const buttonContainer = document.getElementById('virusButtonContainer');
            if (!document.getElementById('viewVirusResults') && buttonContainer) {
                const resultsButton = document.createElement('button');
                resultsButton.textContent = 'View Virus Results';
                resultsButton.id = 'viewVirusResults';
                resultsButton.addEventListener('click', () => {
                    fetch('results.html')
                        .then(response => response.text())
                        .then(html => {
                            const mainContent = document.querySelector('.main-content');
                            mainContent.innerHTML = html;
                        })
                        .catch(error => console.error('Failed to load virus results page:', error));
                });

                buttonContainer.appendChild(resultsButton);
            }
        });

        ipcRenderer.on('virus-complete-failure', (event, errorMessage) => {
            console.error(errorMessage);
        });
    }
}

function setupMetagenomicsPage() {
    const beginAnalysisButton = document.getElementById('beginMetagenomicsAnalysis');
    const fileInput = document.getElementById('metagenomicsFileInput');
    const experimentNameInput = document.getElementById('metagenomicsExperimentName');
    const outputElement = document.getElementById('metagenomicsOutput');

    if (beginAnalysisButton) {
        beginAnalysisButton.addEventListener('click', () => {
            const filePath = fileInput.files[0].path;
            const experimentName = experimentNameInput.value;

            if (filePath && experimentName) {
                ipcRenderer.send('run-metagenomics-command', filePath, experimentName);
            } else {
                console.log("File or experiment name not provided");
            }
        });

        ipcRenderer.on('metagenomics-command-output', (event, { stdout, stderr }) => {
            if (outputElement) {
                if (stdout) {
                    outputElement.textContent += stdout + '\n';
                }
                if (stderr) {
                    outputElement.textContent += stderr + '\n';
                }
                scrollToBottom(outputElement);
            }
        });

        ipcRenderer.on('metagenomics-complete-success', () => {
            const buttonContainer = document.getElementById('metagenomicsButtonContainer');
            if (!document.getElementById('viewMetagenomicsResults') && buttonContainer) {
                const resultsButton = document.createElement('button');
                resultsButton.textContent = 'View Metagenomics Results';
                resultsButton.id = 'viewMetagenomicsResults';
                resultsButton.addEventListener('click', () => {
                    fetch('results.html')
                        .then(response => response.text())
                        .then(html => {
                            const mainContent = document.querySelector('.main-content');
                            mainContent.innerHTML = html;
                        })
                        .catch(error => console.error('Failed to load metagenomics results page:', error));
                });

                buttonContainer.appendChild(resultsButton);
            }
        });

        ipcRenderer.on('metagenomics-complete-failure', (event, errorMessage) => {
            console.error(errorMessage);
        });
    }
}


function setupBacteriaPage() {
    const beginAnalysisButton = document.getElementById('beginAnalysis');
    const fileInput = document.getElementById('fileInput');
    const experimentNameInput = document.getElementById('experimentName');
    const outputElement = document.getElementById('output');

    if (beginAnalysisButton) {
        beginAnalysisButton.addEventListener('click', () => {
            const filePath = fileInput.files[0].path;
            const experimentName = experimentNameInput.value;

            if (filePath && experimentName) {
                ipcRenderer.send('run-isolate-command', filePath, experimentName);
            } else {
                console.log("File or experiment name not provided");
            }
        });

        ipcRenderer.on('isolate-command-output', (event, { stdout, stderr }) => {
            if (outputElement) {
                if (stdout) {
                    outputElement.textContent += stdout + '\n';
                }
                if (stderr) {
                    outputElement.textContent += stderr + '\n';
                }
                scrollToBottom(outputElement);
            }
        });

        ipcRenderer.on('isolate-complete-success', () => {
            const buttonContainer = document.getElementById('buttonContainer');
            if (!document.getElementById('viewResults') && buttonContainer) {
                const resultsButton = document.createElement('button');
                resultsButton.textContent = 'View Results';
                resultsButton.id = 'viewResults';
                resultsButton.addEventListener('click', () => {
                fetch('results.html')
                    .then(response => response.text())
                    .then(html => {
                            const mainContent = document.querySelector('.main-content');
                            mainContent.innerHTML = html;
                            // Call any initialization functions for results.html here, if needed
                        })
                        .catch(error => console.error('Failed to load results page:', error));
                });


                buttonContainer.appendChild(resultsButton);
                }
        });

        ipcRenderer.on('isolate-complete-failure', (event, errorMessage) => {
            console.error(errorMessage);
            // Optionally, display the error message to the user
        });
    }
}
function setupFastQMergePage() {
    const selectFolderButton = document.getElementById('selectFolder');
    const beginMergeButton = document.getElementById('beginMerge');
    const folderPathText = document.getElementById('folderPath');
    const mergeNameInput = document.getElementById('mergeName'); // New input for merge name
    const mergeOutputElement = document.getElementById('mergeOutput');

    if (selectFolderButton && beginMergeButton && folderPathText && mergeNameInput) {
        selectFolderButton.addEventListener('click', () => {
            ipcRenderer.invoke('select-folder').then(folderPath => {
                if (folderPath) {
                    folderPathText.textContent = `Selected Folder: ${folderPath}`;
                    beginMergeButton.style.display = 'block'; // Show the button
                }
            });
        });

        beginMergeButton.addEventListener('click', () => {
            const folderPath = folderPathText.textContent.replace('Selected Folder: ', '');
            const mergeName = mergeNameInput.value; // Get the merge name from the input
            if (folderPath && mergeName) {
                ipcRenderer.send('run-merge-command', folderPath, mergeName);
            } else {
                console.log("No folder selected or merge name provided");
            }
        });
    }

    ipcRenderer.on('merge-command-output', (event, data) => {
        if (mergeOutputElement) {
            if (data.stdout) {
                mergeOutputElement.textContent += data.stdout;
            }
            if (data.stderr) {
                mergeOutputElement.textContent += data.stderr;
            }
            scrollToBottom(mergeOutputElement);
        }
    });
}
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.sidebar a').forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();

            // Corrected line: Ensure href attribute is safely accessed
            const hrefAttribute = this.getAttribute('href');
            if (hrefAttribute) {
                const page = hrefAttribute.substring(1);
                fetch(page + '.html')
                    .then(response => response.text())
                    .then(data => {
                        const mainContent = document.querySelector('.main-content');
                        mainContent.innerHTML = data;
                        if (page === 'bacteria') {
                            setupBacteriaPage();
                        } else if (page === 'fastqmerge') {
                            setupFastQMergePage();
                        } else if (page === 'virus') {
                            setupVirusPage();
                        } else if (page === 'metagenomics') {
                            setupMetagenomicsPage();
                        }  else if (page === 'results') {
                            setupResultsPage();
                        }
                    });
            }
        });
    });
});
