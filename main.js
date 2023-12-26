// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { dialog } = require('electron');


function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            icon: __dirname + 'cge_labs_logo.png',
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);


ipcMain.on('run-command', (event, arg) => {
    const process = spawn(arg, [], { shell: true }); // Using spawn

    process.stdout.on('data', (data) => {
        event.sender.send('command-output', { stdout: data.toString() });
    });

    process.stderr.on('data', (data) => {
        event.sender.send('command-output', { stderr: data.toString() });
    });

    process.on('close', () => {
        event.sender.send('command-output', { stdout: 'Process completed' });
    });
});

ipcMain.handle('select-folder', async (event) => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.filePaths && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.on('run-merge-command', (event, folderPath) => {
    const process = spawn('bash', ['/Users/malhal/dev/CGELabs/t.sh']);

    process.stdout.on('data', (data) => {
        event.sender.send('merge-command-output', { stdout: data.toString() });
    });

    process.stderr.on('data', (data) => {
        event.sender.send('merge-command-output', { stderr: data.toString() });
    });
});