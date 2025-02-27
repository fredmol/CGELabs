/**
 * CGELabs - Main Process
 * 
 * This file handles the core functionality of the Electron application, including:
 * - Window management
 * - File system operations
 * - IPC communication
 * - Tool execution through conda environments
 * - Results management
 */

// ============================================================================
// Core Dependencies and Constants
// ============================================================================
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

// ============================================================================
// Configuration Constants
// ============================================================================
const FILE_SIZE_SETTINGS = {
    MIN_SIZE_MB: 10,    // Minimum file size in MB
    MAX_SIZE_GB: 1     // Maximum file size in GB
};

const resultsDirectory = '/var/lib/cge_test/results';
let pdfWindow = null;

// ============================================================================
// Window Management
// ============================================================================
function createWindow() {
    const iconPath = path.join(__dirname, 'build/icons/logo_256.png');
    
    const win = new BrowserWindow({
        width: 1000,
        height: 720,
        title: 'CGELabs',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            zoomFactor: 0.92,
        },
        icon: iconPath,
    });
    
    win.loadFile('index.html');
    
    // Set zoom after page has loaded
    win.webContents.once('did-finish-load', () => {
        win.webContents.setZoomFactor(0.92);
    });
}

// Application lifecycle handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// ============================================================================
// File Validation and Utility Functions
// ============================================================================
function isPDF(filePath) {
    try {
        const buffer = Buffer.alloc(5);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 5, 0);
        fs.closeSync(fd);
        return buffer.toString('utf8').includes('PDF');
    } catch (error) {
        console.error('Error validating PDF:', error);
        return false;
    }
}

function isValidFilePath(filePath) {
    try {
        return fs.existsSync(filePath) && 
               fs.statSync(filePath).isFile() && 
               path.resolve(filePath).startsWith(resultsDirectory);
    } catch (error) {
        console.error('Error validating file path:', error);
        return false;
    }
}

// ============================================================================
// Metadata Management
// ============================================================================
function saveToolMetadata(experimentName, toolName) {
    try {
        const metadataPath = path.join(resultsDirectory, experimentName, 'metadata.json');
        const metadata = {
            tool: toolName,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
        console.error('Error saving tool metadata:', error);
    }
}

function getToolType(folderPath) {
    try {
        const metadataPath = path.join(folderPath, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            return metadata.tool;
        }
        return 'Unknown';
    } catch (error) {
        console.error('Error determining tool type:', error);
        return 'Unknown';
    }
}

// ============================================================================
// Quality Control Function
// ============================================================================
function runQC(filePath, experimentName, qcParams = {}, pipelineType = 'bacterial') {
    return new Promise((resolve, reject) => {
        const homeDirectory = os.homedir();
        const condaPath = `${homeDirectory}/anaconda3/bin/conda`;
        
        // Create QC directory within results
        const qcDir = path.join(resultsDirectory, experimentName, 'qc');
        try {
            fs.mkdirSync(qcDir, { recursive: true });
        } catch (error) {
            console.error(`Error creating QC directory: ${error}`);
            reject(error);
            return;
        }

        // Build the command with pipe type and any custom parameters
        let cgeqcCmd = [
            '-i', filePath,
            '-o', qcDir,
            '-n', experimentName,
            '--pipeline', pipelineType
        ];
        
        // Add any custom parameters that have been provided
        if (qcParams.minLength !== undefined && qcParams.minLength !== null) cgeqcCmd.push('--min_length', qcParams.minLength);
        if (qcParams.maxLength !== undefined && qcParams.maxLength !== null) cgeqcCmd.push('--max_length', qcParams.maxLength);
        if (qcParams.minPhred !== undefined && qcParams.minPhred !== null) cgeqcCmd.push('--min_phred', qcParams.minPhred);
        if (qcParams.minInternalPhred !== undefined && qcParams.minInternalPhred !== null) cgeqcCmd.push('--min_internal_phred', qcParams.minInternalPhred);
        if (qcParams.minAverageQuality !== undefined && qcParams.minAverageQuality !== null) cgeqcCmd.push('--min_average_quality', qcParams.minAverageQuality);
        if (qcParams.trim5Prime !== undefined && qcParams.trim5Prime !== null) cgeqcCmd.push('--trim_5_prime', qcParams.trim5Prime);
        if (qcParams.trim3Prime !== undefined && qcParams.trim3Prime !== null) cgeqcCmd.push('--trim_3_prime', qcParams.trim3Prime);

        // Create a command string for better logging
        let cmdString = 'cgeqc';
        cgeqcCmd.forEach(arg => {
            cmdString += ' ' + arg;
        });

        const process = spawn('cgeqc', cgeqcCmd);

        // Store process globally for cancellation
        global[`qc_process_${experimentName}`] = process;
        
        let stdout = '';
        let stderr = '';

        // Determine analysis type for event messaging
        const analysisType = pipelineType === 'bacterial' ? 'isolate' : 
                           pipelineType === 'viral' ? 'virus' : 'metagenomics';

        process.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            
            // Send the output back to the renderer
            const event = global.qcEvent;
            if (event) {
                event.sender.send(`${analysisType}-command-output`, { stdout: output });
            }
        });

        process.stderr.on('data', (data) => {
            const output = data.toString();
            stderr += output;
            
            // Send the error back to the renderer
            const event = global.qcEvent;
            if (event) {
                event.sender.send(`${analysisType}-command-output`, { stderr: output });
            }
        });

        process.on('close', (code) => {
            // Clean up process reference
            delete global[`qc_process_${experimentName}`];
            
            if (code === 0) {
                console.log(`Looking for output file in QC directory: ${qcDir}`);
                // Find the QC file in the QC directory
                try {
                    const files = fs.readdirSync(qcDir);
                    const qcFile = files.find(file => file.endsWith('.fq') || file.endsWith('.fq.gz'));
                    if (qcFile) {
                        const qcFilePath = path.join(qcDir, qcFile);
                        resolve({
                            success: true,
                            trimmedFilePath: qcFilePath,
                            qcOutput: stdout
                        });
                    } else {
                        console.error('No QC file found in QC directory');
                        reject(new Error('No QC file found'));
                    }
                } catch (error) {
                    console.error(`Error finding QC file: ${error}`);
                    reject(error);
                }
            } else {
                console.error(`QC process exited with code ${code}`);
                reject(new Error(`QC process exited with code ${code}. Error: ${stderr}`));
            }
        });
    });
}

