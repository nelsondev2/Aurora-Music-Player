# Informe de auditoría técnica — Aurora Music Player 1.2.0

**Fecha:** 17 de octubre de 2026
**Base auditada:** `8efff93` (v1.1.1) → rama `arena/b0f3ec7c-aurora-music-player`
**Alcance:** código completo de la SPA (24 archivos de producto), servidor Express, persistencia IndexedDB, accesibilidad, configuración, pruebas y despliegue.
**Entorno de verificación:** Node.js 22.22.3, jsdom 30.1.3, fake-indexeddb 6.2.6, axe-core 4.14.0, Express 4.22.3. Sin Chromium ni k6 en el sandbox (ver Anexo A).

> **Nota de alcance del repositorio (18-10-2026).** Este repositorio se limpió después de generar el informe y ahora contiene únicamente el código de la aplicación. La suite de pruebas, el servidor Node, el CI, el Dockerfile y las herramientas de auditoría se retiraron del árbol (permanecen en el historial de git, commit `24ff6ca`). Los comandos, rutas y cifras de cobertura de este documento describen el árbol completo sobre el que se realizó la auditoría; pueden no estar disponibles en este checkout.

---

## 0. Resumen ejecutivo

La aplicación es una SPA offline-first sin build, con 20 scripts clásicos, IndexedDB para audio/metadatos y un servidor Express que solo entrega archivos estáticos. La auditoría encontró **5 hallazgos críticos, 7 altos, 11 medios y 9 bajos**. Todos los críticos y altos están corregidos y demostrados con pruebas; los medios y bajos corregidos se indican en la tabla. Quedan pendientes explícitos (no fallos abiertos) en la sección 4.

| Métrica | Antes | Después |
|---|---|---|
| Pruebas automatizadas | 0 ejecutables en Node | **129/129 en verde** |
| Cobertura de sentencias | sin medir | **50,0 %** (55,0 % líneas) |
| Violaciones axe (vista inicial + 23 hojas) | **7** | **0** |
| Vulnerabilidades `npm audit` | no verificado | **0** |
| Código del servidor expuesto por HTTP | sí (`server.js`, tests, `.git`) | **no** (lista blanca) |
| Claves i18n completas | 361 × 8 | **364 × 8** |
| Path traversal codificado | servía archivos | **400** |

**Veredicto:** apto para lanzamiento controlado. Los riesgos residuales son de operación (rate limit en memoria por instancia, cobertura de pruebas mejorable, QA manual en dispositivos reales), no de seguridad crítica.

---

## 1. Metodología

1. **Lectura línea por línea** de `index.html`, `styles.css`, `data.js`, `storage.js`, `uploader.js`, `webxdc.js`, los 15 módulos de `js/` y `server.js`.
2. **Inventarios automatizados:** ids del DOM, `innerHTML`, `aria-*`, `getElementById`, claves i18n usadas/definidas, URLs, secretos, `eval`, dependencias.
3. **Pruebas de comportamiento reales:** la app completa se arranca en jsdom y se ejercita con eventos (`click`, `input`, `change`), `File` reales, IndexedDB falso y el servidor HTTP real en un puerto efímero.
4. **Auditoría de accesibilidad** con axe-core sobre la vista inicial, el reproductor, la cola, las 23 hojas abiertas una a una y flujos con datos.
5. **Seguridad del servidor:** peticiones con rutas crudas (`http.request`) para evitar la normalización de `fetch`, comprobación de cabeceras, MIME, caché, gzip/304, rate limit y errores.
6. **Cada corrección tiene una prueba** que falla sin ella (ver columna «Evidencia»). No se aceptó «funciona en mi máquina» como evidencia.

---

## 2. Hallazgos por severidad

### 2.1 Críticos

