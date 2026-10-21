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
| Paquete `.xdc` | 28 archivos · 302.1 KB | **28 archivos · 325.5 KB** |

**Paquete final:** `aurora-music-player.xdc`
**SHA-256:** `1607f88fe7b42871f94a6caba7c6c63491e1de1a376203891e3ceff1c156eba0`
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
OK  aurora-music-player.xdc · 28 archivos · 325.5 KB
    sha256: 1607f88fe7b42871f94a6caba7c6c63491e1de1a376203891e3ceff1c156eba0
    nombre: Aurora Music Player
    código: https://github.com/nelsondev2/Aurora-Music-Player
    icono: icon.png (90.5 KB)
    archivos: 28 · comprimido: 325.5 KB · sin comprimir: 942.0 KB
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

---

## 16. Organización del repositorio

**Petición:** eliminar todos los archivos de prueba y ubicar cada tecnología en su carpeta. **Decisiones documentadas:** la suite `verificacion/` se elimina por completo del repo (se confirmó en verde, 143/143, justo antes de borrarla y se conserva solo esta constancia); la librería vendorizada `jsmediatags.min.js` se queda en `assets/js/` por ser código de terceros ya dentro de una carpeta `js` — todo el JavaScript **propio** vive en `js/`; y los informes de `docs/` no se reescriben porque son el registro histórico de cada fase.

| Antes | Después |
|---|---|
| `styles.css` (raíz) | `css/styles.css` |
| `data.js`, `storage.js`, `uploader.js`, `webxdc.js` (raíz) | `js/` junto a los demás módulos |
| `verificacion/` (9 archivos + dependencias) | eliminada |

Referencias actualizadas: `index.html` (`css/styles.css`, `js/webxdc.js`, `js/data.js`, `js/storage.js`, `js/uploader.js`), `build-xdc.py` (empaqueta por directorios `css/` y `js/` y valida el stub en `js/webxdc.js`) y la tabla de contenido del `README.md`. Al revisar `index.html` se eliminó además un fragmento duplicado tras el `</html>` (83 bytes que volvían a cargar `js/main.js`).

**Comprobación sin suite permanente:** sintaxis de los 19 JS con `node --check`; arranque real con un arnés externo temporal (copia fuera del repo) cargando los 20 scripts desde sus rutas nuevas — `App` viva, 0 errores — tanto en el repo como en el `.xdc` extraído; y validación del paquete con `build-xdc.py --check` (28 archivos, mismo tamaño e inventario que antes, sin ningún archivo de prueba dentro).

---

## 17. Tres retoques del reproductor (captura del usuario)

**Petición:** el A-B «descuadra» con los otros secundarios; la etiqueta del visualizador sale «Visualizad…»; y arriba se lee «REPRODUCIENDO AHORA / Reproduciendo desde · Musica», redundante.

| Punto | Causa y cambio |
|---|---|
| A-B descuadrado | Era el único secundario sin etiqueta y con distintivo de 34×30 frente a cajas de icono de 36×36: quedaba centrado a otra altura y sin texto debajo. Ahora el distintivo es 36×36 (radio 12, como los `.ico`) y lleva `.sec-label` con la clave nueva `ab_label` («Bucle» en es; junto al distintivo se lee «Bucle A-B»). Los estados `A→`/`A⇄B` y `aria-pressed` no cambian. |
| «Visualizad…» | La `.sec-label` forzaba mayúsculas: «VISUALIZADOR» en caja alta no cabe en su columna (≈61 px a 360 px). Sin `text-transform` y con `letter-spacing: 0` la palabra en caja mixta ocupa ~20 % menos y entra entera; el resto de etiquetas no se resiente. |
| Cabecera redundante | Fuera la línea «REPRODUCIENDO AHORA» del reproductor (la de Letras, «LETRA SINCRONIZADA», queda). El contexto pasa a una sola frase: `playing_from` + nombre, con la traducción española ajustada a «Reproduciendo de» — «Reproduciendo de Música», «de Favoritos»… La misma frase se usa en el subtítulo de la Cola. Sin contexto sigue «Tu biblioteca». |

**Comprobación** (arnés jsdom externo, fuera del repo): cabecera con lista/álbum → «Reproduciendo de Música», con Favoritos → «Reproduciendo de Favoritos», sin contexto → «Tu biblioteca», en inglés → «Playing from Música»; A-B recorre `A-B → A→ → A⇄B → A-B` con sus clases y su etiqueta pasa a «Loop»/«ループ» al cambiar de idioma; 0 errores de arranque en el repo y en el `.xdc` extraído. Paquete: 28 archivos · 325.5 KB · sha256 `1607f88fe7b42871f94a6caba7c6c63491e1de1a376203891e3ceff1c156eba0`.

---

## 18. Play/pausa y pantalla completa «muertos»: listeners duplicados

**Síntoma (captura del usuario):** el botón play/pausa del reproductor no responde y el de pantalla completa del menú de Letras tampoco. **Causa raíz:** ambos son botones tipo *interruptor* (toggle). Si el arranque se dispara dos veces en el mismo contexto — el cliente WebXDC puede re-evaluar `main.js` o reemitir `DOMContentLoaded` — `wireEvents()` registraba cada listener dos veces: un solo toque pausaba y reanudaba a la vez (y la pantalla completa entraba y salía en el mismo clic), así que «no pasaba nada». Los botones no-toggle (siguiente, abrir hojas…) disimulaban el duplicado. **Reproducido en jsdom** forzando un doble `init()`: cada clic llamaba dos veces a `togglePlay`/`toggleLyricsFullscreen`; con un solo arranque, una.

**Corrección (tres capas, comentarios en el código):**
1. `App.init()` se ejecuta una sola vez (`_initStarted`): un segundo arranque devuelve al instante.
2. `wireEvents()` y `wireGestures()` salen si ya están cableados (`_wired.events` / `_wired.gestures`).
3. `bootAurora()` en `main.js` se protege con `window.__auroraBooted` ante una re-evaluación del script.

**Comprobación** (arnés jsdom externo): con doble arranque simulado, 1 clic = 1 llamada; pausar deja `isPlaying:false` y reanudar lo restablece; pantalla completa entra con un clic (`lyrics-fullscreen`) y sale con el botón ×; arranque normal sin cambios; 0 errores en repo y `.xdc` extraído. Paquete: 28 archivos · 325.5 KB · sha256 `1607f88fe7b42871f94a6caba7c6c63491e1de1a376203891e3ceff1c156eba0`.

---

## 19. Bienvenida de Inicio pulida

**Petición:** opinión de la pantalla de inicio en estado vacío (7,5/10) → «Adelante» con los cinco puntos.

| Punto | Cambio |
|---|---|
| Tercio inferior vacío | `.home-welcome` centra el bloque en vertical (`justify-content: center`) y la aurora se extiende a toda la pantalla (`inset: -10% -40%`, opacidad 0.85): el degradado ya no muere a mitad. |
| Sin Ajustes sin música | La cabecera de Inicio se oculta en este estado y con ella su engranaje. La bienvenida lleva el suyo (`#btnHomeWelcomeSettings`, arriba a la derecha) que abre la misma hoja de Ajustes. |
| Perks que parecían botones | Cada ventaja lleva descripción de una línea (`home_perk_*_desc`, 8 idiomas): «Con tus archivos .lrc, línea a línea», «Crea listas y marca favoritos», «Todo queda en tu teléfono». Filas más compactas (padding 8px). |
| Chips incompletos | Se añade **OPUS**: MP3 · FLAC · M4A · WAV · OGG · OPUS, lo que la app reproduce de verdad. |
| Triple marca | Fuera el wordmark «AURORA» bajo el icono (y su CSS, incluida la regla de tema claro): icono + titular, con más aire sobre el `h2`. |

**Comprobación** (arnés jsdom externo): bienvenida sin wordmark, 6 chips, tres perks con título+descripción, el engranaje abre `sheetSettings`, traducción EN aplicada («With your .lrc files, line by line»), 0 errores en repo y en el `.xdc` extraído. Paquete: 28 archivos · 325.5 KB · sha256 `1607f88fe7b42871f94a6caba7c6c63491e1de1a376203891e3ceff1c156eba0`.

---

## 20. Inicio con música: hero que aporta, fuera el «Pro», densidad y «Ver todo»

**Petición:** opinión de Inicio ya con música (8/10) → «Adelante» con los cuatro puntos.

| Punto | Cambio |
|---|---|
| Hero duplicaba al mini | La tarjeta «Continuar escuchando» muestra, si hay posición de reproducción (>5 s y no casi al final), la línea «Retomar en X» (`home_resume_at`, 8 idiomas) en color de acento: ahora aporta el dato que el mini-reproductor no enseña. |
| «AURORA · REPRODUCTOR PRO» | `app_title` pasa a ser solo «Aurora» en los 8 idiomas: no hay versión Pro ni otra que no lo sea. |
| Densidad | Tarjetas de carril de 132 → 116 px: caben tres secciones de un vistazo. Y la pista cargada se marca en su tarjeta con un ecualizador de tres barras sobre la portada (animado solo si suena, quieto con `prefers-reduced-motion`) y el título en acento. |
| Sin salida a la lista completa | Cada sección lleva «Ver todo» (`see_all`, 8 idiomas) que abre la Biblioteca, cableado en `_bindHomeRails` vía `data-see-all`. |

**Comprobación** (arnés jsdom externo): kicker «Aurora»; hero con posición «Retomar en 1:24» y sin posición sin inventar la línea; solo la tarjeta actual lleva `.eq-badge.playing`; «Ver todo» abre la hoja Biblioteca; 0 errores en repo y en el `.xdc` extraído.
Paquete: 28 archivos · 325.5 KB.

## 21. «Reproduciendo desde», no «de»

Ajuste de redacción pedido por el usuario: la frase de contexto vuelve a ser «Reproduciendo desde <lista/contexto>» (clave `playing_from`, es). Se aplica igual en la cabecera del reproductor y en el subtítulo de la Cola. Verificado con el arnés externo: ambas dicen «Reproduciendo desde Música», 0 errores.

---

## 22. Pulido de Biblioteca

**Petición:** «Pasamos ahora a pulir la biblioteca» → opinión (7,5/10) → sí a los seis puntos.

| Punto | Cambio |
|---|---|
| Subtítulo con eco | `makeTrackRow` oculta el álbum del subtítulo cuando coincide con el título o con el artista (la misma regla del reproductor): «BALALAIKA / 9Lana», no «9Lana · BALALAIKA». Lo heredan Biblioteca, listas, Buscar, Favoritos y el menú de pista. |
| «Seleccionar» cortado | El botón de selección por lote sale de la fila con scroll horizontal: nueva `.lib-sort-wrap` con chips desplazables a la izquierda y el botón fijo a la derecha. |
| Duraciones a saltos | `fmtRowDuration` devuelve un «—» tenue (`.row-duration-na`) cuando la duración es desconocida: la columna mantiene el ritmo sin inventar cifras. |
| Fila actual poco visible | Título en color de acento (`.track-row.current`/`.queue-item.current`) y el ecualizador de tres barras sobre la miniatura, animado solo si suena — el mismo distintivo de Inicio. El editor de listas conserva su icono propio. |
| Acciones que se pierden al bajar | Cabecera de «Todas las canciones» + acciones + ordenación en `.lib-songs-sticky` (`position: sticky`, fondo del panel): reproducir todo y reordenar siempre a mano. |
| Última fila bajo el mini | `#sheetLibrary .sheet-body` gana `padding-bottom: 104px`: el final de la lista siempre queda por encima del mini-reproductor. |

