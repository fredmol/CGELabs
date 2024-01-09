const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { dialog, shell } = require('electron');
const os = require('os');
const fs = require('fs');

const resultsDirectory = '/var/lib/cge/results';

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

ipcMain.handle('select-folder', async (event) => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.filePaths.length > 0 ? result.filePaths[0] : null;
});

ipcMain.on('open-file', (event, filePath) => {
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

ipcMain.handle('get-results', async () => {
    try {
        const resultFolders = fs.readdirSync(resultsDirectory, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => {
                const folderName = dirent.name;
                const reportExists = fs.existsSync(path.join(resultsDirectory, folderName, 'report.txt'));
                return { name: folderName, reportExists };
            });
        return resultFolders;
    } catch (error) {
        console.error('Error reading results directory:', error);
        return [];
    }
});

// Handlers for various analysis commands (isolates, virus, metagenomics)
ipcMain.on('run-isolate-command', (event, filePath, experimentName) => {
    runAnalysisCommand('cgeisolate', filePath, experimentName, event, 'isolate');
});

ipcMain.on('run-virus-command', (event, filePath, experimentName) => {
    runAnalysisCommand('cgevirus', filePath, experimentName, event, 'virus');
});

ipcMain.on('run-metagenomics-command', (event, filePath, experimentName) => {
    runAnalysisCommand('cgemetagenomics', filePath, experimentName, event, 'metagenomics');
});

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
