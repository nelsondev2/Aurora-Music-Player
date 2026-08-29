# Aurora — Plan de interfaz y estilo

**Objetivo:** subir la percepción visual de ~78 a **~88–90**, sin convertirlo en Spotify y sin romper las reglas del producto (vanilla, sin CDN, sin bundler, abre con `index.html`, webxdc = marco móvil).

**No es el objetivo:** añadir features. El motor (shuffle, gapless, letras, biblioteca) ya está. Esto es *piel, ritmo y marca*.

**Puntuación de partida (app real, no las capturas del README):**

| Superficie | Hoy | Techo de esta fase |
|---|---|---|
| Now Playing oscuro | 84 | 92 |
| Hub / biblioteca / sheets | 76 | 88 |
| Tema claro | 68 | 86 |
| Desktop ≥ 900 px | 64 | 86 |
| Marca (icono, tipo, acento) | 70 | 90 |
| **Global** | **78** | **~88** |

Las fotos de `docs/` se ven ~90 porque son *mockups*. El criterio de éxito es que un screenshot *de la app corriendo* se acerque a esas fotos.

---

## 1. Principios

1. **Una paleta, una voz.** Dejar de parecer “Tailwind dark + FA”. Aurora es noche, aurora boreal, tipo grande, poco cromo.
2. **El color sale de la portada.** El acento de marca es el default; en Now Playing mandan `--cover-from` / `--cover-to`.
3. **Menos chrome, más portada.** Cada control extra en NP pelea con el disco.
4. **Tokens, no magia.** Tamaño, radio, easing y elevación viven en `:root`. Prohibido otro `font-size: 13px` suelto.
5. **Claro y AMOLED son temas de verdad**, no el oscuro invertido a medias.
6. **Desktop se diseña.** No es el teléfono partido a 420 px.
7. **Cero CDN.** Si hay fuente, es un `.woff2` subset en `assets/fonts/`. Si hay iconos, sprite SVG local.
8. **`prefers-reduced-motion` ya existe:** cualquier animación nueva lo respeta.
9. **Cada string nueva, 8 idiomas en el mismo cambio.** `node audit-i18n.js` tiene que seguir en verde.

---

## 2. Diagnóstico (por qué se siente 78)

Hechos en el repo, no gustos:

| # | Qué se ve | Dónde |
|---|---|---|
| V1 | Acentos de catálogo Tailwind (`#a855f7`, `#3b82f6`, `#10b981`…) | `js/settings.js` `ACCENTS` |
| V2 | Tipografía 100 % sistema; `--font-display` no se nota | `styles.css` `:root` |
| V3 | Escala de tipo suelta: 11/12/13/14/15/16/17/18/20/22/28 px | `styles.css` (~150 `font-size`) |
| V4 | ~51 iconos vía Font Awesome (~664 KB solid+regular) | `webfonts/`, `index.html` |
| V5 | Icono de app = play genérico sobre degradado | `icon.png` |
| V6 | Now Playing: 5 acciones con *label* (Letras, Cola, Volumen, EQ, Sleep) + nav 4 ítems | `#viewPlayer` |
| V7 | Tema `amoled` pinta fondos por JS pero **no tiene CSS propio** (bordes, nav, toast) | `THEMES.amoled` vs `styles.css` |
| V8 | Tema claro: parches puntuales (nav, toast, sheet). Elevación y hairlines siguen de dark | `[data-theme="light"]` |
| V9 | Desktop = `html.aurora-wide` parte el teléfono. Bottom-nav se queda; no hay sidebar | `styles.css` Fase 6 |
| V10 | Empty states = círculo + icono FA 44 px. Welcome sí tiene orbes; el resto no | `.empty-state` |
| V11 | Vinilo + `perspective: 1000px` en portada: gesto “demo” si no está tocando | `.cover-section`, `.cover-vinyl` |
| V12 | 18 `style=` en HTML, 21 `!important` en CSS | `index.html`, `styles.css` |

Lo que **no** se toca: parser LRC, shuffle, gapless, IndexedDB, i18n de producto, P2P (sigue prohibido).

---

## 3. Sistema visual objetivo

### Color (marca Aurora, no Tailwind)

Propuesta para el acento **por defecto** (el usuario sigue pudiendo cambiar):

| Token | Hoy (purple) | Objetivo |
|---|---|---|
| `--accent` | `#a855f7` (violet-500) | `#8B7CFF` (periwinkle aurora) |
| `--accent-2` | `#ec4899` (pink-500) | `#FF7AB6` (rosa frío, no fucsia Tailwind) |
| `--bg-0` dark | `#050509` | se queda (es bueno) |
| `--bg-0` amoled | `#000` vía JS | igual, pero **con CSS** de hairline `rgba(255,255,255,0.08)` |
| `--bg-0` light | `#f5f5f8` | `#F4F1EA` papel cálido, no gris laboratorio |