**Comprobación** (arnés jsdom externo): cinco filas de prueba — eco eliminado (álbum=título y álbum=artista ocultos, álbum distinto visible), duraciones `3:10/—/—/2:49/1:40`, fila actual con `.eq-badge.playing` y las demás sin marca, «Seleccionar» fuera del scroll y dentro de `.lib-sort-wrap`, bloque sticky presente con la lista fuera de él; 0 errores en repo y en el `.xdc` extraído. Paquete: 28 archivos · 325.5 KB · sha256 `1607f88fe7b42871f94a6caba7c6c63491e1de1a376203891e3ceff1c156eba0`.

## 23. Textos neutros de plataforma

«Carga canciones del teléfono» dejaba fuera a quien usa la app en Delta Chat de escritorio. Las dos únicas claves que nombraban el teléfono pasan a «tu dispositivo» en los 8 idiomas: el lead de la bienvenida (`home_welcome_lead`) y la descripción de la ventaja local (`home_perk_offline_desc`; el japonés ya decía «端末»). Sin cambios de lógica. Verificado con el arnés externo en ES y EN, 0 errores.

---

## 24. Listas .m3u: importación (la exportación ya existía)

**Petición:** «Listas .m3u». Al revisar, la exportación ya estaba («Compartir lista» genera un `.m3u8` estándar desde el editor); lo que no existía era importar. **Implementado:**

- **Parser** (`parseM3U`, en `js/playlist-edit.js` junto al exportador): `#EXTM3U`, `#PLAYLIST:nombre`, `#EXTINF:dur,Artista - Título`, rutas con esquema `file://`, codificación `%XX`, saltos CRLF y BOM. También M3U simple (solo rutas).
- **Emparejado** (`matchM3UEntries`) por nombre de archivo (sin la carpeta de origen), por «Artista - Título» y por título si es único. Duplicadas dentro del propio archivo, una sola vez. Si nada coincide no se crea una lista vacía y se avisa con honestidad; el toast resume «X de Y canciones encontradas».
- **Dos entradas**: botón «Importar .m3u» junto a «Nueva» en Listas de reproducción de la Biblioteca, y el selector general «Cargar música» acepta `.m3u/.m3u8` y los convierte en listas. Si el nombre ya existe, la importada se llama «nombre (2)».
- 5 claves nuevas en 8 idiomas (`m3u_import_btn`, `imported_playlist_name`, `toast_m3u_imported/none/empty`).

**Comprobación** (arnés jsdom externo): formato Aurora (ruta Windows `C:\…` y URI con `%20`) importa 2/3; M3U simple con rutas relativas y duplicadas importa 2; rescate por título funciona; sin coincidencias no crea lista; nombre repetido → «(2)»; e ida y vuelta real exportar→importar conservando nombre y orden. 0 errores en repo y `.xdc` extraído.

---

## 25. Auditoría general final

Auditoría completa sobre `5c1cb60` (con el arnés jsdom externo, fuera del repo):

| Bloque | Resultado |
|---|---|
| Sintaxis | 19/19 JS con `node --check`; `build-xdc.py` compila |
| Estructura | Sin IDs duplicados (318), sin JS propio fuera de `js/`, sin CSS fuera de `css/`, referencias locales todas presentes |
| i18n | 394 claves × 8 idiomas, ninguna incompleta; ninguna clave usada sin definir |
| Offline/seguridad | Ninguna carga remota en el código de la app; sin `eval`/`document.write`/`onclick` inline; 0 TODO/FIXME propios |
| Funcional | **26/26**: arranque único y doble (regresión de botones), play/pausa, pantalla completa de Letras, cabecera «Reproduciendo desde», ciclo A-B, Biblioteca (eco/duración/marca/sticky), M3U ida y vuelta, Bienvenida (chips/Ajustes/dispositivo), Inicio (Retomar/marca/Ver todo) e i18n EN |
| Paquete | 28 archivos, sin rastros de pruebas, sha256 reproducible y `--check` OK |
| Accesibilidad | **Hallazgo corregido aquí**: 5 botones de la toolbar de Letras solo tenían icono (4 con `title`, 1 sin nada). Todos con `aria-label` traducible (`data-i18n-aria`), incluido «Quitar loop». Botones sin nombre accesible: 179 → **0 sin nombre** |

**Observaciones que quedan como están (decisión, no fallo):** no hay suite de pruebas dentro del repo (se retiró a petición del usuario; la verificación es externa por fase); la sincronización entre dispositivos está aparcada a petición del usuario; `js/data.js` y `css/styles.css` son grandes pero estables. La verificación visual en dispositivo real sigue siendo la del usuario mediante capturas.

---

## 26. Correcciones tras las capturas (cierre único, placeholder, mini-player)

Las capturas del usuario eran de un paquete anterior (de ahí el eco de Favoritos y el «Select» cortado, ya corregidos en la §23). Los detalles vigentes que se corrigieron:

- **Placeholder de Buscar cortado**: el texto venía truncado en el propio diccionario («Canción, artista o ál…» en los 8 idiomas). Ahora completo: «Canción, artista o álbum» y equivalentes, sin puntos suspensivos.
- **Doble cierre en las cabeceras**: casi todas las hojas tenían a la vez una «×» a la izquierda y un botón de texto «Cerrar»/«Listo» a la derecha que hacían lo mismo; Biblioteca solo tenía la ×. Se eliminan los 16 botones de texto duplicados y se sustituyen por el espaciador de centrado, dejando la × como cierre único (con `aria-label` traducido). Se conservan las acciones reales de la derecha («Nueva» en Listas, «Guardar» en editores, «Reproducir Todo» en Explorar). La clave `done_btn` queda retirada del diccionario al quedarse sin uso.
- **Mini-player sobre las filas**: las hojas-pestaña terminan en `--chrome-offset`, calculado con `--mini-h: 56px`, pero el mini ocupa 56 px de alto + 6 px de margen inferior: el borde de la hoja quedaba 6 px por debajo del borde superior del mini y este tapaba esa franja de la lista. `--mini-h` pasa a 62 px con `has-mini` y la hoja termina justo sobre el mini.

**Comprobación** (arnés jsdom externo): regresión específica 15/15 (ninguna cabecera con botón de texto de cierre, 22 cabeceras con exactamente una ×, acciones conservadas, la × cierra Favoritos y Ajustes, placeholder completo aplicado en ES/EN, diccionario sin `done_btn`) y auditoría funcional general 26/26 sin regresiones; i18n 393 claves × 8 idiomas sin huecos. Repetido sobre el `.xdc` extraído: 15/15, `build-xdc.py --check` OK.

---

## 27. Copia de seguridad completa (v2): ajustes y sesión portables

**Petición:** qué faltaría para el 10 sin realtime → se empieza por la copia de seguridad. Al revisar, ya existía una copia de metadatos (listas, favoritos, estadísticas, historial, con fusión aditiva y reenlace de audio); lo que la hacía «incompleta» era que no guardaba ajustes ni dónde ibas, y que el reenlace entre dispositivos exigía nombre **y tamaño** idénticos.

**Implementado** (en `js/library.js`, junto al exportador/importador existentes):

- **Formato v2** (`version: 2`, con `appVersion` y `exportedAt`; nombre de archivo con fecha `aurora-backup-AAAA-MM-DD.json`). Los backups v1 siguen importando.
- **Ajustes** (`_backupSettings`/`_applyBackupSettings`): tema, acento, idioma, volumen, gapless/normalizar/crossfade/marqueo/vinilo, preservar tono, velocidad, tamaño de letra, modo de visualizador, EQ (ganancias personalizadas o preset) y orden de la biblioteca. Al importar se aplica **en silencio** (sin toasts de los setters) y todo pasa por listas blancas: tema/idioma/modo inventados se rechazan, volumen y ganancias ±12 dB se limitan, crossfade solo acepta 0/3/6/12.
- **Sesión portable** (`_backupSession`): pista actual y cola identificadas por nombre+tamaño de archivo y la posición en segundos. Al importar se traduce a los id locales, se guarda como sesión a restaurar y, si no está sonando nada, se aplica al momento con el propio `restoreSession()`: mismo tema, misma cola, mismo segundo, en el otro dispositivo.
- **Reenlace por nombre**: si el tamaño difiere (otro ripeo de la misma canción) y el nombre de archivo es único en la biblioteca, la pista se reenlaza igual en vez de crear una fantasma sin audio. Aplica a listas, favoritos, estadísticas, historial y sesión.
- El texto de ayuda en Ajustes (8 idiomas) ahora dice la verdad: «Listas, favoritos, ajustes y dónde ibas escuchando. No incluye los archivos de audio.» El flujo entre dispositivos es manual: exportar → enviar el `.json` por el propio chat → importar. Sin servidores, sin realtime, sin gasto continuo de datos.

**Comprobación** (arnés jsdom externo): regresión específica 26/26 —exportación con todos los campos, importación en un «dispositivo B» con otros id y *otros tamaños* (0 pistas fantasma, lista y favoritos reenlazados a los id locales, tema/acento/volumen/crossfade/EQ aplicados, sesión traducida conservando los 42 s), compatibilidad v1 y backup manipulado rechazado por las listas blancas— con 0 errores; auditoría funcional general 26/26 e i18n 393×8 sin huecos. Repetido sobre el `.xdc` extraído: 26/26, `--check` OK.

---

## 28. Reordenar la cola arrastrando (rehacer bien lo que ya había)

**Petición:** reordenar la cola arrastrando. Al revisar, ya existía un asa de arrastre en la cola y en el editor de listas, pero con carencias: el asa medía 20 px de ancho (difícil de agarrar con el dedo), el arrastre no se reflejaba en la cola original con el aleatorio activo (al desactivarlo se perdía el orden nuevo), no guardaba la sesión al soltar, en listas virtualizadas (>80) no había forma de llevar una pista lejos (sin autoscroll, y el repintado podía eliminar la fila a mitad de gesto), y convivía con un «modo reordenar» por pulsación larga que no habilitaba nada (solo pintaba la fila y mostraba un toast).

**Implementado** (reescritura de `wireDragHandle` en `js/playlist-ui.js`, compartido por la cola y el editor de listas):

- **Pointer Events** con captura del puntero: un solo camino para dedo y ratón, sin los listeners duplicados de ratón en ventana del código anterior. `touch-action: none` en el asa para que el navegador no robe el gesto como scroll.
- **Asa de 34×40 px** (objetivo táctil real), icono tenue como hasta ahora.
- **Destino calculado por hueco de inserción** y marcado con una sola línea de acento; la fila sigue al dedo con compensación del autoscroll para no despegarse cuando la lista se desplaza bajo ella.
- **Autoscroll** cerca de los bordes (56 px): se puede cruzar una cola larga entera. En listas virtualizadas la fila arrastrada se marca (`dragIdx`) para que `_paintVirtual` no la elimine del DOM al repintar.
- **Al soltar**: se ajusta `queueIdx` para que la pista que suena nunca se pierda, la misma mudanza se refleja en `_originalQueue` si el aleatorio está activo, y se guarda la sesión al momento. En el editor, el mismo gesto reordena la lista y la persiste (con su límite `maxIndex` propio).
- **Retirado** el modo por pulsación larga y su clave `toast_reorder_mode` (8 idiomas): el arrastre funciona directamente, sin modos.

**Comprobación** (arnés jsdom externo): 11/11 en cola y editor (orden resultante, `queueIdx` siguiendo a la que suena al mover otra y al moverla a ella, cancelación sin efecto, espejo en `_originalQueue`, sesión guardada) y 7/7 con cola virtualizada de 100 pistas (ventana pintada, la fila arrastrada sobrevive al repintado, `dragIdx` limpio al soltar). Auditoría general 26/26, backup 26/26, i18n 392×8. Repetido sobre el `.xdc` extraído: 11/11 y 7/7, `--check` OK.

---

## 29. Portada personalizada por canción

**Petición:** poder poner una imagen propia a una canción (cuando la de los metadatos falta o está mal).

**Implementado:**

