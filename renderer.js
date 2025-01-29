/**
 * CGELabs - Renderer Process
 * 
 * This file handles the renderer process functionality, including:
 * - Page-specific setup and functionality
 * - UI state management
 * - Real-time output streaming
 * - User interaction handling
 * - IPC communication with main process
 */

// ============================================================================
// Core Dependencies and Constants
// ============================================================================
const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

const resultsDirectory = '/var/lib/cge_test/results';

// Global state management
let currentProcess = null;
let outputHistory = {};
let currentPage = null;
let pageStates = {};
let currentSortColumn = 'date';  // Default sort by date
let currentSortDirection = 'desc';  // Default newest first

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Shows an element by its ID
 */
function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'block';
}

/**
 * Hides an element by its ID
 */
function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.style.display = 'none';
}

/**
 * Scrolls an element to the bottom
 */
function scrollToBottom(element) {
    requestAnimationFrame(() => {
        element.scrollTop = element.scrollHeight;
    });
}


/**
 * Validates experiment name for allowed characters
 * @param {string} name - The experiment name to validate
 * @returns {Object} - { isValid: boolean, message: string }
 */
function validateExperimentName(name) {
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!name) {
        return { isValid: false, message: 'Experiment name is required.' };
    }
    if (!validPattern.test(name)) {
        return { 
            isValid: false, 
            message: 'Experiment name can only contain letters, numbers, underscores, and hyphens.' 
        };
    }
    return { isValid: true, message: '' };
}

// ============================================================================
// Results Page Management
// ============================================================================

/**
 * Sets up the results page functionality
 */
function setupResultsPage() {
    console.log('Setting up results page');
    showElement('loadingResults');
    hideElement('errorResults');
    hideElement('resultsTable');

    // Setup header with search and directory button
    const headerDiv = document.querySelector('.results-header') || document.createElement('div');
    headerDiv.className = 'results-header';
    headerDiv.innerHTML = `
        <div class="search-container">
            <input type="text" id="searchResults" placeholder="Search results..." class="search-input">
        </div>
        <button id="openResultsDir" class="directory-button">Open Results Directory</button>
    `;
    const tableContainer = document.getElementById('resultsTable').parentElement;
    tableContainer.insertBefore(headerDiv, tableContainer.firstChild);

    // Directory button listener
    document.getElementById('openResultsDir').addEventListener('click', () => {
        ipcRenderer.invoke('open-results-directory');
    });

    let allResults = []; // Store all results for filtering

    // Load and display results
    ipcRenderer.invoke('get-results').then(resultFolders => {
        hideElement('loadingResults');
        showElement('resultsTable');
        allResults = resultFolders;

        const searchInput = document.getElementById('searchResults');
        searchInput.addEventListener('input', () => {
            updateResultsTable(filterResults(searchInput.value, allResults));
        });

        updateResultsTable(resultFolders);
    }).catch(error => {
        console.error('Error loading results:', error);
        hideElement('loadingResults');
        showElement('errorResults');
    });
}

/**
 * Updates the results table with filtered data
 */
