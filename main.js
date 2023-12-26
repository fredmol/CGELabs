// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { dialog } = require('electron');
const os = require('os');

function createWindow() {
    const iconPath = path.join(__dirname, 'build/icons/logo_256.png');

    const win = new BrowserWindow({
        width: 800,
        height: 600,
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

ipcMain.on('run-merge-command', (event, folderPath, mergeName) => {
    const homeDirectory = os.homedir();
    const cgeutilPath = `${homeDirectory}/miniconda3/envs/cge_env/bin/cgeutil`;
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
