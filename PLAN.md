# Aurora Music Player — Plan de pulido profesional

**Objetivo:** convertir el reproductor actual en una aplicación que se *sienta* profesional: fluida, predecible, completa en lo esencial, y sin funciones a medias.

**No es el objetivo:** convertirlo en Spotify. Aurora es un reproductor **local y offline-first**, sin servidor, sin sincronización P2P. Sigue empaquetable como `.xdc` para Delta Chat (cada dispositivo con su propia biblioteca). El plan respeta esas restricciones (sin CDN, sin bundler obligatorio, sin backend).

---

## 0. Dónde estamos hoy

Aurora ya no es un prototipo. Tiene:

| Área | Estado actual |
|---|---|
| Reproducción | Play/pause, prev/next, seek, shuffle, repeat, volumen, speed, sleep, Media Session, wake lock |
| Biblioteca | Import ID3 + portadas, duplicados, IndexedDB, favoritos, playlists, export/import JSON |
| Letras | Parser LRC, sync RAF, offset, loop, editor, bilingüe, fullscreen |
| UI | Temas, acentos, 8 idiomas, sheets, toasts, confirmaciones, marco móvil |
| P2P | **Eliminado.** Reproductor local; sin oyentes, sync ni envío de pistas |
| Empaquetado | `build-xdc.py` → `.xdc` autónomo (opcional) |

Eso es una base **buena**. Lo que impide que se perciba como producto profesional no es “faltan 40 features”, sino:

1. **Funciones escritas y no cableadas** (código muerto).
2. **Navegación incompleta** (Inicio no es Inicio; no hay artista/álbum).
3. **Flujos a medias** (Inicio no es un hub; no hay vistas Álbum/Artista).
4. **Pulido de detalle** (i18n hardcodeado, bugs, vacíos, accesibilidad).
5. **Audio “pro” que no llega** (gapless incompatible con EQ, shuffle aleatorio, sin mini-player).

---

## 1. Principios de producto

1. **Una sola acción, un resultado obvio.** Nada de botones que abren un toast en lugar de una vista.
2. **Nunca perder el contexto de reproducción.** Si el usuario está en Biblioteca, Letras o Búsqueda, la pista sigue visible y controlable.
3. **La biblioteca se organiza sola.** Artista, álbum, recents, “añadidas recientemente” — no una lista plana infinita.
4. **Offline es un superpoder, no una limitación.** Importar, etiquetar y reproducir debe sentirse instantáneo.
5. **Archivos planos.** Cada kilobyte, cada API y cada gesto deben funcionar abriendo `index.html` y, si se empaqueta, dentro de Delta Chat.
6. **Menos código muerto.** Si una función existe (`playNext`, `startRadio`, `addToQueue`), o se expone en UI o se elimina.
7. **Accesibilidad no es extra.** Teclado, lectores de pantalla, contraste, `prefers-reduced-motion` (ya hay un inicio).

---

## 2. Diagnóstico concreto (código actual)

Hallazgos que el plan debe cerrar. No son opiniones: están en el repo.

### Bugs / deuda

| # | Problema | Dónde |
|---|---|---|
| B1 | ~~Listeners / `peerLabel`~~ — **obsoleto** (P2P eliminado) | — |
| B2 | ~~Historial y stats compartían sheet~~ — **cerrado** (`sheetHistory`) | — |
| B3 | ~~“Ir al artista” abre búsqueda~~ — **cerrado** (vistas Álbum/Artista) | — |
| B4 | ~~Shuffle elige un índice al azar~~ — **cerrado** (Fisher–Yates + `originalQueue`) | `js/audio.js` |
| B5 | ~~Gapless se desactiva con EQ~~ — **cerrado** (swap de `src` en el `<audio>` conectado) | `js/library.js` `gaplessNext()` |
| B6 | Collage de playlist llama `renderPlaylists()` al terminar → riesgo de re-renders en cascada | `js/playlist-ui.js` `getPlaylistCover` |
| B7 | ~~Textos hardcodeados de reset~~ — **cerrado** (i18n) | — |
| B8 | Onboarding de idioma existe (`showLanguageOnboarding`) pero **nunca se llama** | `js/init.js` |
| B9 | ~~`addToQueue` / `playNext` sin UI~~ — **cerrado** (menú de pista). `startRadio` sigue sin UI (Fase 3) | `js/queue.js` |
| B10 | ~~Badge de repeat inline duplicado~~ — **cerrado** (`setRepeatUI` + `.repeat-badge`) | — |
| B11 | Hay `README`; faltan tests y captura de producto | raíz del repo |
| B12 | Export de biblioteca **no incluye audio**; el import no restaura pistas reales | `js/library.js` `exportLibrary` |
| B13 | Quota: hay toast; falta flujo “liberar espacio” | `persistTrack` / Fase 3 |
| B14 | ~~Error de `<audio>` silencioso~~ — **cerrado** (toast) | — |
| B15 | ~~Home del bottom-nav no era Inicio~~ — **cerrado** (`view-home`) | — |