function updateResultsTable(resultFolders) {
    const tableBody = document.getElementById('resultsTable').querySelector('tbody');
    const tableHead = document.getElementById('resultsTable').querySelector('thead tr');
    
    // Helper function to get sort icon
    function getSortIcon(column) {
        if (currentSortColumn !== column) return '&nbsp;&#8645;'; // Show both up/down for unsorted
        return currentSortDirection === 'asc' ? '&nbsp;&#8593;' : '&nbsp;&#8595;'; // Show up or down arrow
    }
    
    // Update headers with sort indicators
    tableHead.innerHTML = `
        <th class="sortable" data-sort="name">
            Analysis Name <span class="sort-icon">${getSortIcon('name')}</span>
        </th>
        <th class="sortable" data-sort="toolType">
            Tool Type <span class="sort-icon">${getSortIcon('toolType')}</span>
        </th>
        <th class="sortable" data-sort="date">
            Date <span class="sort-icon">${getSortIcon('date')}</span>
        </th>
        <th>Text Report</th>
        <th>PDF Report</th>
        <th>Actions</th>
    `;

    // Add click handlers for sortable headers
    tableHead.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.sort;
            if (currentSortColumn === column) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = column;
                currentSortDirection = 'desc';
            }
            updateResultsTable(resultFolders);
        });
    });

    // Sort the results
    resultFolders.sort((a, b) => {
        let comparison = 0;
        switch (currentSortColumn) {
            case 'name':
                comparison = a.name.localeCompare(b.name);
                break;
            case 'toolType':
                comparison = a.toolType.localeCompare(b.toolType);
                break;
            case 'date':
                comparison = new Date(a.date) - new Date(b.date);  // Changed from b.date - a.date
                break;
            default:
                comparison = 0;
        }
        return currentSortDirection === 'asc' ? comparison : -comparison;  // No change needed here
    });
    
    tableBody.innerHTML = '';
    
    resultFolders.forEach(folderInfo => {
        const row = tableBody.insertRow();
        
        // Analysis Name with preview toggle
        const cellName = row.insertCell();
        const nameContainer = document.createElement('div');
        nameContainer.className = 'name-container';
        nameContainer.innerHTML = `
            <div class="name-with-indicator">
                <span class="folder-name">${folderInfo.name}</span>
                <span class="details-text">Click to view details</span>
            </div>
        `;
        cellName.appendChild(nameContainer);
        
        // Tool Type
        const cellType = row.insertCell();
        cellType.textContent = folderInfo.toolType;
        
        // Date - Format to 24H clock
        const cellDate = row.insertCell();
        const date = new Date(folderInfo.date);
        cellDate.textContent = date.toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'numeric', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            hour12: false 
        });
        
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
        
        // Delete button
        const cellActions = row.insertCell();
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.className = 'delete-button';
        deleteButton.addEventListener('click', async () => {
            if (confirm(`Are you sure you want to delete ${folderInfo.name}?`)) {
                const success = await ipcRenderer.invoke('delete-result', folderInfo.name);
                if (success) {
                    setupResultsPage();
                } else {
                    alert('Failed to delete result');
                }
            }
        });
        cellActions.appendChild(deleteButton);

        // Preview row
        const previewRow = tableBody.insertRow();
        previewRow.className = 'preview-row hidden';
        const previewCell = previewRow.insertCell();
        previewCell.colSpan = 6;
        previewCell.innerHTML = `<div class="preview-content">Loading preview...</div>`;

        // Preview functionality
        cellName.addEventListener('click', async () => {
            const detailsText = nameContainer.querySelector('.details-text');
            const content = previewCell.querySelector('.preview-content');
            
            if (previewRow.classList.contains('hidden')) {
                previewRow.classList.remove('hidden');
                detailsText.textContent = 'Click to hide details';
                
                try {
                    const reportPath = path.join(resultsDirectory, folderInfo.name, 'report.txt');
                    const reportContent = await fs.promises.readFile(reportPath, 'utf8');
                    
                    const lines = reportContent.split('\n');
                    const titleLine = lines.find(line => line.includes('Analysis report:'));
                    const templateLine = lines.find(line => line.includes('Template:'));
                    const identityLine = lines.find(line => line.includes('Identity:'));
                    
                    if (templateLine && identityLine) {
                        const preview = `
                            <div class="preview-header">Analysis Details</div>
                            <div class="preview-details">
                                <div><strong>Species:</strong> ${templateLine.split('Template:')[1].trim().split(' chromosome')[0]}</div>
                                <div><strong>Match Quality:</strong> ${identityLine.trim()}</div>
                            </div>
                        `;
                        content.innerHTML = preview;
                    } else {
                        content.innerHTML = '<div class="preview-error">No species identification available</div>';
                    }
                } catch (error) {
                    content.innerHTML = '<div class="preview-error">Error loading preview</div>';
                }
            } else {
                previewRow.classList.add('hidden');
                detailsText.textContent = 'Click to view details';
            }
        });
    });
}

