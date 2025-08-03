/**
 * Soniditos Desktop - Cliente de escritorio para open.soniditos.com
 * 
 * Aplicación Electron que crea una ventana con controles personalizados
 * para mostrar la web de Soniditos con una interfaz nativa.
 * Incluye icono en la bandeja del sistema para gestionar la aplicación.
 */
const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const rpc = require('discord-rpc');
const path = require('path');

const trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png');

let win;
let tray;
let client;

function createWindow() {
  win = new BrowserWindow({
    width: 1281,
    height: 850,
    minWidth: 1281,
    minHeight: 850,
    center: true,
    show: true,
    frame: true,
    backgroundColor: '#11141A',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(app.getAppPath(), 'src', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      zoomFactor: 1.0,
      webSecurity: true
    }
  });

  // Cargar el archivo HTML local que contiene la web embebida
  // win.loadFile(path.join(__dirname, 'container.html'));
  win.loadURL('https://open.soniditos.com');

  win.webContents.on('did-finish-load', () => {
    // Restablecer zoom cada vez que se carga la página
    win.webContents.setZoomFactor(1.0);
  });

  win.setMenuBarVisibility(false);

  // Eventos para los controles de ventana personalizados
  ipcMain.on('window-close', () => {
    if (!app.isQuiting) {
      win.hide();
    } else {
      win.close();
    }
  });

  ipcMain.on('window-minimize', () => {
    win.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  win.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      win.hide();
    }
  });

  setupDiscordRPC();
}
function setupDiscordRPC() {
  client = new rpc.Client({ transport: 'ipc' });
  const configPath = path.resolve(__dirname, '..', 'src', 'config.json');

  win.webContents.on('did-finish-load', () => {
    try {
      const config = require(configPath);
      client.login({ clientId: config.ClientID }).catch(console.error);

      client.on('ready', () => {
        async function updatePresence() {
          let startTime = "Descubriendo...";

          try {
            const [title, artist, album, artwork] = await Promise.all([
              win.webContents.executeJavaScript('navigator.mediaSession.metadata?.title || null'),
              win.webContents.executeJavaScript('navigator.mediaSession.metadata?.artist || null'),
              win.webContents.executeJavaScript('navigator.mediaSession.metadata?.album || null'),
              win.webContents.executeJavaScript('navigator.mediaSession.metadata?.artwork?.[0]?.src || null')
            ]);

            const cuedMediaId = await win.webContents.executeJavaScript('localStorage.getItem("player.web-player.cuedMediaId")');

            const startTimeElement = await getStartTimeElement();
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
                    url: `https://open.soniditos.com/track/${encodeURIComponent(cuedMediaId)}/${encodeURIComponent(artist)}`
                  }
                ],
                type: 2
              }
            });
          } catch (err) {
            console.error('Error en updatePresence:', err.message);
          }
        }

        setInterval(updatePresence, 1000);
      });
    } catch (err) {
      console.error('Error cargando config o iniciando Discord RPC:', err.message);
    }
  });
}

async function getStartTimeElement() {
  return new Promise((resolve) => {
    const intervalId = setInterval(async () => {
      try {
        const result = await win.webContents.executeJavaScript(
          'document.querySelector("div.text-xs.text-muted.flex-shrink-0.min-w-40.text-right span")?.textContent'
        );
        if (result) {
          clearInterval(intervalId);
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
        win.show();
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
    win.show();
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
    tray.destroy();
    app.quit();
  }
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (e) => {
    e.preventDefault();

    const singleInstance = BrowserWindow.getAllWindows()[0];
    if (!singleInstance.isVisible()) singleInstance.show();
    if (singleInstance.isMinimized()) singleInstance.maximize();
  });
}
