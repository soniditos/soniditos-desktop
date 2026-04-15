<h1 align="center">Soniditos Desktop</h1>

<p align="center">
  Cliente de escritorio oficial para <a href="https://open.soniditos.com">open.soniditos.com</a>
</p>

<p align="center">
  <a href="https://github.com/soniditos/soniditos-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/soniditos/soniditos-desktop?style=for-the-badge&label=Descargar&logoColor=d9e0ee&colorA=363a4f&colorB=b7bdf8"/></a>
  <a href="/LICENSE"><img src="https://img.shields.io/static/v1.svg?style=for-the-badge&label=Licencia&message=MIT&logoColor=d9e0ee&colorA=363a4f&colorB=b7bdf8"/></a>
</p>

---
## Para usuarios 🙋‍♂️

## Instalación

Descarga el instalador desde [**Releases**](https://github.com/soniditos/soniditos-desktop/releases/latest), ejecútalo y listo.

La app se **actualiza automáticamente** cuando hay una nueva versión disponible.

## Qué hace

- **Barra de controles personalizada** con botones de ventana y navegación integrados.
- **Tema automático** detecta el tema claro u oscuro de la web y adapta la ventana al instante.
- **Canción en curso** visible en el título de la ventana.
- **Discord Rich Presence** muestra lo que estás escuchando en tu perfil de Discord con portada y enlace directo a la canción.
- **Instancia única** si la app ya está abierta, la trae al frente en lugar de abrir otra ventana.

---

## Para desarrolladores 👨‍💻

### Requisitos

- Node.js 18+
- npm 9+
- electron
- electron-builder

### Arrancar en desarrollo

```bash
git clone https://github.com/soniditos/soniditos-desktop.git
cd soniditos-desktop
npm install
npm run start
```

### Estructura del proyecto

```
soniditos-desktop/
├── src/
│   ├── main.js             # Proceso principal — ventana, vistas, IPC, tema, RPC, auto-update
│   ├── controls.html       # Barra de título personalizada (BrowserView de 40 px)
│   ├── preload.js          # Puente IPC entre main.js y controls.html (contextBridge)
│   ├── splash-dark.html    # Pantalla de carga — tema oscuro
│   ├── splash-light.html   # Pantalla de carga — tema claro
│   ├── config.json         # Configuración de Discord RPC (Client ID y textos)
│   └── assets/             # Iconos de app y bandeja del sistema
├── build/
│   └── installer.nsh       # Personalización del instalador NSIS (Windows)
└── package.json
```

### Cómo funciona por dentro

**Ventana y vistas**

La ventana principal no tiene borde nativo (`frame: false`). Sobre ella se montan dos `BrowserView`:

| Vista            | Posición          | Contenido                                                   |
| ---------------- | ------------------ | ----------------------------------------------------------- |
| `controlsView` | 40 px fijos arriba | `controls.html` — controles de ventana, nav, now playing |
| `contentView`  | El resto           | `https://open.soniditos.com`                              |

**Sincronización de tema**

La web expone `data-theme-id` en el elemento `<html>` — `"1"` para oscuro, `"2"` para claro. Al cargar la página se inyecta un `MutationObserver` que cachea el valor en `window.__sntThemeId`. Un intervalo de 300 ms lee ese cache y, si cambió, ajusta el `backgroundColor` de la ventana y la clase CSS de `controls.html`.

**Discord Rich Presence**

Lee `navigator.mediaSession` (título, artista, álbum, portada) y el timestamp de reproducción directamente del DOM cada segundo. La presencia incluye la portada como imagen y un botón que enlaza a la canción en open.soniditos.com.

**Actualizaciones automáticas**

`electron-updater` comprueba GitHub Releases 3 segundos después del arranque. La descarga es silenciosa; la instalación se ejecuta automáticamente al salir. Mientras la actualización está lista, el menú de bandeja muestra la opción de reiniciar para instalarla.

### Scripts

| Comando           | Descripción                                                 |
| ----------------- | ------------------------------------------------------------ |
| `npm start`     | Arranca en modo desarrollo                                   |
| `npm run build` | Compila el instalador localmente sin publicar                |
| `npm run icon`  | Regenera todos los iconos desde `src/assets/tray-icon.png` |

---

<p align="center">
	Repositorio generado por <a href="https://github.com/virtuanista" target="_blank">virtu 🎣</a>
</p>

<p align="center">
	<img src="https://open.soniditos.com/cat_footer.svg" />
</p>

<p align="center">
	Copyright &copy; 2026
</p>

<p align="center">
	<a href="/LICENSE"><img src="https://img.shields.io/static/v1.svg?style=for-the-badge&label=License&message=MIT&logoColor=d9e0ee&colorA=363a4f&colorB=b7bdf8"/></a>
</p>
