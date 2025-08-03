/* This code snippet is setting up a communication bridge between the main Electron process and the
renderer process in a Electron application. Here's a breakdown of what it's doing: */
const { contextBridge, ipcRenderer } = require('electron');

// Exponer API para los controles de ventana
contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('window-close'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize')
});

// Permitir que el renderer envíe metadatos de media al proceso principal
contextBridge.exposeInMainWorld('mediaAPI', {
  sendMediaMetadata: (metadata) => ipcRenderer.send('media-metadata', metadata)
});
