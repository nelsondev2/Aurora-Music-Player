/* =====================================================================
 *  tests/e2e/flow.test.js
 *  Recorridos de extremo a extremo sobre la app real (index.html +
 *  scripts) en jsdom: onboarding, importación de audio, reproducción,
 *  favoritos, creación de listas, búsqueda y exportación.
 *
 *  No hay Chromium en el sandbox: jsdom cubre DOM, eventos, IndexedDB
 *  (fake) y los mismos módulos que usa el navegador. Lo que jsdom no
 *  puede validar (layout real, códecs, Web Audio) se audita aparte.
 * ===================================================================== */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, waitFor } = require('../helpers/dom-env');

/* Crea un File de jsdom con bytes válidos de relleno (ID3 vacío). */
function makeAudioFile(w, name, size = 2048) {
  const bytes = new Uint8Array(size);
  bytes[0] = 0x49; bytes[1] = 0x44; bytes[2] = 0x33; // "ID3"
  return new w.File([bytes], name, { type: 'audio/mpeg' });
}

function click(w, el) {
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
}

test('e2e: onboarding → importar → reproducir → favorito → lista', async (t) => {
  // El arnés fija aurora_lang por comodidad en el resto de suites; para
  // probar el primer arranque hay que borrarla antes de cargar los scripts.
  const env = await boot({ beforeScripts: (w) => w.localStorage.removeItem('aurora_lang') });
  t.after(env.close);
  const { App, window: w } = env;
  const doc = w.document;

  // 1. Primer arranque: el onboarding de idioma es obligatorio (init lo
  // programa con 350 ms de retraso para no competir con el arranque).
  const onboarding = doc.getElementById('sheetLanguage');
  await waitFor(() => onboarding.classList.contains('open'), 3000);
  assert.ok(onboarding.classList.contains('open'), 'el onboarding debe abrirse');
  assert.ok(onboarding.classList.contains('onboarding'));
  // El click en el backdrop no lo cierra (se debe elegir idioma).
  click(w, onboarding.querySelector('.sheet-backdrop'));
  assert.ok(onboarding.classList.contains('open'), 'el onboarding no debe cerrarse por backdrop');

  // 2. Elegir español en la lista real.
  const esOption = doc.querySelector('#langList li[data-lang="es"]') ||
    Array.from(doc.querySelectorAll('#langList li')).find((li) =>
      /es/i.test(li.dataset.lang || '') || /Español/i.test(li.textContent));
  assert.ok(esOption, 'debe existir la opción de español');
  click(w, esOption);
  assert.equal(onboarding.classList.contains('open'), false, 'el onboarding se cierra al elegir');
  assert.equal(w.localStorage.getItem('aurora_lang'), 'es');

  // 3. Importar dos archivos de audio (ruta real del uploader).
  await App.handleFileInput([
    makeAudioFile(w, 'Primera Cancion.mp3'),
    makeAudioFile(w, 'Artista - Segunda Cancion.mp3')
  ]);
  assert.equal(App.tracks.length, 2, 'deben importarse 2 pistas');

  // 4. La biblioteca lista las pistas.
  App.openSheet('sheetLibrary');
  App.renderLibrary();
  const rows = doc.querySelectorAll('#libraryTracks .track-row');
  assert.equal(rows.length, 2);

  // 5. Click en la fila: reproduce y actualiza el mini-player.
  click(w, rows[0]);
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(App.currentTrack, 'debe haber pista actual');
  assert.equal(App.isPlaying, true, 'al pulsar la fila debe reproducir');
  assert.notEqual(doc.getElementById('miniPlayerTitle').textContent, '—');

  // 6. Favorito desde el botón de corazón de Now Playing.
  App.closeSheet('sheetLibrary');
  App.openNowPlaying();
  click(w, doc.getElementById('btnLike'));
  assert.equal(App.favorites.has(App.currentTrack.id), true, 'la pista debe quedar favorita');

  // 7. Crear una lista desde el sheet real.
  App.openCreatePlaylistSheet();
  doc.getElementById('playlistName').value = 'Mi lista E2E';
  click(w, doc.getElementById('btnSavePlaylist'));
  await new Promise((r) => setTimeout(r, 20));
  const created = App.playlists.find((p) => p.name === 'Mi lista E2E');
  assert.ok(created, 'la lista debe crearse');

  // 8. Exportar: la descarga se genera con un Blob y un <a download>.
  App.tracks.forEach((tr) => { tr._needsRelink = false; });
  let created_url = null;
  const origCreate = w.URL.createObjectURL;
  w.URL.createObjectURL = (blob) => { created_url = blob; return 'blob:e2e'; };
  const origClick = w.HTMLAnchorElement.prototype.click;
  let downloaded = null;
  w.HTMLAnchorElement.prototype.click = function () { downloaded = this.download; };
  try {
    await App.exportLibrary();
  } finally {
    w.URL.createObjectURL = origCreate;
    w.HTMLAnchorElement.prototype.click = origClick;
  }
  assert.equal(downloaded, 'aurora-backup.json');
  assert.ok(created_url && created_url.type === 'application/json');
});

test('e2e: búsqueda con debounce filtra la biblioteca', async (t) => {
  const env = await boot();
  t.after(env.close);
  const { App, window: w } = env;
  const doc = w.document;

  await App.handleFileInput([
    makeAudioFile(w, 'Alpha Song.mp3'),
    makeAudioFile(w, 'Beta Tune.mp3')
  ]);

  App.openSheet('sheetSearch');
  const input = doc.getElementById('searchInput');
  input.value = 'alpha';
  input.dispatchEvent(new w.Event('input', { bubbles: true }));
  // El handler tiene debounce de 150 ms.
  await waitFor(() => {
    const rows = doc.querySelectorAll('#searchResults .track-row, #searchResults .search-result');
    return rows.length === 1;
  }, 3000);
  const text = doc.getElementById('searchResults').textContent.toLowerCase();
  assert.ok(text.includes('alpha'));
  assert.equal(text.includes('beta'), false);
});

test('e2e: cambio de tema y acento se refleja y persiste', async (t) => {
  const env = await boot();
  t.after(env.close);
  const { App, window: w } = env;
  const root = w.document.documentElement;

  App.setTheme('light');
  assert.equal(root.getAttribute('data-theme'), 'light');
  assert.equal(w.localStorage.getItem('aurora_theme'), 'light');

  const accents = Object.keys(App.ACCENTS || {});
  assert.ok(accents.length > 0, 'debe haber acentos');
  const accent = accents[0];
  App.setAccent(accent);
  assert.equal(root.getAttribute('data-accent'), accent);
  assert.equal(w.localStorage.getItem('aurora_accent'), accent);
});