- **Entrada**: menú de pista (⋯ o pulsación larga) → «Cambiar portada»; si la pista ya tiene una personalizada aparece además «Restablecer portada». Icono `i-image` nuevo en el sprite.
- **Procesado** (`setCustomCover`, en `js/playlist-ui.js`): se valida que sea imagen (tipo MIME o extensión) y ≤ 15 MB; se generan dos miniaturas JPEG de 96 y 256 px con recorte cuadrado centrado reutilizando `resizeDataUrl` del importador, y se guardan en `track.customCover` (persisten con la pista en IndexedDB). La portada original nunca se toca: quitar la personalizada la devuelve tal cual.
- **Prioridad en todos los resolvedores**: `coverSrcForRow` (filas), `_renderArtwork` (reproductor y Media Session), `_playlistTrackArtSrc` (mosaicos de listas) y `_coverForSession` consultan primero `customCover`, así ni un re-etiquetado posterior puede pisarla. Al cambiarla se invalida la caché de artwork y los mosaicos de las listas que contienen la pista, y se repintan biblioteca, listas, cola, favoritos, inicio, mini-player y reproductor si es la que suena.
- **Viaja en la copia de seguridad**: el backup la incluye por pista; al importar, una pista restaurada nace con ella y una pista ya existente la adopta solo si no tiene ya una personalizada local. Las miniaturas se validan como cualquier imagen externa (`_safeImageDataUrl`: SVG rechazado).
- 5 claves nuevas × 8 idiomas (`ctx_change_cover`, `ctx_remove_cover`, `toast_cover_updated/removed/error`).

**Comprobación** (arnés jsdom externo, con el redimensionado sustituido por uno determinista): 21/21 —puesta y quitada de portada, prioridad en los cuatro resolvedores, persistencia en IndexedDB, original intacta debajo, menú que muestra/oculta «Restablecer» según el caso, rechazo de un archivo de audio como imagen, y el viaje completo en el backup (adopción sin pisar la local, pista nueva con portada, SVG rechazado)— con 0 errores. Sin regresiones: auditoría 26/26, backup 26/26, cola 11/11, cierres 15/15, i18n 397×8. Repetido sobre el `.xdc` extraído: 21/21, `--check` OK.

---

## 30. Letras .lrc automáticas al importar

**Petición:** que al cargar música, un `.lrc` con el mismo nombre que una canción se le asocie solo, sin abrir la vista de Letras pista a pista.

**Implementado** (en `js/library.js`, dentro de `handleFileInput`, que ya aceptaba `.lrc` en el selector pero los mandaba al importador de audio, donde se perdían):

- Los `.lrc` se separan al inicio, como ya pasaba con los `.m3u`: nunca llegan al importador de pistas.
- **`_attachLrcFiles`**: empareja por nombre base sin extensión ni mayúsculas («Tema.lrc» ↔ «Tema.mp3», también «TEMA.LRC» ↔ «tema.mp3»). Busca primero entre lo recién importado (incluidas las pistas reenlazadas de un backup) y después en toda la biblioteca, así que también funciona soltar **solo los .lrc** de una carpeta ya importada, o reimportar la música acompañada de sus letras.
- **Política**: nunca pisa una letra que la pista ya tenga (la de los metadatos o una cargada/editada a mano manda; para sustituirla está el botón de la vista de Letras). Archivos vacíos o ilegibles se saltan sin romper la importación. La letra se guarda en `track.lrc` (mismo formato de líneas que usa el botón manual), se invalida su caché y se persiste.
- **Avisos**: el toast de la importación añade «· X letra(s) enlazada(s)»; soltando solo letras sin coincidencia se avisa con honestidad («Ninguna letra coincidió con tus canciones»). 2 claves nuevas × 8 idiomas.

**Comprobación** (arnés jsdom externo; el importador de audio se simula y `Blob.text()` de jsdom se sustituye por FileReader, como en un navegador real): 15/15 —audio+letra en la misma importación, letra que `parseLrc` lee con tiempos, persistencia en IndexedDB, letra previa que no se pisa, solo-.lrc sobre la biblioteca, sin coincidencia, .lrc vacío inofensivo, mayúsculas en nombre y extensión, y reimportación sin duplicados ni pérdida de la letra— con 0 errores. Sin regresiones: auditoría 26/26, backup 26/26, portada 21/21, cola 11/11, i18n 399×8. Repetido sobre el `.xdc` extraído: 15/15, `--check` OK.

---

## 31. Estrés con 5.000 canciones y persistencia reforzada

**Petición:** el bloque de «dispositivo real»: preparar la app para bibliotecas grandes y dejar lista la confirmación final en el móvil.

**Medición antes de tocar nada** (arnés jsdom con 5.000 pistas, 20 listas de 250 y cola completa; jsdom es más lento que un WebView real, valen las comparaciones relativas):

| Superficie | Antes | Después | Causa |
|---|---|---|---|
| Favoritos (500) | ~320 ms, 500 filas DOM | **~7 ms, 9 filas** | Era la única lista larga sin virtualizar; ahora usa `fillVirtualList` como la cola |
| Cola (5.000) | ~104 ms | **~7 ms** | La limpieza de ids usaba `tracks.some()` por id (cuadrático): ahora el índice `trackMap()` |
| Listas (20×250) | ~212 ms | **~47 ms** | `getPlaylistCover` resolvía cada id con `find()`: ahora `getTrackById` |
| Importar backup (5.000) | ~110 ms | **~25 ms** | Listas/favoritos/historial filtran contra un `Set` de ids construido una vez |
| Buscar | ~58 ms | ~48 ms | Caché de textos normalizados por pista (`_searchClean`, WeakMap): ya no se normalizan 5.000 títulos por tecla; se recalcula sola si se editan las etiquetas |

Sin cambios de comportamiento: mismos resultados y mismos contextos de reproducción (favoritos sigue reproduciendo la lista entera al pulsar una pista).

**Persistencia**: ya se pedía almacenamiento persistente al arrancar y Ajustes muestra uso/cuota con 🔒 si está concedido. Refuerzo: tras cada importación de música se vuelve a pedir, porque algunos navegadores solo lo conceden tras interacción real con la app.

**Comprobación**: estrés repetido sobre el repo y el `.xdc` extraído (0 errores); regresión de búsqueda 5/5 (tokens cruzados título+artista, filtros, invalidación de la caché al editar); batería completa sin regresiones (auditoría 26/26, backup 26/26, portada 21/21, letras 15/15, cola 11/11, cierres 15/15, i18n 399×8).

**Pendiente (solo puede hacerlo el usuario, en su dispositivo)**: instalar este `.xdc` en Delta Chat, importar una carpeta grande y comprobar que la biblioteca se desplaza sin tirones, que al reabrir la app todo sigue ahí (sesión y biblioteca), y que en Ajustes → Almacenamiento aparece el uso con el 🔒 si el sistema concedió la persistencia. Si algo va lento ahí, la superficie concreta ya tiene su medición de referencia en esta sección.

## 32. Triaje del informe de QA externo (2026-10-20)

Informe recibido favorable («Apto para uso general», 0 errores de consola del
revisor) con deuda concentrada en accesibilidad. Cada hallazgo se verificó
contra el código antes de tocar nada; resultado:

**Confirmados y corregidos**

- **A1 — Ghost de bienvenida invisible en tema claro.** Cierto: la regla
  `:not(.primary-btn)…` de contorno/borde/sombra del tema claro (especificidad
  mayor) ganaba al `.primary-btn.ghost`. Ahora la regla es
  `:root[data-theme="light"] .primary-btn:not(.ghost)`: el ghost conserva su
  aspecto en claro y en oscuro.
- **A2 — Doble salto de ±5 s con las flechas sobre el slider.** Cierto: el
  handler global de `keydown` no excluía `[role="slider"]`, así que el slider
  hacía su salto nativo y además el global sumaba los 5 s. Añadida la guardia
  `e.target.closest('[role="slider"]')`. Verificado: un solo salto.
- **A3 — Velocidad solo editable desde Letras.** Cierto. Nuevo stepper
  −/velocidad/+ en Ajustes → Reproducción (clave `settings_speed`), sincronizado
  en ambos sentidos con el de Letras y con botones deshabilitados en 0,5×/2,0×.
- **A4 — Aria sin localizar.** Cierto en dos sitios: el engranaje de la
  bienvenida llevaba «Abrir Ajustes» fijo (ahora `t('settings_title')`) y las
  bandas del ecualizador se etiquetaban al construirlas, sin refrescar al
  cambiar de idioma (ahora `applyLang()` las re-etiqueta: «Banda 1»↔«Band 1»).
- **A5 — Icono de canciones gigantesco portada.** Cierto: `.pl-cover-icon`
  intentaba 28 % con `inset` pero `width/height:auto` lo dejaba sin tamaño
  efectivo. Ahora centrado explícito al 38 % del cuadrado.
- **M1 — Singular de «pistas».** Cierto. Nueva clave `track_count_one` (×8) y
  helper `fmtTracksCount(n)`: «1 pista» / «1 track». Usado en la tarjeta de
  Inicio, el subtítulo de Explorar, los metadatos de listas y los resultados.
- **M2 — Dos secciones con el mismo título.** Cierto. Nuevas claves
  `theme_section` y `accent_section` (×8): «Tema» y «Color de acento» ya no
  comparten `themes_title`.
- **M3 — Etiquetas laterales en mayúsculas duras.** La causa no era el
  `uppercase` de `.sec-label` (no lo tenía): lo heredaba de `.sec-btn`
  (`text-transform: uppercase` en el botón contenedor). Eliminado allí; los
  acentos («Álbumes», «MÁS ESCUCHADAS») ya no heredan esa transformación.
- **M4 — Asa de arrastre pequeña.** Amplada de 34×40 a 40×44 px.
- **M5 — Buscador sin nombre accesible.** `#searchInput` tiene ahora
  `aria-label` localizado («Buscar», `data-i18n-aria="search_title"`).

**Tratado con aviso (sin modal)**

- **A6 — La copia no avisa de que falta el audio.** No se añadió el modal
  previo que sugería el informe (evita fricción en un flujo que ya tiene su
  pantalla), pero el aviso Visible en Ajustes (`settings_export_hint`, ×8) y su
  fallback en el HTML dicen ahora expresamente que las canciones **no viajan**
  en la copia y que habrá que importarlas también en el otro dispositivo.

**Sin acción**

- **I1 — Service Worker / funcionamiento sin conexión.** La app es una WebXDC:
  Delta Chat sirve los archivos localmente dentro del paquete; no hay red que
  cachear ni manifiesto que instalar. Se queda fuera de alcance salvo petición
  expresa.

**Hallazgo extra durante la regresión (no estaba en el informe)**

- `drawCover()` leía `track.cover.dataURL` sin proteger. Las pistas
  restauradas de una copia traen `coverIsImage` pero no el campo `cover` (el
  backup no lo exporta): al abrir el reproductor con una de ellas sonando, la
  vista reventaba con un TypeError. Ahora se usa la miniatura disponible y, si
  no hay imagen dibujable, se cae al gradiente generado.

Verificación: nueva regresión específica del informe **21/21** (CSS de
A1/A5/M3/M4 inspeccionado, un solo salto con el slider enfocado, stepper de
Ajustes sincronizado con límites, aria de bienvenida y EQ en ES/EN, M2 y M1,
0 errores), regresión general reconstruida **9/9** (doble arranque, búsqueda
con singular, arrastre de cola, copia v2, letra .lrc automática y portada con
repaint usando la pista en curso), diccionario **403 claves ×8 sin huecos**.
Todo repetido sobre el `.xdc` extraído: idéntico resultado.

**Pendiente del usuario**: probar en su dispositivo (Delta Android/Desktop/iOS):
velocidad desde Ajustes sin abrir Letras, slider sin doble salto, tema claro en
la bienvenida, arrastrar la cola y el 🔒 de persistencia en sesiones largas.

## 33. Loop AAA por dimensiones (alcance: personal y local)

