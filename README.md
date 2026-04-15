<p align="center">
  <img src="https://open.soniditos.com/cat_footer.svg" width="80" />
</p>

<h1 align="center">Soniditos Desktop</h1>

<p align="center">
  Aplicación de escritorio oficial de <a href="https://open.soniditos.com">open.soniditos.com</a>
</p>

<p align="center">
  <a href="https://github.com/soniditos/soniditos-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/soniditos/soniditos-desktop?style=for-the-badge&label=Descargar&logoColor=d9e0ee&colorA=363a4f&colorB=b7bdf8"/></a>
  <a href="/LICENSE"><img src="https://img.shields.io/static/v1.svg?style=for-the-badge&label=Licencia&message=MIT&logoColor=d9e0ee&colorA=363a4f&colorB=b7bdf8"/></a>
</p>

---

## Características

- Controles de ventana personalizados (minimizar, maximizar, cerrar)
- Barra de título con tema claro/oscuro automático, sincronizado con la web
- Canción actual visible en la barra de título
- Integración con Discord RPC — muestra lo que estás escuchando
- Icono en la bandeja del sistema
- Actualizaciones automáticas silenciosas

## Instalación

Descarga el instalador desde [Releases](https://github.com/soniditos/soniditos-desktop/releases/latest) y ejecútalo.

La aplicación se actualiza automáticamente al abrirse cuando hay una nueva versión disponible.

## Desarrollo

**Requisitos:** Node.js 18+ y npm

```bash
git clone https://github.com/soniditos/soniditos-desktop.git
cd soniditos-desktop
npm install
npm start
```

**Compilar instalador:**
```bash
npm run build
```

## Tecnologías

- [Electron](https://electronjs.org)
- [electron-builder](https://electron.build)
- [electron-updater](https://www.electron.build/auto-update)
- [discord-rpc](https://github.com/discordjs/RPC)

---

<p align="center">
  Copyright &copy; 2026 Soniditos
</p>