### UX que se siente amateur

- No hay **mini-player** al abrir Biblioteca / Búsqueda / Favoritos / Listas.
- Filas de pista: solo play + borrar. Falta menú contextual (reproducir siguiente, añadir a cola, ir al álbum).
- Volumen vive en un sheet; en un player pro está a un gesto.
- Títulos largos se cortan (`ellipsis`) en vez de marquee al reproducir.
- Biblioteca es una lista plana, sin ordenar (artista / álbum / recientes / A–Z).
- Sleep no tiene “al final de la canción”.
- Confirmaciones y toasts mezclan tono; algunos destructivos no piden confirmación (quitar de cola).
- En escritorio, el marco de móvil está bien para demo, pero el modo standalone merece un layout ancho opcional.

### Lo que ya está a nivel pro (no rehacer)

- Parser LRC tolerante + RAF + offset + loop.
- Persistencia de sesión (pista, cola, posición, shuffle/repeat).
- Temas + acentos + i18n de 8 idiomas (231 claves).
- Confirm sheet propio (no `window.confirm`).
- Safe areas, `100dvh`, `prefers-reduced-motion`, `focus-visible`.
- Empaquetado `.xdc` opcional, sin canal P2P.

---

## 3. Visión de la app “terminada”

Un usuario abre Aurora (en el chat o en el navegador) y en 30 segundos:

1. Ve un **Inicio** con “Continuar escuchando”, Recientes, Listas y un CTA claro si está vacío.
2. Carga música y ve **progreso** (no un toast genérico).
3. Navega por **Artistas / Álbumes / Canciones / Listas**.
4. En cualquier pantalla, un **mini-player** le deja pausar, saltar y volver al now-playing.
5. En cada pista, un menú: *Reproducir ahora / Siguiente / Añadir a cola / Añadir a lista / Ir al artista / Ir al álbum / Eliminar*.
6. Las letras se sienten como Apple Music (ya casi).
7. Nada “se rompe en silencio”: cuota llena, archivo corrupto, pista sin codec → mensaje claro y skip.

---

## 4. Roadmap por fases

Cada fase es entregable por sí sola. No se empieza la siguiente si la anterior no está *cerrada* (bugs de esa fase + UI cableada + i18n).

### Fase 0 — Cimentación (1–2 días) ✅
**Meta:** que nada esté roto y el repo se vea de producto. **Hecha** (incluye quitar P2P).

- [x] **B1** Obsoleto: eliminados `realtime.js`, `js/realtime-bridge.js`, `webxdc.js` y UI de Oyentes.
- [x] **B2** Sheet propio de Historial (`sheetHistory`).
- [x] **B7** i18n de botones de reset (stats / historial) y toasts de error.
- [x] Extraer `setRepeatUI` / `setShuffleUI` únicos (badge en CSS `.repeat-badge`).
- [x] `README.md`: qué es, cómo abrir en navegador, cómo generar `.xdc`.
- [x] `manifest.toml`: descripción de reproductor local.
- [x] Cerrar sheets con `Escape`; `aria-modal` + foco al abrir + trampa de Tab.
- [x] Toast cuando `audio.error`, `play()` bloqueado o IndexedDB quota.
- [x] No-ops del visualizador eliminados (`ensureAudioGraph` para el EQ).