Acentos de Ajustes: **rehacer los 5** para que ninguno sea un color de la docs de Tailwind (`blue-500`, `emerald-500`…). Misma cantidad (5), distinta receta (aurora, océano, musgo, ámbar, cereza).

### Tipo

Sin Google Fonts. Dos caminos, en este orden:

1. **Primero (obligatorio, 0 KB):** tokens de escala + tracking.
   - `--fs-micro: 11px` · `--fs-caption: 12px` · `--fs-body: 14px` · `--fs-ui: 15px` · `--fs-title: 20px` · `--fs-display: 32px`
   - Títulos de pista: `--font-display`, `letter-spacing: -0.03em`, weight 700.
   - Labels de nav: 10 px, `0.08em`, uppercase — o se eliminan (ver Fase C).
2. **Después (opt-in, ≤ 40 KB):** un `.woff2` subset latin (`Fraunces` o `Newsreader` para display, o `Outfit` para UI). Solo si el paso 1 no basta en screenshot.

### Radio y elevación

| Token | Valor |
|---|---|
| `--radius-xs` | 8 px (chips) |
| `--radius-sm` | 12 px (filas) — ya existe |
| `--radius` | 20 px (cards, portada pequeña) |
| `--radius-cover` | 24 px (NP) |
| `--shadow-cover` | `0 24px 48px rgba(0,0,0,.45)` |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` |
| `--dur` | 200 ms (cambio de pista ya usa esto) |

### Iconos

Sprite `assets/icons.svg` con los ~51 glifos que la app usa. Clase `.ico` + `<svg><use href="assets/icons.svg#play">`. Quitar `webfonts/` y `assets/css/fontawesome.min.css`. Ahorro ~700 KB y se acaba el look “admin template”.

---

## 4. Roadmap

Cada fase es un PR. No se mezcla con features de audio. Criterio de salida = screenshot + `node audit-i18n.js` + `node --check` de lo tocado.

### Fase A — Tokens y temas (½–1 día) ✅

**Meta:** el CSS deja de improvisar tamaños y colores. **Hecha.**

- [x] Extraer escala `--fs-*`, `--radius-cover`, `--ease-out`, `--dur` en `:root`.
- [x] Sustituir `font-size` sueltos por tokens (prioridad: player, filas, nav, sheets).
- [x] Nueva paleta `ACCENTS` (5) + default aurora. Migrar `aurora_accent=purple` → `aurora` (alias de un cambio).
- [x] Tema **AMOLED**: bloque CSS `[data-theme="amoled"]` (nav, toast, border, sheet, mini).
- [x] Tema **claro**: superficies de papel, hairline `rgba(20,16,12,0.10)`, acento más oscuro para contraste AA en botones filled.
- [x] `applyTheme()` escribe también `--text-2/3/4`, `--border`, `--blur-bg` en *los tres* temas (hoy light está a medias; amoled no).
- [x] Quitar `style=` de badges/colores que ya tienen clase.

**Salida:** cambiar tema/acento en Ajustes no deja un componente “del otro mundo”. Light y AMOLED se pueden enseñar.

### Fase B — Marca e iconos (1 día) ✅

**Meta:** se reconoce Aurora a 32 px y sin leer el nombre. **Hecha.**

- [x] `icon.png` / favicon: marca aurora (cinta), no el play genérico.
- [x] Wordmark en welcome: tracking y peso alineados al token display.
- [x] Sprite SVG (`assets/icons.svg`, inline en `index.html`); `fa-solid`/`fa-regular` = 0 en código.
- [x] Borrar `webfonts/` y `fontawesome.min.css`. Actualizar `build-xdc.py`.
- [x] Hit areas 44 px se mantienen (los SVG no encogen el tap).

**Salida:** ~700 KB menos; ningún icono FA en runtime.

### Fase C — Now Playing (1 día) ✅

**Meta:** la portada es el 60 % de la pantalla; los controles caben en una respiración. **Hecha.**

- [x] Fila secundaria: **iconos sin label** (Letras / Cola / Volumen). EQ y Sleep en el menú `···`. Like sigue arriba.
- [x] Volumen: slider compacto al tocar el icono (no un sheet).
- [x] Portada: glow 0.35. Vinilo **off por defecto** (Ajustes).
- [x] `perspective` solo con vinilo on.
- [x] Progreso: thumb 12 px, track 3 px, hover/focus más evidentes.
- [x] Título: display size, 2 líneas máx; marquee solo en 1 línea (artista).
- [x] Letras: línea actual más grande/`--text-1`; vecinas `--text-3`. Glow solo en karaoke.

**Salida:** un recorte de NP a 390×844 se puede poner en la store sin recortar cromo.

### Fase D — Hub, listas, vacíos (1 día) ✅

**Meta:** Biblioteca y Inicio parecen el mismo producto que NP. **Hecha.**

- [x] Filas: cover 48 px radius 10, título `--fs-ui`, meta `--fs-caption`. Indicador “sonando” = barra acento 2 px a la izquierda.
- [x] Pills (tabs, sort, search, EQ, xfade): filled = `--accent-fill` + `--accent-on-fill`.
- [x] Mini-player: radio 16, cover 10, progreso 2 px. En wide sigue oculto.
- [x] Empty states: orbe + icono en card 22 px, no círculo FA. Letras vacías de la misma familia.
- [x] Sheets: handle 36×4, margen superior 8. Scrim 40 % dark / 28 % light.
- [x] Toasts: 14 px, blur + border. Destructivo = `.is-danger` / `--danger`.

**Salida:** Inicio vacío, biblioteca con 0 pistas y “sin letra” se sienten familia.

### Fase E — Desktop y tablet (1–2 días) ✅

**Meta:** ≥ 900 px es una app de escritorio; 600–899 es tablet; webxdc no cambia. **Hecha.**

- [x] **Tablet (600–899, no webxdc):** marco más ancho (520), NP no se parte.
- [x] **Desktop (≥ 900, no webxdc):**
  - Columna NP 400–440 px, *padding de producto* (no el safe-area de teléfono).
  - Hub a la derecha con **sidebar vertical** (Inicio / Fav / Buscar / Biblioteca) — el bottom-nav desaparece.
  - Sheets full (EQ, letras editor, ajustes) ocupan la columna derecha, no un overlay a 430 px.
  - Sheets cortos (confirm, sleep, volumen) centran en el hub, no en toda la ventana.
- [x] `syncDesktopLayout()` ya existe: extender breakpoints, no otro flag.
- [x] Hover de verdad: filas, knobs, nav. Cursor pointer. Nada de `:active` como único feedback.
- [x] Ventana < 600 o `window.webxdc`: comportamiento actual (marco).

**Salida:** a 1280×800 no parece un iPhone incrustado. A 390, idéntico a hoy.

### Fase F — Motion, micro, evidencias (½ día)

- [ ] Un easing, una duración de cambio de vista (ya 350 ms — bajar a 240 + `--ease-out`).
- [ ] Press: `transform: scale(.98)` en portada y play; nada en filas (scroll).
- [ ] Skeleton de 3 líneas al importar el primer lote (el overlay de progreso ya existe; esto es la lista).
- [ ] Regenerar `docs/now-playing.jpg`, `library.jpg`, `lyrics.jpg` **desde la app**, no con un generador. El README deja de mentir.
- [ ] Pasada de contraste WCAG AA en light (nav, chips, `--text-3` sobre papel).

**Salida:** README = fotos reales. Reduced-motion no deja animaciones huérfanas.

---

## 5. Qué no haremos

- ❌ CDN de fuentes o iconos (Google Fonts, jsDelivr, FA kit).
- ❌ Redesign a Material You / iOS 26 / “glass total”. Aurora es opaca, con blur *puntual* (nav, mini, toast).
- ❌ Visualizador FFT (se eliminó a propósito).
- ❌ Ilustraciones raster de empty state a 2× (pesan; los orbes CSS bastan).
- ❌ Dark *and* light *and* amoled *and* “oled purple” — 3 temas es el máximo.
- ❌ Más de 5 acentos.
- ❌ Animación de cambio de pista > 240 ms o `rotateY`.
- ❌ Reescritura CSS-in-JS / Tailwind / framework.
- ❌ P2P, oyentes, lyrics-from-network.

---

## 6. Orden si solo hay dos días

1. **A** (tokens + paleta + light/AMOLED) — se nota en *toda* la app.
2. **C** (NP más limpio) — es la foto de producto.
3. **B** (icono + sprite) — marca y peso.
4. D y E si queda tiempo; F siempre al cerrar (screenshots reales).

---

## 7. Criterio de “se siente 88”

La fase de UI se da por cerrada cuando:

- [ ] Un desconocido ve Now Playing oscuro y no pregunta “¿es un template?”.
- [ ] Tema claro se puede usar de día (contraste de nav, chips, toasts).
- [ ] AMOLED no tiene grises `#14141f` residuales.
- [x] Desktop 1280 px: sidebar + NP, sin bottom-nav.
- [ ] `fa-solid` / `fa-regular` = 0 en el repo.
- [ ] `docs/*.jpg` son recortes de la app.
- [ ] `node audit-i18n.js` exit 0.
- [ ] webxdc y viewport 390 se ven como hoy (no peores).

---

## 8. Cómo ejecutarlo

Igual que el plan de producto: **una fase por sesión**, i18n en el mismo diff, no colar features de audio. Probar siempre:

1. Chrome 390×844 dark
2. Mismo, tema light y amoled
3. Desktop 1280
4. `python3 build-xdc.py` y peso del `.xdc`

*Documento vivo, hermano de `PLAN.md`. El producto sigue siendo que Aurora se abra y se quiera dejar sonando — esto es para que también se quiera **mirar**.*
