# Aurora Music Player

Reproductor de música **offline-first** pensado para **WebXDC**: se comparte como archivo `.xdc` en un chat de Delta Chat y funciona sin red, sin cuenta y sin servidor. Carga archivos locales (MP3, M4A, FLAC, WAV, OGG, Opus), lee ID3 y letras LRC.

**Versión:** 1.2.0 · licencia MIT

## Empaquetar como .xdc (Delta Chat)

Requisito: Python 3 (solo biblioteca estándar, sin dependencias).

```bash
python3 build-xdc.py            # genera aurora-music-player.xdc
python3 build-xdc.py --check    # valida el .xdc generado
```

El script comprueba antes de comprimir:

- `index.html` en la raíz del ZIP
- `manifest.toml` con `name` y `source_code_url`
- `icon.png` cuadrado de 128–512 px
- todas las rutas relativas y presentes en el paquete
- ninguna carga remota (un `.xdc` no tiene red)
- que ningún `webxdc.js` viaje en el paquete (lo inyecta el cliente)

El resultado es un ZIP con compresión Deflate, **28 archivos y ~297 KB**, reproducible (mismo contenido → mismo SHA-256).

### Probar en Delta Chat

1. `python3 build-xdc.py`
2. Adjunta `aurora-music-player.xdc` en un chat (o en «Mensajes guardados») y envíalo.
3. Tócalo para abrirlo: la app arranca dentro del chat.
4. Pulsa **+** y elige tus archivos de audio. Los datos quedan en esa instancia del `.xdc`.

> **Cada copia del `.xdc` guarda su propia biblioteca.** Si reenvías el archivo se crea una instancia nueva y vacía. Usa siempre la misma copia y exporta una copia de seguridad (Ajustes → Exportar) antes de cambiar de chat o de versión.

### Qué cambia dentro de Delta Chat

- Los enlaces externos están bloqueados por el cliente: en «Acerca de» el enlace al código fuente se sustituye por la URL en texto.
- El selector de carpetas se desactiva (se eligen archivos, no carpetas).
- «Compartir» usa `sendToChat` para enviar audio, letras o listas al chat.
- La API `window.webxdc` la inyecta el cliente: `index.html` referencia `webxdc.js` (ruta exacta) y ningún `webxdc.js` viaja en el `.xdc`, como manda la spec webxdc. Si el paquete llevara uno propio (p. ej. en `js/`), el cliente no lo reemplazaría y los envíos al chat se perderían en silencio.

## Ejecutar en un navegador

No hay build ni dependencias. Abre `index.html` o sirve la carpeta:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

En navegador no hay API webxdc (la referencia a `webxdc.js` no resuelve): las exportaciones se descargan como archivos y la selección de archivos usa el selector del navegador. Para simular Delta Chat, el simulador oficial `webxdc-dev` o el `webxdc.js` de Hello funcionan sin tocar el paquete.

## Contenido

| Ruta | Qué es |
|---|---|
| `index.html` | Markup de la app (vistas, hojas, sprite de iconos) |
| `css/styles.css` | Estilos, temas y acentos (toda la CSS vive en `css/`) |
| `js/data.js` | Traducciones (8 idiomas) y utilidades de datos |
| `js/storage.js` | Persistencia en IndexedDB |
| `js/uploader.js` | Lectura de archivos, ID3 y LRC |
| `js/` | Todo el JavaScript propio: módulos de la app (audio, UI, listas, letras, ajustes…) |
| `assets/` | Fuente Outfit, iconos y jsmediatags (`assets/js/`) |
| `build-xdc.py` | Empaquetado y validación del `.xdc` |
| `manifest.toml`, `icon.png` | Metadatos e icono del WebXDC |
| `README.md`, `LICENSE` | Documentación y licencia |
| `docs/AUDITORIA.md`, `docs/INFORME-PULIDO-UI.md` | Informes de auditoría y del pulido de interfaz |

El repositorio contiene únicamente la aplicación y su empaquetador: no incluye servidor Node, suite de pruebas, CI ni dependencias externas.
