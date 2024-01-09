const { ipcRenderer } = require('electron');
const fs = require('fs');
const resultsDirectory = '/var/lib/cge/results';

function scrollToBottom(element) {
    requestAnimationFrame(() => {
        element.scrollTop = element.scrollHeight;
    });
}

function setupResultsPage() {
    console.log('Setting up results page');
    ipcRenderer.invoke('get-results').then(resultFolders => {
        const tableBody = document.getElementById('resultsTable').querySelector('tbody');
        tableBody.innerHTML = '';
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
                    ipcRenderer.send('open-file', `${resultsDirectory}/${folderInfo.name}/report.txt`);
                });
                cellLink.appendChild(link);
            } else {
                cellLink.textContent = 'No report available. Likely the analysis failed or was stopped prematurely.';
            }
        });
    });
}

function setupBacteriaPage() {
    const beginAnalysisButton = document.getElementById('beginAnalysis');
    const fileInput = document.getElementById('fileInput');
    const experimentNameInput = document.getElementById('experimentName');
    const outputElement = document.getElementById('output');
    const spinner = document.getElementById('loadingSpinner');
    const statusMessage = document.getElementById('statusMessage');

    if (beginAnalysisButton) {
        beginAnalysisButton.addEventListener('click', () => {
            const filePath = fileInput.files[0].path;
            const experimentName = experimentNameInput.value;

            if (filePath && experimentName) {
                ipcRenderer.send('run-isolate-command', filePath, experimentName);
                spinner.style.display = 'block';
                statusMessage.textContent = 'Analyzing... Please wait.';
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
            spinner.style.display = 'none';
            statusMessage.textContent = 'Analysis completed successfully. View results in the Results section.';
        });

        ipcRenderer.on('isolate-complete-failure', (event, errorMessage) => {
            spinner.style.display = 'none';
            statusMessage.textContent = 'Analysis failed. Check the console for details.';
        });
    }
}
function setupVirusPage() {
    const beginAnalysisButton = document.getElementById('beginVirusAnalysis');
    const fileInput = document.getElementById('virusFileInput');
    const experimentNameInput = document.getElementById('virusExperimentName');
    const outputElement = document.getElementById('virusOutput');
    const spinner = document.getElementById('loadingSpinner');
    const statusMessage = document.getElementById('statusMessage');

    if (beginAnalysisButton) {
        beginAnalysisButton.addEventListener('click', () => {
            const filePath = fileInput.files[0].path;
            const experimentName = experimentNameInput.value;

            if (filePath && experimentName) {
                ipcRenderer.send('run-virus-command', filePath, experimentName);
                spinner.style.display = 'block';
                statusMessage.textContent = 'Virus analysis running... Please wait.';
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
            spinner.style.display = 'none';
            statusMessage.textContent = 'Virus analysis completed successfully. View results in the Results section.';
        });

        ipcRenderer.on('virus-complete-failure', (event, errorMessage) => {
            spinner.style.display = 'none';
            statusMessage.textContent = 'Virus analysis failed. Check the console for details.';
        });
    }
}

function setupMetagenomicsPage() {
    const beginAnalysisButton = document.getElementById('beginMetagenomicsAnalysis');
    const fileInput = document.getElementById('metagenomicsFileInput');
    const experimentNameInput = document.getElementById('metagenomicsExperimentName');
    const outputElement = document.getElementById('metagenomicsOutput');
    const spinner = document.getElementById('loadingSpinner');
    const statusMessage = document.getElementById('statusMessage');

    if (beginAnalysisButton) {
        beginAnalysisButton.addEventListener('click', () => {
            const filePath = fileInput.files[0].path;
            const experimentName = experimentNameInput.value;

            if (filePath && experimentName) {
                ipcRenderer.send('run-metagenomics-command', filePath, experimentName);
                spinner.style.display = 'block';
                statusMessage.textContent = 'Metagenomics analysis running... Please wait.';
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
            spinner.style.display = 'none';
            statusMessage.textContent = 'Metagenomics analysis completed successfully. View results in the Results section.';
        });

        ipcRenderer.on('metagenomics-complete-failure', (event, errorMessage) => {
            spinner.style.display = 'none';
            statusMessage.textContent = 'Metagenomics analysis failed. Check the console for details.';
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
    const mainContent = document.querySelector('.main-content');

    mainContent.addEventListener('contentUpdated', () => {
        if (window.location.hash === '#results') {
            setupResultsPage();
        }
    });

    document.querySelectorAll('.sidebar a').forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const hrefAttribute = this.getAttribute('href');
            if (hrefAttribute) {
                const page = hrefAttribute.substring(1);
                fetch(page + '.html')
                    .then(response => response.text())
                    .then(data => {
                        mainContent.innerHTML = data;
                        if (page === 'bacteria') {
                            setupBacteriaPage();
                        } else if (page === 'fastqmerge') {
                            setupFastQMergePage();
                        } else if (page === 'virus') {
                            setupVirusPage();
                        } else if (page === 'metagenomics') {
                            setupMetagenomicsPage();
                        } else if (page === 'results') {
                            setupResultsPage();
                        }
                    });
            }
        });
    });
});