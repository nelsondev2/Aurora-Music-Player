/* =====================================================================
 *  test/smoke.test.mjs — humo, i18n, versión y escapado
 * ===================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { bootApp, ROOT } from './helpers/app.mjs';

test('la app arranca sin errores de JavaScript', async () => {
  const { App, errors, teardown } = await bootApp();
  try {
    assert.equal(App._initialized, true, 'init() no llegó a completarse');
    assert.deepEqual(errors, [], 'errores durante el arranque');
    assert.equal(App.tracks.length, 0);
  } finally { teardown(); }
});

test('los 14 idiomas cambian sin excepciones', async () => {
  const { App, window, errors, teardown } = await bootApp();
  try {
    const codes = window.SUPPORTED_LANGS.map((l) => l.code);
    assert.equal(codes.length, 14);
    for (const code of codes) {
      App.setLang(code);
      assert.equal(App.lang, code);
      assert.equal(window.document.documentElement.getAttribute('lang'), code);
    }
    assert.deepEqual(errors, []);
  } finally { teardown(); }
});

test('todas las claves de i18n están en los 14 idiomas', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const codes = window.SUPPORTED_LANGS.map((l) => l.code);
    const dict = window.I18N;
    const keys = Object.keys(dict);
    assert.ok(keys.length > 300, 'el diccionario se ha cargado');
    const faltan = [];
    for (const key of keys) {
      for (const code of codes) {
        const value = dict[key][code];
        if (value == null || value === '') faltan.push(code + ':' + key);
      }
    }
    assert.deepEqual(faltan, [], 'traducciones ausentes');
    assert.equal(App.t('no_existe_esta_clave'), 'no_existe_esta_clave',
      'una clave desconocida se devuelve tal cual, no revienta');
  } finally { teardown(); }
});

test('toda clave usada en HTML y JS existe en el diccionario', async () => {
  const { window, teardown } = await bootApp();
  try {
    const dict = window.I18N;
    const usadas = new Set();
    const archivos = ['index.html',
      ...fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f)];

    for (const rel of archivos) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      for (const m of src.matchAll(/\bt\(\s*['"]([A-Za-z0-9_]+)['"]/g)) usadas.add(m[1]);
      for (const m of src.matchAll(/data-i18n(?:-aria|-ph|-title)?="([A-Za-z0-9_]+)"/g)) usadas.add(m[1]);
    }

    // Claves construidas en tiempo de ejecución: t('theme_' + this.theme)
    const dinamicas = new Set(['key', 'theme_', 'accent_']);
    const rotas = [...usadas].filter((k) => !dinamicas.has(k) && !dict[k]);
    assert.deepEqual(rotas, [], 'claves usadas que no existen en data.js');

    const prefijos = [...usadas].filter((k) => dinamicas.has(k));
    assert.deepEqual(prefijos.sort(), ['accent_', 'key', 'theme_'],
      'si aparecen claves dinámicas nuevas, revisa que sus valores existan');
  } finally { teardown(); }
});

test('la versión coincide en la app, el CHANGELOG y el README', async () => {
  const { App, teardown } = await bootApp();
  try {
    const version = App.VERSION;
    assert.match(version, /^\d+\.\d+\.\d+$/);

    const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
    const publicadas = [...changelog.matchAll(/^## (\d+\.\d+\.\d+)/gm)].map((m) => m[1]);
    assert.ok(publicadas.includes(version),
      `App.VERSION=${version} no tiene sección «## ${version}» en el CHANGELOG (las hay: ${publicadas.slice(0, 3).join(', ')})`);

    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const enReadme = readme.match(/\*\*Versión:\*\* (\d+\.\d+\.\d+)/);
    assert.ok(enReadme, 'el README ya no declara la versión');
    assert.equal(enReadme[1], version, 'el README y App.VERSION discrepan');

    // El texto de reserva del HTML también (se ve antes de init()).
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const enHtml = html.match(/id="aboutVersion">([\d.]+)</);
    assert.ok(enHtml && enHtml[1] === version, 'el «Versión» del HTML no coincide');
  } finally { teardown(); }
});

test('los metadatos de una pista no pueden inyectar HTML', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    App.tracks = [{
      id: 'x1',
      title: '<img src=x onerror="window.__pwned=1">',
      artist: '<b>artista</b>',
      album: '"><script>window.__pwned=1</script>',
      fileName: 'x.mp3', fileSize: 1, duration: 10, size: 1, addedAt: Date.now(), rating: 0,
    }];
    App.invalidateTrackIndex();
    App.renderPlaylists();
    if (typeof App.renderHome === 'function') App.renderHome();
    if (typeof App.renderCurrentTrack === 'function') App.renderCurrentTrack();

    assert.equal(window.__pwned, undefined, 'se ejecutó HTML inyectado');
    // Lo que importa: que no exista un nodo con ese atributo. En un nodo
    // de texto las comillas van sueltas, así que no vale buscar la cadena.
    assert.equal(window.document.querySelectorAll('[onerror]').length, 0,
      'el título se convirtió en un <img> con onerror');
    assert.equal(window.document.querySelectorAll('script').length > 0, true,
      'los scripts legítimos siguen ahí (no se ha borrado media página)');
    assert.equal(App.esc('<b>'), '&lt;b&gt;');
    assert.equal(App.esc('a"b\'c&d'), 'a&quot;b&#39;c&amp;d');
  } finally { teardown(); }
});

test('las 20 hojas se abren y se cierran sin dejar el foco perdido', async () => {
  const { App, window, errors, teardown } = await bootApp();
  try {
    const sheets = [...window.document.querySelectorAll('.sheet')].map((s) => s.id);
    assert.ok(sheets.length >= 20, 'se esperaban al menos 20 hojas');
    for (const id of sheets) {
      const sheetEl = window.document.getElementById(id);
      const isTab = sheetEl.classList.contains('sheet-tab');
      App.openSheet(id);
      assert.ok(sheetEl.classList.contains('open'), id + ' no se abrió');
      const panel = sheetEl.querySelector('.sheet-panel');
      if (isTab) {
        assert.equal(panel.getAttribute('role'), 'region', id + ' debe ser region (no modal)');
        assert.equal(panel.getAttribute('aria-modal'), null, id + ' no debe bloquear chrome con aria-modal');
      } else {
        assert.equal(panel.getAttribute('role'), 'dialog', id + ' sin role=dialog');
        assert.equal(panel.getAttribute('aria-modal'), 'true');
      }
      assert.ok(panel.getAttribute('aria-label') || panel.getAttribute('aria-labelledby'),
        id + ' sin nombre accesible');
      App.closeSheet(id);
      assert.equal(sheetEl.getAttribute('aria-hidden'), 'true');
    }
    assert.deepEqual(errors, []);
  } finally { teardown(); }
});

test('el diagnóstico enseña el último error y se puede copiar', async () => {
  const { App, window, teardown } = await bootApp({ lang: 'es' });
  try {
    const row = window.document.getElementById('aboutLastError');
    assert.ok(row, 'falta la fila de diagnóstico en Acerca de');
    assert.equal(row.hidden, true, 'sin errores la fila no debe verse');

    App._lastError = { msg: 'play() rechazado: NotSupportedError', ts: Date.now() };
    App.renderAboutDiagnostics();
    assert.equal(row.hidden, false);
    assert.match(row.textContent, /play\(\) rechazado/);

    const texto = await App.diagnosticsText();
    assert.match(texto, /Aurora Music Player \d+\.\d+\.\d+/);
    assert.match(texto, /lang=es/);
    assert.match(texto, /ultimo_error=play\(\) rechazado/);

    // Sin portapapeles disponible: la reserva usa execCommand y avisa.
    let copiado = null;
    window.document.execCommand = () => { copiado = true; return true; };
    if (window.navigator.clipboard) delete window.navigator.clipboard;
    await App.copyDiagnostics();
    assert.equal(copiado, true, 'no se intentó la copia de reserva');
  } finally { teardown(); }
});

test('no existe sistema de importar ni exportar copias de respaldo', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    // 1. Sin módulos ni pruebas de copia de respaldo en el repositorio.
    const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => /backup|respald/i.test(f));
    assert.deepEqual(jsFiles, [], 'no debe existir ningún módulo de backup en js/');
    const testFiles = fs.readdirSync(path.join(ROOT, 'test')).filter((f) => /backup|respald/i.test(f));
    assert.deepEqual(testFiles, [], 'no debe existir test de backup en test/');

    // 2. Sin scripts, controles, inputs ni etiquetas de respaldo/re-enlace en el DOM.
    const doc = window.document;
    assert.equal(doc.querySelector('script[src*="backup"]'), null);
    for (const id of [
      'menuExportBackup', 'menuImportBackup', 'backupInput', 'backupHint',
      'btnHomeImportBackup', 'menuRelinkAudio',
    ]) {
      assert.equal(doc.getElementById(id), null, `no debe existir #${id}`);
    }
    assert.equal(doc.querySelectorAll('[data-i18n*="backup"], [data-i18n*="relink"]').length, 0);
    assert.equal(doc.querySelectorAll('input[accept*=".aurora"]').length, 0);

    // 3. Sin API de respaldo, re-enlace ni marcador huérfano en App ni en window.
    assert.equal(window.AuroraBackup, undefined);
    for (const fn of [
      'exportBackup', 'importBackup', 'createBackup', 'buildBackup',
      'restoreBackup', 'restoreBackupFromFile', 'parseBackup',
      'exportLibrary', 'importLibrary', '_importLibraryFromFile', '_importLibraryData',
      '_backupSettings', '_backupSession', '_applyBackupSettings',
      'promptRelinkTrack', '_cureRelinkedTrack', 'pendingRelinkCount', 'updateRelinkUI',
      'syncLibCountMarker',
    ]) {
      assert.equal(App[fn], undefined, `App.${fn} no debe existir`);
    }

    // 4. Sin claves huérfanas de copia de respaldo ni de re-enlace en i18n.
    const backupKeys = Object.keys(window.I18N).filter((k) =>
      /(?:^|_)backup(?:_|$)|^relink_|^library_missing/.test(k));
    assert.deepEqual(backupKeys, [], 'no deben quedar claves i18n de respaldo');

    // 5. El selector e importador de audio no aceptan archivos .aurora ni escriben marcadores.
    const queueSrc = fs.readFileSync(path.join(ROOT, 'js/queue.js'), 'utf8');
    const libSrc = fs.readFileSync(path.join(ROOT, 'js/library.js'), 'utf8');
    assert.equal(/\.aurora\b/i.test(queueSrc), false, 'queue.js no debe aceptar .aurora');
    assert.equal(/\.aurora\b/i.test(libSrc), false, 'library.js no debe tratar .aurora');
    assert.equal(window.localStorage.getItem('aurora_lib_count'), null);
  } finally { teardown(); }
});

test('Fase 1 GUI: CSS base, fuente local, color-scheme, etiquetas, teclado, Biblioteca y Mantenimiento', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const doc = window.document;
    const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');

    // C1: .lyrics-fine { display: contents } vive en el nivel raíz, fuera de @media.
    const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '');
    let depth = 0, topLevelLyricsFine = false;
    for (const line of cleanCss.split('\n')) {
      if (depth === 0 && /\.lyrics-fine\s*\{\s*display\s*:\s*contents\s*;?\s*\}/.test(line)) {
        topLevelLyricsFine = true;
      }
      for (const ch of line) {
        if (ch === '{') depth++;
        else if (ch === '}') depth = Math.max(0, depth - 1);
      }
    }
    assert.equal(topLevelLyricsFine, true, '.lyrics-fine debe ser display:contents fuera de @media');

    // C2: toda url(...) relativa en css/styles.css resuelve a un archivo real desde css/.
    const cssDir = path.join(ROOT, 'css');
    const urls = [...cleanCss.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)]
      .map((m) => m[1].trim())
      .filter((u) => u && !u.startsWith('#') && !/^(?:data:|[a-z]+:|\/\/)/i.test(u));
    assert.ok(urls.length >= 1, 'debe incluir la fuente Outfit local');
    for (const u of urls) {
      const target = path.resolve(cssDir, u.split('?')[0].split('#')[0]);
      assert.equal(fs.existsSync(target), true, `url(${u}) debe existir en ${target}`);
    }

    // C3: las hojas completas y de pestaña respetan var(--safe-top).
    assert.match(cleanCss, /\.sheet-tab\s+\.sheet-panel\s*\{[^}]*padding-top\s*:\s*var\(--safe-top\)/);
    assert.match(cleanCss, /\.sheet-full\s+\.sheet-panel\s*\{[^}]*padding-top\s*:\s*var\(--safe-top\)/);

    // C4: color-scheme se sincroniza al cambiar entre dark, light y amoled, y <option> tiene fondo propio.
    assert.match(cleanCss, /\.aurora-select\s+option\s*\{[^}]*background-color\s*:/);
    App.setTheme('light');
    assert.equal(doc.documentElement.style.colorScheme, 'light');
    App.setTheme('amoled');
    assert.equal(doc.documentElement.style.colorScheme, 'dark');
    App.setTheme('dark');
    assert.equal(doc.documentElement.style.colorScheme, 'dark');

    // C5: selectores de orden con <label for> y botones accesibles en Idioma, Catálogo y Estadísticas.
    assert.ok(doc.querySelector('label[for="plSortSelect"]'), '#plSortSelect debe tener <label for>');
    assert.ok(doc.querySelector('label[for="browseSortSelect"]'), '#browseSortSelect debe tener <label for>');
    const langBtns = [...doc.querySelectorAll('#langList button.lang-row')];
    assert.equal(langBtns.length, window.SUPPORTED_LANGS.length, 'cada idioma debe ser un <button>');
    assert.equal(doc.querySelectorAll('#langList button.lang-row[aria-current="true"]').length, 1);
    assert.ok(langBtns[0].querySelector('.lang-flag[aria-hidden="true"]'));

    // A5: pestaña corta en Biblioteca, estados vacíos en catálogo y #libraryTools contextual.
    const firstTab = doc.querySelector('.lib-tab[data-libtab="playlists"]');
    assert.equal(firstTab.getAttribute('data-i18n'), 'tab_playlists');
    App.setLang('es');
    assert.equal(firstTab.textContent, 'Listas');
    App.setLang('en');
    assert.equal(firstTab.textContent, 'Playlists');
    const libTools = doc.getElementById('libraryTools');
    assert.equal(libTools.hidden, true, 'sin pistas suficientes se oculta Buscar duplicados');
    for (const [tab, gridId] of [['albums', 'libraryAlbums'], ['artists', 'libraryArtists'], ['genres', 'libraryGenres']]) {
      App.setLibTab(tab);
      assert.ok(doc.querySelector(`#${gridId} .catalog-empty`), `${tab} vacío debe mostrar estado vacío`);
      assert.equal(libTools.hidden, true);
    }

    // Con 2 pistas: botones en catálogo/estadísticas y #libraryTools visible solo en Listas.
    App.tracks = [
      { id: 't1', title: 'Uno', artist: 'Artista A', album: 'Disco A', genre: 'Synth', duration: 120, cover: { from: '#111111', to: '#222222' } },
      { id: 't2', title: 'Dos', artist: 'Artista B', album: 'Disco B', genre: 'Ambient', duration: 150, cover: { from: '#333333', to: '#444444' } },
    ];
    App.stats = { plays: { t1: 3 }, totalSeconds: 360 };
    App.setLibTab('playlists');
    assert.equal(libTools.hidden, false, 'con ≥2 pistas en Listas se muestra Buscar duplicados');
    App.setLibTab('albums');
    assert.equal(libTools.hidden, true, 'en Álbumes se oculta Buscar duplicados');
    assert.equal(doc.querySelectorAll('#libraryAlbums button.catalog-card-btn').length, 2);
    App.renderStats();
    assert.ok(doc.querySelectorAll('#statsContent button.stats-row-btn').length >= 2);

    // A6: settings_free_hint va justo después de #menuFreeStorage y settings_sleep_fade vive en #sheetSleep.
    const freeBtn = doc.getElementById('menuFreeStorage');
    assert.equal(freeBtn.nextElementSibling.getAttribute('data-i18n'), 'settings_free_hint');
    const delBtn = doc.getElementById('menuDeleteLibrary');
    assert.equal(delBtn.nextElementSibling.getAttribute('data-i18n'), 'settings_delete_hint');
    assert.ok(doc.querySelector('#sheetSleep [data-i18n="settings_sleep_fade"]'));
    assert.equal(doc.querySelector('#sheetSettings [data-i18n="settings_sleep_fade"]'), null);
  } finally { teardown(); }
});

test('Fase 2 GUI: foco pestañas/modales, atajos/Escape, contraste WCAG AA, responsive y objetivos táctiles', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const doc = window.document;
    const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
    const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '');

    // A1: trampa única, pestañas .sheet-tab no atrapan Tab, #viewHome inerte tras pestaña,
    // y cerrar una hoja hija (Temas sobre Ajustes) devuelve el foco al disparador padre.
    assert.equal(App._trapSheetFocus, undefined, '_trapSheetFocus duplicado eliminado');
    App.openSheet('sheetLibrary');
    assert.equal(doc.getElementById('viewHome').getAttribute('aria-hidden'), 'true');
    const libBtns = doc.querySelectorAll('#sheetLibrary button:not([disabled])');
    const lastLibBtn = libBtns[libBtns.length - 1];
    lastLibBtn.focus();
    const tabOnTab = new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    doc.dispatchEvent(tabOnTab);
    assert.equal(tabOnTab.defaultPrevented, false, 'Tab en .sheet-tab debe poder ir al chrome/player');
    App.closeSheet('sheetLibrary');
    assert.equal(doc.getElementById('viewHome').getAttribute('aria-hidden'), 'false');

    App.openSheet('sheetSettings');
    const triggerThemes = doc.getElementById('menuThemesSettings');
    triggerThemes.focus();
    App.openSheet('sheetThemes');
    assert.equal(doc.getElementById('sheetSettings').getAttribute('aria-hidden'), 'true');
    const themeBtns = [...doc.querySelectorAll('#sheetThemes .sheet-panel button:not([disabled])')];
    themeBtns[themeBtns.length - 1].focus();
    const tabOnModal = new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    doc.dispatchEvent(tabOnModal);
    assert.equal(tabOnModal.defaultPrevented, true, 'Tab en modal apilado debe ciclar en la hoja superior');
    assert.equal(doc.activeElement, themeBtns[0]);
    App.closeSheet('sheetThemes');
    assert.equal(doc.activeElement, triggerThemes, 'cerrar hoja hija devuelve el foco a su disparador');
    App.closeSheet('sheetSettings');

    // A3: Ctrl/Cmd/Alt no disparan atajos; Shift+/ no abre Atajos; Escape sale de Letras FS e importación.
    let favCalls = 0;
    const origFav = App.toggleFavorite;
    App.toggleFavorite = () => { favCalls++; };
    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'l', ctrlKey: true, bubbles: true }));
    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'l', metaKey: true, bubbles: true }));
    assert.equal(favCalls, 0, 'Ctrl/Cmd+L no debe conmutar favorito');
    App.toggleFavorite = origFav;

    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: '/', shiftKey: true, bubbles: true }));
    assert.equal(doc.getElementById('sheetShortcuts').classList.contains('open'), false,
      'escribir «/» con Shift+7 no debe abrir Atajos');
    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));
    assert.equal(doc.getElementById('sheetShortcuts').classList.contains('open'), true);
    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(doc.getElementById('sheetShortcuts').classList.contains('open'), false);

    App.showView('lyrics');
    App.toggleLyricsFullscreen(true);
    assert.equal(doc.getElementById('viewLyrics').classList.contains('lyrics-fullscreen'), true);
    assert.equal(doc.getElementById('btnLrcFullscreen').getAttribute('aria-pressed'), 'true');
    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(doc.getElementById('viewLyrics').classList.contains('lyrics-fullscreen'), false);
    assert.equal(doc.getElementById('btnLrcFullscreen').getAttribute('aria-pressed'), 'false');

    const impOv = doc.getElementById('importOverlay');
    App._importCancelled = false;
    impOv.hidden = false;
    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(App._importCancelled, true, 'Escape cancela la importación activa');
    impOv.hidden = true;
    App.showView('home');

    // A4: matriz WCAG AA (≥4.5:1) en dark, light y amoled × los 6 acentos + danger + selector de acentos.
    const parseCol = (s) => {
      let m = String(s).trim().match(/^#([0-9a-f]{6})$/i);
      if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
      m = String(s).trim().match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
      return [+m[1], +m[2], +m[3], m[4] !== undefined ? +m[4] : 1];
    };
    const blend = (fg, bg) => [fg[0]*fg[3]+bg[0]*(1-fg[3]), fg[1]*fg[3]+bg[1]*(1-fg[3]), fg[2]*fg[3]+bg[2]*(1-fg[3]), 1];
    const lum = ([r, g, b]) => {
      const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (fg, bg) => {
      const a = fg[3] < 1 ? blend(fg, bg) : fg;
      const l1 = lum(a), l2 = lum(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const white = [255, 255, 255, 1];
    for (const tn of ['dark', 'light', 'amoled']) {
      const t = App.THEMES[tn];
      const bgs = [parseCol(t.bg1), parseCol(t.bg2), parseCol(t.bg3)];
      for (const bg of bgs) {
        assert.ok(ratio(parseCol(t.danger), bg) >= 4.5, `${tn} danger >= 4.5`);
        assert.ok(ratio(parseCol(t.text3), bg) >= 4.5, `${tn} text3 >= 4.5`);
      }
      for (const [an, a] of Object.entries(App.ACCENTS)) {
        const isLight = tn === 'light';
        const acc = parseCol(isLight ? a.fillLight : a.accent);
        const fill = parseCol(isLight ? a.fillLight : a.fill);
        const fill2 = parseCol(isLight ? a.fillLight2 : a.fill2);
        const tint = blend([fill[0], fill[1], fill[2], 0.14], parseCol(t.bg2));
        for (const bg of [...bgs, tint]) {
          assert.ok(ratio(acc, bg) >= 4.5, `${tn}/${an} accent >= 4.5`);
        }
        assert.ok(ratio(white, fill) >= 4.5, `${tn}/${an} #fff on fill >= 4.5`);
        assert.ok(ratio(white, fill2) >= 4.5, `${tn}/${an} #fff on fill2 >= 4.5`);
      }
    }
    assert.match(cleanCss, /:root\[data-theme="amoled"\]\s+\.nav-btn\s*\{\s*color\s*:\s*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.58\s*\)/);
    assert.equal(doc.querySelectorAll('.accent-opt .accent-swatch .accent-check').length, 6);
    assert.equal(doc.querySelectorAll('.accent-opt[aria-pressed="true"]').length, 1);
    assert.equal(doc.querySelectorAll('.theme-opt[aria-pressed="true"]').length, 1);

    // A2 & A7: --sheet-max unificado en aurora-wide, sin fuentes de 0.5rem/0.5625rem, sliders y progreso ≥32px.
    assert.match(cleanCss, /html\.aurora-wide\s+#sheetLibrary\s*\{\s*--sheet-max\s*:\s*1040px/);
    assert.equal(/font-size\s*:\s*0\.5(?:625)?rem\b/.test(cleanCss), false, 'sin fuentes de 8px ni 9px');
    assert.match(cleanCss, /\.progress-track\s*\{[^}]*height\s*:\s*32px/);
    assert.match(cleanCss, /\.eq-band\s+input\[type="range"\]::-moz-range-thumb/);
  } finally { teardown(); }
});

test('Fase 3 GUI: ARIA/teclado, cola/exploración/stats, letras, reduced-motion, CSS e i18n (M1–M6, B1–B4)', async () => {
  const { window, teardown } = await bootApp();
  try {
    const doc = window.document;
    const App = window.App;
    const rawCss = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
    const cleanCss = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');

    // M1: semántica limpia, #timeTotal nativo, tabpanels con roving tabindex y aria-pressed/expanded.
    assert.equal(doc.querySelectorAll('[role="presentation"]').length, 0);
    const handles = Array.from(doc.querySelectorAll('.sheet-handle'));
    assert.ok(handles.length >= 20 && handles.every(h => h.getAttribute('aria-hidden') === 'true'));
    const timeTotal = doc.getElementById('timeTotal');
    assert.equal(timeTotal.tagName, 'BUTTON');
    assert.equal(timeTotal.getAttribute('aria-pressed'), 'false');
    timeTotal.click();
    assert.equal(timeTotal.getAttribute('aria-pressed'), 'true');
    timeTotal.click();
    assert.equal(timeTotal.getAttribute('aria-pressed'), 'false');

    // M1: diálogo modal de importación con barra de progreso, foco inicial y restitución.
    const impOv = doc.getElementById('importOverlay');
    const impBar = doc.getElementById('importProgressBar');
    assert.equal(impOv.getAttribute('role'), 'dialog');
    assert.equal(impOv.getAttribute('aria-modal'), 'true');
    assert.equal(impBar.getAttribute('role'), 'progressbar');
    App.showImportOverlay(4);
    App.updateImportOverlay(2, 4, 'demo.mp3');
    assert.equal(impBar.getAttribute('aria-valuenow'), '50');
    assert.equal(doc.getElementById('importCount').textContent, '2 / 4');
    App.hideImportOverlay();
    assert.equal(impOv.hidden, true);

    // M1: pestañas de Biblioteca con tabpanels y navegación por flechas/Home/End.
    App.openSheet('sheetLibrary');
    const libTabs = Array.from(doc.querySelectorAll('.lib-tab'));
    assert.equal(libTabs.length, 4);
    libTabs.forEach(tb => {
      const panel = doc.getElementById(tb.getAttribute('aria-controls'));
      assert.ok(panel && panel.getAttribute('role') === 'tabpanel');
    });
    libTabs[0].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal(App._libTab, 'albums');
    assert.equal(libTabs[1].getAttribute('tabindex'), '0');
    assert.equal(libTabs[0].getAttribute('tabindex'), '-1');
    libTabs[1].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    assert.equal(App._libTab, 'genres');
    App.setLibTab('tracks');

    // M1: sincronización de aria-pressed en EQ, temporizador, búsqueda, transiciones y volumen.
    App.applyEqPreset('bass');
    assert.equal(doc.querySelector('.eq-preset[data-preset="bass"]').getAttribute('aria-pressed'), 'true');
    assert.equal(doc.querySelector('.eq-preset[data-preset="normal"]').getAttribute('aria-pressed'), 'false');
    App.applyEqPreset('normal');
    App.startSleep(15);
    assert.equal(doc.querySelector('.sleep-opt[data-min="15"]').getAttribute('aria-pressed'), 'true');
    App.cancelSleep();
    assert.ok(Array.from(doc.querySelectorAll('.sleep-opt')).every(b => b.getAttribute('aria-pressed') === 'false'));
    const btnVol = doc.getElementById('btnVolume');
    assert.equal(btnVol.getAttribute('aria-expanded'), 'false');
    btnVol.click();
    assert.equal(btnVol.getAttribute('aria-expanded'), 'true');
    btnVol.click();
    assert.equal(btnVol.getAttribute('aria-expanded'), 'false');

    // M2 + M1: cola vacía/1/N y reordenación por teclado de asas .drag-handle.
    App.tracks = [
      { id: 't1', title: 'Alpha', artist: 'A1', album: 'Alb1', genre: 'Pop', duration: 100, rating: 5 },
      { id: 't2', title: 'Beta', artist: 'A2', album: 'Alb2', genre: 'Rock', duration: 120, rating: 4 },
      { id: 't3', title: 'Gamma', artist: 'A3', album: 'Alb3', genre: 'Jazz', duration: 90, rating: 0 },
      { id: 't4', title: 'Delta', artist: 'A4', album: 'Alb4', genre: 'Pop', duration: 110, rating: 0 },
      { id: 't5', title: 'Epsilon', artist: 'A5', album: 'Alb5', genre: 'Pop', duration: 80, rating: 0 },
      { id: 't6', title: 'Zeta', artist: 'A6', album: 'Alb6', genre: 'Pop', duration: 95, rating: 0 },
    ];
    App.queue = [];
    App.queueIdx = -1;
    App.renderQueue();
    assert.equal(doc.getElementById('queueActions').hidden, true);
    assert.ok(doc.querySelector('#queueList .empty-state'));
    App.queue = ['t1'];
    App.queueIdx = 0;
    App.renderQueue();
    assert.equal(doc.getElementById('queueActions').hidden, false);
    assert.equal(doc.getElementById('btnClearQueue').disabled, true);
    App.queue = ['t1', 't2', 't3'];
    App.queueIdx = 0;
    App.renderQueue();
    assert.equal(doc.getElementById('btnClearQueue').disabled, false);
    const firstHandle = doc.querySelector('#queueList .drag-handle');
    firstHandle.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    assert.deepEqual(Array.from(App.queue), ['t2', 't1', 't3']);
    assert.equal(App.queueIdx, 1);

    // M2: sheetBrowse con y sin pistas + showConfirm restablece etiqueta de cancelar.
    App.openBrowse({ type: 'artist', title: 'A1', tracks: [App.tracks[0]] });
    assert.equal(doc.getElementById('browseHero').hidden, false);
    assert.equal(doc.getElementById('browseHeroTitle').textContent, 'A1');
    App.openBrowse({ type: 'artist', title: 'Inexistente', tracks: [] });
    assert.equal(doc.getElementById('browseHero').hidden, true);
    assert.equal(doc.getElementById('browseSortRow').hidden, true);
    assert.equal(doc.getElementById('btnPlayBrowse').hidden, true);
    assert.ok(doc.querySelector('#browseTracks .empty-state'));

    const p1 = App.showConfirm({ message: 'B', cancelLabel: 'CUSTOM' });
    assert.equal(doc.getElementById('btnConfirmCancel').textContent, 'CUSTOM');
    doc.getElementById('btnConfirmCancel').click();
    await p1;
    const p2 = App.showConfirm({ message: 'B' });
    assert.equal(doc.getElementById('btnConfirmCancel').textContent, App.t('cancel'));
    doc.getElementById('btnConfirmCancel').click();
    await p2;

    // M2 + M6: estadísticas cuentan todos los artistas (>5) y respetan mayúscula alemana.
    App.stats = {
      totalSeconds: 600,
      plays: { t1: 3, t2: 2, t3: 1, t4: 1, t5: 1, t6: 1 },
      recent: ['t1', 't2'],
    };
    App.setLang('de');
    App.renderStats();
    assert.equal(doc.querySelector('#statsContent .stat-card:nth-child(4) .stat-value').textContent, '6');
    assert.equal(doc.querySelectorAll('#statsContent .stats-row[data-artist]').length, 5);
    assert.equal(doc.querySelector('#statsContent .stats-row[data-artist] .stats-sub').textContent, '3 Wiedergaben');

    // M6: sin emojis de bandera regional, claves traducidas, plegado de ß e í turca, español sin anglicismos.
    assert.ok(window.SUPPORTED_LANGS.every(l => !/[\u{1F1E6}-\u{1F1FF}]/u.test(l.flag)));
    assert.equal(doc.querySelector('.sleep-opt[data-min="60"]').textContent, '1 Std.');
    assert.equal(App.cleanSearchStr('Straße'), App.cleanSearchStr('strasse'));
    assert.equal(App.cleanSearchStr('İstanbul'), App.cleanSearchStr('istanbul'));
    App.setLang('es');
    assert.equal(App.t('sleep'), 'Temporizador');
    assert.equal(App.t('settings_reset_eq'), 'Restablecer EQ');
    assert.equal(App.t('lrc_loop_clear'), 'Quitar bucle');
    assert.equal(App.t('settings_marquee'), 'Desplazar títulos largos');

    // M2: barra de progreso interactiva en Letras.
    const lrcTrack = doc.getElementById('lyricsProgressTrack');
    assert.equal(lrcTrack.getAttribute('role'), 'slider');
    assert.ok(doc.querySelector('#lyricsProgressTrack .lyrics-progress-thumb'));

    // B4: portada inmersiva con pista de salida y clase .cover-fs acotada a html:not(.aurora-wide).
    App.setCoverFullscreen(true);
    assert.equal(doc.getElementById('deviceScreen').classList.contains('cover-fs'), true);
    assert.ok(doc.getElementById('coverFsHint').textContent.length > 0);
    App.setCoverFullscreen(false);
    assert.equal(doc.getElementById('deviceScreen').classList.contains('cover-fs'), false);
    assert.match(cleanCss, /html:not\(\.aurora-wide\)\s+\.device-screen\.cover-fs\s+\.bottom-nav/);

    // M3 + M4 + B1–B3: invariantes de la hoja de estilos.
    assert.equal(cleanCss.includes(':has('), false, 'sin :has() para compatibilidad WebView');
    assert.equal(/--fs-h3\b|--fs-small\b/.test(cleanCss), false, 'sin variables tipográficas indefinidas');
    assert.equal(/\.pl-info\b|\.pl-row\b|\.playlist-list\b|#btnBack\b/.test(cleanCss), false, 'sin selectores huérfanos');
    assert.match(cleanCss, /\.lyrics-exit-fs\s*\{[^}]*z-index\s*:\s*60/);
    assert.match(cleanCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.pl-live\.playing\s+\.pl-bars\s+i/);
    const definedVars = new Set([...cleanCss.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)].map(m => m[1]));
    for (const jf of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
      const jsrc = fs.readFileSync(path.join(ROOT, 'js', jf), 'utf8');
      for (const m of jsrc.matchAll(/setProperty\(\s*['"](--[a-zA-Z0-9_-]+)['"]/g)) definedVars.add(m[1]);
    }
    for (const m of cleanCss.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)) {
      assert.ok(definedVars.has(m[1]), `variable CSS definida: ${m[1]}`);
    }
  } finally { teardown(); }
});