| ID | Hallazgo | Impacto | Solución aplicada | Evidencia |
|---|---|---|---|---|
| CRIT-01 | El servidor servía **todo el repositorio**: `/server.js`, `/package.json`, `/tests/...`, `/.gitignore`, `/README.md`, `/build-xdc.py`. | Divulgación de código interno, rutas y lógica de seguridad; facilita ataques dirigidos. | Lista blanca `PUBLIC_ROOT_FILES` + `PUBLIC_DIRS` (`js`, `assets`) y comprobación con `realpath` (bloquea symlinks). | `server.test.js` → «no expone código de servidor, tests ni metadatos» |
| CRIT-02 | **Path traversal codificado**: `/assets/%2e%2e/%2e%2e/etc/passwd` se decodificaba y resolvía fuera del proyecto. | Lectura arbitraria de archivos del sistema operativo. | Middleware que rechaza `..`, `%2e%2e`, `%2f%2e` y `%00` sobre la ruta cruda; segunda barrera en `resolvePublic` (prefijo + `realpath`). | `server.test.js` con `http.request` y rutas literales |
| CRIT-03 | **XSS/inyección por importación**: ids, títulos, artistas y portadas de un JSON de backup se interpolaban en `innerHTML` y en `style="background-image:url('…')"`. | Ejecución de script en el origen de la app (robo de la biblioteca local, acciones en nombre del usuario). | `esc()` en todo texto interpolado; ids regenerados con `/^[A-Za-z0-9._-]+$/`; portadas solo `data:image/(png|jpeg|webp);base64` < 3 MB; listas M3U/JSON sin CR/LF. | `library.test.js` → «ids peligrosos se regeneran…», «portadas no válidas se descartan» |
| CRIT-04 | **Borrado masivo sin confirmación**: un toque en «Eliminar pistas» borraba N pistas de IndexedDB sin diálogo ni deshacer. | Pérdida irreversible de datos del usuario. | `showConfirm()` con el número de pistas; la cancelación no borra nada. | `ui.test.js` → «batchDeleteTracks respeta cancelar»; `lists.test.js` |
| CRIT-05 | **IndexedDB muerta**: `storage.js._tx()` asumía `this.db` abierto; si el navegador cerraba la conexión (limpieza, otra pestaña) lanzaba `TypeError` y todas las operaciones fallaban. Además, dos `open()` concurrentes abrían dos conexiones. | Pérdida de persistencia silenciosa y bloqueo de futuras migraciones de versión. | `_openPromise` única; `onblocked`/`onclose`/`onversionchange`; `_tx` con errores accionables; `_run` reintenta una vez si la conexión murió; `close()` idempotente. | `storage.test.js` (8 pruebas) |

### 2.2 Altos

| ID | Hallazgo | Impacto | Solución aplicada | Evidencia |
|---|---|---|---|---|
| ALTO-01 | `seekToTime(NaN)` convertía el valor en 0 (`Number(x) || 0`): una posición inválida **rebobinaba** la pista. | Comportamiento errático y pérdida de posición. | `if (!Number.isFinite(n)) return;` con comentario. | `playback.test.js` → «seekToTime ignora NaN/Infinity» |
| ALTO-02 | Cableado muerto: `btnEqualizer`/`btnSleep` ya no existían en el markup y sus listeners se descartaban en silencio; en una revisión previa los botones de lote apuntaban a ids distintos del HTML. | Botones que «no hacen nada», sin error visible. | `$()` null-safe + prueba de contrato HTML↔JS que compara todos los `getElementById('…')` con el markup (y lista de ids dinámicos permitidos); clics reales sobre los botones de lote. | `wiring.test.js` (5 pruebas) |
| ALTO-03 | **7 violaciones axe**: `aria-allowed-attr` en `<nav>`, portada sin nombre, 2 botones LRC sin nombre, dos `<main>`, `nested-interactive` en el mini-player, 5 regiones fuera de landmarks, diálogos sin nombre, inputs de EQ/volumen sin etiqueta. | App inutilizable con lector de pantalla; controles sin anuncio. | Un solo `role="main"`; mini-player con botón superpuesto `.mini-open`; `aria-label` en portada/LRC/volumen; `<label for>` en las 5 bandas; `aria-labelledby` automático en sheets y confirmación; `role="presentation"` en cabeceras de sheet. | `tests/a11y/axe.test.js` → **5/5, 0 violaciones** |
| ALTO-04 | `main.js` solo arrancaba en `DOMContentLoaded`; si el script se inyectaba después (tests, snippets, carga diferida) la app quedaba **en blanco**. | Arranque fallido según el orden de carga. | Comprobación de `document.readyState` + captura de errores de `init()` con toast. | `boot.test.js`, `e2e/flow.test.js` |
| ALTO-05 | Fugas de timers/RAF: el bucle de letras seguía programando RAF con la vista oculta; el selector de archivos dejaba un `<input>` en el DOM y un timer de 5 minutos si se cancelaba. | Batería/CPU en móvil; pruebas colgadas y procesos vivos. | RAF se detiene fuera de la vista y se reinicia al volver; `cancel`/focus/timeout con limpieza y `clearTimeout`; timers del arnés colgados de `window.setTimeout`. | `ui.test.js`, `lists.test.js` → «el input se retira al cancelar» |
| ALTO-06 | Exportación con **MIME incorrecto**: el stub webxdc creaba el blob como `text/plain` y las descargas JSON/M3U8 perdían el tipo. | Archivos mal tipados en el chat/descarga; integraciones que validan MIME fallan. | `exportFile` propaga `mimeType`; el stub lo usa para `plainText` y base64. | `e2e/flow.test.js` → «exportar… `application/json`» |
| ALTO-07 | **Crossfade/gapless**: el evento `ended` y el temporizador podían disparar `next()` dos veces (doble salto de pista). | Saltos de pista y reproducción inconsistente. | Cancelación del temporizador al llegar `ended`, tokens de reproducción y prueba de una sola llamada a `next`. | `playback.test.js` → «crossfade cancela el timer…» |

### 2.3 Medios

