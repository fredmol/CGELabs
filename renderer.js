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
// UI Components
// ============================================================================

/**
 * Sets up a collapsible console
 */
function setupCollapsibleConsole(headerId, bodyId, toggleId, statusId, outputId) {
    const header = document.getElementById(headerId);
    const body = document.getElementById(bodyId);
    const toggle = document.getElementById(toggleId);
    const status = document.getElementById(statusId);
    const output = document.getElementById(outputId);
    
    if (!header || !body || !toggle || !status || !output) return;
    
    // Toggle console visibility
    const toggleConsole = () => {
        if (body.classList.contains('expanded')) {
            body.classList.remove('expanded');
            toggle.textContent = 'Show';
        } else {
            body.classList.add('expanded');
            toggle.textContent = 'Hide';
            if (output) scrollToBottom(output);
        }
    };

    // Setup click handlers
    header.addEventListener('click', toggleConsole);
    toggle.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent double toggle from header click
        toggleConsole();
    });

    // Initialize as collapsed
    body.classList.remove('expanded');
    toggle.textContent = 'Show';
}

/**
 * Updates the console status with the latest output line
 */
function updateConsoleStatus(statusId, text) {
    const status = document.getElementById(statusId);
    if (!status) return;
    
    // Find the last non-empty line
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        // Truncate if too long
        status.textContent = lastLine.length > 100 ? lastLine.substring(0, 97) + '...' : lastLine;
    }
}

/**
 * Sets up the collapsible info panel
 */
function setupInfoPanel() {
    const infoToggle = document.getElementById('infoToggle');
    const infoPanel = document.getElementById('infoPanel');
    
    if (infoToggle && infoPanel) {
        infoToggle.addEventListener('click', () => {
            infoToggle.classList.toggle('active');
            infoPanel.classList.toggle('active');
        });
    }
}

/**
 * Updates the status indicator based on current state
 */
function updateStatusIndicator(state, message = null) {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusTitle = statusIndicator ? statusIndicator.querySelector('.status-title') : null;
    const statusIcon = statusIndicator ? statusIndicator.querySelector('.status-icon') : null;
    const iconElement = statusIcon ? statusIcon.querySelector('i') : null;
    
    if (!statusIndicator || !statusTitle || !statusIcon || !iconElement) return;
    
    // Reset all classes
    statusIcon.classList.remove('waiting', 'running', 'success', 'error');
    
    switch (state) {
        case 'waiting':
            statusTitle.textContent = 'Waiting to start';
            statusIcon.classList.add('waiting');
            iconElement.className = 'fas fa-clock';
            break;
        case 'running':
            statusTitle.textContent = 'Analysis in progress';
            statusIcon.classList.add('running');
            iconElement.className = 'fas fa-sync-alt fa-spin';
            break;
        case 'success':
            statusTitle.textContent = 'Analysis complete';
            statusIcon.classList.add('success');
            iconElement.className = 'fas fa-check-circle';
            break;
        case 'error':
            statusTitle.textContent = 'Analysis failed';
            statusIcon.classList.add('error');
            iconElement.className = 'fas fa-exclamation-circle';
            break;
    }
    
    // If message is provided, update status message too
    if (message) {
        const statusMessageElement = document.getElementById('statusMessage');
        if (statusMessageElement) {
            statusMessageElement.textContent = message;
        }
        
        // Also update console status with complementary information
        const consoleStatus = document.getElementById('consoleStatus') || 
                             document.getElementById('virusConsoleStatus') || 
                             document.getElementById('metaConsoleStatus');
        
        if (consoleStatus) {
            // Use different messages for console status to avoid duplication
            if (state === 'success') {
                consoleStatus.textContent = 'Process completed. Check console for details.';
            } else if (state === 'error') {
                consoleStatus.textContent = 'Error occurred. See console output for details.';
            } else if (state === 'running') {
                consoleStatus.textContent = 'Executing commands...';
            } else {
                consoleStatus.textContent = 'Waiting for analysis to start...';
            }
        }
    }
}

