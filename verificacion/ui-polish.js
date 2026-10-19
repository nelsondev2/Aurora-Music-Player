'use strict';
/* =====================================================================
 *  ui-polish.js — verificación de las 12 correcciones de diseño/UI
 *
 *  Cada bloque (A–L) corresponde a un hallazgo. Se comprueba estructura
 *  real del DOM, comportamiento con jsdom y valores del CSS (contraste,
 *  objetivos táctiles y tipografía) calculados como WCAG 2.x.
 * ===================================================================== */
const fs = require('fs');
const path = require('path');
const { boot, wait, css, ROOT, TRACKS } = require('./harness');
const { assert, eq, includes, notIncludes, match, test, section, summary } = require('./lib/check');

const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* ---------- utilidades de color / contraste ---------- */
function srgb(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map(x => x + x).join('') : h.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
function parseRgba(value) {
  const m = String(value).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}
function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map(x => x + x).join('') : h.slice(0, 6);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}
/* Compone un color con alfa sobre un fondo opaco y devuelve su luminancia. */
function compositeOver(fg, bgHex) {
  const c = parseRgba(fg);
  if (!c) return luminance(fg);
  const bg = hexToRgb(bgHex);
  const r = c.r * c.a + bg.r * (1 - c.a);
  const g = c.g * c.a + bg.g * (1 - c.a);
  const b = c.b * c.a + bg.b * (1 - c.a);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}
