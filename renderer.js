const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

const resultsDirectory = '/var/lib/cge/results';

// Utility functions
function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'block';
}

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'none';
}

function scrollToBottom(element) {
    requestAnimationFrame(() => {
        element.scrollTop = element.scrollHeight;
    });
}

function createStatusCell(status) {
    const cell = document.createElement('td');
    const statusDiv = document.createElement('div');
    statusDiv.className = 'status-cell';
    
    const indicator = document.createElement('span');
    indicator.className = 'status-indicator';
    
    switch(status) {
        case 'complete':
            indicator.classList.add('status-success');
            statusDiv.appendChild(indicator);
            statusDiv.appendChild(document.createTextNode('Complete'));
            break;
        case 'pending':
            indicator.classList.add('status-pending');
            statusDiv.appendChild(indicator);
            statusDiv.appendChild(document.createTextNode('Processing'));
            break;
        default:
            indicator.classList.add('status-error');
            statusDiv.appendChild(indicator);
            statusDiv.appendChild(document.createTextNode('Error'));
    }
    
    cell.appendChild(statusDiv);
    return cell;
}

function setupResultsPage() {
    console.log('Setting up results page');
    showElement('loadingResults');
    hideElement('errorResults');
    hideElement('resultsTable');

    ipcRenderer.invoke('get-results').then(resultFolders => {
        hideElement('loadingResults');
        showElement('resultsTable');

        const tableBody = document.getElementById('resultsTable').querySelector('tbody');
        tableBody.innerHTML = '';
        
        resultFolders.forEach(folderInfo => {
            const row = tableBody.insertRow();
            
            // Analysis Name
            const cellName = row.insertCell();
            cellName.textContent = folderInfo.name;
            
            // Text Report
            const cellTextReport = row.insertCell();
            if (folderInfo.reportExists) {
                const textLink = document.createElement('a');
                textLink.href = '#';
                textLink.textContent = 'Open Text Report';
                textLink.addEventListener('click', (event) => {
                    event.preventDefault();
                    ipcRenderer.send('open-file', `${resultsDirectory}/${folderInfo.name}/report.txt`);
                });
                cellTextReport.appendChild(textLink);
            } else {
                cellTextReport.textContent = 'No report available';
            }
            
            // PDF Report
            const cellPdfReport = row.insertCell();
            if (folderInfo.pdfExists) {
                const viewLink = document.createElement('a');
                viewLink.href = '#';
                viewLink.textContent = 'View in App';
                viewLink.addEventListener('click', (event) => {
                    event.preventDefault();
                    const pdfPath = path.join(resultsDirectory, folderInfo.name, `${folderInfo.name}_report.pdf`);
                    ipcRenderer.send('show-pdf', pdfPath);
                });
                
                const openLink = document.createElement('a');
                openLink.href = '#';
                openLink.textContent = 'Open External';
                openLink.addEventListener('click', (event) => {
                    event.preventDefault();
                    const pdfPath = path.join(resultsDirectory, folderInfo.name, `${folderInfo.name}_report.pdf`);
                    ipcRenderer.send('open-file', pdfPath);
                });
                
                cellPdfReport.appendChild(viewLink);
                cellPdfReport.appendChild(document.createTextNode(' | '));
                cellPdfReport.appendChild(openLink);
            } else {
                cellPdfReport.textContent = 'No PDF report available';
            }
            
            // Status
            row.appendChild(createStatusCell(folderInfo.status));
        });
    }).catch(error => {
        console.error('Error loading results:', error);
        hideElement('loadingResults');
        showElement('errorResults');
    });
}

function setupPdfViewer() {
    const backButton = document.getElementById('backButton');
    const openExternal = document.getElementById('openExternal');
    const pdfViewer = document.getElementById('pdfViewer');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    
    if (backButton) {
        backButton.addEventListener('click', () => {
            ipcRenderer.send('show-results');
        });
    }

    if (openExternal) {
        openExternal.addEventListener('click', () => {
            const pdfPath = pdfViewer.getAttribute('data-path');
            if (pdfPath) {
                ipcRenderer.send('open-file', pdfPath);
            }
        });
    }

    if (errorMessage) {
        errorMessage.style.display = 'none';
    }

    ipcRenderer.on('load-pdf', (event, pdfPath) => {
        if (loadingSpinner) loadingSpinner.style.display = 'block';
        if (errorMessage) errorMessage.style.display = 'none';
        
        if (pdfViewer) {
            pdfViewer.setAttribute('data-path', pdfPath);
            pdfViewer.src = pdfPath;
            
            pdfViewer.onload = () => {
                if (loadingSpinner) loadingSpinner.style.display = 'none';
            };
            
            pdfViewer.onerror = () => {
                if (loadingSpinner) loadingSpinner.style.display = 'none';
                if (errorMessage) errorMessage.style.display = 'block';
            };
        }
    });

    ipcRenderer.on('pdf-error', (event, message) => {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
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

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.querySelector('.main-content');

    if (window.location.pathname.endsWith('report-viewer.html')) {
        setupPdfViewer();
        return;
    }

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
                        mainContent.dispatchEvent(new Event('contentUpdated'));
                        if (page === 'bacteria') {
                            setupBacteriaPage();
                        } else if (page === 'virus') {
                            setupVirusPage();
                        } else if (page === 'metagenomics') {
                            setupMetagenomicsPage();
                        } else if (page === 'results') {
                            setupResultsPage();
                        }
                    })
                    .catch(error => {
                        console.error('Error loading page:', error);
                        mainContent.innerHTML = '<div class="error-message">Error loading page</div>';
                    });
            }
        });
    });
});