/**
 * Toggles QC settings panel visibility
 */
function setupQcSettingsToggle(toggleButtonId, settingsPanelId) {
    const toggleButton = document.getElementById(toggleButtonId);
    const settingsPanel = document.getElementById(settingsPanelId);
    
    if (toggleButton && settingsPanel) {
        toggleButton.addEventListener('click', () => {
            if (settingsPanel.style.display === 'none') {
                settingsPanel.style.display = 'block';
                toggleButton.textContent = 'Hide QC Settings';
            } else {
                settingsPanel.style.display = 'none';
                toggleButton.textContent = 'Advanced QC Settings';
            }
        });
    }
}

/**
 * Gets QC parameters from input fields
 */
function getQcParams(prefix = '') {
    const params = {};
    
    // Helper function to get value from input
    const getValue = (id) => {
        const element = document.getElementById(id);
        return element && element.value ? parseInt(element.value, 10) : null;
    };
    
    // Get input fields with proper error handling
    const fieldIds = {
        minLength: `${prefix}minLength`,
        maxLength: `${prefix}maxLength`,
        minPhred: `${prefix}minPhred`,
        minInternalPhred: `${prefix}minInternalPhred`,
        minAverageQuality: `${prefix}minAverageQuality`,
        trim5Prime: `${prefix}trim5Prime`,
        trim3Prime: `${prefix}trim3Prime`
    };
    
    // Process each field
    Object.entries(fieldIds).forEach(([paramName, elementId]) => {
        const value = getValue(elementId);
        params[paramName] = value; // Assign even if null, for consistency
    });
    
    return params;
}

