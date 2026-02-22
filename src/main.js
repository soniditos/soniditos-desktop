const { app, BrowserWindow, BrowserView, Tray, Menu, ipcMain } = require('electron');
const rpc = require('discord-rpc');
const path = require('path');

const trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png');

let win;
let tray;
let client;

function createWindow() {
  // Crear la ventana sin frame nativo para poder dibujar controles propios
  win = new BrowserWindow({
    width: 1281,
    height: 850,
    minWidth: 1281,
    minHeight: 850,
    center: true,
    show: true,
    frame: false,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    }
  });

  // Crear dos BrowserViews: uno para la barra de controles local y otro para el contenido externo
  const controlsView = new BrowserView({
    webPreferences: {
      preload: path.join(app.getAppPath(), 'src', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    }
  });

  const contentView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    }
  });

  win.setBrowserView(controlsView);
  win.addBrowserView(contentView);

  // Bounds: controls arriba con alto fijo, contenido ocupa el resto
  const contentBounds = win.getContentBounds();
  const controlsHeight = 40;
  controlsView.setBounds({ x: 0, y: 0, width: contentBounds.width, height: controlsHeight });
  contentView.setBounds({ x: 0, y: controlsHeight, width: contentBounds.width, height: contentBounds.height - controlsHeight });

  // Cargar controles locales y el contenido remoto
  try {
    controlsView.webContents.loadFile(path.join(__dirname, 'controls.html'));
  } catch (e) {
    controlsView.webContents.loadURL(`file://${path.join(__dirname, 'controls.html')}`);
  }
  // Enviar estado inicial al terminar de cargar la vista de controles
  try { controlsView.webContents.on('did-finish-load', sendNavState); } catch (e) { }
  contentView.webContents.loadURL('https://open.soniditos.com');
  contentView.webContents.on('did-finish-load', () => contentView.webContents.setZoomFactor(1.0));

  // Enviar estado de navegación (canGoBack / canGoForward) al controlsView
  function sendNavState() {
    try {
      const canGoBack = !!(contentView && contentView.webContents && contentView.webContents.canGoBack && contentView.webContents.canGoBack());
      const canGoForward = !!(contentView && contentView.webContents && contentView.webContents.canGoForward && contentView.webContents.canGoForward());
      try { controlsView.webContents.send('nav-state', { canGoBack, canGoForward }); } catch (e) { }
    } catch (e) { /* ignore */ }
  }

  // Enviar información de 'ahora sonando' al controlsView
  async function sendNowPlaying() {
    try {
      if (!contentView || !contentView.webContents) return;
      const title = await contentView.webContents.executeJavaScript('navigator.mediaSession.metadata?.title || null').catch(() => null);
      const artist = await contentView.webContents.executeJavaScript('navigator.mediaSession.metadata?.artist || null').catch(() => null);
      const artwork = await contentView.webContents.executeJavaScript('navigator.mediaSession.metadata?.artwork?.[0]?.src || null').catch(() => null);
      const playbackState = await contentView.webContents.executeJavaScript('navigator.mediaSession.playbackState || null').catch(() => null);
      try { controlsView.webContents.send('now-playing', { title, artist, artwork, playbackState }); } catch (e) { }
    } catch (e) { /* ignore */ }
  }

  // Poll periódico y envíos en eventos para mantener actualizado el now-playing
  let nowPlayingInterval = null;
  try {
    nowPlayingInterval = setInterval(sendNowPlaying, 2000);
    contentView.webContents.on('did-finish-load', sendNowPlaying);
    contentView.webContents.on('did-navigate', sendNowPlaying);
    contentView.webContents.on('did-navigate-in-page', sendNowPlaying);
  } catch (e) { }

  // Actualizar estado en eventos de navegación
  try {
    contentView.webContents.on('did-navigate', sendNavState);
    contentView.webContents.on('did-navigate-in-page', sendNavState);
    contentView.webContents.on('did-finish-load', sendNavState);
    contentView.webContents.on('dom-ready', sendNavState);
  } catch (e) { }

  // Responder a solicitudes del renderer de controls para enviar estado actual
  ipcMain.removeAllListeners('request-nav-state');
  ipcMain.on('request-nav-state', () => sendNavState());

  win.setMenuBarVisibility(false);

  // Permitir abrir/cerrar DevTools con F12 (útil cuando las teclas no llegan)
  try {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        try {
          const controlsOpen = controlsView && controlsView.webContents && controlsView.webContents.isDevToolsOpened && controlsView.webContents.isDevToolsOpened();
          const contentOpen = contentView && contentView.webContents && contentView.webContents.isDevToolsOpened && contentView.webContents.isDevToolsOpened();
          if (controlsOpen || contentOpen) {
            try { controlsView.webContents.closeDevTools(); } catch (e) { }
            try { contentView.webContents.closeDevTools(); } catch (e) { }
          } else {
            try { controlsView.webContents.openDevTools({ mode: 'detach' }); } catch (e) { }
            try { contentView.webContents.openDevTools({ mode: 'right' }); } catch (e) { }
          }
        } catch (e) { }
        event.preventDefault();
      }
    });
  } catch (e) { }

  // Manejar eventos IPC expuestos desde el preload (controles)
  ipcMain.removeAllListeners('window-close');
  ipcMain.removeAllListeners('window-minimize');
  ipcMain.removeAllListeners('window-maximize');
  ipcMain.on('window-close', () => {
    if (!app.isQuiting && win) return win.hide();
    if (win) return win.close();
  });
  ipcMain.on('window-minimize', () => { if (win) win.minimize(); });
  ipcMain.on('window-maximize', () => {
    if (!win) return;
    if (win.isMaximized()) win.unmaximize(); else win.maximize();
  });
  // Navegación atrás/adelante desde los controles
  ipcMain.removeAllListeners('navigate-back');
  ipcMain.removeAllListeners('navigate-forward');
  ipcMain.on('navigate-back', () => {
    try {
      if (contentView && contentView.webContents && contentView.webContents.canGoBack()) contentView.webContents.goBack();
    } catch (e) { /* ignore */ }
  });
  ipcMain.on('navigate-forward', () => {
    try {
      if (contentView && contentView.webContents && contentView.webContents.canGoForward()) contentView.webContents.goForward();
    } catch (e) { /* ignore */ }
  });

  win.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => { 
    if (nowPlayingInterval) clearInterval(nowPlayingInterval);
    win = null; 
  });

  // Manejar eventos de maximizar/restaurar para ajustar correctamente los BrowserViews
  win.on('maximize', () => {
    try {
      const b = win.getContentBounds();
      controlsView.setBounds({ x: 0, y: 0, width: b.width, height: controlsHeight });
      contentView.setBounds({ x: 0, y: controlsHeight, width: b.width, height: b.height - controlsHeight });
    } catch (e) { }
  });

  win.on('unmaximize', () => {
    try {
      const b = win.getContentBounds();
      controlsView.setBounds({ x: 0, y: 0, width: b.width, height: controlsHeight });
      contentView.setBounds({ x: 0, y: controlsHeight, width: b.width, height: b.height - controlsHeight });
    } catch (e) { }
  });

  // Asegurar que la barra de controles quede encima y ajustar BrowserViews cuando la ventana cambie de tamaño
  try { win.setTopBrowserView(controlsView); } catch (e) { /* ignore if not supported */ }
  win.on('resize', () => {
    try {
      const b = win.getContentBounds();
      controlsView.setBounds({ x: 0, y: 0, width: b.width, height: controlsHeight });
      contentView.setBounds({ x: 0, y: controlsHeight, width: b.width, height: b.height - controlsHeight });
    } catch (e) { }
  });

  setupDiscordRPC(contentView);
}