**Criterio de salida:** 0 bugs de la tabla B1–B7–B10 visibles; README usable; Escape cierra cualquier sheet.

---

### Fase 1 — Navegación de producto (3–5 días) ✅
**Meta:** Aurora se usa como un player, no como un now-playing con menús.

#### 1.1 Mini-player persistente
- [x] Barra inferior (encima del nav) visible en Inicio y sheets a pantalla completa
- [x] Portada 40px + título/artista (marquee si overflow) + play/pause + next
- [x] Tap → Now Playing y cierra el sheet
- [x] Progreso fino (2 px) en el borde superior
- [x] Chrome oculto en Letras

#### 1.2 Pantalla Inicio (el botón Home de verdad)
- [x] Hub: Continuar, Recién añadidas, Listas, Más escuchadas
- [x] Estado vacío con CTA de carga
- [x] Now Playing como vista propia, accesible desde el mini-player

#### 1.3 Biblioteca con pestañas
- [x] `Canciones | Álbumes | Artistas | Listas`
- [x] Canciones: ordenar por título / artista / recientes / duración
- [x] Álbumes: grid de portadas → lista del álbum
- [x] Artistas: lista → discografía local
- [x] **B3** “Ir al artista / álbum” navega a esas vistas

#### 1.4 Menú contextual de pista
- [x] Long-press o `···` en cada fila
- [x] Reproducir ahora / siguiente (`playNext`) / cola (`addToQueue`)
- [x] Añadir a una lista / ir al artista / álbum / editar etiquetas / eliminar
- [x] Reproducir **no** cierra biblioteca, búsqueda ni listas (el mini-player sigue visible)

**Criterio de salida:** se puede vivir 10 minutos en la app sin volver al now-playing excepto a propósito.

---

### Fase 2 — Motor de audio “pro” (3–4 días)
**Meta:** el sonido y la cola se comportan como un reproductor de verdad.

- [ ] **Shuffle profesional:** barajar una copia de la cola (`Fisher–Yates`), mantener `originalQueue` para deshacer. El next ya no es `Math.random()`.
- [ ] **Gapless real con EQ:** no intercambiar `<audio>` (rompe el grafo). Precargar el siguiente en un segundo `Audio` *sin* conectarlo al grafo, y hacer el swap de `src` en el elemento ya conectado en el `ended` − 80 ms, o usar un segundo `MediaElementSource` (más delicado). Decisión: **un solo elemento conectado + preload buffer**; gapless “casi” (hueco < 50 ms) es mejor que gapless teórico que nunca corre.
- [ ] **Crossfade opcional** en Ajustes (0 / 3 / 6 / 12 s). Hoy está desactivado porque retrasaba el corte; debe ser *opt-in* y no tocar el next manual.
- [ ] **Normalización** como toggle en Ajustes (el RMS ya está escrito; está apagado).
- [ ] **Sleep:** añadir “Fin de la canción” y fade-out de 10 s.
- [ ] **EQ:** botón Reset visible; persistir preset; no duplicar Normal/Plano.
- [ ] **Errores de decode:** toast + skip automático a la siguiente (con contador “3 pistas omitidas”).
- [ ] **Media Session:** `setPositionState` en cada `timeupdate` (throttled) para seek en lockscreen.
- [ ] Volumen: slider compacto en Now Playing (long-press del icono o swipe vertical en la portada, común en players móviles).

**Criterio de salida:** shuffle predecible (se puede ver la cola barajada), EQ no impide transiciones, lockscreen muestra tiempo real.

---

### Fase 3 — Biblioteca sólida (3–4 días)
**Meta:** 500 pistas no hunden la app; importar no da miedo.

