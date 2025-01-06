const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { dialog, shell } = require('electron');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

const resultsDirectory = '/var/lib/cge/results';
let pdfWindow = null;

// Utility functions for file validation
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

function createWindow() {
    const iconPath = path.join(__dirname, 'build/icons/logo_256.png');
    const win = new BrowserWindow({
        width: 1200,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: iconPath,
    });
    win.loadFile('index.html');
}

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

// IPC Handlers
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
                const reportPath = path.join(resultsDirectory, folderName, 'report.txt');
                const pdfPath = path.join(resultsDirectory, folderName, `${folderName}_report.pdf`);
                
                return {
                    name: folderName,
                    reportExists: fs.existsSync(reportPath),
                    pdfExists: fs.existsSync(pdfPath) && isPDF(pdfPath),
                    status: fs.existsSync(path.join(resultsDirectory, folderName, '.complete')) ? 'complete' : 'pending'
                };
            });
        return resultFolders;
    } catch (error) {
        console.error('Error reading results directory:', error);
        return [];
    }
});

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

// Analysis command handlers
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

function runAnalysisCommand(scriptName, filePath, experimentName, event, analysisType) {
    const homeDirectory = os.homedir();
    const condaPath = `${homeDirectory}/anaconda3/bin/conda`;
    const scriptPath = `${homeDirectory}/anaconda3/envs/cge_env/bin/${scriptName}`;
    const pythonPath = `${homeDirectory}/anaconda3/envs/cge_env/bin/python3`;

    const args = ['run', '--live-stream', '-n', 'cge_env', pythonPath, scriptPath, '-i', filePath, '-name', experimentName];
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