Decisión de producto que gobierna esta evaluación: Aurora es un reproductor
**personal y local** dentro del chat — biblioteca desde el dispositivo, sin
sincronización en tiempo real ni cola compartida (descartada expresamente por
consumo de datos). La dimensión 5 de la rúbrica queda por tanto como **N/A
justificado**: no hay updates que enviar, con lo que el riesgo de spam al chat
es cero por construcción; `sendToChat` solo actúa cuando el usuario comparte
algo a mano.

### Iteración 1 — metadatos, sesión y corruptos

Evaluación inicial severa (auditoría de código): UX 8 · Audio 8 · Archivos 7 ·
Cola local 8 · Sync N/A · Persistencia 7 · Rendimiento/tamaño 8 · Robustez 7 ·
Integración 8 · Originalidad 9.

Top 3 gaps y correcciones:

1. **La duración real nunca se pedía.** `probeDuration()` existía sin un solo
   llamador: toda canción importada nacía con `duration: 0` y la biblioteca
   mostraba 0:00 hasta reproducirla. Ahora se sondea en paralelo con las
   etiquetas (timeout de 4 s, un archivo corrupto devuelve 0 y no retiene la
   importación).
2. **La restauración de sesión era frágil en tres puntos.** (a) Deduplicaba
   la cola, aunque una cola puede contener la misma canción dos veces de
   forma legítima: al reabrir cambiaba lo que iba a sonar; ahora solo se
   filtran ids inexistentes. (b) Con duplicados, `queueIdx` se recalculaba a
   la primera copia; ahora se respeta el índice guardado si apunta a la pista
   actual. (c) Asignaba `currentTrack.src` a ciegas: una pista restaurada de
   una copia (sin blob) convertía el `<audio>` a la URL literal «undefined»;
   ahora la URL se resuelve con `getTrackUrl()` y, si no hay audio enlazado,
   el elemento queda limpio. Además, `saveSession()` escribe un **espejo
   síncrono en localStorage**: al cerrar la WebView, la escritura asíncrona
   en IndexedDB puede no completarse, y al restaurar gana la foto con mayor
   `ts`. Las colas se guardan como copia, no como referencia viva.
3. **Tres archivos corruptos seguidos paraban la música** aunque la cuarta
   canción fuera válida, con un toast por archivo. Nueva política única
   (`_handleDecodeFailure()`, compartida por el evento `error` y por el
   rechazo de `play()`): se recorre la cola una vez antes de rendirse, se
   avisa solo al primer fallo y al abandonar, y el contador se reinicia en
   cuanto algo suena. El evento `error` sin fuente (vaciar el elemento al
   borrar la pista actual) ya no cuenta como corrupción ni salta canciones.

Tras la iteración: Audio 9 · Cola local 9 · Persistencia 9 · Robustez 9.

### Iteración 2 — Vorbis Comment (FLAC/OGG/Opus)

El único gap que quedaba por debajo de 9 era Archivos (7): jsmediatags cubre
ID3/MP4, pero FLAC, OGG y Opus guardan sus metadatos como **Vorbis Comment**
y esas canciones quedaban con el nombre del archivo por título.

Se añadió un lector propio sin dependencias (`readVorbisTags`): bloques de
metadatos FLAC (tipo 4 = comentario, tipo 6 = portada) y reconstrucción de
paquetes Ogg uniendo segmentos de página (cabeceras `\x03vorbis` y
`OpusTags`), con lectura limitada al primer MB y lectura binaria vía
FileReader (compatible con WebViews sin `Blob.arrayBuffer()`). Rellena
título, artista, álbum y portada solo donde falten, sin pisar un ID3 válido.

Tras la iteración: Archivos 9.

### Evaluación final del loop (auditoría de código)

| Dimensión | Nota | Nota |
|---|---|---|
| 1 UX/UI en sandbox móvil | 9 | Áreas seguras, 100dvh, objetivos ≥44 px, listas virtualizadas |
| 2 Motor de audio web | 9 | Buffering Visible, gapless/crossfade, política de corruptos de una pasada |
| 3 Gestión de archivos | 9 | ID3/MP4 + Vorbis, duración sondeada, duplicados O(1), .lrc y M3U |
| 4 Cola/playlists (local) | 9 | Duplicados legítimos preservados también tras reabrir |
| 5 Sincronización de playback | N/A | Fuera de alcance por decisión expresa; cero updates |
| 6 Persistencia local | 9 | IndexedDB + espejo síncrono, restauración sin URLs inválidas |
| 7 Rendimiento y tamaño | 9 | 339 KB el .xdc; estrés con 5.000 pistas ya optimizado |
| 8 Robustez | 9 | Corruptos, sin-fuente, cierre inesperado, cuota y reenlace |
| 9 Integración con el chat | 9 | Sin spam posible; compartir solo a petición del usuario |
| 10 Originalidad | 9 | Letras sincronizadas, EQ, copia portable, portadas, stats |

Verificación: regresión nueva **12/12** (FLAC y OGG sintéticos con metadatos
Vorbis y duración, sesión con duplicados y posición exacta, pista sin audio
sin «undefined», tres corruptos seguidos llegando a la canción válida, un
solo aviso, error sin fuente inocuo, 0 errores), diccionario **403×8** y todo
repetido sobre el `.xdc` extraído (339,2 KB, sha256 `1668fc92…`).

**Límite honesto**: las notas son de auditoría de código y banco jsdom. La
prueba en el dispositivo real del usuario (Delta Android/Desktop/iOS:
importar FLAC/OGG reales, cerrar la app a mitad de canción y reabrir,
encadenar archivos corruptos) sigue pendiente y es la única vía de subir a
10; ningún 10 se declara sin ella.

## 34. El resaltado de la navegación se quedaba en «Inicio» (reporte con capturas)

**Síntoma** (capturas del usuario en Delta Android): estando en Favoritos,
Buscar o Biblioteca, la pestaña resaltada abajo seguía siendo «Inicio».

**Causa raíz**: `goNav()` marcaba la pestaña nueva **antes** de cerrar las
anteriores. Al cerrar la pestaña previa, `closeSheet()` ejecutaba su regla
«si no queda ninguna pestaña abierta, vuelve a Inicio» y borraba el
resaltado recién puesto; la pestaña nueva se abría después sin volver a
marcar. Desde Inicio (sin pestaña abierta) sí funcionaba, por eso el fallo
solo aparecía al saltar **entre** pestañas — exactamente lo capturado.

**Corrección**:
- `goNav()` aplica `setNavActive(nav)` al final, tras cerrar y abrir.
- `openSheet()` refuerza el invariante: abrir Biblioteca/Buscar/Favoritos
  activa su botón, lo abra el camino que lo abra.
- De paso, `setNavActive()` ahora también pone `aria-current="page"`:
  el lector de pantalla anuncia la pestaña actual igual que el ojo la ve.
- El comportamiento querido se conserva: cerrar una pestaña con la X
  devuelve el resaltado a Inicio (cubierto por la regresión).

Verificación: regresión específica escrita antes de corregir (5 ok / 4 fail,
fallando justo los saltos entre pestañas) y **9/9** tras la corrección;
regresión AAA 12/12 e i18n 403×8, todo repetido sobre el `.xdc` extraído
(339,6 KB, sha256 `79ba0c22…`).

## 35. Dentro de la lista: mismo contenido, menos ruido (petición del usuario)

El usuario aceptó la interfaz en general pero los botones de dentro de
las listas «aún no le convencían». Preguntado, acotó: **el conjunto
entero** (cabecera, fila de acciones y controles por pista) y la
dirección **discreta**: conservar todo, bajando el volumen visual.

Cambios, solo de pintura y acotados al editor de lista
(`#sheetEditPlaylist` / `#editPlaylistTracks`), sin tocar
funcionalidad ni otras pantallas que reutilizan las clases:

- La portada y el botón hero de reproducir pierden la mitad de su
  sombra; el anillo de «esta lista está sonando» se mantiene.
- Las pastillas de acción (Subir, Renombrar, Compartir, Vaciar,
  Eliminar) pasan a fondo transparente, texto e icono en gris
  `--text-3` y peso 500: ya no compiten con el botón de reproducir.
- **Sin rojo permanente**: Vaciar, Eliminar y el ✕ de cada pista son
  neutros en reposo, al pasar el ratón y al tocarlos. El rojo queda
  donde protege de verdad, en el diálogo de confirmación, que no ha
  cambiado.
- Los controles por pista (asa, ⋯, ✕) quedan en voz baja: icono de
  15 px, sin fondos teñidos; el asa conserva sus 40×44 táctiles.

Verificación: como es solo CSS, lo que se comprueba es la cascada
(especificidad con `#sheetEditPlaylist` por encima de las reglas
anteriores, incluidos los `:hover` genéricos que teñían de rojo) y que
nada funcional se rompió: navegación 9/9, AAA 12/12 e i18n 403×8 en
repo y en el `.xdc` extraído (340,1 KB, sha256 `baad97f5…`). El juicio
visual final es del usuario en su dispositivo.

## 36. Barra de Letras uniforme (petición del usuario)

El usuario pidió para los botones de Letras el mismo tratamiento que
convenció en las listas: el problema aquí no era el peso sino la
**uniformidad**. Medido en el CSS, dentro de una sola barra convivían
botones de 36 px (tamaño de letra, bucle, acciones), de 30 px (desfase
y velocidad), el −/+ del desfase dibujado como texto y el de velocidad
como icono SVG, y los valores «0.0s» y «1.0×» con dos tipografías y
anchos distintos.

Corrección (CSS al final de `styles.css`, acotado a `.lyrics-toolbar`,
más un cambio de HTML):

- Una sola caja: todos los botones de la barra miden 36 px de alto
  (34 px en pantallas de ≤360 px), con el mismo radio de pastilla.
- El grupo de desfase adopta el mismo relleno (3 px) y separación que
  los demás grupos; su etiqueta conserva aire a la izquierda.
- El −/+ del desfase pasa de carácter de texto a icono SVG
  (`#i-minus`/`#i-plus`), idéntico al de velocidad.
- Los valores entre − y + (`0.0s`, `1.0×`) comparten fuente, peso,
  ancho mínimo de 40 px y números tabulares: ninguno «salta» al
  cambiar.
- Sin cambios de comportamiento: A−/A+ siguen siendo texto a dos
  tamaños (es su significado), el bucle activo sigue en acento y los
  botones deshabilitados en los extremos de velocidad, igual.

Verificación: regresión específica **9/9** (iconos presentes, regla
de altura única, velocidad/desfase/A+ funcionales, 0 errores),
navegación 9/9, AAA 12/12 e i18n 403×8, todo repetido sobre el
`.xdc` extraído (340,5 KB, sha256 `9a465075…`). El juicio visual,
como en la §35, es del usuario en su dispositivo.

## 37. «Reproducir Todo» de Favoritos, en la misma familia (petición del usuario)

El botón de Favoritos era el último rincón con la pintura antigua:
una banda a todo ancho con el degradado y el resplandor del
`.primary-btn` genérico (0 10px 30px al 35 %), mientras el resto de
la app ya iba plano y sereno (hero de listas, pastillas discretas,
barra de Letras uniforme).

Pasada, en la misma línea de las §35–36:

- Clase propia `.fav-play-all`: relleno **plano** `--accent-fill` (sin
  degradado), sombra suave (0 6px 16px al 22 %, como el hero),
  radio de pastilla, 48 px de alto táctil. Sigue siendo claramente LA
  acción principal de la pestaña, pero ya no grita más que la música.
- **Se oculta cuando no hay favoritos**: antes quedaba sobre el
  estado vacío invitando a reproducir una lista inexistente.
- **Anillo `is-playing`** cuando Favoritos es la lista que suena, el
  mismo lenguaje que el botón hero de las listas.
- El `.primary-btn` con degradado no desaparece: queda para altas y
  diálogos de confirmación, donde ese peso sí ayuda.