// ============================================================================
// PDF Viewer Setup
// ============================================================================

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

// ============================================================================
// Analysis Page Setup Functions
// ============================================================================

/**
 * Sets up the bacteria analysis page
 */
function setupBacteriaPage() {
    // Remove any existing listeners first
    ipcRenderer.removeAllListeners('isolate-command-output');
    ipcRenderer.removeAllListeners('isolate-complete-success');
    ipcRenderer.removeAllListeners('isolate-complete-failure');

    const beginAnalysisButton = document.getElementById('beginAnalysis');
    const fileInput = document.getElementById('fileInput');
    const experimentNameInput = document.getElementById('experimentName');
    const outputElement = document.getElementById('output');
    const spinner = document.getElementById('loadingSpinner');
    const statusMessage = document.getElementById('statusMessage');
    const resultButtons = document.getElementById('resultButtons');
    const openResults = document.getElementById('openResults');
    const openPdf = document.getElementById('openPdf');
    const openText = document.getElementById('openText');
    const cancelButton = document.getElementById('cancelAnalysis');
    const nameWarning = document.getElementById('nameWarning');

    // Check for existing folder and validate experiment name
    if (experimentNameInput) {
        experimentNameInput.addEventListener('input', () => {
            const name = experimentNameInput.value;
            const validation = validateExperimentName(name);
            const folderPath = path.join('/var/lib/cge_test/results', name);
            
            if (!validation.isValid) {
                nameWarning.textContent = validation.message;
                nameWarning.style.display = 'block';
                nameWarning.style.color = '#e74c3c';  // Red color for warning
                beginAnalysisButton.disabled = true;
            } else if (name && fs.existsSync(folderPath)) {
                nameWarning.textContent = 'A folder with this name already exists. Please choose a different name.';
                nameWarning.style.display = 'block';
                nameWarning.style.color = '#e74c3c';
                beginAnalysisButton.disabled = true;
            } else {
                nameWarning.style.display = 'none';
                beginAnalysisButton.disabled = false;
            }
        });
    }

    // File size check
    if (fileInput) {
        const fileSizeWarning = document.getElementById('fileSizeWarning');
        fileInput.addEventListener('change', async () => {
            if (fileInput.files[0]) {
                const result = await ipcRenderer.invoke('check-file-size', fileInput.files[0].path);
                if (result.warning) {
                    fileSizeWarning.textContent = result.message;
                    fileSizeWarning.style.display = 'block';
                    fileSizeWarning.style.color = '#e74c3c';  // Red warning color
                    statusMessage.textContent = 'Warning: File size issue detected';
                    statusMessage.style.color = '#e74c3c';
                } else {
                    fileSizeWarning.style.display = 'none';
                    statusMessage.textContent = 'Ready to start analysis...';
                    statusMessage.style.color = '';
                }
            } else {
                fileSizeWarning.style.display = 'none';
            }
        });
    }

    // Restore previous output if it exists
    const experimentName = experimentNameInput ? experimentNameInput.value : '';
    if (outputElement && outputHistory[experimentName]) {
        outputElement.textContent = outputHistory[experimentName];
    }

    // Begin analysis button handler
    if (beginAnalysisButton) {
        beginAnalysisButton.addEventListener('click', () => {
            const filePath = fileInput.files[0]?.path;
            const experimentName = experimentNameInput.value;

            if (filePath && experimentName) {
                if (resultButtons) {
                    resultButtons.style.display = 'none';
                }
                outputHistory[experimentName] = '';
                outputElement.textContent = '';
                currentProcess = experimentName;
                cancelButton.style.display = 'block';
                ipcRenderer.send('run-isolate-command', filePath, experimentName);
                spinner.style.display = 'block';
                statusMessage.textContent = 'Analyzing... Please wait.';
            } else {
                console.log("File or experiment name not provided");
            }
        });
    }

    // Cancel analysis button handler
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            if (currentProcess) {
                const folderPath = path.join('/var/lib/cge_test/results', currentProcess);
                ipcRenderer.send('cancel-analysis', currentProcess, folderPath);
                cancelButton.style.display = 'none';
                spinner.style.display = 'none';
                statusMessage.textContent = 'Analysis cancelled.';
            }
        });
    }

    // Results buttons handlers
    if (openResults) {
        openResults.addEventListener('click', () => {
            const experimentName = experimentNameInput.value;
            const folderPath = path.join('/var/lib/cge_test/results', experimentName);
            ipcRenderer.send('open-results-directory', folderPath);
        });
    }

    if (openPdf) {
        openPdf.addEventListener('click', () => {
            const experimentName = experimentNameInput.value;
            const pdfPath = path.join('/var/lib/cge_test/results', experimentName, `${experimentName}_report.pdf`);
            ipcRenderer.send('show-pdf', pdfPath);
        });
    }

    if (openText) {
        openText.addEventListener('click', () => {
            const experimentName = experimentNameInput.value;
            const textPath = path.join('/var/lib/cge_test/results', experimentName, 'report.txt');
            ipcRenderer.send('open-file', textPath);
        });
    }

    // Event listeners for command output and completion
    ipcRenderer.on('isolate-command-output', (event, { stdout, stderr }) => {
        if (outputElement && currentProcess) {
            if (stdout) {
                outputHistory[currentProcess] = outputHistory[currentProcess] || '';
                outputHistory[currentProcess] += stdout + '\n';
                outputElement.textContent = outputHistory[currentProcess];
            }
            if (stderr) {
                outputHistory[currentProcess] = outputHistory[currentProcess] || '';
                outputHistory[currentProcess] += stderr + '\n';
                outputElement.textContent = outputHistory[currentProcess];
            }
            scrollToBottom(outputElement);
        }
    });

    ipcRenderer.on('isolate-complete-success', () => {
        spinner.style.display = 'none';
        cancelButton.style.display = 'none';
        statusMessage.textContent = 'Analysis completed successfully. View results in the Results section.';
        if (resultButtons) {
            resultButtons.style.display = 'block';
        }
        currentProcess = null;
    });

    ipcRenderer.on('isolate-complete-failure', (event, errorMessage) => {
        spinner.style.display = 'none';
        cancelButton.style.display = 'none';
        statusMessage.textContent = 'Analysis failed. Check the console for details.';
        if (resultButtons) {
            resultButtons.style.display = 'none';
        }
        currentProcess = null;
    });

    // Save page state if needed
    if (currentPage === 'bacteria') {
        savePageState('bacteria');
    }
}

