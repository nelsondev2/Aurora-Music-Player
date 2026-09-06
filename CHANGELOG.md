# Changelog

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/). Versionado semver.

## 1.0.0 — 2026-08-29

Primera versión publicable. Reproductor **local y offline-first** (sin P2P).

### Añadido
- Inicio como hub (continuar, recientes, listas, más escuchadas) y pantalla de bienvenida.
- Mini-player persistente, menú de pista, vistas Álbum / Artista.
- Shuffle Fisher–Yates, gapless con EQ, crossfade opcional, normalización, sleep con fade.
- Importación con progreso, listas virtuales, miniaturas, collage de playlists.
- Now Playing: marquee, gestos en portada, buffer, letras con empty state y karaoke Enhanced LRC.
- Ajustes completos (reproducción, interfaz, almacenamiento, acerca de).
- Atajos de teclado (`?`), layout desktop (≥ 900 px), tests en `tests.html`.

### Cambiado
- Font Awesome recortado: solo solid + regular (sin brands ni v4compatibility).
- Tema claro: contraste de nav, toasts y sheets.

### Eliminado
- Sincronización P2P, oyentes y envío de pistas.

### Corregido
- Las playlists se abrían detrás de Biblioteca.
- Sheets EQ/Sleep recortados en el marco móvil.
