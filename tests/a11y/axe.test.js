/* =====================================================================
 *  tests/a11y/axe.test.js
 *  Auditoría de accesibilidad automática con axe-core sobre la app real
 *  (index.html + scripts) ejecutada en jsdom.
 *
 *  Nota metodológica: la regla `color-contrast` se desactiva porque jsdom
 *  no implementa layout ni resolución de estilos heredados y daría
 *  resultados falsos. El contraste se revisa a mano con los tokens de
 *  styles.css (ver docs/AUDITORIA.md, sección accesibilidad).
 * ===================================================================== */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { boot } = require('../helpers/dom-env');

const AXE_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'node_modules', 'axe-core', 'axe.min.js'),
  'utf8'
);

const AXE_OPTIONS = {
  rules: {
    // jsdom no calcula colores ni layout: ver nota de cabecera.
    'color-contrast': { enabled: false }
  }
};

/* Inyecta axe-core en el window de jsdom y devuelve un runner. */
function installAxe(w) {
  const s = w.document.createElement('script');
  s.textContent = AXE_SRC;
  w.document.body.appendChild(s);
  assert.ok(w.axe && typeof w.axe.run === 'function', 'axe-core no se cargó');
  return (context) => w.axe.run(context || w.document, AXE_OPTIONS);
}

function describeViolations(violations) {
  return violations.map((v) =>
    `[${v.impact}] ${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`
  ).join('\n');
}

/* Falla el test con un mensaje útil (selectores + regla) si hay violaciones. */
async function expectClean(run, label) {
  const res = await run();
  // Array.from: el array de violaciones pertenece al realm de jsdom y
  // deepStrictEqual falla por prototipo distinto.
  assert.deepStrictEqual(
    Array.from(res.violations, (v) => v.id),
    [],
    `Violaciones axe en «${label}»:\n${describeViolations(res.violations)}`
  );
  return res;
}

test('a11y: vista inicial (home) sin violaciones', async () => {
  const env = await boot();
  try {
    const run = installAxe(env.window);
    await expectClean(run, 'home');
  } finally {
    env.close();
  }
});

test('a11y: reproductor, letras y estados vacíos', async () => {
  const env = await boot();
  const { App, window: w } = env;
  try {
    const run = installAxe(w);

    App.openNowPlaying();
    await expectClean(run, 'viewPlayer');

    // Estado vacío del reproductor (sin pista) y de la cola.
    assert.strictEqual(App.currentTrack, null);
    await expectClean(run, 'viewPlayer vacío');

    App.openSheet('sheetQueue');
    await expectClean(run, 'sheetQueue vacía');
    App.closeSheet('sheetQueue');

    // Vista de letras: sin pista muestra su propio estado vacío.
    App.showView('lyrics');
    await expectClean(run, 'viewLyrics vacía');
    App.showView('home');
  } finally {
    env.close();
  }
});

test('a11y: todas las hojas (sheets) abiertas de una en una', async () => {
  const env = await boot();
  const { App, window: w } = env;
  try {
    const run = installAxe(w);
    const sheets = Array.from(w.document.querySelectorAll('.sheet[id]'))
      .map((el) => el.id)
      .filter((id) => id !== 'sheetConfirm');
    assert.ok(sheets.length >= 20, `se esperaban >=20 sheets, hay ${sheets.length}`);
    for (const id of sheets) {
      App.openSheet(id);
      await expectClean(run, id);
      App.closeSheet(id);
    }
  } finally {
    env.close();
  }
});

test('a11y: biblioteca con pistas, modo lote y menú de pista', async () => {
  const env = await boot();
  const { App, window: w } = env;
  try {
    const run = installAxe(w);

    // Sembrar pistas reales en memoria (sin tocar IndexedDB) para que las
    // filas dinámicas (checkbox, menú, mini-player) también se auditen.
    App.tracks = [
      { id: 'a11y-1', title: 'Canción uno', artist: 'Artista', album: 'Álbum', duration: 200, fileName: 'a.mp3', fileSize: 10 },
      { id: 'a11y-2', title: 'Canción dos', artist: 'Otro', album: 'Álbum', duration: 180, fileName: 'b.mp3', fileSize: 11 }
    ];
    App.currentTrack = App.tracks[0];
    App.openSheet('sheetLibrary');
    App.renderLibrary();
    await expectClean(run, 'sheetLibrary con pistas');

    App.toggleBatchMode(true);
    App.selectAllTracks();
    await expectClean(run, 'sheetLibrary modo lote');

    App.toggleBatchMode(false);
    App.openTrackMenu('a11y-1');
    await expectClean(run, 'sheetTrackMenu');
    App.closeSheet('sheetTrackMenu');

    App.openNowPlaying();
    App.updateBatchUI();
    await expectClean(run, 'viewPlayer con pista');
  } finally {
    env.close();
  }
});

test('a11y: diálogo de confirmación y onboarding de idioma', async () => {
  const env = await boot();
  const { App, window: w } = env;
  try {
    const run = installAxe(w);

    App.showConfirm({ message: '¿Borrar todo?', okLabel: 'Borrar' });
    await expectClean(run, 'sheetConfirm');
    // Cerrar por el botón real (resuelve la Promise pendiente).
    const cancel = w.document.getElementById('btnConfirmCancel');
    cancel.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

    App.openSheet('sheetLanguage');
    await expectClean(run, 'sheetLanguage');
    App.closeSheet('sheetLanguage');
  } finally {
    env.close();
  }
});