- [ ] Overlay de importación: barra de progreso `12 / 48`, nombre del archivo, cancelar.
- [ ] Virtualizar listas (`libraryTracks`, cola, búsqueda) si `n > 80` (windowing simple, sin librerías).
- [ ] Portadas: guardar thumbnail 96/256 aparte del dataURL completo; no pintar 600×600 en cada fila.
- [ ] **B6** collage de playlist: generar una vez, cachear, invalidar solo si cambian `trackIds`; nunca llamar `renderPlaylists()` en cadena.
- [ ] **B13** detectar `QuotaExceededError`; ofrecer “liberar espacio / borrar no usadas”.
- [ ] Editar metadatos de una pista (título, artista, álbum) persistido.
- [ ] Ordenar y agrupar; “Recién añadidas” con `addedAt`.
- [ ] Búsqueda: debounce 150 ms, historial de queries, resultados agrupados (canciones / álbumes / artistas).
- [ ] Playlists: renombrar, reordenar pistas (el drag de cola ya existe — reutilizar `wireDragHandle`).
- [ ] **B12** export: dejar claro que es *metadatos*; o ZIP de biblioteca (opcional, pesado para webxdc). Preferir honestidad en UI antes que un backup falso.
- [ ] Radio (`startRadio`) como acción del menú contextual — ya está el algoritmo.

**Criterio de salida:** importar una carpeta de 100 mp3 muestra progreso, no congela, y la biblioteca se puede ordenar.

---

### Fase 4 — Now Playing & letras (2–3 días)
**Meta:** la pantalla principal da gusto.

- [ ] Marquee en título/artista cuando overflow (pausa 1.5 s, desliza, pause, reset).
- [ ] Gesto en portada: tap = play/pause (ya); swipe horizontal = prev/next (ya a nivel pantalla — acotarlo); long-press = like.
- [ ] Indicador de buffer / “cargando…” si `readyState < 3` al cambiar de pista.
- [ ] Letras: botón “buscar .lrc” más visible cuando no hay letra; empty state con CTA (cargar / pegar).
- [ ] Karaoke opcional (palabra a palabra) **solo si** el LRC trae `<word>` — no inventar.
- [ ] Ajustes de letras (fuente, offset, speed) persistidos por pista (offset ya) y globales (fuente ya).
- [ ] Animación de cambio de pista más sobria: crossfade de portada 200 ms, sin `rotateY` que se siente demo.

**Criterio de salida:** Now Playing se puede enseñar en un screenshot de producto sin explicar nada.

---

### Fase 5 — ~~P2P / grupo~~ cancelada
La sincronización entre dispositivos y el envío de pistas **se eliminaron a propósito**. Aurora es un reproductor local. No reintroducir canal realtime, Listeners ni `webxdc.sendToChat` salvo decisión explícita de producto.

---

### Fase 6 — Profesional hacia fuera (2 días)
**Meta:** se puede publicar.

- [ ] README con capturas (now playing, biblioteca, letras, listeners).
- [ ] `CHANGELOG.md` semver (`1.0.0` al cerrar fase 1–2).
- [ ] Tests sin framework: `tests.html` que ejercite `parseLrc`, shuffle, i18n keys completas, `fmtTime`, duplicados.
- [ ] Auditoría de i18n: script que falle si una clave no tiene los 8 idiomas.
- [ ] Recortar Font Awesome: solo solid+regular usados; **quitar brands y v4compatibility** (~330 KB).
- [ ] Accesibilidad: `role="slider"` en progreso, `aria-pressed` en shuffle/like/repeat, live region para toasts, contraste en tema light.
- [ ] Atajos de teclado: hoja “?” (ya hay espacio/flechas/m/l/n/p).
- [ ] Layout desktop opcional (`min-width: 900px`): now-playing a la izquierda, biblioteca a la derecha. El marco móvil queda para < 768 px y para webxdc.
- [ ] Página de Ajustes completa: reproducción (gapless, crossfade, normalizar, sleep fade), interfaz (tema, acento, idioma, marquee), almacenamiento (retag, export, borrar), acerca de (versión, licencia, source).

**Criterio de salida:** un desconocido clona el repo, entiende qué es, lo abre, y no encuentra un botón que “no hace lo que dice”.

---

## 5. Qué no haremos (alcance)

Para no diluir el pulido:

