// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { dialog } = require('electron');
const os = require('os');
const fs = require('fs');
const resultsDirectory = '/var/lib/cge/results';
const { shell } = require('electron');



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
    if (result.filePaths && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.on('open-file', (event, filePath) => {
    shell.openPath(filePath).then((result) => {
        if (result) {
            console.error('Error opening file:', result);
            // Optionally, send an error back to the renderer process
            event.sender.send('file-open-error', result);
        }
    }).catch((err) => {
        console.error('Failed to open file:', err);
        // Optionally, send an error back to the renderer process
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

ipcMain.on('run-merge-command', (event, folderPath, mergeName) => {
    const homeDirectory = os.homedir();
    const cgeutilPath = `${homeDirectory}/anaconda3/envs/cge_env/bin/cgeutil`;
    console.log(`Running merge command with folderPath: ${folderPath} and mergeName: ${mergeName}`)
    const args = ['merge', '--dir_path', folderPath, '--name', mergeName];

    const process = spawn(cgeutilPath, args);

    process.stdout.on('data', (data) => {
        event.sender.send('merge-command-output', { stdout: data.toString() });
    });

    process.stderr.on('data', (data) => {
        event.sender.send('merge-command-output', { stderr: data.toString() });
    });

    process.on('close', (code) => {
        event.sender.send('merge-complete', `Process exited with code ${code}`);
    });
});

ipcMain.on('run-isolate-command', (event, filePath, experimentName) => {
    const homeDirectory = os.homedir();
    const condaPath = `${homeDirectory}/anaconda3/bin/conda`; // Path to conda executable
    const scriptPath = `${homeDirectory}/anaconda3/envs/cge_env/bin/cgeisolate`; // Path to your script
    const pythonPath = `${homeDirectory}/anaconda3/envs/cge_env/bin/python3`; // Path to Python in cge_env

    console.log(`Running isolate command with filePath: ${filePath} and experimentName: ${experimentName}`);

    // Preparing arguments for conda run
    const args = ['run', '--live-stream', '-n', 'cge_env', pythonPath, scriptPath, '-i', filePath, '-name', experimentName];

    const process = spawn(condaPath, args);

    process.stdout.on('data', (data) => {
        event.sender.send('isolate-command-output', { stdout: data.toString() });
    });

    process.stderr.on('data', (data) => {
        event.sender.send('isolate-command-output', { stderr: data.toString() });
    });

    process.on('close', (code) => {
        if (code === 0) {
            event.sender.send('isolate-complete-success');
        } else {
            event.sender.send('isolate-complete-failure', `Process exited with code ${code}`);
        }
    });
});

// Handler for virus analysis
ipcMain.on('run-virus-command', (event, filePath, experimentName) => {
    const homeDirectory = os.homedir();
    const condaPath = `${homeDirectory}/anaconda3/bin/conda`;
    const scriptPath = `${homeDirectory}/anaconda3/envs/cge_env/bin/cgevirus`; // Adjust script path
    const pythonPath = `${homeDirectory}/anaconda3/envs/cge_env/bin/python3`;

    const args = ['run', '--live-stream', '-n', 'cge_env', pythonPath, scriptPath, '-i', filePath, '-name', experimentName];

    const process = spawn(condaPath, args);

    process.stdout.on('data', (data) => {
        event.sender.send('virus-command-output', { stdout: data.toString() });
    });

    process.stderr.on('data', (data) => {
        event.sender.send('virus-command-output', { stderr: data.toString() });
    });

    process.on('close', (code) => {
        if (code === 0) {
            event.sender.send('virus-complete-success');
        } else {
            event.sender.send('virus-complete-failure', `Process exited with code ${code}`);
        }
    });
});

// Handler for metagenomics analysis
ipcMain.on('run-metagenomics-command', (event, filePath, experimentName) => {
    const homeDirectory = os.homedir();
    const condaPath = `${homeDirectory}/anaconda3/bin/conda`;
    const scriptPath = `${homeDirectory}/anaconda3/envs/cge_env/bin/cgemetagenomics`; // Adjust script path
    const pythonPath = `${homeDirectory}/anaconda3/envs/cge_env/bin/python3`;

    const args = ['run', '--live-stream', '-n', 'cge_env', pythonPath, scriptPath, '-i', filePath, '-name', experimentName];

    const process = spawn(condaPath, args);

    process.stdout.on('data', (data) => {
        event.sender.send('metagenomics-command-output', { stdout: data.toString() });
    });

    process.stderr.on('data', (data) => {
        event.sender.send('metagenomics-command-output', { stderr: data.toString() });
    });

    process.on('close', (code) => {
        if (code === 0) {
            event.sender.send('metagenomics-complete-success');
        } else {
            event.sender.send('metagenomics-complete-failure', `Process exited with code ${code}`);
        }
    });
});