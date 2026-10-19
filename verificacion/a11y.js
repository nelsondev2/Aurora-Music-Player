'use strict';
/* =====================================================================
 *  a11y.js — auditoría axe-core sobre las pantallas principales
 *
 *  jsdom no aplica styles.css, así que color-contrast se desactiva aquí:
 *  el contraste se verifica matemáticamente en ui-polish.js (bloque C).
 *  El resto de reglas (nombres accesibles, roles, diálogos, listas,
 *  aria-hidden con foco, etc.) sí se ejecutan.
 * ===================================================================== */
const fs = require('fs');
const path = require('path');
const { boot, wait, TRACKS } = require('./harness');
const { assert, eq, test, section, summary } = require('./lib/check');

const AXE_SOURCE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

async function runAxe(w, context, label) {
  return await w.axe.run(context || w.document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: {
      // Sin CSS en jsdom no hay colores computados fiables.
      'color-contrast': { enabled: false }
    }
  });
}

function describe(results) {
  return results.violations.map(v =>
    `· [${v.impact}] ${v.id}: ${v.help}\n    ` +
    v.nodes.slice(0, 3).map(n => n.target.join(' ')).join('\n    ')
  ).join('\n');
}

(async () => {
  const { w, doc, App, errors, close } = await boot({ tracks: TRACKS });
  w.eval(AXE_SOURCE);

  await test('axe-core se carga y puede analizar el documento', async () => {
    const results = await runAxe(w);
    assert(Array.isArray(results.violations), 'axe no devolvió violaciones');
    assert(errors.length === 0, 'errores de arranque: ' + errors.join(' | '));
  });

  const states = [
    ['Inicio', () => { App.closeAllSheets(); App.showView('home'); App.renderHome(); }],
    ['Reproductor', () => { App.closeAllSheets(); App.showView('player'); }],
    ['Biblioteca', () => { App.showView('home'); App.goNav('library'); }],
    ['Ajustes', () => { App.closeAllSheets(); App.openSheet('sheetSettings'); }],
    ['Temas y acentos', () => { App.closeAllSheets(); App.openSheet('sheetThemes'); }],
    ['Favoritos', () => { App.closeAllSheets(); App.goNav('favorites'); }],
    ['Buscar', () => { App.closeAllSheets(); App.goNav('search'); }],
    ['Menú de pista', () => { App.closeAllSheets(); App.openTrackMenu('t1'); }],
    ['Editor de lista', () => {
      if (!App.playlists.length) App.createPlaylist('Lista a11y', '', ['t1', 't2']);
      App.closeAllSheets();
      App.openEditPlaylist(App.playlists[0].id);
    }],
    ['Letras', () => { App.closeAllSheets(); App.showView('lyrics'); }]
  ];

  for (const [name, setup] of states) {
    await test(name + ': 0 violaciones axe', async () => {
      setup();
      await wait(60);
      const results = await runAxe(w);
      eq(results.violations.length, 0, name + ':\n' + describe(results));
    });
  }

  await test('las vistas inactivas no exponen controles enfocables a axe', async () => {
    App.closeAllSheets();
    App.showView('home');
    await wait(40);
    const results = await runAxe(w);
    const hiddenFocus = results.violations.find(v => v.id === 'aria-hidden-focus');
    assert(!hiddenFocus, 'aria-hidden-focus presente:\n' + describe(results));
    assert(doc.getElementById('viewPlayer').inert, 'el reproductor oculto no es inert');
  });

  await test('los diálogos abiertos tienen nombre accesible y aria-modal', async () => {
    App.openSheet('sheetSettings');
    await wait(40);
    const panel = doc.querySelector('#sheetSettings .sheet-panel');
    eq(panel.getAttribute('role'), 'dialog');
    eq(panel.getAttribute('aria-modal'), 'true');
    const labelled = panel.getAttribute('aria-label') || panel.getAttribute('aria-labelledby');
    assert(labelled && doc.getElementById(labelled), 'diálogo sin nombre accesible resoluble');
    App.closeAllSheets();
  });

  await test('los botones de la barra tienen nombre accesible', () => {
    const bad = [...doc.querySelectorAll('.bottom-nav .nav-btn')].filter(b => {
      const name = b.getAttribute('aria-label') || b.textContent.trim();
      return !name;
    });
    eq(bad.length, 0, 'botones de nav sin nombre');
  });

  close();
  const ok = summary();
  process.exit(ok ? 0 : 1);
})().catch(e => {
  console.error('Error fatal en a11y:', e);
  process.exit(1);
});
