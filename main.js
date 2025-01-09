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
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { dialog, shell } = require('electron');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

// ============================================================================
// Configuration Constants
// ============================================================================
const FILE_SIZE_SETTINGS = {
    MIN_SIZE_MB: 5,    // Minimum file size in MB
    MAX_SIZE_GB: 1      // Maximum file size in GB
};

const resultsDirectory = '/var/lib/cge_test/results';
let pdfWindow = null;

// ============================================================================
// Window Management
// ============================================================================
function createWindow() {
    const iconPath = path.join(__dirname, 'build/icons/logo_256.png');
    const win = new BrowserWindow({
        width: 1200,
        height: 900,
        title: 'CGELabs',  // Add this line
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: iconPath,
    });
    win.loadFile('index.html');
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
                const stats = fs.statSync(folderPath);
                
                return {
                    name: folderName,
                    reportExists: fs.existsSync(reportPath),
                    pdfExists: fs.existsSync(pdfPath),
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
    if (global[processKey]) {
        global[processKey].kill();
        delete global[processKey];
        
        // Delete the output folder if it exists
        if (folderPath && path.resolve(folderPath).startsWith('/var/lib/cge_test/results')) {
            try {
                fs.rmSync(folderPath, { recursive: true, force: true });
            } catch (error) {
                console.error('Error deleting folder:', error);
            }
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
                message: `Warning: small dataset (${fileSizeMB.toFixed(1)} MB). This may indicate insufficient sequencing depth.`
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

// ============================================================================
// Analysis Command Handlers
// ============================================================================
ipcMain.on('run-isolate-command', (event, filePath, experimentName) => {
    runAnalysisCommand('cgeisolate', filePath, experimentName, event, 'isolate');
});

ipcMain.on('run-virus-command', (event, filePath, experimentName) => {
    runAnalysisCommand('cgevirus', filePath, experimentName, event, 'virus');
});

ipcMain.on('run-metagenomics-command', (event, filePath, experimentName) => {
    runAnalysisCommand('cgemetagenomics', filePath, experimentName, event, 'metagenomics');
});

ipcMain.on('run-merge-command', (event, filePath, experimentName) => {
    mergeCondaCommand('cgeutil', filePath, experimentName, event, 'merge');
});

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
    const condaPath = `${homeDirectory}/anaconda3/bin/conda`;
    
    // Buffer to store output until directory is ready
    let outputBuffer = [];
    
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

    let args = [
        'run',
        '-n', 'cge_env_test',
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