// ============================================================================
// Core Analysis Functions
// ============================================================================

/**
 * Executes merge commands using conda environment
 */
function mergeCondaCommand(scriptName, filePath, experimentName, event, analysisType) {
    const homeDirectory = os.homedir();
    const condaPath = `${homeDirectory}/anaconda3/bin/conda`;
    const scriptPath = `${homeDirectory}/anaconda3/envs/cge_env/bin/${scriptName}`;
    const pythonPath = `${homeDirectory}/anaconda3/envs/cge_env/bin/python3`;

    const args = ['run', '--live-stream', '-n', 'cge_env', pythonPath, scriptPath, 'merge', '--dir_path', filePath, '--name', experimentName];
    const process = spawn(condaPath, args);

    process.stdout.on('data', (data) => {
        event.sender.send(`${analysisType}-command-output`, { stdout: data.toString() });
    });

    process.stderr.on('data', (data) => {
        event.sender.send(`${analysisType}-command-output`, { stderr: data.toString() });
    });

    process.on('close', (code) => {
        if (code === 0) {
            event.sender.send(`${analysisType}-complete-success`);
        } else {
            event.sender.send(`${analysisType}-complete-failure`, `Process exited with code ${code}`);
        }
    });
}

/**
 * Executes analysis commands using conda environment
 */