| ID | Hallazgo | Impacto | Solución | Evidencia |
|---|---|---|---|---|
| MED-01 | `aria-orientation` no permitido en `<nav>`. | HTML/ARIA inválido; lectores lo ignoran. | Atributo movido a `data-orientation` (CSS). | `axe.test.js`, `boot.test.js` |
| MED-02 | `API_RATE_LIMIT=abc` producía `NaN`; `count > NaN` siempre es falso y **desactivaba el límite**. | Falsa sensación de protección ante una mala configuración. | Validación con `Number.isFinite` y valor por defecto 120. | `server.test.js` → «API_RATE_LIMIT inválido…» |
| MED-03 | El middleware anti-traversal inspeccionaba también el query string: `?q=..` devolvía 400. | Falsos positivos en enlaces con parámetros. | Se inspecciona solo `originalUrl.split('?')[0]`. | `server.test.js` → «query legítimo con ..» |
| MED-04 | Importación no aditiva y duplicados inconsistentes (podía borrar listas existentes; favoritos/stats se sobrescribían). | Pérdida de datos al restaurar un backup. | Fusión aditiva por id, renombrado de listas, favoritos unidos, stats por máximo, dedupe por `fileName+fileSize`. | `library.test.js` (12 pruebas) |
| MED-05 | Sesión guardada cada 5 s sin deduplicar y sin volcado final; objectURLs no se liberaban. | Escrituras inútiles en IndexedDB y fugas de memoria. | `saveSession()` deduplicado; guardado en `pagehide`/`beforeunload`; `releaseAllUrls()`; bfcache respetado (`persisted`). | `boot.test.js` |
| MED-06 | Al borrar la lista en reproducción el `playContext` quedaba apuntando a una lista inexistente; borrar una pista actual dejaba la cola inconsistente; toast equivocado al borrar lista. | Cabecera «fantasma», siguiente pista errónea, mensaje confuso. | Contexto a `{type:'all'}`; purga de cola; toast `toast_playlist_deleted`. | `playlist-ui.js`, `lists.test.js` |
| MED-07 | Añadir a playlist por lote no funcionaba (`batchAddToPlaylist` abría el selector sin conservar ids). | Función Visible pero inoperante. | `_batchAddIds` + `_addTrackIdToPlaylist()` sin duplicados, con toast y persistencia. | `library.test.js`, `ui.test.js` |
| MED-08 | Shuffle desincronizado al añadir a la cola o «reproducir siguiente» (`_originalQueue` no se actualizaba). | Al desactivar shuffle se perdía el orden o faltaban pistas. | Actualización de `_originalQueue` en `addToQueue`/`playNext`; prueba. | `lists.test.js` |
| MED-09 | i18n incompleto tras añadir funciones (claves LRC/EQ/«Seleccionar pista»). | Textos en clave cruda (`lrc_speed_up`) en la UI. | 3 claves nuevas × 8 idiomas; auditoría `audit-i18n.js` 364 × 8. | `i18n.test.js`, `npm run lint` |
| MED-10 | El diálogo de confirmación y varios sheets no tenían nombre accesible; la cabecera `<header>` dentro de un `dialog` se interpretaba como banner. | Anuncios ambiguos y navegación por landmarks rota. | `aria-labelledby` al `<h3>` o `#confirmMsg`; `role="presentation"` en `.sheet-header`. | `axe.test.js` |
| MED-11 | `deleteTrack` de la pista actual no purgaba la cola hasta el siguiente render; el reproductor podía quedar apuntando a un id eliminado. | Estado inconsistente tras borrar. | Purga explícita y reinicio de contexto; pruebas con dos pistas. | `library.test.js` |

### 2.4 Bajos

| ID | Hallazgo | Corrección |
|---|---|---|
| BAJO-01 | README decía 1.1.0 y «Acerca de» 1.1.1; dos fuentes de versión. | Versión única `App.VERSION` = 1.2.0; `#aboutVersion` se rellena al arrancar; README/CHANGELOG/package.json alineados. |
| BAJO-02 | `npm test` con directorios no funcionaba en Node 22 (`Cannot find module tests/a11y`). | Scripts con globs (`tests/*/*.test.js`). |
| BAJO-03 | 40 claves i18n sin uso aparente y falso positivo `accent_` en el detector. | Documentado; las claves dinámicas (`accent_*`) se excluyen del chequeo. No se borran para no romper traducciones futuras. |
| BAJO-04 | Faltaban `aria-label` en `#volumeSlider`, `#coverArt`, botones ± de velocidad LRC. | Añadidos con `data-i18n-aria` (se traducen al cambiar idioma). |
| BAJO-05 | `package-lock.json` no estaba versionado; instalaciones no reproducibles. | Lockfile generado y usado por `npm ci` en CI/Docker. |
| BAJO-06 | `#progressAbRange` y otros controles sin estado anunciado. | `aria-pressed`/`aria-valuetext` en A-B, shuffle y repeat. |
| BAJO-07 | Errores de reproducción se tragaban en silencio (`AbortError`). | Se distingue `AbortError` (carrera benigna) de `NotAllowedError` (bloqueo real) y se apaga siempre el spinner. |
| BAJO-08 | Caché de estáticos sin estrategia por tipo. | `index.html` → `no-cache`; resto → `max-age=3600, must-revalidate`; ETag/304; gzip negociado. |
| BAJO-09 | Mensajes y logs poco claros (`toast_track_deleted` al borrar lista; logs sin estructura). | Toasts correctos; logs JSON con `level`, `msg` y campos de diagnóstico. |

