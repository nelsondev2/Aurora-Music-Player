# Aurora Music Player

Reproductor de música **offline-first** en una sola página: carga archivos locales (MP3, M4A, FLAC, WAV, OGG, Opus), lee ID3 y letras LRC, y funciona sin servidor, sin cuenta y sin nube.

**Versión:** 1.2.0 · licencia MIT

## Ejecutar

No hay build, ni dependencias, ni instalación.

1. Abre `index.html` en el navegador, o
2. Sirve la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

> Recomendado servir por HTTP: algunos navegadores restringen IndexedDB en `file://`.

## Contenido

| Ruta | Qué es |
|---|---|
| `index.html` | Markup de la app (vistas, hojas, sprite de iconos) |
| `styles.css` | Estilos, temas y acentos |
| `data.js` | Traducciones (8 idiomas) y utilidades de datos |
| `storage.js` | Persistencia en IndexedDB |
| `uploader.js` | Lectura de archivos, ID3 y LRC |
| `webxdc.js` | Stub de compatibilidad WebXDC |
| `js/` | Módulos de la app (audio, UI, listas, letras, ajustes…) |
| `assets/` | Fuente Outfit e iconos |
| `icon.png`, `manifest.toml`, `metadata.json` | Icono y metadatos de empaquetado WebXDC |
| `LICENSE` | MIT |

## Documentación

- [`docs/AUDITORIA.md`](docs/AUDITORIA.md): informe de la auditoría técnica 1.2.0 (seguridad, accesibilidad, pruebas y despliegue).

Este repositorio contiene únicamente el código necesario para ejecutar la aplicación: no incluye servidor Node, suite de pruebas, CI ni herramientas de empaquetado.
