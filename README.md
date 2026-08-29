# Aurora Music Player

Reproductor de música **offline-first**, mobile-first. Carga tus archivos locales (MP3, M4A, FLAC, WAV, OGG, Opus), lee metadatos ID3 y letras LRC, y funciona sin servidor ni cuenta.

Abre `index.html` en el navegador. No hace falta build.

## Qué incluye

- Biblioteca local persistida en IndexedDB
- Playlists, favoritos, cola, shuffle y repeat
- Letras sincronizadas (LRC) con editor, offset y loop
- Ecualizador de 5 bandas y temporizador sleep
- Temas (oscuro / claro / AMOLED), acentos e i18n (es, en, pt, zh, ja, fr, it, ru)
- Estadísticas e historial de reproducción
- Restaura la sesión (pista, cola y posición)

## Uso

1. Abre `index.html`.
2. Pulsa **+** o *Cargar música del dispositivo* y elige archivos (o una carpeta).
3. Reproduce, crea listas y, si tienes un `.lrc` con el mismo nombre, la letra se empareja sola.

Atajos de teclado (escritorio): `Espacio` play/pausa, `←` `→` seek (±5 s, Shift = pista), `↑` `↓` volumen, `M` silencio, `L` favorito, `N`/`P` siguiente/anterior, `Esc` cierra paneles.

## Empaquetar como WebXDC (opcional)

Sigue siendo un `.xdc` válido para Delta Chat, **sin sincronización P2P**: cada dispositivo reproduce su propia biblioteca.

```bash
python3 build-xdc.py
```

Salida: `aurora-music-player.xdc`.

## Licencia

MIT. Ver `LICENSE`.
