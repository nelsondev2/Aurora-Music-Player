# Informe de pulido de interfaz — Aurora Music Player

**Fecha:** 19 de octubre de 2026
**Base:** `ff73b21` (merge del PR #6, biblioteca simplificada)
**Rama:** `arena/4c26cbd7-aurora-music-player`
**Alcance elegido:** los 12 puntos de la auditoría de diseño (6 fallos + 6 de pulido), no solo los críticos.
**Resultado:** 12/12 implementados + rediseño de botones de listas + corrección de los solapes de las capturas + filas de canciones v2 + Letras v2 + Reproductor v2 · **143/143 pruebas automatizadas en verde** · `.xdc` válido para Delta Chat.

---

## 1. Resumen

| Métrica | Antes (ff73b21) | Ahora |
|---|---|---|
| Puntos de diseño corregidos | 0/12 | **12/12** |
| Pruebas de esta ronda | — | **143** (102 pulido + 27 smoke + 14 axe) |
| Violaciones axe (10 pantallas) | — | **0** |
| Contraste de acentos (peor extremo del degradado) | **1.64:1** | **4.75:1** |
| Objetivo táctil mínimo en controles citados | 28 px | **40 px** (fab 36 px) |
| `font-size` en px | 22 declaraciones + tokens | **0** |
| Paquete `.xdc` | 28 archivos · 302.1 KB | **28 archivos · 317.7 KB** |

**Paquete final:** `aurora-music-player.xdc`
**SHA-256:** `d2d8c90bd48d08670fbf74091b4af515136f54558c8e70d93f89b1d0444d6178`
**Validación:** `python3 build-xdc.py --check` → «OK el .xdc es válido para Delta Chat / webxdc».

---

## 2. Las 12 correcciones

### Fallos (1–6)

| # | Hallazgo | Solución aplicada | Dónde | Evidencia |
|---|---|---|---|---|
| 1 | Ajustes inalcanzable sin pista cargada: solo se llegaba por «Más opciones» del reproductor, y sin pista no se abre esa vista. | Engranaje visible en la cabecera de Inicio (`#btnHomeSettings`). Se conserva el acceso existente por «Más opciones». | `index.html`, `js/events.js` | Bloque A de `ui-polish.js`: clic real sobre el engranaje abre `#sheetSettings` con 0 pistas. |
| 2 | Las vistas ocultas seguían en el orden de tabulación y en el árbol de accesibilidad (solo `opacity:0` + `pointer-events:none`). | `showView()` pone `inert` y `aria-hidden="true"` a las vistas inactivas; el CSS añade `visibility:hidden` (con retardo para no cortar el fundido). Si el foco estaba dentro de la vista que se oculta, se mueve a la navegación. | `js/ui.js`, `styles.css` | Bloque B: estados en Inicio/Reproductor/Letras y modo ancho; axe sin `aria-hidden-focus`. |
| 3 | Texto e iconos blancos sobre degradados de acento con 1.64–3.56:1. | Nuevos pares `fill`/`fill2` (y `fillLight`/`fillLight2`) que cumplen AA en los 5 acentos. Los degradados con texto blanco usan `--accent-fill-2` en vez del tono brillante `--accent-2`. Corazón «me gusta» pasa a `--accent` en tema claro. `--text-4` sube a 3:1 para iconos/bordes. | `js/settings.js`, `styles.css` | Bloque C: cálculo WCAG de los 5 acentos × 3 temas; tabla en §3. |
| 4 | Biblioteca vacía sin acción para importar: solo había un texto y «Borrar todo». | Estado vacío con icono, titular, explicación y CTA «Cargar música» que abre el selector. Se ocultan contador/acciones/orden/«Borrar todo» cuando no hay pistas. | `js/playlist-ui.js` | Bloque D: existencia del CTA, apertura real del selector y ocultado del resto. |
| 5 | El icono de la pestaña Biblioteca era `#i-grip` (asa de arrastre). | Nuevo símbolo `#i-library` (libros en estante) usado por la nav. | `index.html` | Bloque A: `use[href="#i-library"]`. |
| 6 | Cinco `aria-label` fijos en español sin `data-i18n-aria`. | Claves nuevas × 8 idiomas: `back_btn`, `exit_fs`, `move`, `remove` (además de `view_player` y las etiquetas regionales). Los textos dinámicos de listas/cola usan `t()`. | `index.html`, `data.js`, `js/playlist-ui.js`, `js/playlist-edit.js` | Bloque A: claves completas en 8 idiomas y cambio real a inglés. |

### Pulido (7–12)

| # | Hallazgo | Solución aplicada | Dónde | Evidencia |
|---|---|---|---|---|
| 7 | Faltaban «Reproducir todo» y «Aleatorio» en la sección de canciones. | Fila propia bajo la cabecera con dos acciones. «Reproducir todo» usa el orden visible (`sortedTracks()`); «Aleatorio» activa el shuffle real de la cola (`_applyShuffle`), no solo el icono. | `index.html`, `js/playlist-ui.js`, `js/events.js` | Bloque F: cola esperada, `shuffle=true`, `aria-pressed`, y reordenación efectiva. |
| 8 | El menú de pista no permitía marcar favorito sin abrir el reproductor. | Fila `#ctxToggleFavorite` con estado `aria-pressed`, icono corazón sólido/vacío y sincronización al abrir el menú. `toggleFavoriteFor(trackId)` funciona con cualquier pista. | `index.html`, `js/nav.js`, `js/audio.js`, `js/events.js` | Bloque E: marcar, reabrir, desmarcar. |
| 9 | Estados vacíos incoherentes (texto plano en Favoritos/cola/búsqueda). | Componente único `emptyStateHtml()` (icono, titular, explicación y CTA opcional), usado en Biblioteca, Favoritos, listas, cola, historial y editor de listas. Variante `compact` para listas dentro de sheets. | `js/ui.js`, `js/stats-ui.js`, `js/playlist-ui.js`, `js/playlist-edit.js`, `styles.css` | Bloque G: misma estructura en Biblioteca/Favoritos y variante compacta en cola/historial. |
| 10 | No existía el tema «Sistema». | Cuarta opción en la rejilla. Se guarda la preferencia `system`; `applyTheme()` resuelve claro/oscuro con `prefers-color-scheme` y escucha cambios en vivo. `data-theme` refleja la paleta aplicada y `data-theme-pref` la preferencia. | `js/settings.js`, `index.html`, `styles.css` | Bloque H: cambio de esquema del sistema repinta sin recargar; un tema fijo deja de seguir al sistema. |
| 11 | `aurora-wide` no adaptaba el carril de listas ni las filas de canciones. | En escritorio el carril pasa a rejilla (`auto-fill`), el cuerpo de la Biblioteca se limita a 1040 px centrados, los filtros hacen wrap y las filas no se estiran. | `styles.css` | Bloque I: reglas y navegación real con `aurora-wide`. |
| 12 | Objetivos táctiles de 28–36 px, tipografía en px, contadores «0» redundantes y acciones destructivas sin deshacer. | `.lt-btn` 40, `.icon-btn-sm` 40, `.row-action` 40, `.pl-play-fab` 36, `.text-btn` y `.drag-handle` 40. Tokens y tamaños en `rem` (incluido el tamaño LRC, guardado en px equivalentes y aplicado en rem). Contadores ocultos a 0. Borrado de pista, de lista y «vaciar lista» con toast «Deshacer» (8 s). | `styles.css`, `js/lyrics.js`, `js/library.js`, `js/playlist-ui.js`, `js/playlist-edit.js`, `js/ui.js` | Bloque J: tamaños, ausencia de px, contadores y los tres flujos de deshacer (incluido el vencimiento del plazo). |

---

## 3. Contraste medido (WCAG 2.x)

### 3.1 Texto/icono blanco sobre el degradado de acento

Se comprueba **cada extremo** del degradado, no solo el color base. AA exige 4.5:1 para texto normal y 3:1 para iconos.

| Acento | `fill` / blanco | `fill2` / blanco |
|---|---:|---:|
| Aurora | 6.23 | 7.87 |
| Océano | 6.07 | 7.03 |
| Musgo | 6.59 | 7.80 |
| Ámbar | **4.75** | 6.61 |
| Cereza | 5.64 | 7.85 |

### 3.2 Tema claro (texto oscuro sobre `#F4F1EA`)

| Acento | `fillLight` / fondo | `fillLight2` / fondo |
|---|---:|---:|
| Aurora | 6.49 | 8.36 |
| Océano | 6.23 | 7.13 |
| Musgo | 6.91 | 8.22 |
| Ámbar | **5.45** | 7.00 |
| Cereza | 6.54 | 7.72 |

### 3.3 Acento como texto sobre fondo oscuro `#050509`

Aurora 6.22 · Océano 7.31 · Musgo 6.06 · Ámbar 8.20 · Cereza 4.82 (todos ≥ 4.5).

### 3.4 `--text-4`

Se usa para iconos, bordes de casillas y chevrons (no para texto principal). Se elevó de 2.53/2.45/3.06 a **3.1+** en oscuro/AMOLED y se mantiene por encima de 3 en claro. Los placeholders de texto usan `--text-3`.

---

## 4. Decisiones ante ambigüedad

1. **«Deshacer» con borrado diferido (8 s).** Para que el audio siga disponible, el borrado de una pista no revoca su `objectURL` ni toca IndexedDB hasta que vence el plazo (o se borra otra pista). Si se cierra la app, `pagehide` confirma los borrados pendientes para que no reaparezcan al reabrir. El borrado por lote y «borrar todo» son definitivos y mantienen su confirmación: mezclar N deshaceres parciales sería más peligroso que útil.
2. **Nuevo par de variables `--accent-fill` / `--accent-fill-2`.** No se oscureció `--accent-2` porque ese tono se usa como color de texto decorativo y en portadas; cambiarlo habría roto la identidad visual. Los degradados con texto blanco apuntan ahora al par seguro.
3. **«Aleatorio» de la sección de canciones** activa el modo aleatorio global de la cola (igual que el botón del reproductor), en lugar de reproducir una sola vez en orden aleatorio. Así el icono de shuffle y el comportamiento coinciden.
4. **Tema «Sistema»** guarda la preferencia, no la paleta resuelta: si el usuario cambia el tema del teléfono, la app se adapta sin recargar. `data-theme` sigue siendo `dark`/`light`/`amoled` para que el CSS existente funcione.
5. **Estados vacíos**: se reutiliza el lenguaje visual de la bienvenida de Inicio, pero en variante compacta dentro de listas para no empujar el contenido fuera de la pantalla.
6. **Tamaño de letra LRC**: el ajuste guardado se conserva en «px equivalentes» (12–32) por compatibilidad, pero se aplica en `rem`; con el tamaño de fuente por defecto el resultado es idéntico y ahora escala con la preferencia del sistema.
7. **Escritorio ancho**: en lugar de reconstruir la Biblioteca en dos columnas, se convierte el carril en rejilla y se acota el ancho de lectura. Mantiene una sola jerarquía y evita duplicar lógica de scroll.

---

## 5. Pruebas

### 5.1 Composición (93)

| Suite | Pruebas | Qué demuestra |
|---|---:|---|
| `verificacion/ui-polish.js` | **65** | Los 12 hallazgos y el rediseño de botones de listas: comportamiento real en jsdom + comprobaciones del CSS y contraste calculado. |
| `verificacion/smoke.js` | **27** | Arranque, biblioteca, reproducción, cola, búsqueda, favoritos, listas, letras, estadísticas, idioma y temas. |
| `verificacion/a11y.js` | **14** | axe-core en 10 pantallas (Inicio, Reproductor, Biblioteca, Ajustes, Temas, Favoritos, Buscar, menú de pista, Letras, editor de lista) + diálogos y nav. **0 violaciones**. |

### 5.2 Ejecución

```bash
cd verificacion
npm install          # jsdom, fake-indexeddb, axe-core
npm test             # las tres suites
# o por separado:
npm run polish
npm run smoke
npm run a11y
```

El arnés arranca el `index.html` real y evalúa los mismos scripts que la app (sin bundler), con IndexedDB falso, canvas y audio simulados. `AURORA_ROOT` permite apuntar a otro checkout.

### 5.3 Limitación conocida del entorno

jsdom **no aplica `styles.css`**; por eso `color-contrast` de axe se desactiva y el contraste se verifica matemáticamente en el bloque C de `ui-polish.js` (fórmula WCAG con luminancia relativa). La estructura, el foco, los `aria-*` y el comportamiento sí se prueban en el DOM real. No hay Chromium en el sandbox, así que no se hicieron capturas visuales; se recomienda una pasada manual en un dispositivo antes de publicar.

---

## 6. Archivos modificados

```
data.js              13 +   (claves i18n × 8 idiomas)
index.html           90 +/− (engranaje, icono, acciones, tema, favorito, botones de lista)
styles.css          546 +/− (contraste, rem, táctil, wide, estados vacíos, toast, botones de lista)
js/audio.js          18 +/− (favorito por pista)
js/events.js         18 +   (cableado nuevo)
js/init.js            5 +   (confirmar borrados al cerrar)
js/library.js       109 +/− (deshacer borrado de pista)
js/lyrics.js         11 +/− (tamaño LRC en rem)
js/nav.js            14 +/− (favorito en el menú)
js/playlist-edit.js  36 +/− (deshacer vaciado + i18n + estado del hero)
js/playlist-ui.js   152 +/− (acciones, estados vacíos, deshacer, i18n, acciones de fila)
js/settings.js       85 +/− (tema Sistema, paletas AA y --accent-text-2)
js/stats-ui.js       29 +/− (favoritos vacío)
js/ui.js             76 +/− (inert, emptyStateHtml, toast con acción)
verificacion/        nuevas suites (no entran en el .xdc)
docs/INFORME-PULIDO-UI.md  este informe
```

`build-xdc.py` solo empaqueta `APP_ENTRIES`; `verificacion/` y `docs/` quedan fuera del paquete.

---

## 7. Empaquetado y validación

```bash
python3 build-xdc.py
python3 build-xdc.py --check
```

Salida final:

```
OK  aurora-music-player.xdc · 28 archivos · 317.7 KB
    sha256: d2d8c90bd48d08670fbf74091b4af515136f54558c8e70d93f89b1d0444d6178
    nombre: Aurora Music Player
    código: https://github.com/nelsondev2/Aurora-Music-Player
    icono: icon.png (90.5 KB)
    archivos: 28 · comprimido: 317.7 KB · sin comprimir: 919.2 KB
OK  el .xdc es válido para Delta Chat / webxdc
```


---

## 8. Revisión posterior: botones de las listas de reproducción

**Petición:** «los botones dentro de las listas de reproducción son toscos y horribles».

### 8.1 Qué había

- **Editor de lista:** seis tarjetas del mismo tamaño (2×3), cada una con una ficha de icono de 34 px y texto de 12 px. Dos eran rojas permanentes y la de «Reproducir» usaba el degradado brillante `--accent → --accent-2` con texto blanco: **1.64–2.41:1 en el extremo claro**, el mismo fallo de contraste corregido antes en otros botones.
- **«Tus listas»:** cada fila llevaba un disco blanco de 36 px sobre una miniatura de 58 px (tapaba la portada) más un botón de borrado siempre visible.
- **Filas de pistas dentro de una lista:** asa de arrastre + menú + quitar, los tres con el mismo peso visual, sin jerarquía.

### 8.2 Qué se hizo

| Zona | Antes | Ahora |
|---|---|---|
| Editor · acción principal | Tarjeta con degradado brillante y texto | **Círculo de 52 px** junto a la portada, con `--accent-fill` (blanco ≥ 4.5:1) y anillo fino cuando esa lista está sonando. |
| Editor · acciones secundarias | 6 tarjetas 2×3 con fichas de icono | **Pastillas ligeras** de 40 px (icono 16 px + etiqueta 13 px), fondo `surface`, borde sutil; hover/foco con realce. |
| Editor · destructivas | Dos bloques rojos permanentes | Texto y icono en `--danger`; solo se tiñen al pulsar/pasar. «Borrar todo» pasa a **«Vaciar»** para no confundirse con «Eliminar lista». |
| «Tus listas» · play | Disco blanco sobre la miniatura | **Botón circular en columna propia** (40 px), tinte de acento; la portada queda limpia. |
| «Tus listas» · borrado | Siempre visible | En ratón aparece al pasar por la fila o al enfocar (`focus-within`); en táctil sigue visible. |
| Tarjetas de la biblioteca | Disco blanco de 36 px | Disco de acento de 40 px con icono blanco, sombra suave y realce al pasar. |
| Filas del editor | Tres controles con el mismo peso | Iconos de 16 px en `--text-3`, visibles al pasar/enfocar con ratón; 40 px de área táctil. |
| Escritorio ancho | Editor pegado al borde | Cuerpo limitado a 760 px centrados. |

### 8.3 Fallos de contraste residuales corregidos de paso

Al revisar los botones aparecieron cuatro usos del degradado brillante con contenido blanco que seguían por debajo de AA:

| Selector | Problema | Corrección |
|---|---|---|
| `.icon-add` («+» de la barra) | Icono blanco hasta 2.41:1 | `--accent-fill` → `--accent-fill-2` |
| `.sleep-opt.active` | Texto blanco hasta 2.41:1 | Relleno seguro + `--accent-on-fill` |
| `.home-welcome-perks .ico` | Icono blanco hasta 2.41:1 | Relleno seguro |
| `.stat-value` / `.home-welcome-brand` | Degradado de texto que en tema claro caía a 2.14:1 | Nueva variable **`--accent-text-2`**, resuelta por tema (brillante en oscuro, oscura en claro) |

`--accent-text-2` se calcula en `applyTheme()`: `accent2` en oscuro/AMOLED y `fillLight2` en claro. Las pruebas verifican ambos extremos con la fórmula WCAG en los 5 acentos y los 2 temas.

### 8.4 Pruebas añadidas (13)

- Estructura: tarjetas con fab, filas sin fab y con columna de acciones.
- Comportamiento: el play de fila reproduce sin abrir el editor; el hero reproduce y marca el anillo; «Subir canciones» sigue abriendo el selector.
- CSS: relleno AA del hero, pastillas de 40 px, ausencia de `.pl-action-ico`/`.pl-action-play`, disco de acento, revelado por hover/foco.
- Contraste: `--accent-text-2` y los cuatro selectores residuales.
- axe: el **editor de lista** entra como décima pantalla auditada (0 violaciones).

**Total tras esta sección: 106/106** (65 pulido + 27 smoke + 14 axe).

---

## 9. Corrección de las capturas (2026-10-19): vacíos solapados y «Nueva» sin funcionar

**Reporte:** tres capturas en ArcaneChat (Biblioteca con 1 canción, Buscar y Biblioteca vacía) con iconos/títulos flotando sobre el contenido, y el botón de crear listas sin responder.

### 9.1 Causa raíz (única para casi todo)

En `styles.css` existían **dos** reglas para el mismo selector `.empty-state`:

1. ~línea 1236: en flujo (`position: relative`, pensada para estados vacíos dentro de listas).
2. ~línea 2004: `position: absolute; inset: 0; z-index: 10` (pensada **solo** para `#emptyState`, la pantalla vacía del reproductor).

La segunda ganaba en la cascada para **todos** los `.empty-state`. Así, cada estado vacío dentro de un `<li>` (listas de Biblioteca, canciones, historial de Buscar, Favoritos, cola) se convertía en una capa a pantalla completa anclada al `.sheet-panel`:

- **Captura 1 (Biblioteca, 1 canción):** el vacío «Sin listas todavía» del carril tapaba la fila MONOLOG, los chips de orden y parte de «Aleatorio».
- **Captura 2 (Buscar):** el vacío del historial flotaba sobre los filtros, con el placeholder del input como titular gigante.
- **Captura 3 (Biblioteca vacía):** los vacíos de listas y de canciones, ambos absolutos, se imprimían uno sobre otro («Tu biblioteca está vacía» + «Sin listas todavía» + botón entre medias).
- **«Nueva» no funcionaba:** la lógica siempre fue correcta (verificado por DOM: abre, guarda y pinta la lista), pero la capa invisible del estado vacío cubría todo el panel e interceptaba los toques antes de que llegaran al botón.

### 9.2 Corrección

| Archivo | Cambio |
|---|---|
| `styles.css` | La regla absoluta pasa a `#emptyState` (solo el reproductor). Refuerzo en el bloque de pulido: los `.empty-state` hijos de `.track-list`, `.queue-list`, `.playlist-list` y `.playlist-rail` quedan `position: relative; inset: auto; z-index: auto; width: 100%`. El vacío del carril se hace breve (icono 44 px, `padding: 20px 16px`, `flex: 1 0 100%`) para no empujar las canciones fuera de vista. |
| `js/stats-ui.js` + `data.js` | El vacío de Buscar ya no reutiliza `search_placeholder` como titular: nuevas claves `search_empty_title` / `search_empty_hint` en los 8 idiomas («Sin búsquedas recientes» + explicación). |

No se tocó la lógica de crear listas: no tenía ningún fallo. Al retirar la capa que bloqueaba los toques, tanto «+ Nueva» de Biblioteca como «Nueva» de «Tus listas» (y el CTA del propio vacío) vuelven a funcionar.

### 9.3 Pruebas añadidas (9, bloque M de `verificacion/ui-polish.js`)

- CSS: ningún `.empty-state` sin acotar es absoluto; solo `#emptyState` lo es; los vacíos de listas van en flujo y el del carril es breve.
- DOM: Biblioteca vacía muestra cada vacío en su sección; Buscar no duplica el placeholder; con 1 canción y 0 listas la fila se ve y el vacío queda en su carril.
- Comportamiento: «+ Nueva» abre el creador, guardar crea la lista (aparece en el carril y en «Tus listas») y el vacío desaparece; «Nueva» de «Tus listas» también abre.

**Total tras esta sección: 115/115** (74 pulido + 27 smoke + 14 axe), ejecutadas también contra el `.xdc` extraído.

---

## 10. Filas de canciones v2, icono de Vaciar y Favoritos (capturas 2026-10-19)

**Petición:** pulir la lista de canciones en la cola, en las listas y en «Todas las canciones»; el icono de vaciar lista es horrible; eliminar el botón de ir a Biblioteca en Favoritos.

### 10.1 Diagnóstico de las filas

Las tres pantallas ya compartían el patrón `.track-row`/`.queue-item`, pero con medidas pensadas para escritorio: asa de arrastre de mínimo 40 px, portada de 48 px (sobre un canvas de 44, reescalado), dos acciones de 40 px y huecos de 12 px. En una fila útil de ~320 px, lo fijo sumaba ~274 px en el editor de lista: el título quedaba en ~46 px («Us…», «Aspi…»). Además, las pistas sin metadatos mostraban «0:00», como si duraran cero segundos.

### 10.2 Qué se hizo

| Zona | Cambio |
|---|---|
| Patrón de fila (Cola, listas, Todas las canciones, Buscar, Favoritos, historial) | Huecos de 9 px, padding 7 px, alto mínimo 60 px (las listas virtuales siguen con `rowHeight: 64`), radio 14 px, portada **44×44** (tamaño real del canvas), texto en columna con línea 1.3/1.35, duración pequeña alineada a la derecha con números tabulares. |
| Asa de arrastre | Columna fina de **20 px** (40 de alto), icono de 13 px y opacidad 0.55: sigue reordenando, ya no roba el título. |
| Acciones de fila (menú, quitar, quitar de la cola) | **36 px** visuales, icono 16–17 px. Decisión documentada: se baja de 40 a 36 px a cambio de ~70 px más para el texto; la fila (≥60 px) sigue siendo el objetivo principal y cada botón conserva su `aria-label`. |
| Duración desconocida | Nuevo `App.fmtRowDuration(t)`: con duración 0/ausente la celda queda vacía. Usado en Biblioteca, Cola, editor de lista e historial. El reproductor sigue mostrando el total con `fmtTime`. |
| Icono de Vaciar | Eliminada la escoba (`#i-broom`, ilegible a 13–16 px). Nuevo `#i-clear-list`: tres líneas con una ×, en trazo. Aplicado en Vaciar cola, Vaciar lista y «Liberar espacio». |
| «Vaciar» de la cola | De barra a todo ancho a pastilla discreta `fit-content` alineada a la derecha. |
| Favoritos vacío | Sin botón «Biblioteca» (`#btnFavGoLibrary` eliminado): Favoritos y Biblioteca ya son pestañas vecinas en la barra inferior. Queda icono, titular y explicación. En pantallas ≤360 px la portada baja a 40 px y las acciones a 34 px antes que seguir recortando el título. |

Con las nuevas medidas, el texto útil en el editor de lista pasa de ~46 px a ~120 px en un móvil de 360 px.

### 10.3 Pruebas añadidas (6, bloque N de `verificacion/ui-polish.js`)

- CSS: fila unificada (44/9/60), asa de 20 px, acciones de 36 px y «Vaciar» de la cola como pastilla.
- Icono: existe `#i-clear-list`, lo usan los 3 botones y no queda `#i-broom`.
- DOM: con una pista de 3:24 y otra sin duración, ninguna de las tres listas pinta «0:00»; las tres comparten portada/texto/duración y conservan asa, menú y quitar donde toca.
- Favoritos: el vacío no contiene ningún botón.

**Total tras esta sección: 121/121** (80 pulido + 27 smoke + 14 axe), ejecutadas también contra el `.xdc` extraído.

---

## 11. Letras v2 (captura 2026-10-19)

**Petición:** «aquí hay bastante que pulir también en la interfaz», sobre la vista de letra sincronizada.

### 11.1 Diagnóstico de la captura

1. **Cabecera duplicada:** arriba «Yoake no uta — jo0ji» y justo debajo, otra vez título y artista junto a la portada.
2. **Barra de herramientas rota:** 11 controles sueltos (A−, A+, Desfase, repetir, restablecer, pantalla completa, cargar, editar, compartir) que en 360 px saltaban a dos filas y dejaban iconos huérfanos flotando.
3. **La velocidad apretaba la mini-cabecera:** `− 1.0× +` compartía fila con portada y título.
4. **Controles sobre el texto:** anterior/pausa/siguiente flotaban en absoluto sobre la última línea visible, que quedaba atrapada bajo la pausa.
5. **Silencios como versos:** cada línea vacía se pintaba con una ♪ a tamaño completo, con el hueco de un verso (en la captura, tres notas enormes separando frases).
6. **Lectura fatigosa:** huecos de 16 px entre líneas, líneas lejanas al 55% de opacidad sobre un degradado morado al 60%: casi ilegibles.

### 11.2 Qué se hizo

| Zona | Cambio |
|---|---|
| Cabecera | Solo queda la etiqueta «Letra sincronizada». Se elimina `#lyricsTrackName` y su asignación en `renderCurrentTrack()`: la identidad vive una sola vez, en la mini-cabecera. |
| Herramientas | Una **sola fila desplazable** con 5 grupos en pastilla: tamaño de letra, desfase, velocidad, repetir/restablecer y acciones (pantalla completa, cargar, editar, compartir). Todos los botones conservan su `id` y su comportamiento. |
| Velocidad | Se muda de la mini-cabecera a la barra, con los demás ajustes. La mini-cabecera queda en portada 44 px + título/artista, con un filete inferior. |
| Controles | De flotantes a **barra atracada** en la columna (`position: relative`, fondo `--blur-bg` esmerilado y borde superior). La letra hace scroll por su carril y nunca queda bajo la pausa. El play usa el degradado seguro `--accent-fill → --accent-fill-2`. |
| Progreso | La barra estrena una línea fina de progreso con tiempos (actual/total), alimentada por el mismo `updateProgress()` del reproductor (`#lyricsProgressFill`, `#lyricsTimeCurrent`, `#lyricsTimeTotal`). |
| Líneas | Hueco de 11 px, ancho máximo 620 px, línea activa con fondo de acento al 12% y crecimiento del 12% (antes 18%, que hacía saltar el texto). Lejanas al 70–85% (antes 55%). Fondo degradado al 42% (antes 60%). |
| Silencios | `.lrc-line.empty` al 58% del tamaño, opacidad 0.35 y sin altura de verso; si es el silencio activo sube al 72% en color de acento, sin fondo. |

### 11.3 Pruebas añadidas (8, bloque O de `verificacion/ui-polish.js`)

- CSS: fila sin saltos con grupos, controles atracados (no absolutos), silencios discretos y lejanas legibles.
- DOM: no existe la línea duplicada de cabecera; la velocidad está en la barra y sube/baja (1.0× → 1.1× → 1.0×); los 10 ajustes/acciones siguen presentes y agrupados en 5 pastillas.
- Render: una LRC con silencio intermedio lo pinta como interludio `♪` con clase `empty`.
- Progreso: con el audio a 50 s de 200, la barra marca 25%, `0:50` y `3:20`.

**Total tras esta sección: 129/129** (88 pulido + 27 smoke + 14 axe), ejecutadas también contra el `.xdc` extraído.

---

## 12. Regresión de gestos: la barra de Letras cambiaba de canción

**Reporte:** «Al desplazar el menú ahora de un lado a otro se pasa de una canción a otra».

**Causa:** la barra de herramientas de Letras pasó a ser desplazable en horizontal (sección 11), pero el gesto global de `wireGestures()` —deslizar en la vista de Letras para ir a la siguiente/anterior— solo excluía hojas, navegación y la portada. El arrastre sobre la barra burbujeaba hasta `#deviceScreen` con `dx > 60` y disparaba `next()`/`prev()`. El mismo hueco permitía cerrar la vista arrastrando la barra hacia abajo.

**Corrección (`js/events.js`):** el gesto se clasifica al nacer. En `touchstart` se marca `swipeFromUi` si el toque empieza en `.lyrics-toolbar`, `.lyrics-top-bar`, `.lyrics-mini`, `.lyrics-controls`, el indicador de bucle o cualquier control interactivo (`button`, `input`, `textarea`, `select`, `a`, `[role="slider"]`); en `touchend` esos gestos se descartan tanto para el cambio de canción como para el cierre vertical. Marcarlo al inicio importa: el dedo puede terminar sobre otro elemento. Deslizar sobre la letra misma sigue cambiando de canción y cerrando la vista, como antes.

**Pruebas (4, bloque P):** se simulan arrastres táctiles reales sobre la barra, sobre un botón de la barra, sobre el play y sobre el área de la letra. Sin la corrección, las 4 fallan; con ella, la barra no cambia de canción ni cierra, y el gesto sobre la letra conserva su comportamiento.

**Total tras esta sección: 133/133** (92 pulido + 27 smoke + 14 axe), también contra el `.xdc` extraído.

---

## 13. Acciones de la lista en una sola línea

**Petición:** aplicar a los botones de dentro de la lista (subir, renombrar, compartir, vaciar y eliminar) lo mismo que a la barra de Letras: una sola línea.

**Cambio (`styles.css`, acotado a `#sheetEditPlaylist .edit-pl-actions`):** la fila deja de envolverse (`flex-wrap: nowrap`) y pasa a desplazarse en horizontal sin barra visible, con las pastillas sin encoger (`flex: 0 0 auto`) para que ninguna etiqueta se parta ni se recorte. Un fundido en el borde derecho avisa de que hay más acciones fuera de pantalla. El acotado importa: Favoritos reutiliza `.edit-pl-actions` para su «Reproducir Todo» y conserva su comportamiento. Las cinco acciones mantienen orden, texto, iconos y el contraste de las destructivas.

**Pruebas (3, bloque Q):** la regla acotada no envuelve y desplaza, la genérica sigue intacta para Favoritos; las cinco acciones están en la fila en el orden pedido con su texto; y «Subir» y «Renombrar» siguen funcionando dentro de la fila. Se corrigió además una búsqueda sin anclar en el bloque L que cazaba la nueva regla acotada en vez de la base.

**Total tras esta sección: 136/136** (95 pulido + 27 smoke + 14 axe), también contra el `.xdc` extraído.

---

## 14. Sin cierre de Letras al deslizar hacia abajo

**Petición:** eliminar en la vista de Letras lo de desplazar hacia abajo para cerrar.

**Cambio (`js/events.js`):** se elimina la rama de swipe vertical de `wireGestures()`: deslizar hacia abajo ya no vuelve al reproductor desde ninguna zona de la vista. Era fácil dispararla sin querer al hacer scroll por la letra. Para salir quedan el botón de volver de la cabecera (`#btnBackFromLyrics`) y, en pantalla completa, el de salir (`#btnLrcExitFs`). El swipe horizontal sobre la letra para cambiar de canción no se toca, ni la protección de la barra de herramientas de la sección 12.

**Pruebas (bloque P actualizado, 5):** deslizar hacia abajo sobre la barra y sobre la letra mantiene la vista abierta y no cambia de canción; el botón de volver sí cierra.

**Total tras esta sección: 137/137** (96 pulido + 27 smoke + 14 axe), también contra el `.xdc` extraído.

---

## 15. Reproductor v2

**Petición:** tras la crítica de la captura del reproductor («¿Qué te parece la interfaz?» → «Adelante»), se aplican los seis puntos acordados.

| Punto | Cambio |
|---|---|
| Cabecera sin duplicar | `#nowPlayingContext` ya no repite el título (que va en grande bajo la portada): muestra «Reproduciendo desde · <contexto>» con `getPlayContextLabel()`, o «Tu biblioteca» si no hay contexto. El título completo queda en el tooltip. |
| «+» sobrio | `#btnBack` pierde la clase `icon-add` (el disco de acento de 40 px que competía con la portada y se confundía con un «volver»): queda un botón de superficie. Inicio conserva su disco, donde cargar música sí es la acción principal. |
| Álbum que aporta | En `renderCurrentTrack()` el álbum se oculta si coincide con el título o con el artista (comparación normalizada), el caso del sencillo de la captura. |
| Progreso preciso | El área de toque pasa a 22 px con la línea visible de 4 px centrada (`::before`), el tirador se insinúa siempre (13 px, acento con borde blanco) y crece al arrastrar, y el relleno usa el acento uniforme en vez del degradado de portada que viraba a rosa. El buffer y el rango A–B se centran igual. |
| Transporte reequilibrado | Grupo centrado (`justify-content: center`, huecos fluidos), aleatorio/repetir a 44 px en `--text-2` con punto de acento cuando están activos, anterior/siguiente a 48 px y play a 68 px con sombra más suave. |
| Secundaria con etiquetas | Letras, Cola, Volumen y Visualizador ganan etiqueta `.sec-label` traducida (`data-i18n` con la misma clave que su `aria-label`); A–B ya se lee en su distintivo. En pantallas bajas la portada cede a 30dvh antes que los controles. |

**Pruebas (6, bloque R):** CSS de progreso/transporte/etiquetas; la cabecera pinta «Reproduciendo desde · Mi música» y no el título; el álbum igual al título se oculta y uno distinto se muestra; el «+» del reproductor no es disco y el de Inicio sí; y las cuatro etiquetas existen con su clave i18n.

**Total actual: 143/143** (102 pulido + 27 smoke + 14 axe), también contra el `.xdc` extraído con `AURORA_ROOT=/tmp/xdc-player-v2 npm test`.