function setupDiscordRPC(view) {
  client = new rpc.Client({ transport: 'ipc' });
  const configPath = path.resolve(__dirname, 'config.json');
  let updatePresenceInterval = null;

  view.webContents.on('did-finish-load', () => {
    try {
      const config = require(configPath);
      client.login({ clientId: config.ClientID }).catch(console.error);

      client.on('ready', () => {
        async function updatePresence() {
          let startTime = "Descubriendo...";

          try {
            const [title, artist, album, artwork] = await Promise.all([
              view.webContents.executeJavaScript('navigator.mediaSession.metadata?.title || null'),
              view.webContents.executeJavaScript('navigator.mediaSession.metadata?.artist || null'),
              view.webContents.executeJavaScript('navigator.mediaSession.metadata?.album || null'),
              view.webContents.executeJavaScript('navigator.mediaSession.metadata?.artwork?.[0]?.src || null')
            ]);

            const cuedMediaId = await view.webContents.executeJavaScript('localStorage.getItem("player.web-player.cuedMediaId")');

            const startTimeElement = await getStartTimeElement(view);
            startTime = startTimeElement ? startTimeElement.trim() : "Descubriendo...";

            client.request('SET_ACTIVITY', {
              pid: process.pid,
              activity: {
                details: `${artist} - ${title}`,
                timestamps: {
                  start: startTime ? Date.now() - parseTimestamp(startTime) : null,
                },
                assets: {
                  large_image: artwork,
                  large_text: album,
                },
                buttons: [
                  {
                    label: config.Button1,
                    url: `https://open.soniditos.com/track/${encodeURIComponent(cuedMediaId)}/${encodeURIComponent(artist)}?utm_source=discord&utm_medium=desktop`
                  }
                ],
                type: 2
              }
            });
          } catch (err) {
            console.error('Error en updatePresence:', err.message);
          }
        }

        // Limpiar intervalo anterior si existe
        if (updatePresenceInterval) clearInterval(updatePresenceInterval);
        updatePresenceInterval = setInterval(updatePresence, 1000);
      });
    } catch (err) {
      console.error('Error cargando config o iniciando Discord RPC:', err.message);
    }
  });

  // Limpiar el intervalo cuando se destruya la vista
  win.on('closed', () => {
    if (updatePresenceInterval) clearInterval(updatePresenceInterval);
    updatePresenceInterval = null;
  });
}