// ============================================================================
// Page Setup Functions
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
        <th>QC Report</th>
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
                comparison = new Date(a.date) - new Date(b.date);
                break;
            default:
                comparison = 0;
        }
        return currentSortDirection === 'asc' ? comparison : -comparison;
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

        // QC PDF Report
        const cellQcReport = row.insertCell();
        if (folderInfo.qcPdfExists) {
            const viewLink = document.createElement('a');
            viewLink.href = '#';
            viewLink.textContent = 'View in App';
            viewLink.addEventListener('click', (event) => {
                event.preventDefault();
                const qcPdfPath = path.join(resultsDirectory, folderInfo.name, 'qc', `${folderInfo.name}_qc_report.pdf`);
                ipcRenderer.send('show-pdf', qcPdfPath);
            });
            
            const openLink = document.createElement('a');
            openLink.href = '#';
            openLink.textContent = 'Open External';
            openLink.addEventListener('click', (event) => { 
                event.preventDefault();
                const qcPdfPath = path.join(resultsDirectory, folderInfo.name, 'qc', `${folderInfo.name}_qc_report.pdf`);
                ipcRenderer.send('open-file', qcPdfPath);
            });
            
            cellQcReport.appendChild(viewLink);
            cellQcReport.appendChild(document.createTextNode(' | '));
            cellQcReport.appendChild(openLink);
        } else {
            cellQcReport.textContent = 'No QC report available';
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
        previewCell.colSpan = 7;
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

/**
 * Sets up the PDF viewer
 */
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

/**
 * Sets up the bacteria analysis page
 */
function setupBacteriaPage() {
    // Initialize collapsible info panel
    setupInfoPanel();
    
    // Remove any existing listeners to prevent memory leaks
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
    const resultsCard = document.getElementById('resultsCard');

    // Setup QC settings toggle
    setupQcSettingsToggle('qcSettingsToggle', 'qcSettingsPanel');

    // Ensure QC fields are initialized with defaults
    const initQcField = (id, defaultValue) => {
        const field = document.getElementById(id);
        if (field) {
            field.placeholder = defaultValue.toString();
        }
    };

    // Initialize QC fields with bacterial defaults
    initQcField('minLength', 16);
    initQcField('maxLength', 2147483647);
    initQcField('minPhred', 20);
    initQcField('minInternalPhred', 0);
    initQcField('minAverageQuality', 10);
    initQcField('trim5Prime', 0);
    initQcField('trim3Prime', 0);

    // Setup collapsible console
    setupCollapsibleConsole('consoleHeader', 'consoleBody', 'consoleToggle', 'consoleStatus', 'output');

    // Add validation for numeric fields
    const qcNumericFields = [
        'minLength', 'maxLength', 'minPhred', 
        'minInternalPhred', 'minAverageQuality', 
        'trim5Prime', 'trim3Prime'
    ];

    qcNumericFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', (e) => {
                // Only allow numeric input
                const value = e.target.value.trim();
                if (value !== '' && !/^\d+$/.test(value)) {
                    e.target.setCustomValidity('Please enter a valid number');
                    e.target.reportValidity();
                } else {
                    e.target.setCustomValidity('');
                }
            });
        }
    });

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
            const enableQC = document.getElementById('enableQC')?.checked ?? true;
            
            // Get QC parameters if QC is enabled
            const qcParams = enableQC ? getQcParams('') : {};
            
            if (filePath && experimentName) {
                // Update status to running
                updateStatusIndicator('running', 'Analysis is currently running...');
                
                // Hide results card
                if (resultsCard) {
                    resultsCard.style.display = 'none';
                }
                
                // Reset result buttons
                if (resultButtons) {
                    resultButtons.style.display = 'none';
                }
                
                outputHistory[experimentName] = '';
                outputElement.textContent = '';
                currentProcess = experimentName;
                cancelButton.style.display = 'block';
                ipcRenderer.send('run-isolate-command', filePath, experimentName, enableQC, qcParams);
                spinner.style.display = 'block';
                statusMessage.textContent = enableQC ? 
                    'Running QC and analysis... Please wait.' : 
                    'Analyzing... Please wait.';
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
                updateStatusIndicator('waiting', 'Analysis cancelled.');
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

    const openQcPdf = document.getElementById('openQcPdf');
    if (openQcPdf) {
        openQcPdf.addEventListener('click', () => {
            const experimentName = experimentNameInput.value;
            const qcPdfPath = path.join('/var/lib/cge_test/results', experimentName, 'qc', `${experimentName}_qc_report.pdf`);
            
            // Check if file exists before trying to open it
            if (fs.existsSync(qcPdfPath)) {
                ipcRenderer.send('show-pdf', qcPdfPath);
            } else {
                alert('QC report not found. The QC process may not have completed successfully.');
            }
        });
    }

    // Setup event listeners for command output and completion
    ipcRenderer.on('isolate-command-output', (event, { stdout, stderr }) => {
        if (outputElement && currentProcess) {
            if (stdout) {
                outputHistory[currentProcess] = outputHistory[currentProcess] || '';
                outputHistory[currentProcess] += stdout + '\n';
                outputElement.textContent = outputHistory[currentProcess];
                // Update console status
                updateConsoleStatus('consoleStatus', stdout);
            }
            if (stderr) {
                outputHistory[currentProcess] = outputHistory[currentProcess] || '';
                outputHistory[currentProcess] += stderr + '\n';
                outputElement.textContent = outputHistory[currentProcess];
                // Update console status
                updateConsoleStatus('consoleStatus', stderr);
            }
            // Only scroll if console is expanded
            const consoleBody = document.getElementById('consoleBody');
            if (consoleBody && consoleBody.classList.contains('expanded')) {
                scrollToBottom(outputElement);
            }
        }
    });

    ipcRenderer.on('isolate-complete-success', () => {
        spinner.style.display = 'none';
        cancelButton.style.display = 'none';
        updateStatusIndicator('success', 'Analysis completed successfully.');
        if (resultsCard) {
            resultsCard.style.display = 'block';
        }
        if (resultButtons) {
            resultButtons.style.display = 'block';
        }
        currentProcess = null;
    });

    ipcRenderer.on('isolate-complete-failure', (event, errorMessage) => {
        spinner.style.display = 'none';
        cancelButton.style.display = 'none';
        updateStatusIndicator('error', 'Analysis failed. Check the console for details.');
        if (resultsCard) {
            resultsCard.style.display = 'none';
        }
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
    // Initialize collapsible info panel
    setupInfoPanel();
    
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
    const resultsCard = document.getElementById('resultsCard');

    // Setup collapsible console
    setupCollapsibleConsole('virusConsoleHeader', 'virusConsoleBody', 'virusConsoleToggle', 'virusConsoleStatus', 'virusOutput');

    // Setup QC settings toggle
    setupQcSettingsToggle('virusQcSettingsToggle', 'virusQcSettingsPanel');

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
            const enableQC = document.getElementById('enableVirusQC')?.checked ?? true;
            
            // Get QC parameters if QC is enabled
            const qcParams = enableQC ? getQcParams('virus') : {};

            if (filePath && experimentName) {
                // Update status to running
                updateStatusIndicator('running', 'Analysis is currently running...');
                
                // Hide results card
                if (resultsCard) {
                    resultsCard.style.display = 'none';
                }
                
                if (resultButtons) {
                    resultButtons.style.display = 'none';
                }
                outputHistory[experimentName] = '';
                outputElement.textContent = '';
                currentProcess = experimentName;
                cancelButton.style.display = 'block';
                ipcRenderer.send('run-virus-command', filePath, experimentName, enableQC, qcParams);
                spinner.style.display = 'block';
                statusMessage.textContent = enableQC ? 
                    'Running QC and analysis... Please wait.' : 
                    'Analyzing... Please wait.';
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
                updateStatusIndicator('waiting', 'Analysis cancelled.');
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

    const openQcPdf = document.getElementById('openQcPdf');
    if (openQcPdf) {
        openQcPdf.addEventListener('click', () => {
            const experimentName = experimentNameInput.value;
            const qcPdfPath = path.join('/var/lib/cge_test/results', experimentName, 'qc', `${experimentName}_qc_report.pdf`);
            
            // Check if file exists before trying to open it
            if (fs.existsSync(qcPdfPath)) {
                ipcRenderer.send('show-pdf', qcPdfPath);
            } else {
                alert('QC report not found. The QC process may not have completed successfully.');
            }
        });
    }

    // Event listeners for command output and completion
    ipcRenderer.on('virus-command-output', (event, { stdout, stderr }) => {
        if (outputElement && currentProcess) {
            if (stdout) {
                outputHistory[currentProcess] = outputHistory[currentProcess] || '';
                outputHistory[currentProcess] += stdout + '\n';
                outputElement.textContent = outputHistory[currentProcess];
                // Update console status
                updateConsoleStatus('virusConsoleStatus', stdout);
            }
            if (stderr) {
                outputHistory[currentProcess] = outputHistory[currentProcess] || '';
                outputHistory[currentProcess] += stderr + '\n';
                outputElement.textContent = outputHistory[currentProcess];
                // Update console status
                updateConsoleStatus('virusConsoleStatus', stderr);
            }
            // Only scroll if console is expanded
            const consoleBody = document.getElementById('virusConsoleBody');
            if (consoleBody && consoleBody.classList.contains('expanded')) {
                scrollToBottom(outputElement);
            }
        }
    });

    ipcRenderer.on('virus-complete-success', () => {
        spinner.style.display = 'none';
        cancelButton.style.display = 'none';
        updateStatusIndicator('success', 'Analysis completed successfully.');
        if (resultsCard) {
            resultsCard.style.display = 'block';
        }
        if (resultButtons) {
            resultButtons.style.display = 'block';
        }
        currentProcess = null;
    });

    ipcRenderer.on('virus-complete-failure', (event, errorMessage) => {
        spinner.style.display = 'none';
        cancelButton.style.display = 'none';
        updateStatusIndicator('error', 'Analysis failed. Check the console for details.');
        if (resultsCard) {
            resultsCard.style.display = 'none';
        }
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
    // Initialize collapsible info panel
    setupInfoPanel();
    
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
    const resultsCard = document.getElementById('resultsCard');

    // Setup collapsible console
    setupCollapsibleConsole('metaConsoleHeader', 'metaConsoleBody', 'metaConsoleToggle', 'metaConsoleStatus', 'metagenomicsOutput');

    // Setup QC settings toggle
    setupQcSettingsToggle('metaQcSettingsToggle', 'metaQcSettingsPanel');

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
            const enableQC = document.getElementById('enableMetagenomicsQC')?.checked ?? true;
            
            // Get QC parameters if QC is enabled
            const qcParams = enableQC ? getQcParams('meta') : {};

            if (filePath && experimentName) {
                // Update status to running
                updateStatusIndicator('running', 'Analysis is currently running...');
                
                // Hide results card
                if (resultsCard) {
                    resultsCard.style.display = 'none';
                }
                
                if (resultButtons) {
                    resultButtons.style.display = 'none';
                }
                outputHistory[experimentName] = '';
                outputElement.textContent = '';
                currentProcess = experimentName;
                cancelButton.style.display = 'block';
                ipcRenderer.send('run-metagenomics-command', filePath, experimentName, enableQC, qcParams);
                spinner.style.display = 'block';
                statusMessage.textContent = enableQC ? 
                    'Running QC and analysis... Please wait.' : 
                    'Analyzing... Please wait.';
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
                updateStatusIndicator('waiting', 'Analysis cancelled.');
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

    const openQcPdf = document.getElementById('openQcPdf');
    if (openQcPdf) {
        openQcPdf.addEventListener('click', () => {
            const experimentName = experimentNameInput.value;
            const qcPdfPath = path.join('/var/lib/cge_test/results', experimentName, 'qc', `${experimentName}_qc_report.pdf`);
            
            // Check if file exists before trying to open it
            if (fs.existsSync(qcPdfPath)) {
                ipcRenderer.send('show-pdf', qcPdfPath);
            } else {
                alert('QC report not found. The QC process may not have completed successfully.');
            }
        });
    }

    // Event listeners for command output and completion
    ipcRenderer.on('metagenomics-command-output', (event, { stdout, stderr }) => {
        if (outputElement && currentProcess) {
            if (stdout) {
                outputHistory[currentProcess] = outputHistory[currentProcess] || '';
                outputHistory[currentProcess] += stdout + '\n';
                outputElement.textContent = outputHistory[currentProcess];
                // Update console status
                updateConsoleStatus('metaConsoleStatus', stdout);
            }
            if (stderr) {
                outputHistory[currentProcess] = outputHistory[currentProcess] || '';
                outputHistory[currentProcess] += stderr + '\n';
                outputElement.textContent = outputHistory[currentProcess];
                // Update console status
                updateConsoleStatus('metaConsoleStatus', stderr);
            }
            // Only scroll if console is expanded
            const consoleBody = document.getElementById('metaConsoleBody');
            if (consoleBody && consoleBody.classList.contains('expanded')) {
                scrollToBottom(outputElement);
            }
        }
    });

    ipcRenderer.on('metagenomics-complete-success', () => {
        spinner.style.display = 'none';
        cancelButton.style.display = 'none';
        updateStatusIndicator('success', 'Analysis completed successfully.');
        if (resultsCard) {
            resultsCard.style.display = 'block';
        }
        if (resultButtons) {
            resultButtons.style.display = 'block';
        }
        currentProcess = null;
    });

    ipcRenderer.on('metagenomics-complete-failure', (event, errorMessage) => {
        spinner.style.display = 'none';
        cancelButton.style.display = 'none';
        updateStatusIndicator('error', 'Analysis failed. Check the console for details.');
        if (resultsCard) {
            resultsCard.style.display = 'none';
        }
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
// Page State Management Functions
// ============================================================================

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