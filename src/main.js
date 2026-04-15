const { app, BrowserWindow, BrowserView, Tray, Menu, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const rpc = require('discord-rpc');
const path = require('path');
const fs = require('fs');

const trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png');

let win;
let tray;
let client;
let splash;
let showWindow = () => { if (win) { win.show(); win.focus(); } };
let currentTheme = 'light'; // Track current theme ('light' or 'dark') - default LIGHT to match web defaults
let lastAppliedTheme = 'light'; // Track the last actually applied theme to avoid re-applying
let themeChangeTimeout = null; // Debounce timer for theme changes
let lastDetectedThemeId = null; // Cache last detected data-theme-id to avoid false changes
let sendThemeStateInProgress = false; // Prevent multiple simultaneous detections
let lastThemeIdChangeTime = 0; // Track when data-theme-id last changed to prevent rapid re-applies

// Get theme state path - ensure directory exists
function getThemeStatePath() {
  const userDataPath = app.getPath('userData');
  try {
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
  } catch(e) { console.error('[ERROR] failed to create userData dir:', e); }
  return path.join(userDataPath, 'theme-state.json');
}

const themeStatePath = getThemeStatePath();

// Load theme from file OR default to 'light' (matching most web defaults like Spotify)
function loadTheme() {
  try {
    if (fs.existsSync(themeStatePath)) {
      const content = fs.readFileSync(themeStatePath, 'utf8');
      const data = JSON.parse(content);
      if (data && (data.theme === 'light' || data.theme === 'dark')) {
        currentTheme = data.theme;
      }
    }
    // If file doesn't exist or theme not set, keep currentTheme = 'light' (default)
  } catch(e) { console.error('[ERROR] theme load failed:', e); }
  return currentTheme;
}

// Save theme to file
function saveTheme(theme) {
  try {
    if (theme !== 'light' && theme !== 'dark') return;
    const content = JSON.stringify({ theme }, null, 2);
    fs.writeFileSync(themeStatePath, content, 'utf8');
    currentTheme = theme;
  } catch(e) { console.error('[ERROR] theme save failed:', e); }
}

// Get background color for theme
function getThemeColor(theme) {
  return theme === 'light' ? '#ffffff' : '#0f0f0f';
}

// Get splash filename for theme
function getSplashFile(theme) {
  return path.join(__dirname, theme === 'light' ? 'splash-light.html' : 'splash-dark.html');
}

function closeSplash(immediate = false) {
  try {
    if (!splash) return;
    try { splash.webContents.executeJavaScript('window.fadeOut && window.fadeOut()').catch(()=>{}); } catch (e) {}
    const doClose = () => { try { if (splash && !splash.isDestroyed()) splash.close(); } catch(e){} splash = null; };
    if (immediate) doClose(); else setTimeout(doClose, 500);
  } catch (e) { splash = null; }
}

function createWindow() {
  // Load persisted theme (or default to 'dark')
  loadTheme();
  lastAppliedTheme = currentTheme; // Initialize lastAppliedTheme
  const bgColor = getThemeColor(currentTheme);

  // Create splash with correct theme
  try {
    splash = new BrowserWindow({
      width: 1281,
      height: 850,
      center: true,
      frame: false,
      show: true,
      transparent: false,
      backgroundColor: getThemeColor(currentTheme),
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    splash.loadFile(getSplashFile(currentTheme));
  } catch(e) { console.error('[ERROR] splash creation failed:', e); }

  // Create main window with persisted theme background
  win = new BrowserWindow({
    width: 1281,
    height: 850,
    minWidth: 1281,
    minHeight: 850,
    center: true,
    show: false,
    frame: false,
    backgroundColor: bgColor,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    }
  });

  // (ready-to-show no se usa aquí: tryShowIfReady gestiona cuándo mostrar win)

  // Create two BrowserViews: controls (top, fixed 40px) and content (rest)
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

  const contentBounds = win.getContentBounds();
  const controlsHeight = 40;
  controlsView.setBounds({ x: 0, y: 0, width: contentBounds.width, height: controlsHeight });
  contentView.setBounds({ x: 0, y: controlsHeight, width: contentBounds.width, height: contentBounds.height - controlsHeight });

  // Load controls and content
  try {
    controlsView.webContents.loadFile(path.join(__dirname, 'controls.html'));
  } catch (e) {
    controlsView.webContents.loadURL(`file://${path.join(__dirname, 'controls.html')}`);
  }

  contentView.webContents.loadURL('https://open.soniditos.com');
  contentView.webContents.on('did-finish-load', () => contentView.webContents.setZoomFactor(1.0));

  // Detect theme when DOM is ready
  let domReadyTriggered = false;
  contentView.webContents.on('dom-ready', () => {
    if (domReadyTriggered) return;
    domReadyTriggered = true;
    sendThemeState(true);
  });

  // Track loading state
  let controlsLoaded = false;
  let contentLoaded = false;
  const splashStartTime = Date.now();
  const MIN_SPLASH_MS = 2000;

  function tryShowIfReady() {
    if (controlsLoaded && contentLoaded) {
      const elapsed = Date.now() - splashStartTime;
      const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
      setTimeout(() => {
        try {
          try { controlsView.webContents.executeJavaScript("document.documentElement.classList.add('visible')"); } catch(e){}
          try { contentView.webContents.executeJavaScript("document.documentElement.classList.add('visible')"); } catch(e){}

          if (splash && splash.webContents) {
            try { splash.webContents.executeJavaScript('window.fadeOut && window.fadeOut()').catch(()=>{}); } catch(e){}
            setTimeout(() => {
              try { if (!win.isVisible()) win.show(); } catch(e){}
              try { if (splash && !splash.isDestroyed()) { splash.close(); } } catch(e){}
              splash = null;
            }, 300);
          } else {
            if (!win.isVisible()) win.show();
          }
        } catch (e) { console.error('[ERROR] tryShowIfReady:', e); }
      }, remaining);
    }
  }

  try { 
    controlsView.webContents.on('did-finish-load', () => { 
      console.log('[CONTROLS-LOADED] Applying theme class:', currentTheme);
      // Apply theme class immediately when controls load
      if (currentTheme === 'light') {
        try { controlsView.webContents.executeJavaScript("document.body.classList.add('light')"); } catch(e){}
      } else {
        try { controlsView.webContents.executeJavaScript("document.body.classList.remove('light')"); } catch(e){}
      }
      controlsLoaded = true; 
      tryShowIfReady(); 
    }); 
  } catch(e){}
  try { contentView.webContents.on('did-finish-load', () => { contentLoaded = true; tryShowIfReady(); }); } catch(e){}

  // Helper functions
  function sendNavState() {
    try {
      const canGoBack = !!(contentView && contentView.webContents && contentView.webContents.canGoBack && contentView.webContents.canGoBack());
      const canGoForward = !!(contentView && contentView.webContents && contentView.webContents.canGoForward && contentView.webContents.canGoForward());
      try { controlsView.webContents.send('nav-state', { canGoBack, canGoForward }); } catch (e) { }
    } catch (e) { }
  }

  async function sendNowPlaying() {
    try {
      if (!contentView || !contentView.webContents) return;
      const title = await contentView.webContents.executeJavaScript('navigator.mediaSession.metadata?.title || null').catch(() => null);
      const artist = await contentView.webContents.executeJavaScript('navigator.mediaSession.metadata?.artist || null').catch(() => null);
      const artwork = await contentView.webContents.executeJavaScript('navigator.mediaSession.metadata?.artwork?.[0]?.src || null').catch(() => null);
      const playbackState = await contentView.webContents.executeJavaScript('navigator.mediaSession.playbackState || null').catch(() => null);
      try { controlsView.webContents.send('now-playing', { title, artist, artwork, playbackState }); } catch (e) { }
    } catch (e) { }
  }

  async function sendThemeState(forceApply = false) {
    try {
      if (sendThemeStateInProgress) return;
      sendThemeStateInProgress = true;

      if (!contentView || !contentView.webContents) {
        sendThemeStateInProgress = false;
        return;
      }

      // data-theme-id is ALWAYS present: "1"=dark, "2"=light
      const themeId = await contentView.webContents.executeJavaScript(
        'document.documentElement.getAttribute("data-theme-id")'
      ).catch(() => null);

      // If not readable (page still loading), do nothing - never change theme on missing data
      if (themeId !== '1' && themeId !== '2') {
        sendThemeStateInProgress = false;
        return;
      }

      const detectedTheme = themeId === '2' ? 'light' : 'dark';

      if (detectedTheme !== lastAppliedTheme || forceApply) {
        lastDetectedThemeId = themeId;
        lastAppliedTheme = detectedTheme;
        saveTheme(detectedTheme);
        const newBgColor = getThemeColor(detectedTheme);
        try { win.setBackgroundColor(newBgColor); } catch(e){}
        if (detectedTheme === 'light') {
          try { controlsView.webContents.executeJavaScript("document.body.classList.add('light')"); } catch(e){}
        } else {
          try { controlsView.webContents.executeJavaScript("document.body.classList.remove('light')"); } catch(e){}
        }
      } else {
        lastDetectedThemeId = themeId;
      }

      try { controlsView.webContents.send('theme-state', { themeFromId: detectedTheme, dataThemeId: themeId, isLight: detectedTheme === 'light' }); } catch(e){}
      sendThemeStateInProgress = false;
    } catch(e) {
      sendThemeStateInProgress = false;
    }
  }

  // Setup intervals and event listeners
  let nowPlayingInterval = null;
  try {
    nowPlayingInterval = setInterval(sendNowPlaying, 1000);
    contentView.webContents.on('did-finish-load', sendNowPlaying);
    contentView.webContents.on('did-navigate', sendNowPlaying);
    contentView.webContents.on('did-navigate-in-page', sendNowPlaying);
  } catch (e) { }

  let themeInterval = null;
  try {
    // Inject a MutationObserver in the page that caches data-theme-id into window.__sntThemeId
    // This way changes are captured instantly; we only need a fast lightweight poll to read the cached value
    function injectThemeObserver() {
      try {
        contentView.webContents.executeJavaScript(`
          (function() {
            window.__sntThemeId = document.documentElement.getAttribute('data-theme-id');
            if (window.__sntThemeObserver) window.__sntThemeObserver.disconnect();
            window.__sntThemeObserver = new MutationObserver(function() {
              window.__sntThemeId = document.documentElement.getAttribute('data-theme-id');
            });
            window.__sntThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-id'] });
          })();
        `).catch(() => {});
      } catch(e) {}
    }

    contentView.webContents.on('did-finish-load', () => { 
      injectThemeObserver();
      sendThemeState(true);
      contentLoaded = true; 
      tryShowIfReady(); 
    });
    contentView.webContents.on('did-navigate', () => {
      injectThemeObserver();
      sendThemeState(true);
    });
    contentView.webContents.on('did-navigate-in-page', () => {
      injectThemeObserver();
      sendThemeState(true);
    });

    // Fast poll every 300ms reading only the cached window.__sntThemeId (set by MutationObserver)
    // Much cheaper than running executeJavaScript on the full DOM every tick
    themeInterval = setInterval(async () => {
      try {
        if (sendThemeStateInProgress || !contentView || !contentView.webContents) return;
        const themeId = await contentView.webContents.executeJavaScript('window.__sntThemeId || null').catch(() => null);
        if (themeId !== '1' && themeId !== '2') return;
        if (themeId !== lastDetectedThemeId) {
          await sendThemeState(true);
        }
      } catch(e) {}
    }, 300);
  } catch (e) { }

  try {
    contentView.webContents.on('did-navigate', sendNavState);
    contentView.webContents.on('did-navigate-in-page', sendNavState);
    contentView.webContents.on('did-finish-load', sendNavState);
    contentView.webContents.on('dom-ready', sendNavState);
  } catch (e) { }

  ipcMain.removeAllListeners('request-nav-state');
  ipcMain.on('request-nav-state', () => sendNavState());

  win.setMenuBarVisibility(false);

  // DevTools toggle with F12
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

  // IPC Handlers for window controls
  ipcMain.removeAllListeners('window-close');
  ipcMain.removeAllListeners('window-minimize');
  ipcMain.removeAllListeners('window-maximize');
  ipcMain.on('window-close', () => {
    app.isQuiting = true;
    if (win) win.close();
  });
  ipcMain.on('window-minimize', () => { if (win) win.minimize(); });
  ipcMain.on('window-maximize', () => {
    if (!win) return;
    if (win.isMaximized()) win.unmaximize(); else win.maximize();
  });

  // Navigation handlers
  ipcMain.removeAllListeners('navigate-back');
  ipcMain.removeAllListeners('navigate-forward');
  ipcMain.on('navigate-back', () => {
    try {
      if (contentView && contentView.webContents && contentView.webContents.canGoBack()) contentView.webContents.goBack();
    } catch (e) { }
  });
  ipcMain.on('navigate-forward', () => {
    try {
      if (contentView && contentView.webContents && contentView.webContents.canGoForward()) contentView.webContents.goForward();
    } catch (e) { }
  });

  // Window events
  win.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => { 
    if (nowPlayingInterval) clearInterval(nowPlayingInterval);
    if (themeInterval) clearInterval(themeInterval);
    win = null; 
  });

  win.on('maximize', () => {
    try {
      const b = win.getContentBounds();
      controlsView.setBounds({ x: 0, y: 0, width: b.width, height: controlsHeight });
      contentView.setBounds({ x: 0, y: controlsHeight, width: b.width, height: b.height - controlsHeight });
      try { controlsView.webContents.send('window-maximized', true); } catch (e) { }
    } catch (e) { }
  });

  win.on('unmaximize', () => {
    try {
      const b = win.getContentBounds();
      controlsView.setBounds({ x: 0, y: 0, width: b.width, height: controlsHeight });
      contentView.setBounds({ x: 0, y: controlsHeight, width: b.width, height: b.height - controlsHeight });
      try { controlsView.webContents.send('window-maximized', false); } catch (e) { }
    } catch (e) { }
  });

  try { win.setTopBrowserView(controlsView); } catch (e) { }

  // Helper para restaurar la ventana desde tray: recalcula bounds de las vistas
  showWindow = () => {
    try {
      if (!win || win.isDestroyed()) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      // Esperar a que la ventana esté completamente visible antes de recalcular bounds
      setTimeout(() => {
        try {
          const b = win.getContentBounds();
          if (b.width > 0 && b.height > 0) {
            controlsView.setBounds({ x: 0, y: 0, width: b.width, height: controlsHeight });
            contentView.setBounds({ x: 0, y: controlsHeight, width: b.width, height: b.height - controlsHeight });
          }
        } catch (e) { }
      }, 50);
    } catch (e) { }
  };

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
      click: () => showWindow()
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

  tray.on('click', () => showWindow());
  tray.on('double-click', () => showWindow());
}

// Auto-update: silent download, install automatically when app quits
let updateDownloaded = false;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-downloaded', () => {
  updateDownloaded = true;
  // Add tray menu option to install now
  if (tray) {
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Actualización lista — Reiniciar para instalar', enabled: false },
      { label: 'Reiniciar y actualizar', click: () => { autoUpdater.quitAndInstall(); } },
      { type: 'separator' },
      { label: 'Mostrar aplicación', click: () => showWindow() },
      { label: 'Cerrar', click: () => { app.isQuiting = true; app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
    tray.setToolTip('Soniditos — Actualización lista');
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Check for updates silently 3 seconds after startup
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 3000);

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
        try { showWindow(); } catch (err) { /* ignore */ }
        return;
      }

      // Si no hay `win`, intentar obtener la primera ventana existente
      const wins = BrowserWindow.getAllWindows();
      const singleInstance = (Array.isArray(wins) && wins.length) ? wins[0] : null;
      if (singleInstance) {
        try { singleInstance?.show?.(); } catch (err) { /* ignore */ }
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