### 2.5 Revisado y sin hallazgos

- **Sin `eval`/`new Function`** y sin secretos en el repositorio.
- **Sin SQL**: no hay base de datos relacional (IndexedDB local), por lo que la inyección SQL no aplica.
- **Sin CSRF**: no hay endpoints que muten estado; `/api/health` es de solo lectura.
- **CORS**: no se emite `Access-Control-Allow-Origin`; todo es same-origin, incluidos blobs.
- **Transacciones IndexedDB**: `put/delete/clear` son atómicas por operación; la importación valida antes de escribir.
- **Concurrencia de importación**: `handleFileInput` ignora llamadas simultáneas (flag `_importing` con `finally`).
- **Dependencias**: `npm audit` → 0 vulnerabilidades (producción y desarrollo).

---

## 3. Código corregido completo

Los 26 archivos modificados (23 de producto, más `.gitignore`, README y CHANGELOG) están **íntegros en el repositorio**: este informe no reproduce fragmentos parciales porque la fuente de verdad es el árbol de trabajo. Cada archivo se puede abrir, revisar y comparar con la base:

```bash
git diff 8efff93 -- .                # cambios completos, archivo por archivo
git diff --stat 8efff93               # 1.636 inserciones / 317 borrados
```

Manifiesto verificable (SHA-256 truncado a 16 hex; tamaño y líneas a fecha de este informe):

| Archivo | Líneas | Tamaño | SHA-256 (16) |
|---|---:|---:|---|
| `.gitignore` | 10 | 0.2 KB | `439841b71e3ed8a8` |
| `CHANGELOG.md` | 84 | 5.6 KB | `5834712516eef344` |
| `README.md` | 98 | 4.0 KB | `c15bf98cacaeebcf` |
| `data.js` | 2715 | 106.9 KB | `1e5fc527294dca0d` |
| `index.html` | 1154 | 75.0 KB | `472146f83a70656f` |
| `js/audio.js` | 1195 | 45.1 KB | `63de4f00ce64c55d` |
| `js/events.js` | 952 | 43.9 KB | `f681fb200ce82a6f` |
| `js/init.js` | 403 | 15.4 KB | `205ff256f6b93f6a` |
| `js/library.js` | 1206 | 50.0 KB | `ecc21651259bba57` |
| `js/lyrics.js` | 724 | 28.3 KB | `ff4f202ede41f36d` |
| `js/main.js` | 32 | 1.0 KB | `b365a0cb1f7fb4e6` |
| `js/nav.js` | 804 | 33.0 KB | `8f9bad7e70f9f7bd` |
| `js/player-ui.js` | 308 | 12.4 KB | `b1bb6573ef17287d` |
| `js/playlist-edit.js` | 378 | 17.2 KB | `df70100c13b6cf74` |
| `js/playlist-ui.js` | 952 | 39.5 KB | `319709cd0c350e1b` |
| `js/queue.js` | 176 | 7.6 KB | `039a9145275bc08e` |
| `js/settings.js` | 671 | 27.3 KB | `9b99223e1069d429` |
| `js/state.js` | 197 | 6.6 KB | `791cd816757d2bda` |
| `js/stats-ui.js` | 331 | 14.1 KB | `d1d218d5e31e434d` |
| `js/ui.js` | 488 | 20.1 KB | `37b68ef828a631cc` |
| `package.json` | 48 | 1.4 KB | `00adb8df3243a936` |
| `server.js` | 371 | 13.8 KB | `b69e7338c0f5bc81` |
| `storage.js` | 170 | 6.1 KB | `0f6bcf3c9b8ed42f` |
| `styles.css` | 4013 | 98.1 KB | `1c6153d449b0f836` |
| `uploader.js` | 747 | 28.5 KB | `99e7e1ecaa992574` |
| `webxdc.js` | 68 | 2.2 KB | `6a464a78eca944c8` |

El diff completo de la auditoría (50 archivos, incluida la suite de pruebas y el servidor, hoy retirados del árbol) permanece en el historial de git:

```bash
git show 24ff6ca            # snapshot completo de la auditoría
git diff 8efff93 24ff6ca    # cambios respecto a la base auditada
```

**Archivos nuevos** (no existían en la base):

- `tests/helpers/dom-env.js`, `tests/unit/*.test.js` (6), `tests/integration/*.test.js` (7), `tests/a11y/axe.test.js`, `tests/e2e/flow.test.js`, `tests/load/k6.js`
- `scripts/coverage.js`, `scripts/coverage-hook.js`
- `.github/workflows/ci.yml`, `Dockerfile`, `.dockerignore`
- `package-lock.json`, `docs/AUDITORIA.md`

**Correcciones no obvias (con comentario en el código):**