/**
 * Sets up the virus analysis page
 */
function setupVirusPage() {
    // Remove any existing listeners first
    ipcRenderer.removeAllListeners('virus-command-output');
    ipcRenderer.removeAllListeners('virus-complete-success');
    ipcRenderer.removeAllListeners('virus-complete-failure');

    const beginAnalysisButton = document.getElementById('beginVirusAnalysis');
    const fileInput = document.getElementById('virusFileInput');
    const experimentNameInput = document.getElementById('virusExperimentName');
    const outputElement = document.getElementById('virusOutput');
    const spinner = document.getElementById('loadingSpinner');
    const statusMessage = document.getElementById('statusMessage');
    const resultButtons = document.getElementById('resultButtons');
    const openResults = document.getElementById('openResults');
    const openPdf = document.getElementById('openPdf');
    const openText = document.getElementById('openText');
    const cancelButton = document.getElementById('cancelAnalysis');
    const nameWarning = document.getElementById('nameWarning');

    // Check for existing folder on experiment name change
    if (experimentNameInput) {
        experimentNameInput.addEventListener('input', () => {
            const name = experimentNameInput.value;
            const validation = validateExperimentName(name);
            const folderPath = path.join('/var/lib/cge_test/results', name);
            
            if (!validation.isValid) {
                nameWarning.textContent = validation.message;
                nameWarning.style.display = 'block';
                nameWarning.style.color = '#e74c3c';  // Red color for warning
                beginAnalysisButton.disabled = true;
            } else if (name && fs.existsSync(folderPath)) {
                nameWarning.textContent = 'A folder with this name already exists. Please choose a different name.';
                nameWarning.style.display = 'block';
                nameWarning.style.color = '#e74c3c';
                beginAnalysisButton.disabled = true;
            } else {
                nameWarning.style.display = 'none';
                beginAnalysisButton.disabled = false;
            }
        });
    }

    // File size check
    if (fileInput) {
        const fileSizeWarning = document.getElementById('fileSizeWarning');
        fileInput.addEventListener('change', async () => {
            if (fileInput.files[0]) {
                const result = await ipcRenderer.invoke('check-file-size', fileInput.files[0].path);
                if (result.warning) {
                    fileSizeWarning.textContent = result.message;
                    fileSizeWarning.style.display = 'block';
                    fileSizeWarning.style.color = '#e74c3c';  // Red warning color
                    statusMessage.textContent = 'Warning: File size issue detected';
                    statusMessage.style.color = '#e74c3c';
                } else {
                    fileSizeWarning.style.display = 'none';
                    statusMessage.textContent = 'Ready to start analysis...';
                    statusMessage.style.color = '';
                }
            } else {
                fileSizeWarning.style.display = 'none';
            }
        });
    }

    // Restore previous output if it exists
    const experimentName = experimentNameInput ? experimentNameInput.value : '';
    if (outputElement && outputHistory[experimentName]) {
        outputElement.textContent = outputHistory[experimentName];
    }

    // Begin analysis button handler
    if (beginAnalysisButton) {
        beginAnalysisButton.addEventListener('click', () => {
            const filePath = fileInput.files[0]?.path;
            const experimentName = experimentNameInput.value;

            if (filePath && experimentName) {
                if (resultButtons) {
                    resultButtons.style.display = 'none';
                }
                outputHistory[experimentName] = '';
                outputElement.textContent = '';
                currentProcess = experimentName;
                cancelButton.style.display = 'block';
                ipcRenderer.send('run-virus-command', filePath, experimentName);
                spinner.style.display = 'block';
                statusMessage.textContent = 'Analyzing... Please wait.';
            } else {
                console.log("File or experiment name not provided");
            }
        });
    }

    // Cancel analysis button handler
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            if (currentProcess) {
                const folderPath = path.join('/var/lib/cge_test/results', currentProcess);
                ipcRenderer.send('cancel-analysis', currentProcess, folderPath);
                cancelButton.style.display = 'none';
                spinner.style.display = 'none';
                statusMessage.textContent = 'Analysis cancelled.';
            }
        });
    }

    // Results buttons handlers
    if (openResults) {
        openResults.addEventListener('click', () => {
            const experimentName = experimentNameInput.value;
            const folderPath = path.join('/var/lib/cge_test/results', experimentName);
            ipcRenderer.send('open-results-directory', folderPath);
        });
    }

    if (openPdf) {
        openPdf.addEventListener('click', () => {
            const experimentName = experimentNameInput.value;
            const pdfPath = path.join('/var/lib/cge_test/results', experimentName, `${experimentName}_report.pdf`);
            ipcRenderer.send('show-pdf', pdfPath);
        });
    }

    if (openText) {
        openText.addEventListener('click', () => {
            const experimentName = experimentNameInput.value;
            const textPath = path.join('/var/lib/cge_test/results', experimentName, 'report.txt');
            ipcRenderer.send('open-file', textPath);
        });
    }

    // Event listeners for command output and completion
    ipcRenderer.on('virus-command-output', (event, { stdout, stderr }) => {
        if (outputElement && currentProcess) {
            if (stdout) {
                outputHistory[currentProcess] = outputHistory[currentProcess] || '';
                outputHistory[currentProcess] += stdout + '\n';
                outputElement.textContent = outputHistory[currentProcess];
            }
            if (stderr) {
                outputHistory[currentProcess] = outputHistory[currentProcess] || '';
                outputHistory[currentProcess] += stderr + '\n';
                outputElement.textContent = outputHistory[currentProcess];
            }
            scrollToBottom(outputElement);
        }
    });

    ipcRenderer.on('virus-complete-success', () => {
        spinner.style.display = 'none';
        cancelButton.style.display = 'none';
        statusMessage.textContent = 'Analysis completed successfully. View results in the Results section.';
        if (resultButtons) {
            resultButtons.style.display = 'block';
        }
        currentProcess = null;
    });

    ipcRenderer.on('virus-complete-failure', (event, errorMessage) => {
        spinner.style.display = 'none';
        cancelButton.style.display = 'none';
        statusMessage.textContent = 'Analysis failed. Check the console for details.';
        if (resultButtons) {
            resultButtons.style.display = 'none';
        }
        currentProcess = null;
    });

    // Save page state if needed
    if (currentPage === 'virus') {
        savePageState('virus');
    }
}