- ❌ Streaming (YouTube, Spotify, radios online).
- ❌ Cuenta de usuario / nube.
- ❌ Bundler + npm como requisito (webxdc debe seguir siendo archivos planos). Si algún día hay tests con Node, que sea opcional.
- ❌ Visualizador de barras (se eliminó a propósito).
- ❌ Redes sociales, scrobbling Last.fm (salvo que se pida después).
- ❌ Equalizer de 10+ bandas con analizer FFT de adorno.
- ❌ PWA con service worker *dentro* del `.xdc` (el mensajero ya cachea). En standalone, PWA es fase posterior.
- ❌ Reescribir a React/Vue. El `Object.assign(App, …)` es feo pero funciona offline y en webxdc. Pulir *por módulos de dominio* (audio, library, ui) sí; framework no.

---

## 6. Arquitectura: cambios mínimos, no reescritura

El monolito `App` está partido en `js/*.js` clásicos. Mantenerlo.

Ajustes internos, fase a fase, **sin romper el orden de scripts**:

```
state → init → settings → library → queue
     → audio → player-ui → lyrics → playlist-ui → playlist-edit
     → ui → nav → events → stats-ui → main
```

Reglas nuevas:

1. **Un módulo, una responsabilidad.** `runSearch` no debería vivir en `stats-ui.js`. Moverlo a `library.js` o `js/search.js`.
2. **UI de repeat/shuffle/like** en `player-ui.js`, no repartida.
3. **No más estilos inline** para badges; clases CSS (`.repeat-badge`).
4. **Eventos de pista** vía un mini-bus interno (`App.emit('trackchange')`) para que mini-player y media session no se olviden de actualizar.
5. IndexedDB v2 cuando haga falta (`addedAt`, thumbnails, `lrcOffset`). Migración en `onupgradeneeded`.

---

## 7. Prioridad si solo hay una semana

Orden de máximo impacto percibido:

1. Mini-player (Fase 1.1)
2. Menú contextual + cablear cola (Fase 1.4 + B9)
3. Inicio real (Fase 1.2)
4. Shuffle de verdad + errores visibles (Fase 2 + B4 + B14)
5. Biblioteca por álbumes/artistas (Fase 1.3)
6. Overlay de importación (Fase 3)
7. README + recorte de webfonts (Fase 6)

Con eso Aurora **se siente** profesional. El resto es profundidad.

---

## 8. Criterios de “aplicación profesional”

La app se considera pulida cuando se cumplen **todos**:

- [ ] Ningún botón del menú hace “nada” o un toast de placeholder.
- [ ] Hay mini-player en toda navegación secundaria.
- [ ] Hay vistas Artista y Álbum, y se llega a ellas desde la pista.
- [x] Shuffle produce una cola visible y estable.
- [ ] Importar 50 archivos muestra progreso y no bloquea play.
- [ ] Un archivo corrupto no detiene la sesión.
- [x] Historial y estadísticas son pantallas distintas (o pestañas).
- [ ] 8 idiomas sin claves huérfanas ni strings en crudo.
- [x] Escape, teclado y Media Session funcionan.
- [x] README + `.xdc` construible en un comando.
- [ ] *(Cancelado)* Host P2P / oyentes en grupo.
- [ ] Tema claro usable (contraste de nav, toasts, sheets).
- [ ] Lista de 300 pistas scrollea a 60 fps en móvil medio.

---

## 9. Métricas internas (para no ir a ciegas)

Añadir un flag oculto `?debug=1` o 7 taps en Ajustes → “Acerca de”:

- Nº pistas / peso aproximado en IDB / quota
- Último error (`_lastError`)
- (P2P eliminado: no hay drift de sync)
- Tiempo hasta primer play tras restore
- FPS estimado del RAF de letras (ya es sensible)

No es un panel de tests de demo; es instrumentación de producto.

---

## 10. Cómo ejecutar este plan

1. Trabajar **una fase por PR / sesión**, con commit atómico por ítem (`feat: mini-player`, `fix: shuffle fisher-yates`, …).
2. Cada ítem de UI lleva su clave i18n en los 8 idiomas *en el mismo cambio*.
3. No añadir features de la fase N+1 “ya que estamos”.
4. Probar siempre en: Chrome móvil (viewport estrecho) y desktop con marco.
5. Generar `.xdc` al cerrar cada fase (`python3 build-xdc.py`) y verificar tamaño.

---

*Documento vivo. Actualizar la tabla de bugs al ir cerrándolos. El producto no es la lista: es que Aurora se abra y se quiera dejar sonando.*