1. `storage.js` — la conexión se reabre si el navegador la cierra; dos aperturas simultáneas comparten promesa.
2. `server.js` — el middleware anti-traversal usa la ruta cruda sin query; `realpath` se calcula una vez.
3. `js/audio.js` — `seekToTime` ignora valores no finitos; las bandas del EQ llevan `label for` + `aria-label`.
4. `js/player-ui.js` — `updateCoverA11y()` centraliza nombre/estado de la portada (evita divergencia entre dos rutas de render).
5. `js/queue.js` — el timer de seguridad del selector de archivos se cancela al cerrar/cancelar.
6. `js/library.js` + `webxdc.js` — el MIME viaja con el archivo exportado.

---

## 4. Suite de pruebas

### 4.1 Composición

| Suite | Archivos | Pruebas | Qué demuestra |
|---|---|---:|---|
| Unitaria | `tests/unit/*.test.js` | **48** | Parser LRC/karaoke, utilidades de texto, ID3/uploader, i18n, lista blanca del servidor, IndexedDB |
| Integración | `tests/integration/*.test.js` | **73** | Servidor HTTP real, arranque, biblioteca/importación, reproducción, sheets/UI, cableado DOM, colas y listas |
| Accesibilidad | `tests/a11y/axe.test.js` | **5** | 0 violaciones axe en inicio, reproductor, letras, cola, 23 hojas, biblioteca con datos, lote, menú y confirmación |
| E2E | `tests/e2e/flow.test.js` | **3** | Onboarding → importar `File` reales → reproducir → favorito → crear lista → exportar; búsqueda; tema/acento |
| **Total** | | **129** | **129/129 en verde** |

### 4.2 Ejecución

```bash
npm ci
npm test                 # todo (≈ 37 s)
npm run test:unit
npm run test:integration
npm run test:a11y
npm run test:e2e
npm run test:coverage    # instrumentación + coverage/index.html + lcov
npm run test:load        # k6 (requiere binario k6)
npm run lint             # i18n 364 × 8
npm run audit            # npm audit
```

### 4.3 Cobertura (medición real, 129 pruebas)

La cobertura de `c8` no ve los scripts inyectados en el VM de jsdom, así que `scripts/coverage-hook.js` instrumenta con istanbul tanto los módulos Node como cada `<script>` antes de inyectarlo, y fusiona la cobertura de cada realm.

| Archivo | % Sentencias | % Ramas | % Funciones | % Líneas |
|---|---:|---:|---:|---:|
| `data.js` | 100,0 | 100,0 | 100,0 | 100,0 |
| `js/state.js` | 91,3 | 75,0 | 100,0 | 100,0 |
| `js/player-ui.js` | 80,4 | 66,9 | 87,5 | 83,0 |
| `js/settings.js` | 78,9 | 59,0 | 82,8 | 83,3 |
| `server.js` | 69,5 | 54,1 | 52,2 | 74,8 |
| `storage.js` | 67,0 | 27,6 | 73,7 | 72,8 |
| `js/ui.js` | 64,0 | 51,5 | 59,1 | 68,0 |
| `js/queue.js` | 63,0 | 41,3 | 77,8 | 68,7 |
| `webxdc.js` | 61,8 | 40,0 | 66,7 | 70,0 |
| `js/init.js` | 61,5 | 38,6 | 41,0 | 66,3 |
| `js/nav.js` | 58,2 | 42,9 | 50,0 | 62,7 |
| `js/library.js` | 57,9 | 42,2 | 65,7 | 61,5 |
| `js/audio.js` | 50,2 | 42,4 | 53,0 | 53,6 |
| `js/stats-ui.js` | 46,0 | 45,7 | 50,0 | 48,2 |
| `js/events.js` | 43,6 | 23,2 | 18,8 | 48,5 |
| `uploader.js` | 42,8 | 31,6 | 51,8 | 44,8 |
| `js/main.js` | 40,0 | 12,5 | 25,0 | 44,4 |
| `js/playlist-edit.js` | 30,2 | 20,8 | 26,2 | 30,1 |
| `js/lyrics.js` | 29,2 | 22,3 | 35,5 | 28,5 |
| `js/playlist-ui.js` | 29,1 | 27,2 | 34,0 | 33,9 |
| **TOTAL** | **50,0** | **38,5** | **47,1** | **55,0** |

**Lectura honesta:** el 50 % no es un aprobado de cobertura; es el punto de partida medido. Las zonas con menos cobertura son las que dependen de interacción visual fina (letras karaoke, editor de listas, estadísticas) y se priorizan en el plan post-lanzamiento. Lo que sí está garantizado: **todas las rutas críticas** (arranque, importación, persistencia, reproducción, borrado, seguridad del servidor, accesibilidad) tienen pruebas que fallan si se rompen.

### 4.4 Casos límite y de seguridad cubiertos

