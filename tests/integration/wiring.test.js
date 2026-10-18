/* =====================================================================
 *  tests/integration/wiring.test.js
 *  Contrato HTML ↔ JS: todo id que el código busca debe existir (o
 *  crearse dinámicamente y estar documentado aquí). Detecta el tipo de
 *  bug que dejó botones sin efecto tras el rediseño de la vista.
 * ===================================================================== */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { boot } = require('../helpers/dom-env');

const ROOT = path.resolve(__dirname, '..', '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const STATIC_IDS = new Set(Array.from(HTML.matchAll(/\bid="([^"]+)"/g), (m) => m[1]));

/* Ids creados en tiempo de ejecución por la propia app (no están en el
 * markup inicial) o usados como fallback de versiones anteriores. */
const DYNAMIC_IDS = new Set([
  'emptyState',        // js/library.js: estado vacío de la biblioteca
  'lrcFileInput',      // js/lyrics.js: <input type=file> para .lrc
  'btnResetHistory',   // js/library.js: botón del historial renderizado
  'btnResetStats',     // js/stats-ui.js: botón del panel de estadísticas
  'btnHomeLoad',       // js/nav.js: CTA del estado bienvenida
  'homeHero',          // js/nav.js: tarjeta de reproducción reciente
  'homeHeroCanvas',    // js/nav.js: portada de la tarjeta
  'btnSleep'           // js/ui.js: fallback del botón antiguo (menú #menuSleep)
]);

test('wiring: todos los getElementById($) literales tienen markup o creación dinámica', () => {
  const refs = new Map();
  for (const file of fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');
    const patterns = [
      /getElementById\(\s*'([A-Za-z0-9_-]+)'\s*\)/g,
      /(?<![.\w$])\$\(\s*'([A-Za-z0-9_-]+)'\s*\)/g
    ];
    for (const re of patterns) {
      for (const m of src.matchAll(re)) {
        if (!refs.has(m[1])) refs.set(m[1], new Set());
        refs.get(m[1]).add(file);
      }
    }
  }
  const missing = Array.from(refs.keys())
    .filter((id) => !STATIC_IDS.has(id) && !DYNAMIC_IDS.has(id));
  assert.deepEqual(missing, [], 'ids referenciados que no existen: ' + missing.join(', '));
});

test('wiring: data-close-sheet apunta a sheets existentes', () => {
  const targets = Array.from(HTML.matchAll(/data-close-sheet="([^"]+)"/g), (m) => m[1]);
  assert.ok(targets.length > 0);
  const bad = targets.filter((id) => !STATIC_IDS.has(id));
  assert.deepEqual(bad, [], 'data-close-sheet sin destino: ' + bad.join(', '));
});

test('wiring: ids únicos en el documento', async () => {
  const env = await boot();
  try {
    const doc = env.window.document;
    const seen = new Set();
    const dup = [];
    doc.querySelectorAll('[id]').forEach((el) => {
      if (seen.has(el.id)) dup.push(el.id);
      seen.add(el.id);
    });
    assert.deepEqual(dup, [], 'ids duplicados: ' + dup.join(', '));
  } finally {
    env.close();
  }
});

test('wiring: los botones reales del modo lote están conectados', async () => {
  const env = await boot();
  const { App, window: w } = env;
  try {
    App.tracks = [
      { id: 'w1', title: 'Uno', artist: 'A', album: 'B', duration: 100, fileName: '1.mp3', fileSize: 1 },
      { id: 'w2', title: 'Dos', artist: 'A', album: 'B', duration: 100, fileName: '2.mp3', fileSize: 2 }
    ];
    App.openSheet('sheetLibrary');
    App.renderLibrary();

    const click = (id) => w.document.getElementById(id)
      .dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

    // #btnBatchSelect debe activar el modo (no solo existir).
    click('btnBatchSelect');
    assert.equal(App._batchMode, true, 'btnBatchSelect no activó el modo lote');
    assert.equal(w.document.getElementById('btnBatchSelect').getAttribute('aria-pressed'), 'true');

    // #btnBatchSelectAll selecciona todas las pistas.
    click('btnBatchSelectAll');
    assert.equal(App._selectedTrackIds.size, 2);

    // #btnBatchCancel sale del modo y limpia la selección.
    click('btnBatchCancel');
    assert.equal(App._batchMode, false);
    assert.equal(App._selectedTrackIds.size, 0);
  } finally {
    env.close();
  }
});

test('wiring: botones de reproducción y navegación responden', async () => {
  const env = await boot();
  const { App, window: w } = env;
  try {
    App.tracks = [{ id: 'p1', title: 'Pista', artist: 'A', album: 'B', duration: 100, fileName: 'p.mp3', fileSize: 3 }];
    App.currentTrack = App.tracks[0];
    const doc = w.document;
    const clickPlay = () => doc.getElementById('btnPlay')
      .dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    const settle = () => new Promise((r) => setTimeout(r, 20));

    clickPlay();
    await settle();
    assert.equal(App.isPlaying, true, 'btnPlay no inició la reproducción');
    clickPlay();
    await settle();
    assert.equal(App.isPlaying, false, 'btnPlay no pausó');
    clickPlay();
    await settle();
    assert.equal(App.isPlaying, true, 'btnPlay no reanudó');

    // Navegación inferior: cada botón abre su sheet.
    const libBtn = doc.querySelector('.nav-btn[data-nav="library"]');
    libBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    assert.ok(doc.getElementById('sheetLibrary').classList.contains('open'));
    App.closeSheet('sheetLibrary');
  } finally {
    env.close();
  }
});
