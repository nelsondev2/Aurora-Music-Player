# Changelog

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/). Versionado semver.

## [Sin publicar]

### Añadido
- Copia de seguridad re-vinculable: importar un JSON restaura también las pistas (metadatos) y reimportar los archivos les devuelve el audio, con fila «Vincular audio» en Ajustes e insignia «Sin audio».
- Importación por carpeta en el menú Más (solo escritorio; oculta en Android/webxdc nativo).
- Aviso de primer arranque en Delta Chat: la música se detiene al salir del chat.
- Visualizador de frecuencias cableado en Now Playing (barras/onda/off) con pausa fuera de pantalla, 30 fps y respeto a `prefers-reduced-motion`.
- Indicador de almacenamiento usado en Ajustes y acción «Liberar espacio» funcional.
- Caché de artwork de MediaSession (sin regenerar PNG en cada pista).

### Cambiado
- `icon.png` optimizado: 226 KB → 93 KB (el `.xdc` baja ~130 KB).
- `metadata.json` sin capacidades de plantilla ajenas a la app.

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