Verificación: regresión específica **9/9** (clase y pintura plana,
oculto sin favoritos, visible con ellos, anillo al sonar y no en
pausa, clic que reproduce con 0 errores), Letras 9/9, navegación 9/9,
AAA 12/12 e i18n 403×8, repetido sobre el `.xdc` extraído (341,0 KB,
sha256 `d52996b5…`).

## 38. Vuelve «Mi Música» automática + contexto real desde Buscar (petición del usuario)

Dos peticiones del usuario en un mismo mensaje:

**1. «Mi Música» como lista automática.** Las canciones que se
agregan sin haber creado una lista iban solo a Todas las canciones.
El usuario revierte expresamente la retirada anterior de esta lista:
ahora existe de nuevo como lista automática de la casa (id fijo
`mi-musica`, primera entre las listas):

- Al arrancar, si hay biblioteca y no existe, se crea con todas las
  pistas (no se guarda la procedencia histórica de cada una).
- Al importar sin lista destino, las canciones nuevas (y las
  duplicadas/re-enlazadas en esa misma importación) entran en ella.
  Importar desde la pantalla de una lista solo alimenta esa lista.
- Como cualquier lista, solo agrupa: quitar una canción de «Mi
  Música» no la borra de la biblioteca, y la lista se puede borrar;
  al hacerlo queda la marca `aurora_mimusica_removed` para que el
  arranque no la resucite — solo vuelve cuando se agregue otra
  canción fuera de una lista. Deshacer el borrado retira la marca.
- La copia de seguridad la sigue ignorando como lista: el arranque
  la reconstruye con la biblioteca restaurada.

**2. «Reproduciendo desde…» mentía desde Buscar.** Todas las
canciones elegidas en Buscar salían con contexto «Todas las
canciones» aunque vivieran en una lista (y la cola era la biblioteca
entera). Nuevo `searchPlayContextFor()`: manda la lista de la
canción — primero las listas del usuario, después «Mi Música» y
solo si no está en ninguna, Todas las canciones —. No es cosmético:
la cola pasa a ser esa lista, así que siguiente/anterior y la
etiqueta cuentan lo mismo.

Verificación: regresión específica **15/15** (creación al arrancar
y primera posición, importación suelta dentro, importación a lista
fuera, borrado respetado y reconstrucción, las tres prioridades de
contexto y el extremo a extremo buscar→reproducir con cola y
etiqueta «desde Rock», 0 errores), Favoritos 9/9, Letras 9/9,
navegación 9/9, AAA 12/12 e i18n 403×8, repetido sobre el `.xdc`
extraído (342,3 KB, sha256 `b721dd93…`).

## 39. Barrida de pequeños detalles (petición del usuario)

El usuario pidió buscar «otros pequeños detalles como los arreglados
hasta ahora». Barrida por ejes (contextos que mienten, pintura fuera
de familia, textos sin traducir, contadores, objetivos táctiles) con
estos hallazgos reales — todo lo demás salió limpio: 78 aria-labels
con su clave i18n (salvo el nombre de la app), ningún literal en
español fuera del diccionario, ningún plural sin singular y la
duración desconocida ya pintaba «—», no «0:00»:

1. **El «Todas las canciones» forzado tenía tres focos más** tras el
   de Buscar (§38): «Reproducir ahora» y «Reproducir a continuación»
   del menú de pista, las tarjetas de canción de Inicio y las filas
   del Historial. El resolvedor se generaliza a
   `trackPlayContextFor()` (queda alias del nombre viejo) y los tres
   focos lo usan: manda la lista de la canción en cualquier puerta.
2. **Anillos «está sonando» desactualizados**: el hero de la lista
   abierta y el «Reproducir Todo» de Favoritos se pintan al
   renderizar; pausar desde el mini-reproductor con la hoja abierta
   los dejaba encendidos. `updatePlayUI()` los re-sincroniza en cada
   play/pausa.
3. **Etiqueta con el nombre del día del play**: «Reproduciendo
   desde…» usaba el nombre guardado en el contexto; renombrar la
   lista que suena no se reflejaba. Ahora se resuelve por id al
   pintar.
4. **Botón de quitar el bucle de Letras a 24×24 px**, por debajo de
   todo lo demás: sube a 32×32.

Verificación: regresión específica **6/6** (menú de pista hacia su
lista, anillo que se enciende y se apaga sin re-render, etiqueta tras
renombrar, regla CSS del bucle, 0 errores) y la batería completa en
verde (Mi Música 15/15, Favoritos 9/9, Letras 9/9, navegación 9/9,
AAA 12/12, i18n 403×8), repetida la específica sobre el `.xdc`
extraído (343,1 KB, sha256 `7dcccd72…`).

## 40. El fondo difuminado vive solo en la zona superior (petición y consulta del usuario)

El usuario pidió que el fondo difuminado del reproductor ocupara
«desde la parte superior hasta antes de la barra de progreso», y
pidió opinión sobre si era buena idea o era mejor no hacer nada.

**Opinión dada**: buena idea con dos condiciones — que el límite sea
una disolución y no una pared (la barra de progreso no cae al mismo
píxel en todas las pantallas, porque la sección de la portada
flexiona con el alto) y que título/artista queden sobre la parte ya
disuelta para no perder legibilidad. El ambiente actual cubría la
vista entera y se disolvía al 95 %, ensuciando de color la zona de
controles sin aportar nada allí.

**Hecho** (solo CSS, acotado a `#viewPlayer`; Letras conserva el
suyo): el contenedor `.bg-blur` pasa de ocupar toda la vista al
60 % superior, y su velo disuelve a `--bg-0` al 97 %, de modo que el
ambiente muere justo al llegar a la barra de progreso y la zona de
controles queda sobre el fondo limpio de siempre. Sin JS, sin DOM y
sin tocar el rendimiento (el mismo blur de antes, en menos área).

Se descartó por ahora la variante «portada real difuminada como
imagen de fondo»: es el siguiente escalón visual posible, pero mete
imagen tras el título (legibilidad) y coste de repintado; la rampa
de colores de la portada ya da el mismo ambiente sin esos riesgos.
Si el usuario la quiere, se hace como opción aparte.

Verificación: como es solo CSS, la batería funcional es la red de
regresiones habitual (detalles 6/6, Mi Música 15/15, navegación 9/9,
AAA 12/12, i18n 403×8) en repo y detalles 6/6 sobre el `.xdc`
extraído (343,5 KB, sha256 `f439cbd9…`). El juicio visual final es
del usuario en su dispositivo.

## 41. Segunda barrida con lupa (todas las áreas)

Auditoría por referencias cruzadas (iconos, i18n, IDs, etiquetas) más
lectura de código. **Cinco imperfecciones reales**, todas corregidas:

### 41.1 «Reproduciendo desde Iniciar radio»
La etiqueta de contexto reutilizaba la clave del botón de menú
`ctx_start_radio` («Iniciar radio», verbo): el reproductor anunciaba
«Reproduciendo desde Iniciar radio». Nueva clave sustantiva
`radio_label` («Radio» y equivalentes en los 8 idiomas; diccionario
404 claves × 8).

### 41.2 `fmtTime` desbordaba los minutos a partir de una hora
Una pista de 90 minutos mostraba «90:00». Ahora `h:mm:ss` desde los
3600 segundos; por debajo, `m:ss` intacto. Afecta a los tiempos del
reproductor y a las filas (`fmtRowDuration`).

### 41.3 Estadísticas reproducía sin contexto
El clic en «Canciones más escuchadas» llamaba a `playTrack(tid)` sin
contexto: la cola pasaba a ser toda la biblioteca conservando la
etiqueta del contexto anterior. Ahora usa `trackPlayContextFor()`
(§39): la canción suena desde su lista.

### 41.4 Contraste de `.lt-btn.emphasis`
Blanco sobre `--accent` (≈3,9:1). Pasa al par de relleno seguro
`--accent-fill`/`--accent-on-fill` (≥4,5:1 garantizado), el mismo de
la barra de Letras y del botón de Favoritos.

### 41.5 Dos símbolos de icono muertos
`i-backward` e `i-font` definidos en el sprite y jamás usados,
retirados. Verificado antes de tocar: `i-volume-xmark` NO era muerto
(se invoca dinámicamente por nombre en `_updateVolumeIcon()`) y se
conserva.

**Verificado limpio en esta pasada** (sin cambios): referencias de
iconos (ninguna usada-sin-definir), claves i18n invocadas sin definir
(solo falsos positivos de `createElement`), IDs (sin duplicados;
todos los buscados existen en HTML o se crean dinámicamente),
hojas (las 23 con cierre), Escape global, progreso con
`aria-valuenow`/`valuetext`, textos de error sin literales en español
fuera de i18n, singular/plural de conteos, duración 0 como «—».

**Verificación**: regresión específica 10/10 (radio, fmtTime,
estadísticas, emphasis, integridad de iconos, 0 errores); batería
completa en verde (detalles 6/6, mimusica 15/15, fav 9/9, letras 9/9,
nav 9/9, AAA 12/12, i18n 404×8); `.xdc` reconstruido y revalidado
sobre la copia extraída.

## Cierre de la sesión §41

| Check | Resultado |
|---|---|
| Etiqueta «Reproduciendo desde Radio» + fmtTime h:mm:ss + estadísticas con contexto + contraste emphasis + sprite sin muertos | ✅ |
| Batería completa (mimusica 15/15, AAA 12/12, nav 9/9, letras 9/9, fav 9/9, detalles 6/6, i18n 404×8) | ✅ |
| `.xdc` válido (343,8 KB, sha256 `a6ca85fe…`) + regresiones sobre extraído | ✅ |

## 42. Selector de archivos integrado de Delta Chat (`webxdc.importFiles`)

La única funcionalidad webxdc desaprovechada que encaja con el
criterio vigente (sin red, gasto cero): en Delta Chat nativo, escoger
archivos con el selector del propio Delta en vez de salir al
explorador del sistema.

**Diseño** — un ayudante central, `pickFilesWebxdc(filter)` en
`js/library.js`, con contrato estricto:

- Devuelve un **array** (aunque vacío): el selector nativo se usó.
  Vacío = el usuario canceló, y **no** se abre el `<input>` detrás
  (sería lanzarle un segundo selector tras cancelar).
- Devuelve **null**: la API no existe (navegador, stub, Delta antiguo
  sin `importFiles`) o lanzó un error → el llamador sigue con su
  `<input type="file">` de siempre, intacto.

**Conectado en los cinco selectores de la app**:

| Selector | Filtro nativo |
|---|---|
| Música (`openFilePicker`, sin modo carpeta) | extensiones de audio + `.lrc/.txt/.m3u/.m3u8`, múltiple |
| Importar lista (botón M3U) | `.m3u/.m3u8`, único |
| Copia de seguridad (`importLibrary`) | `.json`, único |
| Letra externa (`loadExternalLrc`) | `.lrc/.txt`, único |
| Portada personalizada (`pickCustomCover`) | imágenes, único |

El modo carpeta sigue con su `<input webkitdirectory>` (importFiles
no tiene equivalente; en Delta nativo ese modo ya se degradaba a
multiselección de archivos, que ahora pasa por el selector
integrado). Dos cuerpos de procesado que vivían dentro de handlers
de `change` se extrajeron sin cambiar su lógica para compartirlos
entre ambos caminos: `_importLibraryFromFile()` y
`_applyExternalLrc()`.

**Sin cambios** en el stub de navegador (`js/webxdc.js`): allí
`_isStub` hace que `pickFilesWebxdc` devuelva null y todo sigue como
antes. Sin tocar red ni datos: cero megas, como se decidió.

