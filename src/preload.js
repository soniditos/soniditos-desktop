const { contextBridge, ipcRenderer } = require('electron');

// Exponer API para los controles de ventana y navegación
contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('window-close'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  navigateBack: () => ipcRenderer.send('navigate-back'),
  navigateForward: () => ipcRenderer.send('navigate-forward'),
  // Suscribirse a cambios de estado de navegación desde el proceso principal
  onNavigationState: (callback) => {
    const listener = (event, state) => callback(state);
    ipcRenderer.on('nav-state', listener);
    return () => ipcRenderer.removeListener('nav-state', listener);
  },
  // Solicitar estado inicial de navegación
  requestNavState: () => ipcRenderer.send('request-nav-state'),
  // Suscribirse a ahora sonando (title/artist) enviado desde el proceso principal
  onNowPlaying: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('now-playing', listener);
    return () => ipcRenderer.removeListener('now-playing', listener);
  }
  ,
  // Suscribirse a cambios de tema (claro/oscuro) enviados desde el proceso principal
  onThemeState: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('theme-state', listener);
    return () => ipcRenderer.removeListener('theme-state', listener);
  }
  ,
  // Escuchar cambios de maximizado desde el proceso principal
  onWindowMaximized: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('window-maximized', listener);
    return () => ipcRenderer.removeListener('window-maximized', listener);
  }
});

// Permitir que el renderer envíe metadatos de media al proceso principal
contextBridge.exposeInMainWorld('mediaAPI', {
  sendMediaMetadata: (metadata) => ipcRenderer.send('media-metadata', metadata)
});