/**
 * Sets up the metagenomics analysis page
 */
function setupMetagenomicsPage() {
    // Remove any existing listeners first
    ipcRenderer.removeAllListeners('metagenomics-command-output');
    ipcRenderer.removeAllListeners('metagenomics-complete-success');
    ipcRenderer.removeAllListeners('metagenomics-complete-failure');

    const beginAnalysisButton = document.getElementById('beginMetagenomicsAnalysis');
    const fileInput = document.getElementById('metagenomicsFileInput');
    const experimentNameInput = document.getElementById('metagenomicsExperimentName');
    const outputElement = document.getElementById('metagenomicsOutput');
    const spinner = document.getElementById('loadingSpinner');
    const statusMessage = document.getElementById('statusMessage');
    const resultButtons = document.getElementById('resultButtons');
    const openResults = document.getElementById('openResults');
    const openPdf = document.getElementById('openPdf');
    const openText = document.getElementById('openText');
    const cancelButton = document.getElementById('cancelAnalysis');
    const nameWarning = document.getElementById('nameWarning');

    // Check for existing folder on experiment name change
    if (experimentNameInput) {
        experimentNameInput.addEventListener('input', () => {
            const name = experimentNameInput.value;
            const validation = validateExperimentName(name);
            const folderPath = path.join('/var/lib/cge_test/results', name);
            
            if (!validation.isValid) {
                nameWarning.textContent = validation.message;
                nameWarning.style.display = 'block';
                nameWarning.style.color = '#e74c3c';  // Red color for warning
                beginAnalysisButton.disabled = true;
            } else if (name && fs.existsSync(folderPath)) {
                nameWarning.textContent = 'A folder with this name already exists. Please choose a different name.';
                nameWarning.style.display = 'block';
                nameWarning.style.color = '#e74c3c';
                beginAnalysisButton.disabled = true;
            } else {
                nameWarning.style.display = 'none';
                beginAnalysisButton.disabled = false;
            }
        });
    }

    // File size check
    if (fileInput) {
        const fileSizeWarning = document.getElementById('fileSizeWarning');
        fileInput.addEventListener('change', async () => {
            if (fileInput.files[0]) {
                const result = await ipcRenderer.invoke('check-file-size', fileInput.files[0].path);
                if (result.warning) {
                    fileSizeWarning.textContent = result.message;
                    fileSizeWarning.style.display = 'block';
                    fileSizeWarning.style.color = '#e74c3c';  // Red warning color
                    statusMessage.textContent = 'Warning: File size issue detected';
                    statusMessage.style.color = '#e74c3c';
                } else {
                    fileSizeWarning.style.display = 'none';
                    statusMessage.textContent = 'Ready to start analysis...';
                    statusMessage.style.color = '';
                }
            } else {
                fileSizeWarning.style.display = 'none';
            }
        });
    }

    // Restore previous output if it exists
    const experimentName = experimentNameInput ? experimentNameInput.value : '';
    if (outputElement && outputHistory[experimentName]) {
        outputElement.textContent = outputHistory[experimentName];
    }

    // Begin analysis button handler
    if (beginAnalysisButton) {
        beginAnalysisButton.addEventListener('click', () => {
            const filePath = fileInput.files[0]?.path;
            const experimentName = experimentNameInput.value;

            if (filePath && experimentName) {
                if (resultButtons) {
                    resultButtons.style.display = 'none';
                }
                outputHistory[experimentName] = '';
                outputElement.textContent = '';
                currentProcess = experimentName;
                cancelButton.style.display = 'block';
                ipcRenderer.send('run-metagenomics-command', filePath, experimentName);
                spinner.style.display = 'block';
                statusMessage.textContent = 'Analyzing... Please wait.';
            } else {
                console.log("File or experiment name not provided");
            }
        });
    }

    // Cancel analysis button handler
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            if (currentProcess) {
                const folderPath = path.join('/var/lib/cge_test/results', currentProcess);
                ipcRenderer.send('cancel-analysis', currentProcess, folderPath);
                cancelButton.style.display = 'none';
                spinner.style.display = 'none';
                statusMessage.textContent = 'Analysis cancelled.';
            }
        });
    }

    // Results buttons handlers
    if (openResults) {
        openResults.addEventListener('click', () => {
            const experimentName = experimentNameInput.value;
            const folderPath = path.join('/var/lib/cge_test/results', experimentName);
            ipcRenderer.send('open-results-directory', folderPath);
        });
    }

    if (openPdf) {
        openPdf.addEventListener('click', () => {
            const experimentName = experimentNameInput.value;
            const pdfPath = path.join('/var/lib/cge_test/results', experimentName, `${experimentName}_report.pdf`);
            ipcRenderer.send('show-pdf', pdfPath);
        });
    }

    if (openText) {
        openText.addEventListener('click', () => {
            const experimentName = experimentNameInput.value;
            const textPath = path.join('/var/lib/cge_test/results', experimentName, 'report.txt');
            ipcRenderer.send('open-file', textPath);
        });
    }

    // Event listeners for command output and completion
    ipcRenderer.on('metagenomics-command-output', (event, { stdout, stderr }) => {
        if (outputElement && currentProcess) {
            if (stdout) {
                outputHistory[currentProcess] = outputHistory[currentProcess] || '';
                outputHistory[currentProcess] += stdout + '\n';
                outputElement.textContent = outputHistory[currentProcess];
            }
            if (stderr) {
                outputHistory[currentProcess] = outputHistory[currentProcess] || '';
                outputHistory[currentProcess] += stderr + '\n';
                outputElement.textContent = outputHistory[currentProcess];
            }
            scrollToBottom(outputElement);
        }
    });

    ipcRenderer.on('metagenomics-complete-success', () => {
        spinner.style.display = 'none';
        cancelButton.style.display = 'none';
        statusMessage.textContent = 'Analysis completed successfully. View results in the Results section.';
        if (resultButtons) {
            resultButtons.style.display = 'block';
        }
        currentProcess = null;
    });

    ipcRenderer.on('metagenomics-complete-failure', (event, errorMessage) => {
        spinner.style.display = 'none';
        cancelButton.style.display = 'none';
        statusMessage.textContent = 'Analysis failed. Check the console for details.';
        if (resultButtons) {
            resultButtons.style.display = 'none';
        }
        currentProcess = null;
    });

    // Save page state if needed
    if (currentPage === 'metagenomics') {
        savePageState('metagenomics');
    }
}