- IDs/portadas maliciosas, JSON basura, archivos truncados, SVG/base64 gigante, nombres con Unicode (ruso, chino, japonés).
- `seekToTime(NaN/Infinity)`, volumen fuera de rango, A-B invertido, crossfade con `ended`, repeat one, shuffle.
- IndexedDB cerrada, desconocida, apertura concurrente, cuota/errores de persistencia.
- Path traversal literal y codificado, query con `..`, MIME, gzip, ETag/304, rate limit inválido, cabeceras CSP.
- Foco, `inert`, `aria-hidden`, Escape, onboarding no cerrable, confirmación sustituida.

### 4.5 Limitaciones conocidas del entorno

- **Sin Chromium**: e2e y a11y corren en jsdom. No se validan códecs de audio reales, Web Audio, ni layout/paint.
- **`color-contrast` desactivada** en axe: jsdom no calcula estilos heredados ni layout. El contraste se revisa con los tokens de `styles.css` (pendiente de auditoría visual manual).
- **k6 no instalado**: `tests/load/k6.js` está listo y documentado, pero no se ejecutó aquí.

---

## 5. Checklist de lanzamiento

### 5.1 Seguridad

| Ítem | Estado |
|---|---|
| Lista blanca de archivos públicos | ✅ Cumplido |
| Path traversal (literal, codificado, symlinks) | ✅ Cumplido |
| CSP, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | ✅ Cumplido |
| HSTS cuando hay TLS (`ENABLE_HSTS=1`) | ✅ Cumplido (condicional) |
| Rate limit en `/api` y validación de configuración | ✅ Cumplido |
| Timeouts y apagado ordenado | ✅ Cumplido |
| `npm audit` sin vulnerabilidades | ✅ Cumplido |
| Sin secretos ni `eval` | ✅ Cumplido |
| Rate limit distribuido para varias instancias | ⏳ Pendiente si se escala horizontalmente |
| Dependabot/actualizaciones automáticas | ⏳ Pendiente (CI ya ejecuta `npm audit`) |

### 5.2 Calidad y pruebas

| Ítem | Estado |
|---|---|
| Suite unitaria | ✅ 48/48 |
| Integración (servidor + app) | ✅ 73/73 |
| Accesibilidad automatizada | ✅ 5/5, 0 violaciones |
| E2E de flujos críticos | ✅ 3/3 |
| Cobertura medida y publicada | ✅ 50,0 % sentencias / 55,0 % líneas |
| Umbral de cobertura ≥ 80 % | ⏳ Pendiente (plan post-lanzamiento) |
| Lint de JavaScript (ESLint) | ⏳ Pendiente; hoy `node --check` + `audit-i18n` |
| i18n completo | ✅ 364 claves × 8 idiomas |

### 5.3 Accesibilidad y UX

| Ítem | Estado |
|---|---|
| axe sin violaciones en vistas y hojas | ✅ Cumplido |
| Nombres accesibles en controles | ✅ Cumplido |
| Navegación por teclado y foco en sheets | ✅ Cubierto por pruebas |
| Contraste verificado visualmente | ⏳ Pendiente (manual) |
| Lectores de pantalla reales (VoiceOver/TalkBack) | ⏳ Pendiente (QA manual) |

### 5.4 Operación

| Ítem | Estado |
|---|---|
| Variables de entorno documentadas | ✅ Cumplido (`PORT`, `HOST`, `TRUST_PROXY`, `ENABLE_HSTS`, `API_RATE_LIMIT`, timeouts) |
| Healthcheck | ✅ `/api/health` |
| Logs estructurados y apagado ordenado | ✅ Cumplido |
| Dockerfile y CI | ✅ Cumplido |
| Backups del lado servidor | ➖ No aplica: no hay datos en servidor |
| Copia de seguridad del usuario (JSON) | ✅ Implementada y probada |
| Monitorización externa (uptime, errores, p95) | ⏳ Pendiente de configurar en el proveedor |
| Prueba de carga k6 ejecutada | ⏳ Pendiente (script listo) |

### 5.5 Producto

| Ítem | Estado |
|---|---|
| Offline-first sin build | ✅ Cumplido |
| Empaquetado WebXDC | ✅ `build-xdc.py` disponible |
| Versión coherente 1.2.0 | ✅ Cumplido |
| Documentación de auditoría | ✅ Este documento |
| QA en iOS/Android/escritorio reales | ⏳ Pendiente |

---

## 6. Despliegue a producción, paso a paso

### 6.1 Requisitos