async function getStartTimeElement(view) {
  return new Promise((resolve) => {
    let cleared = false;
    const timeoutId = setTimeout(() => {
      cleared = true;
      clearInterval(intervalId);
      resolve(null);
    }, 10000); // Timeout de 10 segundos
    
    const intervalId = setInterval(async () => {
      if (cleared) return;
      try {
        const result = await view.webContents.executeJavaScript(
          'document.querySelector("div.text-xs.text-muted.flex-shrink-0.min-w-40.text-right span")?.textContent'
        );
        if (result) {
          cleared = true;
          clearInterval(intervalId);
          clearTimeout(timeoutId);
          resolve(result);
        }
      } catch (err) {
        console.error('Error al obtener startTimeElement:', err.message);
      }
    }, 2000);
  });
}

function parseTimestamp(timestamp) {
  const [minutes, seconds] = timestamp.split(':');
  return (parseInt(minutes, 10) * 60 + parseInt(seconds, 10)) * 1000;
}

function createTray() {
  tray = new Tray(trayIconPath);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar aplicación',
      click: () => {
        if (win) win.show();
      }
    },
    {
      label: 'Cerrar',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('open.soniditos.com');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (win) win.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    try { if (tray) tray.destroy(); } catch (e) { /* ignore */ }
    app.quit();
  }
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (e, argv, workingDirectory) => {
    e.preventDefault();
    try {
      // Preferir la ventana global `win` si existe
      if (typeof win !== 'undefined' && win && !win.isDestroyed()) {
        try { win?.show?.(); } catch (err) { /* ignore */ }
        try { win?.restore?.(); } catch (err) { /* ignore */ }
        try { win?.focus?.(); } catch (err) { /* ignore */ }
        return;
      }

      // Si no hay `win`, intentar obtener la primera ventana existente
      const wins = BrowserWindow.getAllWindows();
      const singleInstance = (Array.isArray(wins) && wins.length) ? wins[0] : null;
      if (singleInstance) {
        try { singleInstance?.show?.(); } catch (err) { /* ignore */ }
        try { singleInstance?.restore?.(); } catch (err) { /* ignore */ }
        try { singleInstance?.focus?.(); } catch (err) { /* ignore */ }
        return;
      }

      // Si no hay ninguna ventana, crear una nueva
      try { createWindow(); } catch (err) { console.error('Error creando ventana en second-instance:', err); }
    } catch (err) {
      console.error('Error en second-instance handler:', err);
    }
  });
}