**Verificación**: regresión específica 16/16 (contrato del ayudante:
stub→null, nativo→archivos+filtro, error→null, cancelación→[];
importación de música de principio a fin sin crear `<input>`;
cancelación sin efectos; copia, letra, portada y botón M3U por el
camino nativo; respaldo creando el `<input>`; 0 errores). Batería
completa en verde (lupa 10/10, detalles 6/6, mimusica 15/15,
fav/letras/nav 9/9, AAA 12/12, i18n 404×8) y regresión repetida sobre
el `.xdc` extraído. El juicio final del selector real (Delta
Android/Desktop) es del usuario en su dispositivo.

## Cierre de la sesión §42

| Check | Resultado |
|---|---|
| `pickFilesWebxdc` + 5 selectores con camino nativo y respaldo | ✅ |
| Regresión importFiles 16/16 + batería completa | ✅ |
| `.xdc` válido (344,8 KB, sha256 `4bce7b82…`) + regresiones sobre extraído | ✅ |

## 43. Visualizador: ondas fluidas y espectro con peso

El visualizador funcionaba, pero con cuatro debilidades medibles.
Todo el trabajo está en `js/audio.js` (+8 px de alto en CSS).

### Funcional

1. **`fftSize` 256 → 2048** (1024 bins). La onda ya no se dibuja con
   128 muestras en zigzag, y el espectro tiene resolución para
   bandas de verdad. Buffer temporal propio (`_visTimeData`, fftSize
   muestras); antes la onda reusaba el buffer de frecuencias, de la
   mitad de largo.
2. **Bandas logarítmicas 35 Hz–16 kHz** (`_visLogBands`, cacheadas
   por barras/bins/sampleRate): la energía musical vive abajo y el
   muestreo lineal anterior dejaba los graves pegados al techo y
   los agudos muertos. Nivel por banda = máximo del rango con
   gamma 0,78 (levanta pasajes flojos sin saturar).
3. **Suavizado ataque/caída por tiempo real** (`_visStepBars`,
   coeficientes desde el dt entre frames, no por frame): ataque en
   ~42 ms, caída en ~175 ms. El parpadeo nervioso pasa a ser un
   espectro con inercia. El bucle ahora pasa el dt al dibujante.
4. **Marcas de pico** que aguantan y caen a 0,42/segundo, dibujadas
   en una sola pasada con un solo `fillStyle`.
5. **Nº de barras adaptable al ancho** (24–56 según el ancho CSS
   del canvas): ni columnas enanas ni láminas de 1 px.

### Visual

6. **Onda fluida de verdad** (`_visWavePoints` + trazo nuevo): se
   diezma el dominio temporal quedándose con la muestra de mayor
   amplitud de cada tramo (~64–140 puntos según ancho), se suaviza
   entre frames y se dibuja con curvas cuadráticas por puntos
   medios, en tres capas: halo ancho al 15 %, relleno suave hasta
   la línea central y trazo principal con extremos redondeados.
7. **Colores de la portada que suena**: los gradientes (onda y
   barras) nacen de `cover.from/cover.to` — la paleta dinámica que
   `renderCurrentTrack` ya calculaba «para el fondo y
   visualizador» sin que el visualizador la usara jamás. Sin paleta,
   el violeta/rosa clásico de respaldo. Cache de gradientes por
   modo + tamaño + paleta (sin recrear por frame, como antes).
8. La sección sube de 54 a 62 px (radio 14) para que barras y
   picos respiren; el coste lo absorbe el área flexible de la
   portada.

**Rendimiento**: se conserva todo lo que ya lo protegía (30 fps,
pausa fuera de pantalla con IntersectionObserver + `document.hidden`,
DPR ≤ 2, gradientes cacheados) y no se asigna memoria por frame
salvo los arrays cacheados que se reutilizan.

**Verificación**: regresión específica 19/19 — paleta y respaldo,
`_hexA`, bandas log crecientes y en rango, gamma en graves,
ataque ≈ mitad en 33 ms y caída más lenta, pico que aguanta y
acaba cayendo, diezmado de onda por máxima amplitud, dibujo
completo de ambos modos con un ctx registrador (rellenos, picos,
≥2 trazos, curvas, caché de gradientes), fftSize y CSS en el código,
0 errores. Batería completa en verde (importFiles 16/16, lupa
10/10, detalles 6/6, mimusica 15/15, fav/letras/nav 9/9, AAA 12/12,
i18n 404×8) y regresión repetida sobre el `.xdc` extraído. El
juicio visual final (fluidez percibida en hardware real) es del
usuario en su dispositivo.

## Cierre de la sesión §43

| Check | Resultado |
|---|---|
| FFT 2048 + bandas log + ataque/caída + picos + onda fluida + paleta de portada | ✅ |
| Regresión visualizador 19/19 + batería completa | ✅ |
| `.xdc` válido (347,5 KB, sha256 `84ff7774…`) + regresiones sobre extraído | ✅ |

## 44. Botones de «Todas las canciones»: la fórmula serena

Captura del usuario: la cabecera de la sección mezclaba cuatro
cajas distintas — «Reproducir Todo» como píldora de acento
desproporcionada, «Aleatorio» con borde, chips de orden a 36 px y
«Seleccionar» con borde discontinuo, más «Borrar todo» en rojo
permanente. Se les aplica la misma fórmula de la barra de Letras
(§36), el «Reproducir Todo» de Favoritos (§37) y los botones de
lista (§35), con un solo bloque CSS acotado a
`#sheetLibrary .lib-songs-sticky` (las clases base `.text-btn`,
`.lib-sort` y `.lib-batch-btn` se usan en más sitios y no se tocan):

- **Una caja de 40 px para todo el grupo** (Reproducir Todo,
  Aleatorio, chips de orden y Seleccionar): misma altura, mismo
  radio de píldora, misma fuente y peso; iconos a 16 px.
- **Un solo protagonista plano** en `--accent-fill`: «Reproducir
  Todo» y el chip de orden activo (y «Seleccionar» en su activo,
  con regla propia dentro del ámbito para que la genérica no lo
  tape por especificidad).
- **El resto, discreto**: superficie + borde sólido + texto, como
  el «Aleatorio» que ya estaba bien encaminado.
- **Adiós al borde discontinuo** de «Seleccionar» (no era familia
  de ningún otro control) y **«Borrar todo» pierde el rojo
  permanente**: queda como utilidad discreta; el rojo aparece al
  pulsar y en la confirmación, que ya existía.

Solo presentación: ningún handler, clase funcional ni texto
cambia (la regresión de abajo pulsa los cinco botones reales).

**Verificación**: regresión específica 10/10 (las cinco reglas CSS
de la fórmula + Reproducir Todo/Aleatorio/Borrar todo vivos, chip
de orden que mueve el activo, «Seleccionar» que entra y sale del
modo con `aria-pressed`, 0 errores). Batería completa en verde
(visualizador 19/19, importFiles 16/16, lupa 10/10, detalles 6/6,
mimusica 15/15, fav/letras/nav 9/9, AAA 12/12, i18n 404×8) y
regresión repetida sobre el `.xdc` extraído. El juicio visual
final es del usuario en su dispositivo.

## Cierre de la sesión §44

| Check | Resultado |
|---|---|
| Cabecera de «Todas las canciones» con la fórmula serena (caja única 40 px, un acento, sin discontinuos ni rojo permanente) | ✅ |
| Regresión cabecera 10/10 + batería completa | ✅ |
| `.xdc` válido (348,2 KB, sha256 `9cc4a4ec…`) + regresiones sobre extraído | ✅ |

## 45. Fuera el botón «Seleccionar» de «Todas las canciones»

Petición del usuario: el botón solo estorba. Se elimina **el
botón**, no la función: la selección múltiple conserva su otra
entrada natural — **pulsación larga sobre cualquier canción**
(0,52 s, ya existía en `wireTrackLongPress`) — que entra en el
modo, marca esa canción y muestra la barra de lote con todas sus
acciones (editar etiquetas, añadir a lista, eliminar, seleccionar
todo, cancelar).

**Limpieza completa de referencias** (nada de botón fantasma):

- `index.html`: botón fuera; el comentario de la cabecera fija
  ahora dice cómo se entra en el modo.
- `js/events.js`: binding del botón fuera.
- `js/nav.js`: `updateBatchUI()` ya no sincroniza clase ni
  `aria-pressed` de un elemento inexistente.
- `js/data.js`: clave huérfana `batch_select` fuera (diccionario:
  403 claves × 8, sin huecos).
- `css/styles.css`: clase `.lib-batch-btn` eliminada entera (base,
  regla de la fila de ordenación y las menciones en el bloque §44,
  que queda vigente para los botones que sí quedan: caja de 40 px,
  «Borrar todo» discreto).

**Hallazgo al hacer hueco**: el «Cancelar selección» de la barra
de lote llevaba un `data-close-sheet="sheetLibrary"` heredado, así
que cancelar la selección **cerraba la biblioteca entera**. Sin el
botón de la cabecera, ese botón pasa a ser la única salida visible
del modo: se le quita el atributo y ahora hace solo lo que su
etiqueta promete (verificado por regresión).

Los chips de orden ganan el ancho que ocupaba el botón; la fila
ahora respira a todo lo ancho.

**Verificación**: regresión específica 18/18 (cero referencias al
botón en HTML/CSS/JS/i18n; fórmula §44 intacta en lo que queda;
pulsación larga real con `mousedown` + 720 ms que entra en el modo
y selecciona la pista; barra visible con contador; «Cancelar
selección» que sale y limpia sin cerrar; Reproducir Todo/Aleatorio
y chips vivos; 0 errores). La regresión §44 queda superada por
esta (sus dos asertos del botón ya no aplican). Batería completa
en verde (visualizador 19/19, importFiles 16/16, lupa 10/10,
detalles 6/6, mimusica 15/15, fav/letras/nav 9/9, AAA 12/12, i18n
403×8) y regresión repetida sobre el `.xdc` extraído.

## Cierre de la sesión §45

| Check | Resultado |
|---|---|
| Botón «Seleccionar» eliminado sin referencias colgantes; lote por pulsación larga intacto | ✅ |
| «Cancelar selección» ya no cierra la biblioteca | ✅ |
| Regresión sinselect 18/18 + batería completa | ✅ |
| `.xdc` válido (347,9 KB, sha256 `098ebeed…`) + regresiones sobre extraído | ✅ |

## 46. «Mi Música» ya no se siembra con las canciones de otras listas

**Fallo reportado por el usuario**: al agregar una canción fuera de
una lista, si «Mi Música» no existía, nacía con **todas las
canciones de las demás listas** en lugar de solo con la agregada.
Causa exacta: `_ensureMiMusica()` recibía los ids de la
importación (`extraIds`) pero, en la rama de creación, los ignoraba
y sembraba con `this.tracks.map(t => t.id)` — en ese momento las
nuevas ya están en la biblioteca, así que entraba todo (§38).

**Corrección** (`js/init.js`):

1. **Crear desde una importación** (`_ensureMiMusica`): la lista
   nace SOLO con los ids de esa importación (deduplicados). Sin
   ids — importación sin frutos — no se materializa una lista
   vacía: devuelve `null`.
2. **Siembra al arrancar** (`migrateMiMusica`): el espejo del mismo
   error. Sin procedencia histórica guardada, «agregada fuera de
   una lista» solo puede reconstruirse como «canción que no vive
   en ninguna otra lista»: la siembra pasa a ser las canciones
   sueltas de la biblioteca, excluidas las que ya están en alguna
   lista del usuario. Si no hay sueltas, no nace vacía en el
   arranque; aparecerá con la primera importación suelta.
   Decisión documentada en el comentario del modelo: una canción
   que entró suelta y luego se organizó en una lista no puede
   distinguirse sin guardar procedencia; la regla observable es
   «en ninguna lista ⇒ suelta».
3. El comentario de la restauración de copia (`js/library.js`)
   quedó alineado («se reconstruye con las canciones restauradas
   que no quedaron en ninguna lista»).