- Node.js 22 LTS (el servidor funciona desde 18; las pruebas requieren ≥ 22.22 por jsdom 30).
- Un dominio con TLS (Let's Encrypt) si se publica en internet.
- 128 MB de RAM y pocos MB de disco: es estático + Express.

### 6.2 Preflight (en la máquina de build)

```bash
git clone <repo> aurora && cd aurora
git checkout <tag/commit auditado>
npm ci
npm run lint
npm test
npm run audit
```

No continuar si alguna orden falla.

### 6.3 Variables de entorno

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `HOST` | `0.0.0.0` | Interfaz de escucha |
| `TRUST_PROXY` | desactivado | `1` detrás de Nginx/Cloudflare para rate limit por IP real |
| `API_RATE_LIMIT` | `120` | Peticiones/minuto por IP a `/api` |
| `ENABLE_HSTS` | desactivado | `1` solo cuando el dominio ya sirve HTTPS estable |
| `REQUEST_TIMEOUT_MS` | `30000` | Timeout de petición |
| `HEADERS_TIMEOUT_MS` | `35000` | Timeout de cabeceras |

### 6.4 Instalación con systemd

```bash
sudo useradd -r -s /usr/sbin/nologin aurora
sudo mkdir -p /opt/aurora && sudo chown aurora:aurora /opt/aurora
# copiar el contenido (sin .git, tests ni node_modules) a /opt/aurora
cd /opt/aurora && sudo -u aurora npm ci --omit=dev
```

`/etc/systemd/system/aurora.service`:

```ini
[Unit]
Description=Aurora Music Player
After=network.target

[Service]
Type=simple
User=aurora
WorkingDirectory=/opt/aurora
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOST=127.0.0.1
Environment=TRUST_PROXY=1
# Activar solo con TLS estable:
# Environment=ENABLE_HSTS=1
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadOnlyPaths=/opt/aurora

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aurora
curl -fsS http://127.0.0.1:3000/api/health
```

### 6.5 Proxy inverso (Nginx)

```nginx
server {
  listen 443 ssl http2;
  server_name musica.ejemplo.com;

  ssl_certificate     /etc/letsencrypt/live/musica.ejemplo.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/musica.ejemplo.com/privkey.pem;

  # La app no sube archivos al servidor.
  client_max_body_size 1m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 35s;
  }
}
```

Notas:

- **No añadir otro CSP en el proxy**: el servidor ya envía una política estricta.
- Dejar pasar `Accept-Encoding` y `If-None-Match` (gzip y 304 los gestiona la app).
- Si se usa Cloudflare, activar `TRUST_PROXY=1`.

### 6.6 Alternativa con Docker

```bash
docker build -t aurora:1.2.0 .
docker run -d --name aurora -p 127.0.0.1:3000:3000 \
  -e TRUST_PROXY=1 -e ENABLE_HSTS=1 aurora:1.2.0
curl -fsS http://127.0.0.1:3000/api/health
```

### 6.7 Verificación tras desplegar

```bash
BASE=https://musica.ejemplo.com

# 1. Salud y versión
curl -fsS $BASE/api/health | jq .

# 2. Cabeceras de seguridad
curl -sI $BASE/ | grep -Ei 'content-security-policy|x-content-type-options|referrer-policy'

# 3. Lo que NO debe salir
for p in /server.js /package.json /tests/unit/lrc.test.js /.gitignore; do
  code=$(curl -s -o /dev/null -w '%{http_code}' $BASE$p); echo "$p -> $code (esperado 404)";
done

# 4. Traversal literal (sin normalizar)
printf 'GET /assets/%%2e%%2e/%%2e%%2e/etc/passwd HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n' \
  | openssl s_client -quiet -connect musica.ejemplo.com:443 2>/dev/null | head -1

# 5. gzip y caché
curl -sI -H 'Accept-Encoding: gzip' $BASE/js/main.js | grep -Ei 'content-encoding|cache-control|etag'
curl -sI $BASE/ | grep -i cache-control   # debe ser no-cache

# 6. Rate limit (con API_RATE_LIMIT bajo en staging)
for i in $(seq 1 5); do curl -s -o /dev/null -w '%{http_code} ' $BASE/api/health; done; echo
```

### 6.8 Rollback

1. Mantener dos directorios (`/opt/aurora/current` como symlink y `/opt/aurora/releases/<fecha>`).
2. Ante un incidente: re-apuntar el symlink a la release anterior y `systemctl restart aurora`.
3. Verificar `/api/health` y los smoke tests de 6.7.
4. La app es estática: no hay migraciones de base de datos que revertir. IndexedDB del usuario no se toca al cambiar de versión.

### 6.9 Empaquetado WebXDC (opcional, Delta Chat)

```bash
python3 build-xdc.py
```

Genera `aurora-music-player.xdc`. Recordatorio: cada copia del `.xdc` guarda su propia biblioteca; exportar backup antes de cambiar de copia.

---

## 7. Recomendaciones post-lanzamiento

### 7.1 Monitorización (primeras 72 horas)

- Uptime externo cada 60 s contra `/api/health` (alerta a los 2 fallos).
- Alertas: tasa de 5xx > 1 %, p95 > 800 ms, 429 > 5 % de peticiones, proceso caído.
- Revisar logs JSON: `server_started`, `shutdown`, `request_failed`.
- Panel mínimo: peticiones/min, p95, memoria RSS, reinicios.

### 7.2 Seguridad continua

- Ejecutar `npm audit` en CI en cada PR (ya configurado) y revisar avisos semanalmente.
- Activar Dependabot para `express` y dependencias de desarrollo.
- Revisar CSP si se añade contenido externo (hoy no hay ninguno).
- No relajar la lista blanca de archivos públicos: cualquier archivo nuevo que deba servirse se añade explícitamente.
- Si se escala a varias instancias, mover el rate limit a un almacén compartido (Redis) o al proxy.

### 7.3 Datos y continuidad

- El servidor no guarda datos de usuario: los backups son responsabilidad del cliente. Se recomienda recordar la exportación (Ajustes → Exportar) y documentarlo en la ayuda.
- Probar la restauración de un backup real (importar JSON → reimportar audio → verificar re-vinculado).
- Definir política de soporte para «biblioteca perdida» (la app ya detecta 0 pistas con biblioteca previa y ofrece importar).

### 7.4 Rendimiento

- Servir con HTTP/2 y TLS; mantener gzip del servidor (ya activo) y evaluar Brotli en el proxy.
- Cuando exista pipeline de build, añadir hash de contenido a los nombres de assets para cachear un año; hoy `max-age=3600` es deliberado.
- Medir con k6 en staging: objetivo p95 < 800 ms y 0 % de errores con 20 VU.
- Revisar el tamaño de `styles.css` (98 KB) y `data.js` (107 KB) si crece el catálogo i18n.

### 7.5 Accesibilidad

- Auditoría manual con VoiceOver (iOS/macOS) y TalkBack (Android): foco, orden de lectura, anuncio de cambios de pista.
- Revisar contraste real en los cuatro temas (oscuro, claro, AMOLED, acentos) con axe DevTools o Lighthouse.
- Mantener `axe.test.js` en CI: cualquier regresión de nombres/landmarks rompe la suite.

### 7.6 Pruebas y calidad

- Subir cobertura priorizando `js/lyrics.js`, `js/playlist-edit.js` y `js/playlist-ui.js` (hoy < 34 %).
- Añadir Playwright + Chromium en CI para: reproducción real, gestos, descarga de archivos y contraste.
- Ejecutar `tests/load/k6.js` en staging antes de cada release importante.
- Añadir ESLint/Prettier con reglas mínimas (`no-undef`, `no-unused-vars`, `eqeqeq`).
- Umbral de cobertura progresivo: 55 % → 65 % → 80 % (no bloquear el lanzamiento actual).

### 7.7 Producto (backlog sugerido)

- Service Worker para offline real en navegador (hoy el offline depende de webxdc/archivos locales).
- Sincronización opcional de backups entre dispositivos (fuera del alcance actual).
- Editor de letras con vista previa y validación de timestamps.
- Ecualizador con presets personalizados exportables.

---

## 8. Anexo A — Decisiones ante ambigüedad

1. **E2E en jsdom, no en navegador**: el sandbox no tiene Chromium. Se optó por jsdom para que las pruebas sean ejecutables en CI sin descargas; las limitaciones se documentan y se recomienda Playwright en el roadmap.
2. **`color-contrast` desactivada**: jsdom no calcula layout; activarla produce falsos negativos/positivos. Se compensa con revisión manual de tokens.
3. **k6 no ejecutado**: no hay binario en el sandbox. Se entrega script listo, con umbrales y variables de entorno; se marca como pendiente en el checklist.
4. **Cobertura con instrumentación propia**: `c8` no ve los scripts inyectados en jsdom; se añadió un hook de istanbul para medir de verdad, en lugar de reportar un porcentaje ficticio.
5. **Informe en `docs/AUDITORIA.md`**: se eligió un único documento con los seis entregables para facilitar la revisión; el código completo vive en el repositorio y se referencia con hashes.
6. **Versión 1.2.0**: cambio menor por correcciones de seguridad, accesibilidad y pruebas; no hay cambios incompatibles de formato de datos (los backups v1 siguen siendo válidos).
7. **`style-src 'unsafe-inline'`**: el markup usa atributos `style` para portadas y posiciones; eliminarlo requeriría un refactor CSS no solicitado. Se documenta como riesgo aceptado y se restringe `script-src` a `'self'`.
8. **Rate limit en memoria**: suficiente para una instancia; documentado para escalado horizontal.
9. **No se borran las 40 claves i18n sin uso**: pueden ser referencias dinámicas o traducciones preparadas; borrarlas sin trazabilidad rompería idiomas. Se deja la lista en el detector como deuda técnica.

## 9. Anexo B — Cómo reproducir cada hallazgo

```bash
# Seguridad del servidor y cabeceras
node --test tests/integration/server.test.js

# XSS/importación/persistencia
node --test tests/integration/library.test.js tests/unit/storage.test.js

# Reproducción, colas y listas
node --test tests/integration/playback.test.js tests/integration/lists.test.js

# Accesibilidad
node --test tests/a11y/axe.test.js

# Flujo completo de usuario
node --test tests/e2e/flow.test.js

# Cobertura
npm run test:coverage && xdg-open coverage/index.html
```

Para verificar una corrección concreta, revertir mentalmente el cambio y comprobar que la prueba asociada falla: cada prueba de la tabla de hallazgos fue escrita antes o durante la corrección y se ejecutó contra el código roto.

---

**Fin del informe.** Documento generado como parte del entregable de auditoría; las cifras de pruebas y cobertura corresponden a la última ejecución completa (129/129 y 50,0 % de sentencias).