// ============================================================================
// Event Listeners and Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.querySelector('.main-content');
    
    // Check if we're on index page and add class
    if (!window.location.hash) {
        document.body.classList.add('index-page');
    }
    
    // Special handling for PDF viewer page
    if (window.location.pathname.endsWith('report-viewer.html')) {
        setupPdfViewer();
        return;
    }
    
    // Content update handler
    mainContent.addEventListener('contentUpdated', () => {
        if (window.location.hash === '#results') {
            setupResultsPage();
        }
    });
    
    // Make feature cards clickable if they exist (on index page)
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('click', function() {
            document.body.classList.remove('index-page');
            
            // Get the text from h3 and convert to lowercase for page name
            const heading = this.querySelector('h3').textContent.toLowerCase();
            let pageName;
            
            // Map the heading text to the correct page name
            switch(heading) {
                case 'bacterial analysis':
                    pageName = 'bacteria';
                    break;
                case 'viral analysis':
                    pageName = 'virus';
                    break;
                case 'metagenomics':
                    pageName = 'metagenomics';
                    break;
                case 'results':
                    pageName = 'results';
                    break;
                case 'fastq tools':
                    pageName = 'fastqmerge';
                    break;
                default:
                    pageName = heading;
            }
            
            fetch(pageName + '.html')
                .then(response => response.text())
                .then(data => {
                    mainContent.innerHTML = data;
                    mainContent.dispatchEvent(new Event('contentUpdated'));
                    
                    if (pageName === 'bacteria') {
                        setupBacteriaPage();
                    } else if (pageName === 'virus') {
                        setupVirusPage();
                    } else if (pageName === 'metagenomics') {
                        setupMetagenomicsPage();
                    } else if (pageName === 'results') {
                        setupResultsPage();
                    }
                })
                .catch(error => {
                    console.error('Error loading page:', error);
                    mainContent.innerHTML = '<div class="error-message">Error loading page</div>';
                });
        });
    });
    
    // Setup navigation
    document.querySelectorAll('.sidebar a').forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            document.body.classList.remove('index-page');
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




