**Lo que no se toca**: una «Mi Música» ya existente con la siembra
antigua no se poda automáticamente — podarla expulsaría también
canciones que entraron sueltas de verdad y después se organizaron
en una lista, indistinguibles sin procedencia. Quien la tenga
llena de todo puede borrarla: a partir de ahí, la próxima
canción suelta la recrea limpia (las demás siguen en «Todas las
canciones»; la lista solo agrupa, no se pierde música).

**Verificación**: regresión de «Mi Música» ampliada a 21/21 —
incluye el escenario reportado tal cual (lista del usuario con
canciones + importar fuera de lista ⇒ «Mi Música» nace con
exactamente la nueva), siembra de arranque solo con sueltas, no
nace vacía si todo está en listas, e importación sin frutos que
no crea nada; los 15 asertos anteriores compatibles siguen en
verde. Batería completa en verde (sinselect 18/18, visualizador
19/19, importFiles 16/16, lupa 10/10, detalles 6/6, fav/letras/nav
9/9, AAA 12/12, i18n 403×8) y regresión repetida sobre el `.xdc`
extraído.

## Cierre de la sesión §46

| Check | Resultado |
|---|---|
| «Mi Música» nace solo con la importación que la crea; arranque solo con sueltas | ✅ |
| Regresión mimusica 21/21 + batería completa | ✅ |
| `.xdc` válido (348,1 KB, sha256 `46471bf2…`) + regresiones sobre extraído | ✅ |

## 47. La Biblioteca es solo listas: fuera «Todas las canciones»

Petición del usuario: eliminar completamente la sección «Todas las
canciones» y dejar solo las playlists. La sección era la raíz de
varias piezas; quitarla «completamente» es quitar también lo que
solo vivía en ella, y así se ha hecho:

**Desaparece**:
- La sección entera del marcado (cabecera fija, «Reproducir Todo»,
  «Aleatorio», chips de ordenación y la lista virtual de canciones)
  y su botón «Borrar todo» de cabecera.
- `renderLibrary()` y sus 20 llamadas (la lista queda solo con
  `renderLibrarySections()` → `renderPlaylists()`), `playLibraryTracks()`,
  `sortedTracks()`, `setLibrarySort()` y el estado `_librarySort`,
  que además deja de viajar en la copia de seguridad (las copias
  viejas que lo traigan lo ignoran sin romper).
- **La selección/edición por lotes entera** (§45 ya había perdido
  su botón; su casa eran estas filas): barra de lote, hoja de
  edición por lote, las 9 funciones `toggleBatchMode`/
  `toggleTrackSelection`/`selectAllTracks`/`clearTrackSelection`/
  `updateBatchUI`/`openBatchEditModal`/`saveBatchEditTags`/
  `batchDeleteTracks`/`batchAddToPlaylist`, sus 8 bindings, las
  casillas en las filas (`makeTrackRow` ya no pinta checkbox ni
  clases de lote), el estado `_batchMode`/`_selectedTrackIds` y la
  rama de lote del selector de listas (la adición de una pista,
  intacta).
- CSS huérfano: `.lib-song-actions`, `.lib-sort*`, `.lib-songs-sticky`,
  `.batch-bar`, `.batch-act`, `.row-batch-check`, `.batch-checkbox`,
  `.track-row.selected/.batch-mode`, `.lib-empty-cta`, el bloque
  §44 entero (solo hablaba de esos botones) y las menciones en las
  listas de selectores compartidas y en el modo ancho.
- 19 claves i18n huérfanas (diccionario: **384 × 8**, sin huecos):
  la sección, las 4 de ordenación y toda la familia `batch_*` +
  `select_track`.

**Decisiones documentadas**:
- La pulsación larga sobre una fila ya no entra en el modo lote:
  abre el menú de la canción, que era su otro significado y el
  único coherente sin lista de biblioteca.
- **«Borrar toda la biblioteca» NO se elimina**: tenía una segunda
  puerta viva en el menú de Ajustes (`menuDeleteLibrary`), así que
  `deleteAllTracks()` se queda; solo muere su botón de la sección.
- Las canciones sin lista siguen alcanzables por Buscar, Inicio
  (recientes/top) y «Mi Música»; la re-vinculación vive en Ajustes
  y no dependía de la sección. Las regresiones `check-sinselect` y
  `check-libbtns` probaban la UI eliminada: jubiladas y sustituidas
  por `check-sololistas`.

**Verificación**: regresión específica 15/15 (marcado y CSS sin la
sección ni el lote; funciones ausentes y `deleteAllTracks`
presente; tarjetas pintadas; «Mi Música» solo con sueltas; filas
sin casilla que reproducen desde su lista; pulsación larga real
que abre el menú sin modo lote; importación suelta intacta;
borrar-todo cancelado que no toca nada; 0 errores). Batería
completa en verde (mimusica 21/21, visualizador 19/19, importFiles
16/16, lupa 10/10, detalles 6/6, fav/letras/nav 9/9, AAA 12/12,
i18n 384×8) y regresión repetida sobre el `.xdc` extraído (el
paquete adelgaza ~6 KB: 342,2 KB).

## Cierre de la sesión §47

| Check | Resultado |
|---|---|
| Sección «Todas las canciones» + lote + ordenación eliminados sin restos | ✅ |
| Biblioteca solo con listas; pulsación larga = menú de la canción | ✅ |
| Regresión sololistas 15/15 + batería completa | ✅ |
| `.xdc` válido (342,2 KB, sha256 `9a5ffe62…`) + regresiones sobre extraído | ✅ |

## 48. Botones del diálogo de confirmación: la misma caja serena

Captura del usuario (borrar «Mi Música»): «Cancelar» y «Delete»
como dos losas de media pantalla. Causa: ambos heredan el
`.primary-btn` global — ~52 px de alto, degradado y resplandor de
30 px pensado para botones de formulario — y el destructivo suma
una sombra roja de neón.

**Corrección** (solo CSS, en las reglas ya acotadas del propio
diálogo `.confirm-actions`; el botón primario de formularios, los
«Guardar» de las hojas, no se toca): la caja serena de siempre —
**44 px, forma de píldora, plana, sin sombras**, peso 600. Cancelar
queda en superficie con borde; confirmar en `--accent-fill`; y el
destructivo en rojo pelado `var(--danger)` sin resplandor (el
`:active` oscuro se conserva). Como la caja quedó plana, el
diálogo entero (icono, mensaje, acciones) recupera proporción.

**Verificación**: regresión específica 10/10 (las tres reglas CSS
de la caja + comportamiento real del diálogo: destructivo con
icono y clase `danger`, cancelar resuelve `false`, no destructivo
sin icono, aceptar resuelve `true`, aviso de un solo botón con
`hideCancel` que oculta y luego restaura el cancelar, 0 errores).
Batería completa en verde (sololistas 15/15, mimusica 21/21,
visualizador 19/19, importFiles 16/16, lupa 10/10, detalles 6/6,
fav/letras/nav 9/9, AAA 12/12, i18n 384×8) y regresión repetida
sobre el `.xdc` extraído.

## Cierre de la sesión §48

| Check | Resultado |
|---|---|
| Diálogo de confirmación con caja serena de 44 px (sin losas ni resplandor) | ✅ |
| Regresión confirm 10/10 + batería completa | ✅ |
| `.xdc` válido (342,5 KB, sha256 `65177baa…`) + regresiones sobre extraído | ✅ |

## 49. «Seguir escuchando» ya no ofrece la canción que está sonando

Reporte del usuario: en Inicio, la tarjeta «Seguir escuchando»
mostraba la canción incluso mientras se estaba reproduciendo —
no hay nada que «seguir» escuchando de lo que ya suena (la tarjeta
duplicaba al mini-reproductor sin aportar ni el «Retomar en…»).

**Corrección** (`js/nav.js`, `js/player-ui.js`, `css/styles.css`):

- La tarjeta nace con el atributo `hidden` cuando algo está
  sonando, y con `data-track` de la pista que muestra.
- `updatePlayUI()` — el punto único por el que pasa cada cambio de
  play/pausa — la conmuta sin repintar Inicio: suena → oculta,
  pausa → visible como «retomar». Nada de rebuilds ni parpadeos.
- Si la pista cambió con Inicio montado (avance automático), el
  `data-track` ya no coincide y ahí sí se repinta Inicio, para que
  al pausar no reaparezca la canción anterior.
- `.home-hero[hidden] { display: none }`: el `display:flex` de la
  tarjeta ganaba al `[hidden]` del navegador y la habría dejado
  visible pese al atributo.

Las otras secciones de Inicio no cambian: en «Añadidas
recientemente» y «Más escuchadas» la pista actual sigue saliendo
con su distintivo de ecualizador, que es lo correcto en una lista.

**Verificación**: regresión específica 8/8 (pausado visible,
sonando oculta vía `updatePlayUI`, pausa la devuelve, render en
reproducción que nace oculta, cambio de pista que se repinta a la
nueva, sin pista no hay tarjeta, regla CSS, 0 errores). Batería
completa en verde (sololistas 15/15, confirm 10/10, mimusica
21/21, visualizador 19/19, importFiles 16/16, lupa 10/10, detalles
6/6, fav/letras/nav 9/9, AAA 12/12, i18n 384×8) y regresión
repetida sobre el `.xdc` extraído.

## Cierre de la sesión §49

| Check | Resultado |
|---|---|
| «Seguir escuchando» oculto mientras suena y de vuelta al pausar | ✅ |
| Regresión hero 8/8 + batería completa | ✅ |
| `.xdc` válido (342,8 KB, sha256 `533982a9…`) + regresiones sobre extraído | ✅ |

## 50. Importar mucho, rápido: una decodificación por portada

Petición del usuario: optimizar la carga de un volumen grande de
canciones. Medido el pipeline (`processFiles` → `processOne` →
persistencia), los dos costes grandes por canción no eran la red
ni IndexedDB (una sola transacción por lote ya existía), sino el
trabajo repetido con las portadas:

1. **Tres decodificaciones por canción con portada**: la imagen
   incrustada se decodificaba entera para la copia de 600 px, OTRA
   vez para la de 256 y OTRA para la de 96 (`limitArtwork` +
   `resizeDataUrl` ×2, cada uno con su `Image` y su JPEG).
2. **Y por cada canción del álbum, lo mismo**: un disco de 12 temas
   trae la misma portada incrustada 12 veces → 36 decodificaciones
   de la misma imagen.
3. **Pool fijo de 3 trabajadores** aunque el hardware dé más.

**Optimizaciones** (`js/uploader.js`, sin cambiar formatos ni
calidades de salida):

- `_produceArtwork()`: de UNA decodificación (`_loadImage`, con
  tiempo límite de 8 s para que un WebView colgado no retenga la
  importación) salen las tres copias con los tamaños y calidades
  de siempre (600 JPEG 0.85, 256/96 cuadradas JPEG 0.72) y los
  mismos respaldos ante error.
- **Caché de portadas por lote** (`_artworkForPicture` +
  `_artworkKey`, huella = longitud + muestra de 512 bytes): la
  portada repetida se produce una sola vez por importación, y los
  trabajadores comparten hasta la promesa en curso (nada de
  decodificar lo mismo en paralelo). `limitArtwork`/`resizeDataUrl`
  se quedan para sus otros llamantes (portada personalizada).
- **Pool de 3–6 trabajadores** según `navigator.hardwareConcurrency`.
- **FLAC sin sondeo**: el bloque STREAMINFO ya trae frecuencia y
  nº de muestras; el lector Vorbis propio ahora devuelve también
  la duración exacta y `processOne` la usa sin crear el `<audio>`
  de sondeo (que sigue para MP3/M4A/OGG, con su timeout de 4 s:
  la duración al importar es una función querida, §33, y no se
  sacrifica por velocidad).