function runAnalysisCommand(scriptName, filePath, experimentName, event, analysisType) {
    const homeDirectory = os.homedir();
    // Determine conda path based on platform
    let condaPath;
    if (global.process.platform === 'darwin') {
        // On macOS, use conda from the PATH
        condaPath = 'conda';
    } else {
        condaPath = `${homeDirectory}/anaconda3/bin/conda`;
    }
    
    // Buffer to store output until directory is ready
    let outputBuffer = [];
    
    // Determine tool name from script name
    let toolName;
    switch(scriptName) {
        case 'cgeisolate':
            toolName = 'CGE Isolate';
            break;
        case 'cgevirus':
            toolName = 'CGE Virus';
            break;
        case 'cgemetagenomics':
            toolName = 'CGE Metagenomics';
            break;
        default:
            toolName = scriptName;
    }

    // Prepare command arguments
    let args = [
        'run',
        '--no-capture-output',
        scriptName
    ];

    if (scriptName === 'cgeisolate') {
        args.push('-i', filePath, '-name', experimentName, '-db_dir', '/var/lib/cge_test/database/cge_db');
    } else {
        args.push('-i', filePath, '-name', experimentName);
    }
    
    const process = spawn(condaPath, args);

    // Store process globally for cancellation
    global[`process_${experimentName}`] = process;

    // Handle process output
    process.stdout.on('data', (data) => {
        const output = data.toString();
        if (!output.startsWith('function')) {
            event.sender.send(`${analysisType}-command-output`, { stdout: output });
            outputBuffer.push(`[${new Date().toISOString()}] [STDOUT] ${output.trim()}`);
        }
    });

    process.stderr.on('data', (data) => {
        const output = data.toString();
        if (!output.startsWith('function')) {
            event.sender.send(`${analysisType}-command-output`, { stderr: output });
            outputBuffer.push(`[${new Date().toISOString()}] [STDERR] ${output.trim()}`);
        }
    });

    // Handle process errors and completion
    process.on('error', (error) => {
        console.error('Process error:', error);
        event.sender.send(`${analysisType}-command-output`, { stderr: error.message });
        event.sender.send(`${analysisType}-complete-failure`, error.message);
        outputBuffer.push(`[${new Date().toISOString()}] [ERROR] Process error: ${error.message}`);
        delete global[`process_${experimentName}`];
    });

    process.on('close', (code) => {
        // Clean up process reference
        delete global[`process_${experimentName}`];

        if (code === 0) {
            const experimentDir = path.join(resultsDirectory, experimentName);
            const logPath = path.join(experimentDir, 'analysis.log');
            outputBuffer.push(`[${new Date().toISOString()}] [INFO] Process completed successfully with exit code ${code}`);
            
            // Write the buffered output to the log file
            fs.writeFileSync(logPath, outputBuffer.join('\n') + '\n');
            
            saveToolMetadata(experimentName, toolName);
            event.sender.send(`${analysisType}-complete-success`);
        } else {
            outputBuffer.push(`[${new Date().toISOString()}] [ERROR] Process failed with exit code ${code}`);
            event.sender.send(`${analysisType}-complete-failure`, `Process exited with code ${code}`);
            
            // Even if process fails, try to write the log if we have output
            if (outputBuffer.length > 0) {
                try {
                    const experimentDir = path.join(resultsDirectory, experimentName);
                    const logPath = path.join(experimentDir, 'analysis.log');
                    fs.writeFileSync(logPath, outputBuffer.join('\n') + '\n');
                } catch (error) {
                    console.error('Failed to write log file:', error);
                }
            }
        }
    });
}

// ============================================================================
// IPC Handlers - Results Management
// ============================================================================
ipcMain.handle('select-folder', async (event) => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.filePaths.length > 0 ? result.filePaths[0] : null;
});

ipcMain.handle('get-results', async () => {
    try {
        const resultFolders = fs.readdirSync(resultsDirectory, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => {
                const folderName = dirent.name;
                const folderPath = path.join(resultsDirectory, folderName);
                const reportPath = path.join(folderPath, 'report.txt');
                const pdfPath = path.join(folderPath, `${folderName}_report.pdf`);
                const qcPdfPath = path.join(folderPath, 'qc', `${folderName}_qc_report.pdf`);
                const stats = fs.statSync(folderPath);
                
                return {
                    name: folderName,
                    reportExists: fs.existsSync(reportPath),
                    pdfExists: fs.existsSync(pdfPath),
                    qcPdfExists: fs.existsSync(qcPdfPath),
                    toolType: getToolType(folderPath),
                    date: stats.mtime.toISOString()
                };
            });
        return resultFolders;
    } catch (error) {
        console.error('Error reading results directory:', error);
        return [];
    }
});

