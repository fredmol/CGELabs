console.log("preload.js is loaded");

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    sendCommand: (command) => ipcRenderer.send('run-command', command),
    onCommandOutput: (callback) => ipcRenderer.on('command-output', callback)
});
