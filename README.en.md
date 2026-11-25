<p align="center"><a href="README.md">Español</a> · <b>English</b></p>

<h1 align="center">Soniditos Desktop</h1>

<p align="center">
  Official desktop client for <a href="https://open.soniditos.com">open.soniditos.com</a>
</p>

<p align="center">
  <a href="https://github.com/soniditos/soniditos-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/soniditos/soniditos-desktop?style=for-the-badge&label=Download&logoColor=d9e0ee&colorA=363a4f&colorB=b7bdf8"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/static/v1.svg?style=for-the-badge&label=License&message=MIT&logoColor=d9e0ee&colorA=363a4f&colorB=b7bdf8"/></a>
</p>

---
## For users 🙋‍♂️

### Installation

Download the installer from [**Releases**](https://github.com/soniditos/soniditos-desktop/releases/latest), run it and you're done.

The app **updates automatically** when a new version is available.

### What it does

- **Custom control bar** with built-in window and navigation buttons.
- **Automatic theme** detects the site's light or dark theme and adapts the window instantly.
- **Current song** shown in the window title.
- **Discord Rich Presence** shows what you are listening to on your Discord profile, with cover art and a direct link to the song.
- **Single instance** if the app is already open, brings it to the front instead of opening another window.

---

## For developers 👨‍💻

### Requirements

- Node.js 18+
- npm 9+

### Running in development

```bash
git clone https://github.com/soniditos/soniditos-desktop.git
cd soniditos-desktop
npm install
npm start
```

### Project structure

```
soniditos-desktop/
├── src/
│   ├── main.js             # Main process — window, views, IPC, theme, RPC, auto-update
│   ├── controls.html       # Custom title bar (40 px BrowserView)
│   ├── preload.js          # IPC bridge between main.js and controls.html (contextBridge)
│   ├── splash-dark.html    # Splash screen — dark theme
│   ├── splash-light.html   # Splash screen — light theme
│   ├── config.json         # Discord RPC configuration (Client ID and texts)
│   └── assets/             # App and system tray icons
├── build/
│   └── installer.nsh       # NSIS installer customization (Windows)
└── package.json
```

### How it works inside

**Window and views**

The main window has no native frame (`frame: false`). Two `BrowserView`s are mounted on it:

| View           | Position               | Content                                             |
| -------------- | ---------------------- | --------------------------------------------------- |
| `controlsView` | Fixed 40 px at the top | `controls.html` — window controls, nav, now playing |
| `contentView`  | The rest               | `https://open.soniditos.com`                        |

**Theme synchronization**

The site exposes `data-theme-id` on the `<html>` element — `"1"` for dark, `"2"` for light. When the page loads, a `MutationObserver` is injected that caches the value in `window.__sntThemeId`. A 300 ms interval reads that cache and, if it has changed, adjusts the window's `backgroundColor` and the CSS class of `controls.html`.

**Discord Rich Presence**

It reads `navigator.mediaSession` (title, artist, album, cover) and the playback timestamp directly from the DOM every second. The presence includes the cover as an image and a button that links to the song on open.soniditos.com.

**Automatic updates**

`electron-updater` checks GitHub Releases 3 seconds after startup. The download is silent; the installation runs automatically on exit. When the update is ready, the tray menu shows the option to restart and install it.

### Scripts

| Command         | Description                                           |
| --------------- | ----------------------------------------------------- |
| `npm start`     | Starts in development mode                            |
| `npm run build` | Builds the installer locally without publishing       |
| `npm run icon`  | Regenerates all icons from `src/assets/tray-icon.png` |

---

<p align="center">
	Repository made by <a href="https://github.com/virtuanista" target="_blank">virtu 🎣</a>
</p>

<p align="center">
	<img src="https://open.soniditos.com/cat_footer.svg" />
</p>

<p align="center">
	Copyright &copy; 2026
</p>

<p align="center">
	<a href="LICENSE"><img src="https://img.shields.io/static/v1.svg?style=for-the-badge&label=License&message=MIT&logoColor=d9e0ee&colorA=363a4f&colorB=b7bdf8"/></a>
</p>