// ============================================================================
// IPC Handlers - File Operations
// ============================================================================
ipcMain.on('open-file', (event, filePath) => {
    if (!isValidFilePath(filePath)) {
        event.reply('file-open-error', 'Invalid file path');
        return;
    }

    shell.openPath(filePath).then((result) => {
        if (result) {
            console.error('Error opening file:', result);
            event.sender.send('file-open-error', result);
        }
    }).catch((err) => {
        console.error('Failed to open file:', err);
        event.sender.send('file-open-error', err.message);
    });
});

ipcMain.on('show-pdf', (event, pdfPath) => {
    if (!isValidFilePath(pdfPath) || !isPDF(pdfPath)) {
        event.reply('pdf-error', 'Invalid PDF file');
        return;
    }

    if (!pdfWindow) {
        pdfWindow = new BrowserWindow({
            width: 1200,
            height: 900,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            },
            parent: BrowserWindow.getFocusedWindow(),
            modal: true
        });

        pdfWindow.on('closed', () => {
            pdfWindow = null;
        });
    }
    
    pdfWindow.loadFile('report-viewer.html');
    
    pdfWindow.webContents.once('did-finish-load', () => {
        pdfWindow.webContents.send('load-pdf', pdfPath);
    });
});

ipcMain.on('show-results', () => {
    if (pdfWindow) {
        pdfWindow.close();
    }
});

ipcMain.on('open-results-directory', (event, folderPath) => {
    if (fs.existsSync(folderPath)) {
        shell.openPath(folderPath).catch(err => {
            console.error('Error opening directory:', err);
        });
    }
});

// ============================================================================
// IPC Handlers - Analysis Management
// ============================================================================
ipcMain.handle('delete-result', async (event, folderName) => {
    try {
        const folderPath = path.join(resultsDirectory, folderName);
        if (!path.resolve(folderPath).startsWith(resultsDirectory)) {
            throw new Error('Invalid folder path');
        }
        await fs.promises.rm(folderPath, { recursive: true });
        return true;
    } catch (error) {
        console.error('Error deleting result:', error);
        return false;
    }
});

ipcMain.handle('open-results-directory', () => {
    shell.openPath(resultsDirectory);
});

ipcMain.on('cancel-analysis', (event, experimentName, folderPath) => {
    const processKey = `process_${experimentName}`;
    const qcProcessKey = `qc_process_${experimentName}`;
    
    // Kill QC process if exists
    if (global[qcProcessKey]) {
        global[qcProcessKey].kill();
        delete global[qcProcessKey];
    }
    
    // Kill analysis process if exists
    if (global[processKey]) {
        global[processKey].kill();
        delete global[processKey];
    }
    
    // Delete the output folder if it exists
    if (folderPath && path.resolve(folderPath).startsWith('/var/lib/cge_test/results')) {
        try {
            fs.rmSync(folderPath, { recursive: true, force: true });
        } catch (error) {
            console.error('Error deleting folder:', error);
        }
    }
});

ipcMain.handle('check-file-size', (event, filePath) => {
    try {
        const stats = fs.statSync(filePath);
        const fileSizeMB = stats.size / (1024 * 1024);
        const fileSizeGB = fileSizeMB / 1024;

        if (fileSizeMB < FILE_SIZE_SETTINGS.MIN_SIZE_MB) {
            return {
                warning: true,
                message: `Warning: small dataset (${fileSizeMB.toFixed(1)} MB). This may indicate low sequencing depth.`
            };
        }

        if (fileSizeGB > FILE_SIZE_SETTINGS.MAX_SIZE_GB) {
            return {
                warning: true,
                message: `Note: large dataset (${fileSizeGB.toFixed(1)} GB). Analysis may take longer.`
            };
        }

        return { warning: false };
    } catch (error) {
        console.error('Error checking file size:', error);
        return { warning: false };
    }
});


// File dialog handler for selecting FASTQ files
ipcMain.handle('open-fastq-dialog', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'FASTQ Files', extensions: ['fastq', 'fastq.gz', 'fq', 'fq.gz'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    title: 'Select FASTQ File'
  });
  
  return result.canceled ? null : result.filePaths[0];
});