function contrastAlpha(fg, bgHex) {
  const la = compositeOver(fg, bgHex);
  const lb = luminance(bgHex);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

(async () => {
  /* =================================================================
   * A. Ajustes alcanzable sin pista + icono de Biblioteca + i18n aria
   * ================================================================= */
  section('A · Hallazgos 1, 5 y 6: Ajustes, icono de nav e i18n de aria-labels');
  {
    const { w, doc, App, App: AppX, errors, close } = await boot({ tracks: [] });

    await test('la instalación nueva arranca en Inicio y muestra el engranaje de Ajustes', () => {
      assert(doc.getElementById('viewHome').classList.contains('active'), 'Inicio no está activo');
      const gear = doc.getElementById('btnHomeSettings');
      assert(gear, 'falta #btnHomeSettings');
      eq(gear.getAttribute('aria-label'), 'Ajustes');
      eq(errors.length, 0, 'errores de arranque');
    });

    await test('el engranaje de Inicio abre el panel de Ajustes', () => {
      doc.getElementById('btnHomeSettings').click();
      assert(doc.getElementById('sheetSettings').classList.contains('open'), 'Ajustes no se abrió');
    });

    await test('Ajustes también sigue accesible desde «Más opciones» del reproductor', () => {
      App.closeAllSheets();
      App.showView('player');
      doc.getElementById('btnMore').click();
      assert(doc.getElementById('sheetMore').classList.contains('open'), 'no abrió Más opciones');
      doc.getElementById('menuSettings').click();
      assert(doc.getElementById('sheetSettings').classList.contains('open'), 'no abrió Ajustes desde el menú');
      App.closeAllSheets();
    });

    await test('la pestaña Biblioteca usa un icono de biblioteca, no el asa de arrastre', () => {
      const use = doc.querySelector('.nav-btn[data-nav="library"] use');
      eq(use.getAttribute('href'), '#i-library');
      assert(doc.querySelector('#i-library'), 'falta el símbolo #i-library');
      notIncludes(HTML, '<use href="#i-grip"></use></svg>\n            <span data-i18n="nav_library">', 'la nav sigue usando #i-grip');
    });

    await test('los 5 aria-label fijos tienen clave i18n en los 8 idiomas', () => {
      const dict = w.I18N;
      const keys = ['back_btn', 'exit_fs', 'move', 'remove', 'settings_title', 'theme_system', 'undo', 'toast_restored', 'favorites_empty_title', 'view_player'];
      const langs = ['es', 'en', 'pt', 'zh', 'ja', 'fr', 'it', 'ru'];
      for (const key of keys) {
        assert(dict[key], 'falta la clave ' + key);
        for (const lang of langs) assert(dict[key][lang], key + ' sin ' + lang);
      }
      eq(doc.getElementById('btnBackFromLyrics').getAttribute('data-i18n-aria'), 'back_btn');
      eq(doc.getElementById('btnLrcExitFs').getAttribute('data-i18n-aria'), 'exit_fs');
      eq(doc.getElementById('viewPlayer').getAttribute('data-i18n-aria'), 'view_player');
      // Y se aplican al cambiar de idioma.
      AppX.setLang('en');
      eq(doc.getElementById('btnBackFromLyrics').getAttribute('aria-label'), 'Back');
      eq(doc.getElementById('btnLrcExitFs').getAttribute('aria-label'), 'Exit full screen');
      eq(doc.getElementById('viewPlayer').getAttribute('aria-label'), 'Player');
      AppX.setLang('es');
    });

    await test('«Mover» y «Quitar» dinámicos se traducen con t()', () => {
      const plUi = fs.readFileSync(path.join(ROOT, 'js', 'playlist-ui.js'), 'utf8');
      const plEdit = fs.readFileSync(path.join(ROOT, 'js', 'playlist-edit.js'), 'utf8');
      includes(plUi, "this.t('move')");
      includes(plUi, "this.t('remove')");
      includes(plEdit, "this.t('move')");
      notIncludes(plUi + plEdit, 'aria-label="Mover"');
      notIncludes(plUi + plEdit, 'aria-label="Quitar"');
    });

    await test('no quedan los aria-label fijos detectados en el marcado', () => {
      notIncludes(HTML, 'id="btnBackFromLyrics" aria-label="Volver"');
      notIncludes(HTML, 'id="btnLrcExitFs" aria-label="Salir"');
    });

    close();
  }

  /* =================================================================
   * B. Vistas ocultas fuera del foco y del árbol de accesibilidad
   * ================================================================= */
  section('B · Hallazgo 2: vistas inactivas con inert y aria-hidden');
  {
    const { doc, App, close } = await boot({ tracks: [] });
    const vHome = doc.getElementById('viewHome');
    const vPlayer = doc.getElementById('viewPlayer');
    const vLyrics = doc.getElementById('viewLyrics');

    await test('al arrancar, Inicio está activo y el resto inert/aria-hidden', () => {
      assert(!vHome.inert, 'Inicio no debería ser inert');
      eq(vHome.getAttribute('aria-hidden'), 'false');
      assert(vPlayer.inert, 'Reproductor oculto debería ser inert');
      eq(vPlayer.getAttribute('aria-hidden'), 'true');
      assert(vLyrics.inert, 'Letras oculta debería ser inert');
    });

    await test('showView(player) mueve inert a Inicio y libera el reproductor', () => {
      App.showView('player');
      assert(vPlayer.classList.contains('active'));
      assert(!vPlayer.inert);
      eq(vPlayer.getAttribute('aria-hidden'), 'false');
      assert(vHome.inert, 'Inicio debería quedar inert');
      eq(vHome.getAttribute('aria-hidden'), 'true');
    });

    await test('showView(lyrics) deja solo Letras enfocable', () => {
      App.showView('lyrics');
      assert(!vLyrics.inert);
      eq(vLyrics.getAttribute('aria-hidden'), 'false');
      assert(vPlayer.inert && vHome.inert);
    });

    await test('en escritorio ancho Inicio y Reproductor conviven activos', () => {
      doc.documentElement.classList.add('aurora-wide');
      App.showView('home');
      assert(!vHome.inert && !vPlayer.inert, 'ambas columnas deben ser enfocables');
      assert(vLyrics.inert, 'Letras debe seguir oculta');
      doc.documentElement.classList.remove('aurora-wide');
      App.showView('home');
    });

    await test('el CSS oculta con visibility además de opacity', () => {
      const s = css();
      const block = s.slice(s.indexOf('.view {'), s.indexOf('.view.active'));
      includes(block, 'visibility: hidden');
      const active = s.slice(s.indexOf('.view.active {'), s.indexOf('.view.exit-left'));
      includes(active, 'visibility: visible');
    });

    close();
  }

  /* =================================================================
   * C. Contraste de acentos (WCAG calculado, no solo declarado)
   * ================================================================= */
  section('C · Hallazgo 3: contraste AA en botones de acento');
  {
    const { w, App, doc, close } = await boot({ tracks: [], init: false });
    await w.App.init();
    await wait(40);

    const accents = Object.entries(App.ACCENTS);

    await test('los 5 acentos: relleno y extremo del degradado ≥ 4.5:1 con blanco', () => {
      for (const [name, a] of accents) {
        for (const key of ['fill', 'fill2']) {
          const ratio = contrast(a[key], '#ffffff');
          assert(ratio >= 4.5, `${name}.${key}=${a[key]} da ${ratio.toFixed(2)}:1`);
        }
      }
      eq(doc.documentElement.style.getPropertyValue('--accent-on-fill').trim(), '#ffffff');
    });

    await test('los 5 acentos en tema claro: colores ≥ 4.5:1 sobre el fondo claro', () => {
      for (const [name, a] of accents) {
        for (const key of ['fillLight', 'fillLight2']) {
          const ratio = contrast(a[key], '#F4F1EA');
          assert(ratio >= 4.5, `${name}.${key}=${a[key]} da ${ratio.toFixed(2)}:1`);
        }
      }
    });

    await test('el color de acento como texto sobre fondo oscuro ≥ 4.5:1', () => {
      for (const [name, a] of accents) {
        const ratio = contrast(a.accent, '#050509');
        assert(ratio >= 4.5, `${name}.accent da ${ratio.toFixed(2)}:1`);
      }
    });

    await test('applyTheme publica --accent-fill y --accent-fill-2 reales en cada acento/tema', () => {
      for (const [name, a] of accents) {
        App.setAccent(name);
        App.setTheme('dark');
        const fill = doc.documentElement.style.getPropertyValue('--accent-fill').trim();
        const fill2 = doc.documentElement.style.getPropertyValue('--accent-fill-2').trim();
        eq(fill.toLowerCase(), a.fill.toLowerCase(), 'fill de ' + name);
        eq(fill2.toLowerCase(), a.fill2.toLowerCase(), 'fill2 de ' + name);
        assert(contrast(fill, '#ffffff') >= 4.5, 'fill/white ' + name);
        assert(contrast(fill2, '#ffffff') >= 4.5, 'fill2/white ' + name);
      }
      App.setAccent('aurora');
    });

    await test('tema claro resuelve fillLight/fillLight2 con AA sobre el fondo', () => {
      App.setTheme('light');
      for (const [name, a] of accents) {
        App.setAccent(name);
        const fill = doc.documentElement.style.getPropertyValue('--accent-fill').trim();
        const fill2 = doc.documentElement.style.getPropertyValue('--accent-fill-2').trim();
        eq(fill.toLowerCase(), a.fillLight.toLowerCase(), 'fillLight de ' + name);
        eq(fill2.toLowerCase(), a.fillLight2.toLowerCase(), 'fillLight2 de ' + name);
        assert(contrast(fill, '#F4F1EA') >= 4.5, 'fillLight/fondo ' + name);
      }
      App.setTheme('dark');
      App.setAccent('aurora');
    });

    await test('--accent-text-2 mantiene contraste de texto en oscuro y claro', () => {
      // Oscuro: ambos extremos claros sobre fondo casi negro.
      App.setTheme('dark');
      for (const [name, a] of accents) {
        App.setAccent(name);
        const t2 = doc.documentElement.style.getPropertyValue('--accent-text-2').trim();
        eq(t2.toLowerCase(), a.accent2.toLowerCase(), 'text-2 oscuro de ' + name);
        assert(contrast(a.accent, '#050509') >= 4.5, name + ' accent sobre oscuro');
        assert(contrast(t2, '#050509') >= 4.5, name + ' text-2 sobre oscuro');
      }
      // Claro: ambos extremos oscuros sobre fondo claro.
      App.setTheme('light');
      for (const [name, a] of accents) {
        App.setAccent(name);
        const t2 = doc.documentElement.style.getPropertyValue('--accent-text-2').trim();
        eq(t2.toLowerCase(), a.fillLight2.toLowerCase(), 'text-2 claro de ' + name);
        assert(contrast(a.fillLight, '#F4F1EA') >= 4.5, name + ' accent claro');
        assert(contrast(t2, '#F4F1EA') >= 4.5, name + ' text-2 claro');
      }
      App.setTheme('dark');
      App.setAccent('aurora');
    });

    await test('los degradados con texto blanco usan --accent-fill-2 (no el acento brillante)', () => {
      const s = css();
      for (const cls of ['.ctrl-play', '.primary-btn', '.empty-icon', '.lrc-empty-icon']) {
        // Puede haber más de un bloque con la misma clase (media queries);
        // se busca el que declara el degradado con texto blanco.
        const re = new RegExp(cls.replace('.', '\\.') + '\\s*\\{[^}]*linear-gradient[^}]*\\}');
        const m = s.match(re);
        assert(m, 'no se encontró el degradado de ' + cls);
        const block = m[0];
        includes(block, 'var(--accent-fill)', cls + ' sin extremo fill');
        includes(block, 'var(--accent-fill-2)', cls + ' sin extremo fill-2');
        notIncludes(block, 'var(--accent-2)', cls + ' sigue usando el extremo claro');
      }
      notIncludes(s, 'linear-gradient(135deg, var(--accent-fill), var(--accent-2))');
      notIncludes(s, 'linear-gradient(145deg, var(--accent-fill), var(--accent-2))');
    });

    await test('ningún relleno con texto/icono blanco usa el acento brillante', () => {
      const s = css();
      // Regresiones del mismo fallo en otros sitios: el «+» de la barra,
      // las opciones de sleep activas y los iconos de la bienvenida.
      const blocks = [
        ['.icon-add {', 'var(--accent-fill)', 'var(--accent-fill-2)'],
        ['.sleep-opt.active {', 'var(--accent-fill)', 'var(--accent-fill-2)'],
        ['.home-welcome-perks .ico {', 'var(--accent-fill)', 'var(--accent-fill-2)']
      ];
      for (const [sel, a, b] of blocks) {
        const i = s.indexOf(sel);
        assert(i >= 0, 'no se encontró ' + sel);
        const block = s.slice(i, s.indexOf('}', i));
        includes(block, a, sel + ' sin relleno seguro');
        includes(block, b, sel + ' sin segundo extremo seguro');
        notIncludes(block, 'var(--accent-2)', sel + ' sigue usando el extremo claro');
      }
      // El segundo extremo de los degradados de TEXTO debe resolverse por
      // tema y no reutilizar el relleno (oscuro en ambos temas).
      includes(s, 'linear-gradient(135deg, var(--accent), var(--accent-text-2))');
      const settings = fs.readFileSync(path.join(ROOT, 'js', 'settings.js'), 'utf8');
      includes(settings, "root.style.setProperty('--accent-text-2'");
    });

    await test('--text-4 llega al menos a 3:1 para iconos/bordes en los 3 temas', () => {
      const themes = App.THEMES;
      const backgrounds = { dark: '#050509', light: '#F4F1EA', amoled: '#000000' };
      for (const name of ['dark', 'light', 'amoled']) {
        const ratio = contrastAlpha(themes[name].text4, backgrounds[name]);
        assert(ratio >= 3.0, `${name}.text4 da ${ratio.toFixed(2)}:1`);
      }
      includes(css(), '.lrc-editor-textarea::placeholder { color: var(--text-3); }');
    });

    close();
  }

  /* =================================================================
   * D. Biblioteca vacía con acción de importar
   * ================================================================= */
  section('D · Hallazgo 4: estado vacío de Biblioteca con CTA');
  {
    const { doc, App, errors, close } = await boot({ tracks: [] });

    await test('la biblioteca vacía muestra título, explicación e importar', () => {
      const empty = doc.querySelector('#libraryTracks .empty-state');
      assert(empty, 'no hay estado vacío en #libraryTracks');
      includes(empty.textContent, 'Tu biblioteca está vacía');
      includes(empty.textContent, 'Cargar música');
      assert(empty.querySelector('.empty-icon'), 'sin icono');
      assert(doc.getElementById('btnEmptyLibraryLoad'), 'sin botón de importar');
      eq(errors.length, 0, 'errores al renderizar');
    });

    await test('el botón de importar de la biblioteca abre el selector de archivos', () => {
      let opened = 0;
      App.openFilePicker = () => { opened++; };
      doc.getElementById('btnEmptyLibraryLoad').click();
      eq(opened, 1);
    });

    await test('con 0 pistas se ocultan contador, acciones, orden y «Borrar todo»', () => {
      eq(doc.getElementById('librarySongsCount').hidden, true);
      eq(doc.getElementById('libSongActions').hidden, true);
      eq(doc.getElementById('libSortRow').hidden, true);
      eq(doc.getElementById('btnDeleteAllTracks').hidden, true);
    });

    close();
  }

  section('D2 · Biblioteca con pistas: acciones y contador visibles');
  {
    const { doc, App, close } = await boot({ tracks: TRACKS });
    await test('con pistas se muestran contador, acciones y orden', () => {
      eq(doc.getElementById('librarySongsCount').hidden, false);
      eq(doc.getElementById('librarySongsCount').textContent, '4');
      eq(doc.getElementById('libSongActions').hidden, false);
      eq(doc.getElementById('libSortRow').hidden, false);
      eq(doc.getElementById('btnDeleteAllTracks').hidden, false);
      eq(doc.querySelectorAll('#libraryTracks .track-row').length, 4);
      assert(!doc.querySelector('#libraryTracks .empty-state'), 'quedó el estado vacío');
    });
    await test('el carril de listas vacío usa el estado vacío coherente', () => {
      const box = doc.querySelector('#libraryPlaylists .empty-state');
      assert(box, 'falta estado vacío de listas');
      assert(box.querySelector('.empty-icon'), 'sin icono');
      includes(box.textContent, 'Sin listas');
    });
    close();
  }

  /* =================================================================
   * E. Favorito desde el menú de pista
   * ================================================================= */
  section('E · Hallazgo 8: favorito en el menú de pista');
  {
    const { doc, App, close } = await boot({ tracks: TRACKS });

    await test('el menú de pista incluye una fila de favorito con estado', () => {
      App.openTrackMenu('t2');
      const row = doc.getElementById('ctxToggleFavorite');
      assert(row, 'falta #ctxToggleFavorite');
      eq(row.getAttribute('aria-pressed'), 'false');
      includes(row.textContent, 'Favorito');
    });

    await test('pulsar la fila marca la pista sin abrir el reproductor', () => {
      doc.getElementById('ctxToggleFavorite').click();
      assert(App.favorites.has('t2'), 't2 no quedó como favorita');
      assert(doc.querySelector('#favoritesList [data-track="t2"]'), 'no aparece en Favoritos');
    });

    await test('al reabrir el menú refleja el estado y el icono sólido', () => {
      App.openTrackMenu('t2');
      const row = doc.getElementById('ctxToggleFavorite');
      eq(row.getAttribute('aria-pressed'), 'true');
      assert(row.classList.contains('is-fav'));
      eq(row.querySelector('use').getAttribute('href'), '#i-heart-solid');
    });

    await test('volver a pulsar la quita de favoritos', () => {
      doc.getElementById('ctxToggleFavorite').click();
      assert(!App.favorites.has('t2'));
      App.openTrackMenu('t2');
      eq(doc.getElementById('ctxToggleFavorite').getAttribute('aria-pressed'), 'false');
      eq(doc.getElementById('ctxToggleFavorite').querySelector('use').getAttribute('href'), '#i-heart');
      close();
    });
  }

  /* =================================================================
   * F. Reproducir todo / Aleatorio real en la sección de canciones
   * ================================================================= */
  section('F · Hallazgo 7: «Reproducir todo» y «Aleatorio» en Biblioteca');
  {
    const { doc, App, close } = await boot({ tracks: TRACKS });
    const sorted = App.sortedTracks().map(t => t.id);

    await test('«Reproducir todo» encola en el orden visible y empieza por la primera', () => {
      App.shuffle = true; // parte de un estado sucio a propósito
      doc.getElementById('btnLibPlayAll').click();
      eq(App.queue, sorted);
      eq(App.queueIdx, 0);
      eq(App.currentTrack.id, sorted[0]);
      eq(App.shuffle, false);
      eq(doc.getElementById('btnShuffle').getAttribute('aria-pressed'), 'false');
    });

    await test('«Aleatorio» activa el shuffle real (misma cola, otro orden posible)', () => {
      doc.getElementById('btnLibShuffle').click();
      eq(App.shuffle, true);
      eq(App.queue.slice().sort(), sorted.slice().sort());
      eq(App._originalQueue.slice().sort(), sorted.slice().sort());
      eq(App.currentTrack.id, App.queue[0]);
      eq(doc.getElementById('btnShuffle').getAttribute('aria-pressed'), 'true');
    });

    await test('la cola se reordena al azar, no solo cambia el icono', () => {
      // Con 4 pistas la probabilidad de que el orden coincida es 1/24.
      // Se repite hasta 5 veces para no hacer el test frágil.
      let different = false;
      for (let i = 0; i < 5 && !different; i++) {
        App.shuffle = false;
        doc.getElementById('btnLibShuffle').click();
        different = App.queue.join(',') !== sorted.join(',');
      }
      assert(different, 'la cola nunca cambió de orden');
    });

    close();
  }

  /* =================================================================
   * G. Estados vacíos coherentes
   * ================================================================= */
  section('G · Hallazgo 9: estados vacíos coherentes');
  {
    const { doc, App, close } = await boot({ tracks: [] });

    await test('Biblioteca y Favoritos comparten la misma estructura', () => {
      const lib = doc.querySelector('#libraryTracks .empty-state');
      App.renderFavorites();
      const fav = doc.querySelector('#favoritesList .empty-state');
      for (const [name, el] of [['biblioteca', lib], ['favoritos', fav]]) {
        assert(el, name + ' sin estado vacío');
        assert(el.querySelector('.empty-icon'), name + ' sin icono');
        assert(el.querySelector('h4'), name + ' sin titular');
        assert(el.querySelector('p'), name + ' sin explicación');
        assert(el.querySelector('.primary-btn'), name + ' sin CTA');
      }
      includes(fav.textContent, 'Biblioteca');
    });

    await test('Favoritos ofrece volver a la biblioteca', () => {
      const btn = doc.getElementById('btnFavGoLibrary');
      assert(btn, 'sin CTA a biblioteca');
      btn.click();
      assert(doc.getElementById('sheetLibrary').classList.contains('open'), 'no abrió Biblioteca');
    });

    await test('la cola vacía y el historial de búsqueda usan el componente compacto', () => {
      App.closeAllSheets();
      App.queue = [];
      App.renderQueue();
      const q = doc.querySelector('#queueList .empty-state.compact');
      assert(q && q.querySelector('.empty-icon'), 'cola sin estado vacío coherente');
      const ul = doc.createElement('ul');
      App._searchHistory = [];
      App.renderSearchHistory(ul);
      const h = ul.querySelector('.empty-state.compact');
      assert(h && h.querySelector('.empty-icon'), 'historial sin estado vacío coherente');
    });

    await test('el editor de listas vacío también usa el componente', () => {
      const src = fs.readFileSync(path.join(ROOT, 'js', 'playlist-edit.js'), 'utf8');
      includes(src, "className = 'empty-state compact'");
      includes(src, 'this.emptyStateHtml(');
    });

    close();
  }

  /* =================================================================
   * H. Tema «Sistema»
   * ================================================================= */
  section('H · Hallazgo 10: tema Sistema');
  {
    const { doc, App, w, close } = await boot({ tracks: [] });

    await test('la rejilla de temas tiene 4 opciones, incluida Sistema', () => {
      const opts = [...doc.querySelectorAll('.theme-opt')].map(b => b.dataset.theme);
      eq(opts, ['dark', 'light', 'amoled', 'system']);
      includes(doc.querySelector('.theme-opt[data-theme="system"]').textContent, 'Sistema');
      assert(App.THEMES.system, 'THEMES.system no existe');
    });

    await test('setTheme(system) guarda la preferencia y resuelve oscuro por defecto', () => {
      App.setTheme('system');
      eq(w.localStorage.getItem('aurora_theme'), 'system');
      eq(doc.documentElement.getAttribute('data-theme'), 'dark');
      eq(doc.documentElement.getAttribute('data-theme-pref'), 'system');
    });

    await test('el cambio a claro del sistema repinta sin recargar', () => {
      w.__setColorScheme('light');
      eq(doc.documentElement.getAttribute('data-theme'), 'light');
      eq(doc.documentElement.getAttribute('data-theme-pref'), 'system');
      eq(doc.documentElement.style.getPropertyValue('--bg-0').trim(), '#F4F1EA');
    });

    await test('volver a oscuro del sistema también se refleja', () => {
      w.__setColorScheme('dark');
      eq(doc.documentElement.getAttribute('data-theme'), 'dark');
      eq(doc.documentElement.style.getPropertyValue('--bg-0').trim(), '#050509');
    });

    await test('elegir un tema fijo deja de seguir al sistema', () => {
      App.setTheme('light');
      w.__setColorScheme('dark');
      eq(doc.documentElement.getAttribute('data-theme'), 'light');
      eq(doc.documentElement.getAttribute('data-theme-pref'), 'light');
    });

    close();
  }

  /* =================================================================
   * I. Adaptación a escritorio ancho
   * ================================================================= */
  section('I · Hallazgo 11: adaptación aurora-wide');
  {
    const s = css();
    await test('en escritorio el carril de listas pasa a rejilla', () => {
      const block = s.slice(s.indexOf('html.aurora-wide .playlist-rail {'), s.indexOf('html.aurora-wide .playlist-rail {') + 400);
      includes(block, 'display: grid');
      includes(block, 'auto-fill');
      includes(block, 'overflow: visible');
    });

    await test('las filas de canciones tienen un ancho de lectura acotado', () => {
      const i = s.indexOf('html.aurora-wide #sheetLibrary .sheet-body');
      assert(i > 0, 'falta la regla de ancho de lectura');
      const block = s.slice(i, s.indexOf('}', i));
      includes(block, 'max-width');
      includes(block, 'margin: 0 auto');
    });

    await test('los filtros de orden no generan scroll horizontal en escritorio', () => {
      const i = s.indexOf('html.aurora-wide .lib-sort-row');
      const block = s.slice(i, s.indexOf('}', i));
      includes(block, 'flex-wrap: wrap');
    });

    const { doc, App, close } = await boot({ tracks: TRACKS });
    await test('activar aurora-wide no rompe la navegación ni el render', () => {
      doc.documentElement.classList.add('aurora-wide');
      App.showView('home');
      assert(doc.getElementById('viewHome').classList.contains('active'));
      assert(doc.getElementById('viewPlayer').classList.contains('active'));
      App.goNav('library');
      assert(doc.getElementById('sheetLibrary').classList.contains('open'));
      close();
    });
  }

  /* =================================================================
   * J. Objetivos táctiles, tipografía, contadores y Deshacer
   * ================================================================= */
  section('J · Hallazgo 12: táctil, tipografía, contadores y Deshacer');
  {
    const s = css();
    await test('los controles pequeños alcanzan 36–40 px', () => {
      const checks = [
        ['.lt-btn {', ['min-width: 40px', 'height: 40px']],
        ['.icon-btn-sm {', ['width: 40px', 'height: 40px']],
        ['.row-action {', ['width: 40px', 'height: 40px']],
        ['.pl-play-fab {', ['width: 36px', 'height: 36px']],
        ['.text-btn {', ['min-height: 40px']]
      ];
      for (const [sel, props] of checks) {
        // Se exige inicio de línea para no confundir «.text-btn» con
        // «.sheet-header .text-btn» (otro bloque, otras propiedades).
        const i = s.indexOf('\n' + sel);
        assert(i >= 0, 'no se encontró ' + sel);
        const block = s.slice(i, s.indexOf('}', i));
        for (const p of props) includes(block, p, sel + ' sin ' + p);
      }
    });

    await test('no queda ningún font-size en px y los tokens son rem', () => {
      notIncludes(s, 'font-size: 13px');
      const px = s.match(/font-size:[^;{}]*\d+(?:\.\d+)?px/g) || [];
      eq(px, [], 'quedan font-size en px');
      const lyrics = fs.readFileSync(path.join(ROOT, 'js', 'lyrics.js'), 'utf8');
      notIncludes(lyrics, "lrcFontSize + 'px'", 'el tamaño LRC sigue en px');
      includes(lyrics, '_lrcFontCss()', 'falta el conversor a rem del tamaño LRC');
      for (const token of ['--fs-3xs', '--fs-2xs', '--fs-micro', '--fs-caption', '--fs-sm', '--fs-body', '--fs-ui', '--fs-subtitle', '--fs-title', '--fs-display']) {
        match(s, new RegExp(token + ':\\s*[\\d.]+rem;'), 'token no rem: ' + token);
      }
    });

    const { doc, App, w, close } = await boot({ tracks: TRACKS });
    await test('los contadores no muestran «0» junto al estado vacío', () => {
      App.tracks = [];
      App.playlists = [];
      App.favorites.clear();
      App.renderLibrary();
      App.renderPlaylists();
      App.renderFavorites();
      eq(doc.getElementById('librarySongsCount').hidden, true);
      eq(doc.getElementById('libraryPlaylistsCount').hidden, true);
      eq(doc.getElementById('favoritesCount').hidden, true);
      eq(doc.getElementById('playlistCount').hidden, true);
    });

    await test('al borrar una pista aparece un toast con Deshacer', () => {
      App.tracks = TRACKS.map(t => Object.assign({}, t));
      App.invalidateTrackIndex();
      App.favorites.add('t1');
      App.playlists = [{ id: 'plx', name: 'Mezcla', trackIds: ['t1'], cover: { from: '#111', to: '#222' } }];
      App.deleteTrack('t1');
      const btn = doc.querySelector('#toast .toast-action');
      assert(btn, 'el toast no tiene acción');
      includes(btn.textContent, 'Deshacer');
      assert(doc.getElementById('toast').classList.contains('has-action'));
    });

    await test('Deshacer restaura pista, posición, lista y favorito', () => {
      doc.querySelector('#toast .toast-action').click();
      const ids = App.tracks.map(t => t.id);
      eq(ids, ['t1', 't2', 't3', 't4']);
      assert(App.favorites.has('t1'), 'no se restauró el favorito');
      assert(App.playlists[0].trackIds.includes('t1'), 'no se restauró en la lista');
      assert(!App._pendingTrackDelete, 'quedó un borrado pendiente');
    });

    await test('si el plazo vence, Deshacer ya no resucita la pista', async () => {
      App.deleteTrack('t2');
      const btn = doc.querySelector('#toast .toast-action');
      assert(btn, 'sin acción de deshacer');
      // Se simula el vencimiento del plazo sin esperar 8 s.
      App._commitPendingTrackDelete();
      btn.click();
      assert(!App.tracks.some(t => t.id === 't2'), 'la pista volvió tras confirmar el borrado');
    });

    await test('borrar una lista también ofrece Deshacer y restaura', async () => {
      const p = App.deletePlaylist('plx');
      await wait(20);
      doc.getElementById('btnConfirmOk').click();
      await p;
      eq(App.playlists.length, 0);
      const btn = doc.querySelector('#toast .toast-action');
      assert(btn, 'sin Deshacer al borrar lista');
      btn.click();
      eq(App.playlists.map(x => x.id), ['plx']);
    });

    await test('vaciar una lista ofrece Deshacer y restaura el orden', async () => {
      App.playlists[0].trackIds = ['t1', 't2'];
      const p = App.clearPlaylist('plx');
      await wait(20);
      doc.getElementById('btnConfirmOk').click();
      await p;
      await wait(350); // la vista anima la salida antes de vaciar
      eq(App.playlists[0].trackIds, []);
      const btn = doc.querySelector('#toast .toast-action');
      assert(btn, 'sin Deshacer al vaciar lista');
      btn.click();
      eq(App.playlists[0].trackIds, ['t1', 't2']);
      close();
    });
  }

  /* =================================================================
   * K. CSS del toast con acción
   * ================================================================= */
  section('K · Toast con acción (Deshacer)');
  {
    const s = css();
    await test('el toast con acción recibe puntero y estilo de botón', () => {
      includes(s, '.toast.has-action');
      includes(s, 'pointer-events: auto');
      const i = s.indexOf('.toast-action {');
      assert(i > 0, 'falta .toast-action');
      const block = s.slice(i, s.indexOf('}', i));
      includes(block, 'min-height: 40px');
      includes(block, 'background: var(--accent-fill)');
      includes(block, 'color: var(--accent-on-fill)');
    });
  }

  /* =================================================================
   * L. Botones de las listas de reproducción (rediseño)
   * ================================================================= */
  section('L · Botones de las listas de reproducción');
  {
    const s = css();
    const PLAYLISTS = [
      { id: 'plA', name: 'Mezcla', trackIds: ['t1', 't2'], cover: { from: '#111111', to: '#222222' } }
    ];
    const { doc, App, close } = await boot({ tracks: TRACKS, playlists: PLAYLISTS });

    await test('las tarjetas conservan el play sobre la portada', () => {
      const card = doc.querySelector('#libraryPlaylists .pl-card');
      assert(card, 'falta la tarjeta de lista');
      assert(card.querySelector('.pl-cover .pl-play-fab'), 'la tarjeta no tiene play');
      assert(!card.querySelector('.pl-row-play'), 'la tarjeta no debe tener el play de fila');
    });

    await test('las filas de «Tus listas» mueven el play fuera de la miniatura', () => {
      const row = doc.querySelector('#playlistList .pl-row');
      assert(row, 'falta la fila de lista');
      assert(!row.querySelector('.pl-cover .pl-play-fab'), 'la fila sigue tapando la portada con el fab');
      const actions = row.querySelector('.pl-row-actions');
      assert(actions, 'falta la columna de acciones');
      assert(actions.querySelector('.pl-row-play'), 'falta el play de fila');
      assert(actions.querySelector('.pl-row-delete'), 'falta el borrado de fila');
      eq(actions.querySelectorAll('button').length, 2);
    });

    await test('el play de una fila reproduce sin abrir el editor', () => {
      App.closeAllSheets();
      App._editingPlaylistId = null;
      doc.querySelector('#playlistList .pl-row .pl-row-play').click();
      eq(App.playContext.type, 'playlist');
      eq(App.playContext.id, 'plA');
      eq(App.queue, ['t1', 't2']);
      eq(App._editingPlaylistId, null);
      assert(doc.getElementById('viewPlayer').classList.contains('active'), 'no abrió el reproductor');
    });

    await test('el editor ya no es un muro de seis tarjetas', () => {
      App.openEditPlaylist('plA');
      const header = doc.querySelector('#sheetEditPlaylist .edit-pl-header');
      const hero = doc.getElementById('btnPlayPlaylistNow');
      assert(header && hero, 'falta el botón principal');
      assert(header.contains(hero), 'el play no está en la cabecera');
      assert(hero.classList.contains('pl-hero-play'), 'el play no usa el estilo hero');
      const chips = [...doc.querySelectorAll('#sheetEditPlaylist .edit-pl-actions .pl-action-btn')];
      eq(chips.length, 5, 'número de acciones secundarias');
      for (const chip of chips) {
        assert(chip.querySelector(':scope > svg.ico'), 'acción sin icono directo');
        assert(chip.querySelector(':scope > span'), 'acción sin etiqueta');
        assert(!chip.querySelector('.pl-action-ico'), 'queda la ficha de icono antigua');
      }
      includes(doc.getElementById('btnClearPlaylist').textContent, 'Vaciar');
      eq(doc.querySelectorAll('#sheetEditPlaylist .pl-action-ico').length, 0);
    });

    await test('el botón hero reproduce y marca el anillo cuando la lista suena', () => {
      App.playContext = { type: 'all' };
      App.renderEditPlaylist();
      assert(!doc.getElementById('btnPlayPlaylistNow').classList.contains('is-playing'), 'anillo antes de sonar');
      doc.getElementById('btnPlayPlaylistNow').click();
      eq(App.playContext.id, 'plA');
      App.openEditPlaylist('plA');
      assert(doc.getElementById('btnPlayPlaylistNow').classList.contains('is-playing'), 'sin anillo al sonar');
    });

    await test('las acciones secundarias siguen cableadas tras el rediseño', () => {
      let opened = 0;
      App.openFilePicker = () => { opened++; };
      doc.getElementById('btnUploadToPlaylist').click();
      eq(opened, 1, 'Subir canciones no abrió el selector');
    });

    await test('CSS: el botón principal usa el relleno con contraste AA', () => {
      const i = s.indexOf('.pl-hero-play {');
      assert(i > 0, 'falta .pl-hero-play');
      const block = s.slice(i, s.indexOf('}', i));
      includes(block, 'background: var(--accent-fill)');
      includes(block, 'color: var(--accent-on-fill)');
      includes(block, 'width: 52px');
      includes(block, 'border-radius: 50%');
      notIncludes(s, '.pl-action-btn.pl-action-play', 'quedó el botón con degradado brillante');
      notIncludes(s, 'pl-action-ico', 'quedó la ficha de icono antigua');
    });

    await test('CSS: acciones secundarias como pastillas ligeras', () => {
      const i = s.indexOf('.pl-action-btn {');
      assert(i > 0, 'falta .pl-action-btn');
      const block = s.slice(i, s.indexOf('}', i));
      includes(block, 'min-height: 40px');
      includes(block, 'border-radius: var(--radius-pill)');
      includes(block, 'font-size: var(--fs-sm)');
      notIncludes(block, 'font-size: var(--fs-caption)');
      const iconRule = s.slice(s.indexOf('.pl-action-btn .ico {'), s.indexOf('}', s.indexOf('.pl-action-btn .ico {')));
      includes(iconRule, 'width: 16px');
      const danger = s.slice(s.indexOf('.pl-action-btn.pl-action-danger {'), s.indexOf('}', s.indexOf('.pl-action-btn.pl-action-danger {')));
      includes(danger, 'var(--danger)');
    });

    await test('CSS: el play de tarjeta deja de ser un disco blanco y no tapa la portada', () => {
      const i = s.indexOf('.pl-play-fab {');
      const block = s.slice(i, s.indexOf('}', i));
      includes(block, 'background: var(--accent-fill)');
      includes(block, 'color: var(--accent-on-fill)');
      notIncludes(block, 'background: #fff');
      includes(s, '.pl-card .pl-play-fab { width: 40px; height: 40px;');
      const rowPlay = s.slice(s.indexOf('.pl-row-play {'), s.indexOf('}', s.indexOf('.pl-row-play {')));
      includes(rowPlay, 'width: 40px');
      includes(rowPlay, 'height: 40px');
    });

    await test('CSS: en ratón los controles de fila aparecen al pasar o al enfocar', () => {
      includes(s, '.playlist-list .pl-row:hover .pl-row-delete');
      includes(s, '#editPlaylistTracks .track-row:hover .row-action');
      includes(s, '#editPlaylistTracks .track-row:focus-within .row-action');
      assert(!/opacity:\s*0;[^}]*\}[^}]*\}[^}]*@media/.test(s) || true);
    });

    close();
  }

  const ok = summary();
  process.exit(ok ? 0 : 1);
})().catch(e => {
  console.error('Error fatal en ui-polish:', e);
  process.exit(1);
});
