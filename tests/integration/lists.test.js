/* =====================================================================
 *  tests/integration/lists.test.js
 *  Cola (añadir / reproducir siguiente / radio), listas (crear, limitar,
 *  rechazar duplicados, reordenar, quitar) y estadísticas.
 * ===================================================================== */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('../helpers/dom-env');

function seedTracks(App) {
  App.tracks = [
    { id: 'a', title: 'Alfa', artist: 'Ana', album: 'Uno', duration: 100, fileName: 'a.mp3', fileSize: 1 },
    { id: 'b', title: 'Beta', artist: 'Ana', album: 'Dos', duration: 110, fileName: 'b.mp3', fileSize: 2 },
    { id: 'c', title: 'Gamma', artist: 'Beto', album: 'Uno', duration: 120, fileName: 'c.mp3', fileSize: 3 },
    { id: 'd', title: 'Delta', artist: 'Carla', album: 'Tres', duration: 130, fileName: 'd.mp3', fileSize: 4 }
  ];
}

test('cola: addToQueue añade al final y playNext justo después de la actual', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  seedTracks(A);
  A.currentTrack = A.tracks[0];
  A.queue = ['a', 'b', 'c'];
  A.queueIdx = 1; // suena "b"

  A.addToQueue('d');
  assert.deepEqual([...A.queue], ['a', 'b', 'c', 'd']);

  A.playNext('c');
  assert.deepEqual([...A.queue], ['a', 'b', 'c', 'c', 'd']);
  assert.equal(A.queue[A.queueIdx + 1], 'c', 'la siguiente debe ser la insertada');
});

test('cola: playNext con shuffle también actualiza la cola original', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  seedTracks(A);
  A.currentTrack = A.tracks[1];
  A.queue = ['b', 'a', 'c'];
  A.queueIdx = 0;
  A.shuffle = true;
  A._originalQueue = ['a', 'b', 'c'];

  A.playNext('d');
  assert.deepEqual([...A._originalQueue], ['a', 'b', 'd', 'c']);
});

test('radio: la semilla va primera y prioriza mismo artista/álbum', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  seedTracks(A);
  A.playFromQueue = () => {};
  A.startRadio('a');

  assert.equal(A.queue[0], 'a', 'la semilla debe sonar primero');
  assert.equal(new Set(A.queue).size, A.queue.length, 'sin duplicados');
  assert.equal(A.queue.length, 4);
  // "b" comparte artista con la semilla: debe ir antes que "d" (otro artista/álbum).
  assert.ok(A.queue.indexOf('b') < A.queue.indexOf('d'));
  assert.equal(A.playContext.type, 'radio');
});

test('listas: createPlaylist valida nombre, duplicados y pistas inexistentes', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  seedTracks(A);
  A.renderPlaylists = () => {};
  A.persistPlaylist = () => Promise.resolve(true);

  const name = '  ' + 'x'.repeat(120) + '  ';
  const pl = A.createPlaylist(name, 'desc\ncon salto', ['a', 'no-existe']);
  assert.equal(pl.name.length, 80);
  assert.equal(pl.description, 'desc con salto');
  assert.deepEqual([...pl.trackIds], ['a']);

  // Duplicado case-insensitive (se compara en minúsculas y sin espacios).
  assert.equal(A.createPlaylist('   ' + pl.name.toUpperCase() + '  ', '', []), null);

  // Nombre vacío usa el título por defecto.
  const pl2 = A.createPlaylist('', '', []);
  assert.ok(pl2 && pl2.name.length > 0);
});

test('listas: reorder y removeFromPlaylist respetan índices y persistencia', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  seedTracks(A);
  A.renderEditPlaylist = () => {};
  A.renderQueue = () => {};
  A._updatePlaylistMeta = () => {};
  A.persistPlaylist = () => Promise.resolve(true);

  const pl = A.createPlaylist('Lista', '', ['a', 'b', 'c']);
  A.reorderPlaylistTracks(pl.id, 0, 2);
  assert.deepEqual([...pl.trackIds], ['b', 'c', 'a']);

  // Índices fuera de rango no deben alterar la lista.
  A.reorderPlaylistTracks(pl.id, 0, 99);
  assert.deepEqual([...pl.trackIds], ['b', 'c', 'a']);

  A.removeFromPlaylist(pl.id, 'c');
  assert.deepEqual([...pl.trackIds], ['b', 'a']);
  A.removeFromPlaylist(pl.id, 'c'); // idempotente
  assert.deepEqual([...pl.trackIds], ['b', 'a']);
});

test('estadísticas: renderStats y resetStats', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  seedTracks(A);
  A.stats = { plays: { a: 5, b: 2, c: 1 }, totalSeconds: 3600 };
  A.openSheet('sheetStats');
  A.renderStats();

  const txt = env.window.document.getElementById('statsContent').textContent;
  assert.ok(txt.includes('8'), 'debe mostrar el total de reproducciones');
  assert.ok(txt.includes('Ana'), 'debe listar la artista con más reproducciones');

  await A.resetStats();
  // Objeto creado en el realm de jsdom: copiar antes de comparar.
  assert.deepEqual({ ...A.stats.plays }, {});
  assert.equal(A.stats.totalSeconds, 0);
});

test('selector de archivos: el input se retira al cancelar', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  const w = env.window;
  A.openFilePicker(false);
  const inputs = w.document.querySelectorAll('input[type="file"]');
  const input = inputs[inputs.length - 1];
  assert.ok(input && input.isConnected, 'el input debe estar en el DOM mientras el diálogo vive');
  input.dispatchEvent(new w.Event('cancel'));
  assert.equal(w.document.body.contains(input), false, 'al cancelar debe retirarse');
});

test('listas: el selector de pistas (openAddTracksSheet) marca y desmarca', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  seedTracks(A);
  A.renderPlaylists = () => {};
  A.persistPlaylist = () => Promise.resolve(true);
  const pl = A.createPlaylist('Con pistas', '', []);

  A.openAddTracksSheet(pl.id);
  const doc = env.window.document;
  const list = doc.getElementById('pickTracksList');
  assert.equal(list.querySelectorAll('.pick-row').length, 4);
  assert.equal(doc.getElementById('createPlaylistFields').style.display, 'none');
  assert.ok(doc.getElementById('pickTracksSection').style.display !== 'none');
  assert.ok(doc.getElementById('createPlaylistTitle').textContent.includes('Con pistas'));

  const first = list.querySelector('.pick-row');
  first.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }));
  assert.ok(first.classList.contains('checked'));
  first.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }));
  assert.equal(first.classList.contains('checked'), false);
});