// ============================================================================
// Analysis Command Handlers
// ============================================================================
ipcMain.on('run-isolate-command', (event, filePath, experimentName, enableQC, qcParams = {}) => {
    if (enableQC) {
        event.sender.send('isolate-command-output', { stdout: 'Starting Quality Control...\n' });
        global.qcEvent = event; // Store the event for QC output
        runQC(filePath, experimentName, qcParams, 'bacterial')
            .then(result => {
                global.qcEvent = null; // Clear the event
                event.sender.send('isolate-command-output', { stdout: 'QC completed successfully.\n' });
                event.sender.send('isolate-command-output', { stdout: `Using trimmed file: ${result.trimmedFilePath}\n` });
                event.sender.send('isolate-command-output', { stdout: 'Starting bacterial analysis...\n' });
                runAnalysisCommand('cgeisolate', result.trimmedFilePath, experimentName, event, 'isolate');
            })
            .catch(error => {
                global.qcEvent = null; // Clear the event
                event.sender.send('isolate-command-output', { stderr: `QC failed: ${error.message}\n` });
                event.sender.send('isolate-command-output', { stdout: 'Falling back to original file for analysis...\n' });
                runAnalysisCommand('cgeisolate', filePath, experimentName, event, 'isolate');
            });
    } else {
        event.sender.send('isolate-command-output', { stdout: 'Skipping Quality Control as per user choice.\n' });
        runAnalysisCommand('cgeisolate', filePath, experimentName, event, 'isolate');
    }
});

ipcMain.on('run-virus-command', (event, filePath, experimentName, enableQC, qcParams = {}) => {
    if (enableQC) {
        event.sender.send('virus-command-output', { stdout: 'Starting Quality Control...\n' });
        global.qcEvent = event; // Store the event for QC output
        runQC(filePath, experimentName, qcParams, 'viral')
            .then(result => {
                global.qcEvent = null; // Clear the event
                event.sender.send('virus-command-output', { stdout: 'QC completed successfully.\n' });
                event.sender.send('virus-command-output', { stdout: `Using trimmed file: ${result.trimmedFilePath}\n` });
                event.sender.send('virus-command-output', { stdout: 'Starting virus analysis...\n' });
                runAnalysisCommand('cgevirus', result.trimmedFilePath, experimentName, event, 'virus');
            })
            .catch(error => {
                global.qcEvent = null; // Clear the event
                event.sender.send('virus-command-output', { stderr: `QC failed: ${error.message}\n` });
                event.sender.send('virus-command-output', { stdout: 'Falling back to original file for analysis...\n' });
                runAnalysisCommand('cgevirus', filePath, experimentName, event, 'virus');
            });
    } else {
        event.sender.send('virus-command-output', { stdout: 'Skipping Quality Control as per user choice.\n' });
        runAnalysisCommand('cgevirus', filePath, experimentName, event, 'virus');
    }
});

ipcMain.on('run-metagenomics-command', (event, filePath, experimentName, enableQC, qcParams = {}) => {
    if (enableQC) {
        event.sender.send('metagenomics-command-output', { stdout: 'Starting Quality Control...\n' });
        global.qcEvent = event; // Store the event for QC output
        runQC(filePath, experimentName, qcParams, 'metagenomic')
            .then(result => {
                global.qcEvent = null; // Clear the event
                event.sender.send('metagenomics-command-output', { stdout: 'QC completed successfully.\n' });
                event.sender.send('metagenomics-command-output', { stdout: `Using trimmed file: ${result.trimmedFilePath}\n` });
                event.sender.send('metagenomics-command-output', { stdout: 'Starting metagenomics analysis...\n' });
                runAnalysisCommand('cgemetagenomics', result.trimmedFilePath, experimentName, event, 'metagenomics');
            })
            .catch(error => {
                global.qcEvent = null; // Clear the event
                event.sender.send('metagenomics-command-output', { stderr: `QC failed: ${error.message}\n` });
                event.sender.send('metagenomics-command-output', { stdout: 'Falling back to original file for analysis...\n' });
                runAnalysisCommand('cgemetagenomics', filePath, experimentName, event, 'metagenomics');
            });
    } else {
        event.sender.send('metagenomics-command-output', { stdout: 'Skipping Quality Control as per user choice.\n' });
        runAnalysisCommand('cgemetagenomics', filePath, experimentName, event, 'metagenomics');
    }
});

ipcMain.on('run-merge-command', (event, filePath, experimentName) => {
    mergeCondaCommand('cgeutil', filePath, experimentName, event, 'merge');
});