**Verificación**: regresión específica 14/14 (huella estable y
discriminante; las tres copias de una decodificación y sus
respaldos; álbum simulado: 2 canciones = 1 producción; processOne
completo; STREAMINFO sintético = 185 s exactos sin tocar el
sondeo; pool con concurrencia real ≥3, resultados en orden y
9×15 ms simulados muy por debajo del tiempo en serie; 0 errores).
Batería completa en verde (sololistas 15/15, hero 8/8, confirm
10/10, mimusica 21/21, visualizador 19/19, importFiles 16/16, lupa
10/10, detalles 6/6, fav/letras/nav 9/9, AAA 12/12, i18n 384×8) y
regresión repetida sobre el `.xdc` extraído. La ganancia percibida
depende del dispositivo y del tamaño de las portadas; la
estructural es la descrita (de ~3N decodificaciones a N, y a 1
por álbum en la práctica).

## Cierre de la sesión §50

| Check | Resultado |
|---|---|
| 1 decodificación por portada distinta + pool 3–6 + FLAC sin sondeo | ✅ |
| Regresión importperf 14/14 + batería completa | ✅ |
| `.xdc` válido (344,5 KB, sha256 `303c7477…`) + regresiones sobre extraído | ✅ |

---

## 51. Fuera importar .m3u/biblioteca, dentro copia de seguridad en Opciones y «Compartir lista» reparado

**Encargo:** (1) eliminar la importación de listas `.m3u` y la de biblioteca tal como existían; (2) crear en su lugar un sistema de copia de seguridad —exportar los datos hacia el chat e importarlos en otra versión/dispositivo— ubicado en el menú de opciones; (3) arreglar «Compartir lista» dentro de las listas, que no funcionaba correctamente.

### Por qué «Compartir lista» no funcionaba (la raíz)

No era el botón ni la lista: era `exportFile()`.

- Enviaba el texto como `file: { name, plainText }`. La forma que Delta Chat acepta de forma fiable hoy es `file: { name, blob }`; un cliente actual puede rechazar o ignorar el `plainText`.
- Peor: ese rechazo se tragaba dentro de la propia función (devolvía `false` y seguía), y **todos los llamantes enseñaban el toast de éxito sin mirar el resultado**. El usuario veía «Lista compartida» mientras en el chat no llegaba nada — de ahí el «no funciona correctamente»: no fallaba ruidosamente, mentía en silencio.

### Arreglo

- `exportFile()` envía siempre el archivo como **Blob** (el texto se envuelve con su MIME; un Blob de audio pasa tal cual) y devuelve `true` solo si `sendToChat` resolvió —o si en navegador la descarga se disparó—.
- Los cuatro llamantes miran ese booleano y avisan con honestidad: `exportPlaylist` («Compartir lista»), `exportLibrary` (la nueva copia), `shareTrack` (canción y respaldo de texto) y `exportCurrentLyrics` (letra). Éxito → toast de éxito; rechazo → toast de error en rojo. Se acabó el «compartido» falso.
- El stub webxdc de navegador ya prefería `blob`: compatible sin tocarlo.

### Sistema de copia de seguridad (menú Opciones)

- Nuevas filas en `#sheetMore` («Opciones»): **Exportar copia de seguridad**, **Importar copia de seguridad** y una pista breve, con iconos `i-file-export`/`i-file-import`. Cierran la hoja antes de actuar, como hace «Compartir canción en chat».
- Reutiliza los motores ya probados (`exportLibrary`/`importLibrary`, backup **v2** `aurora-backup-AAAA-MM-DD.json`): listas, favoritos, ajustes y punto de escucha; el audio no viaja —en el otro dispositivo se importan las canciones y se enlazan solas por título/artista/nombre de archivo—.
- Fuera de Ajustes las filas sueltas «Exportar biblioteca»/«Importar biblioteca» con su nota. `menuRelinkAudio` se queda (re-enlaza audio; no es la importación eliminada).
- La etiqueta del diálogo de bienvenida («restaurar») pasa a la clave nueva `backup_import`.
- La exportación de una lista como `.m3u8` (Compartir lista) **se conserva**: es formato para otros reproductores; el camino Aurora→Aurora es la copia JSON.

### Importación M3U eliminada por completo

- Fuera el botón `#btnImportM3u` de la cabecera de Biblioteca y su binding.
- Fuera `parseM3U`, `matchM3UEntries`, `importM3U`, `importM3UFile` de `playlist-edit.js` y la rama que desviaba `.m3u` en `handleFileInput`.
- El selector de archivos ya no admite `.m3u/.m3u8` (`queue.js`); un `.m3u` que llegue por otra vía se descarta como hasta ahora se descartaba cualquier no-audio.
- I18n podado (`m3u_import_btn`, `toast_m3u_imported`, `toast_m3u_none`, `toast_m3u_empty`, `imported_playlist_name`, `settings_export`, `settings_import`, `settings_export_hint`) y añadido (`backup_export`, `backup_import`, `backup_hint`): **379 claves × 8 idiomas, sin huecos**.

### Verificación

- Nuevo `check-backup.js`: **22/22** — estructura (copia en Opciones, nada en Ajustes, sin botón M3U), superficie eliminada (`importM3UFile`/`parseM3U`/`matchM3UEntries` ya no existen), raíz reparada (payload **Blob**, `false` honesto ante rechazo de Delta), toasts de compartir según el resultado real, la copia sale al chat como `aurora-backup-AAAA-MM-DD.json`, y el ciclo completo exportar→importar en «otro dispositivo» devuelve la lista.
- Checks veteranos actualizados a la nueva realidad: `sololistas` 15/15 e `importfiles` 15/15 verifican ahora también la ausencia del M3U. Resto de la batería en verde: hero 8, confirm 10, mimusica 21, visualizer 19, lupa 10, detalles 6, fav-btn 9, letras-btn 9, nav 9, aaa 12, importperf 14.
- `.xdc` reconstruido y válido: 28 archivos, 342,5 KB.


---

## 52. En Inicio, con la música en pausa, no se muestra el mini reproductor

**Encargo:** si la música está en pausa, el mini reproductor no debe aparecer en Inicio.

### Motivación

En Inicio, en pausa, el mini reproductor duplicaba al hero «Retomar en…» (§49): dos controles para lo mismo en la misma pantalla. En pausa, la pantalla de Inicio queda limpia y el hero es quien retoma; mientras suena, el mini sigue ofreciendo pausa/siguiente sin bajar a Now Playing.

### Implementación

- `updateChrome()` (nav.js) calcula si Inicio está «en primer plano»: `viewHome` activa **y** ninguna pestaña (Biblioteca, Buscar o Favoritos, que son hojas sobre Inicio) abierta encima. Solo en ese caso el mini depende de `isPlaying`:
  `showMini = … && !(onHome && !this.isPlaying)`.
  Fuera de Inicio el comportamiento no cambia: en Biblioteca/Buscar/Favoritos el mini sigue visible también en pausa, y se mantienen las reglas previas (nunca en Now Playing ni en Letras, nunca con un modal abierto, nunca sin pista actual ni en modo ancho).
- Los cambios de play/pausa no pasan por `updateChrome()`, solo por `updatePlayUI()`: pausar con el mini visible lo dejaba «congelado» en pantalla. Al final de `updatePlayUI()` (player-ui.js) se refresca ahora el chrome, de modo que pausar oculta el mini al instante y reanudar lo devuelve, sin navegar. Esto cubre también la pausa/reanudación desde Now Playing o desde el propio mini antes de que se oculte.

### Verificación

- Nuevo `check-minipausa.js`: **13/13** — Inicio en pausa sin mini; Inicio sonando con mini; pausar/reanudar sin navegar oculta/devuelve el mini al momento; Biblioteca en pausa conserva el mini (§52 es solo Inicio); volver a Inicio en pausa lo oculta; sin pista nunca hay mini; Now Playing sigue sin mini; el hero §49 y el mini se relevan (pausa: hero visible y mini oculto; sonando: al revés); con un modal abierto no hay mini y al cerrarlo vuelve. Cero errores de consola.
- Nota de infraestructura: `/tmp` se había perdido entre sesiones; el arnés (jsdom + fake-indexeddb) se reconstruyó con stubs de canvas/viewport de teléfono. La batería histórica completa quedó verde en §51 sobre este mismo HEAD base.
- `.xdc` reconstruido y válido para Delta Chat.

---

## 53. Nada de lo que envía al chat funcionaba: el `webxdc.js` propio tapaba la API de Delta

**Reporte:** ningún envío al chat funciona — compartir lista, compartir canción, exportar la copia de seguridad, exportar letra… todos «hacen algo» (incluso enseñaban el toast de éxito) pero al chat no llega nada.

### Causa raíz (confirmada contra la especificación oficial)

La spec webxdc (`webxdc/webxdc_docs`, `src/spec/README.md`) dice dos cosas:

1. «Para activar la API webxdc hay que referenciar `webxdc.js`»: `<script src="webxdc.js"></script>` — la sirve el mensajero para esa ruta exacta.
2. «**`webxdc.js` must not be added to your `.xdc` file as they are provided by the messenger.**»

Aurora hacía exactamente lo contrario desde la reorganización del repositorio (commit `6546dac`, «JS en `js/`»): `index.html` cargaba `js/webxdc.js`, un stub propio pensado para navegador. Delta **no reemplaza** ese archivo (solo sirve el suyo para la ruta `webxdc.js`), así que dentro de Delta se ejecutaba el stub: su `sendToChat` «envía» descargando con un `<a download>`, que en el WebView de Delta no hace nada; la promesa se resuelve y la app creía haber compartido. Por eso el §51 (payload Blob + toasts honestos) no podía arreglarlo: el problema no era el formato del mensaje, era que **el mensajero nunca llegaba a verlo**. La misma causa dejaba `importFiles` sin API nativa (caía siempre al respaldo `<input>`).

### Arreglo (según la spec)

- `index.html`: la referencia pasa a la ruta exacta `<script src="webxdc.js"></script>`, como primer script. Delta inyecta ahí su API real (`sendToChat`, `importFiles`, `sendUpdate`…).
- Eliminado `js/webxdc.js` del repo: ningún `webxdc.js` viaja ya en el paquete. En navegador la referencia simplemente no resuelve y los respaldos toman el relevo: `exportFile` descarga el archivo (su propio fallback), `pickFilesWebxdc` devuelve `null` → selector `<input>`. Todas las comprobaciones `window.webxdc` de la app ya toleraban su ausencia.
- `exportFile()`: simplificado el manejo de errores — sin stub propio, un rechazo de `sendToChat` es «no enviado» y se avisa, como dicta la spec («In case of errors… the promise will be rejected»).
- `build-xdc.py` hace cumplir la regla para siempre: la referencia `webxdc.js` queda exenta del control de «referenciado pero no está en el paquete» (la sirve el mensajero) y **el build falla si cualquier archivo llamado `webxdc.js` intenta viajar en el .xdc**. README actualizado en la misma dirección.

### Verificación

- Nuevo `check-chat.js`: **14/14** — forma del paquete (referencia exacta y primer script; sin `webxdc.js` en raíz ni en `js/`); simulando al mensajero (API nativa inyectada antes de cargar la app): la app no la sobrescribe, compartir lista / copia de seguridad / canción llegan a `sendToChat` con su Blob, e importar la copia usa `importFiles` nativo y la aplica; en modo navegador, sin API, descargan los respaldos y `pickFilesWebxdc` devuelve `null`. Cero errores en ambos modos.
- §52 sigue en verde (13/13) con el arnés ya sin stub, y el empaquetador demuestra el guardián: con un `js/webxdc.js` infiltrado el build falla con el motivo; sin él, OK.
- `.xdc` reconstruido: **27 archivos, 342,0 KB**, sin ningún `webxdc.js`; sha256 `cbf966d34a39092869173164d46a2c9b2c43f521d55e3fbb14128e155e00722c`.
- Lo que no puede probarse aquí: el diálogo real de Delta al enviar (depende del mensajero en el dispositivo). Al probarlo: compartir una lista debe abrir el selector de chat de Delta y dejar el `.m3u8` como borrador/mensaje en el chat elegido.