// ============================================================================
// Currently Unused Functions - Kept for Reference
// ============================================================================

/**
 * Creates a status cell for the results table
 */
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

/**
 * Filters results based on search term
 */
function filterResults(searchTerm, results) {
    if (!searchTerm) return results;
    searchTerm = searchTerm.toLowerCase();
    return results.filter(result => 
        result.name.toLowerCase().includes(searchTerm) ||
        result.toolType.toLowerCase().includes(searchTerm) ||
        new Date(result.date).toLocaleString().toLowerCase().includes(searchTerm)
    );
}

/**
 * Saves the current state of a page
 */
function savePageState(page) {
    if (!page) return;
    
    pageStates[page] = {
        output: document.getElementById('output')?.textContent || '',
        experimentName: document.getElementById('experimentName')?.value || '',
        statusMessage: document.getElementById('statusMessage')?.textContent || '',
        showSpinner: document.getElementById('loadingSpinner')?.style.display === 'block',
        showResultButtons: document.getElementById('resultButtons')?.style.display === 'block',
        showCancelButton: document.getElementById('cancelAnalysis')?.style.display === 'block'
    };
}

/**
 * Loads the saved state of a page
 */
function loadPageState(page) {
    if (!page || !pageStates[page]) return;
    
    const state = pageStates[page];
    const outputElement = document.getElementById('output');
    const experimentNameInput = document.getElementById('experimentName');
    const statusMessage = document.getElementById('statusMessage');
    const spinner = document.getElementById('loadingSpinner');
    const resultButtons = document.getElementById('resultButtons');
    const cancelButton = document.getElementById('cancelAnalysis');

    if (outputElement) outputElement.textContent = state.output;
    if (experimentNameInput) experimentNameInput.value = state.experimentName;
    if (statusMessage) statusMessage.textContent = state.statusMessage;
    if (spinner) spinner.style.display = state.showSpinner ? 'block' : 'none';
    if (resultButtons) resultButtons.style.display = state.showResultButtons ? 'block' : 'none';
    if (cancelButton) cancelButton.style.display = state.showCancelButton ? 'block' : 'none';
}
