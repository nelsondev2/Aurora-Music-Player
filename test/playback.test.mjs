/* =====================================================================
 *  test/playback.test.mjs — cola, aleatorio, repetición, borrado,
 *  estadísticas y sesión.
 *
 *  Son las reglas que el usuario nota cuando se rompen, y las que más
 *  fácil se estropean al tocar el reproductor.
 * ===================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, setLibrary, makeTrack } from './helpers/app.mjs';

const tres = () => [
  makeTrack('t1', { title: 'Uno', artist: 'A', rating: 5 }),
  makeTrack('t2', { title: 'Dos', artist: 'B', rating: 3 }),
  makeTrack('t3', { title: 'Tres', artist: 'A', rating: 0 }),
];

test('la cola sigue el contexto y deja el índice en la pista elegida', async () => {
  const { App, teardown } = await bootApp();
  try {
    setLibrary(App, tres());
    App.playTrack('t2', { type: 'all' });
    assert.deepEqual(App.queue, ['t1', 't2', 't3']);
    assert.equal(App.queueIdx, 1);
    assert.equal(App.currentTrack.id, 't2');
    // play() devuelve una promesa: isPlaying se enciende en el then.
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(App.isPlaying, true);
  } finally { teardown(); }
});

test('next avanza y al final de la cola se detiene (repeat off)', async () => {
  const { App, teardown } = await bootApp();
  try {
    setLibrary(App, tres());
    App.playTrack('t3', { type: 'all' });
    App.next(true);            // auto: fin de cola
    assert.equal(App.repeat, 'off');
    assert.equal(App.isPlaying, false, 'sin repetir, la reproducción debe parar');
    assert.equal(App.queueIdx, 2);
  } finally { teardown(); }
});

test('repeat all vuelve al principio y repeat one reinicia la misma', async () => {
  const { App, teardown } = await bootApp();
  try {
    setLibrary(App, tres());
    App.repeat = 'all';
    App.playTrack('t3', { type: 'all' });
    App.next(true);
    assert.equal(App.currentTrack.id, 't1');

    App.repeat = 'one';
    App.playTrack('t1', { type: 'all' });
    App.audio._ct = 120;
    App.next(true);
    assert.equal(App.currentTrack.id, 't1');
    assert.equal(App.audio.currentTime, 0);
  } finally { teardown(); }
});

test('el aleatorio ancla la pista elegida, no duplica y se puede deshacer', async () => {
  const { App, teardown } = await bootApp();
  try {
    setLibrary(App, tres());
    App.playTrack('t2', { type: 'all' });
    App.toggleShuffle();
    assert.equal(App.queue[0], 't2', 'la canción pulsada debe sonar primero');
    assert.equal(new Set(App.queue).size, 3, 'sin duplicados');
    assert.deepEqual(App._originalQueue, ['t1', 't2', 't3']);

    App.toggleShuffle();
    assert.deepEqual(App.queue, ['t1', 't2', 't3'], 'al desactivar vuelve el orden');
  } finally { teardown(); }
});

test('la cola de una lista respeta el orden por estrellas', async () => {
  const { App, teardown } = await bootApp();
  try {
    setLibrary(App, tres());
    App.playlists = [{ id: 'p1', name: 'P1', trackIds: ['t3', 't1', 't2'], createdAt: 1 }];
    App.playTrack('t3', { type: 'playlist', id: 'p1' });
    assert.deepEqual(App.queue, ['t1', 't2', 't3']);
    assert.equal(App.playContext.type, 'playlist');
  } finally { teardown(); }
});

test('favoritos como contexto: solo suenan los marcados', async () => {
  const { App, teardown } = await bootApp();
  try {
    setLibrary(App, tres());
    App.favorites = new Set(['t1', 't3']);
    App.playTrack('t1', { type: 'favorites' });
    assert.deepEqual(App.queue.slice().sort(), ['t1', 't3']);
  } finally { teardown(); }
});

test('borrar la canción que suena salta a otra y «Deshacer» la devuelve a la cola', async () => {
  const { App, teardown } = await bootApp();
  try {
    setLibrary(App, tres());
    App.playTrack('t2', { type: 'all' });
    await App.deleteTrack('t2');

    assert.ok(!App.tracks.some((t) => t.id === 't2'), 'salió de la biblioteca');
    assert.notEqual(App.currentTrack.id, 't2', 'no puede seguir sonando una borrada');
    assert.equal(App.isPlaying, false, 'queda en pausa, no arranca sola otra');
    assert.ok(App._pendingTrackDelete, 'hay un borrado pendiente de deshacer');

    App._undoDeleteTrack();
    assert.ok(App.tracks.some((t) => t.id === 't2'), 'vuelve a la biblioteca');
    assert.ok(App.queue.includes('t2'), 'y a la cola');
  } finally { teardown(); }
});

test('una escucha completa suma en estadísticas; a medias, no', async () => {
  const { App, teardown } = await bootApp();
  try {
    setLibrary(App, tres());
    App.stats = { plays: {}, skips: {}, totalSeconds: 0, lastPlayed: null, sessionStart: Date.now() };
    App.playTrack('t1', { type: 'all' });

    App._playCounted = false;
    App.trackPlayCompleted();
    assert.equal(App.stats.plays.t1, 1);

    // La misma escucha no cuenta dos veces (gapless + next).
    App.trackPlayCompleted();
    assert.equal(App.stats.plays.t1, 1);
  } finally { teardown(); }
});

test('la sesión se guarda y se restaura con cola, posición y contexto', async () => {
  const { App, teardown } = await bootApp();
  try {
    setLibrary(App, tres());
    App.playTrack('t2', { type: 'all' });
    App.audio._ct = 42;
    await App.saveSession();

    const restaurada = await App.restoreSession();
    assert.equal(restaurada, true);
    assert.equal(App.currentTrack.id, 't2');
    assert.equal(App.queueIdx, 1);
  } finally { teardown(); }
});

test('la caché de objectURL no crece sin límite', async () => {
  const { App, liveUrls, teardown } = await bootApp();
  try {
    const pistas = [];
    for (let i = 0; i < 40; i++) {
      pistas.push(makeTrack('c' + i, { fileBlob: { size: 10 } }));
    }
    setLibrary(App, pistas);
    for (const p of pistas) App.getTrackUrl(p);

    assert.ok(App._urlCache.size <= App._URL_CACHE_MAX,
      'la caché debe quedar acotada (tiene ' + App._urlCache.size + ')');
    assert.ok(liveUrls.size <= App._URL_CACHE_MAX + 1,
      'las URLs revocadas deben soltarse de verdad (' + liveUrls.size + ' vivas)');
  } finally { teardown(); }
});

test('los formatos de tiempo son estables', async () => {
  const { App, teardown } = await bootApp();
  try {
    assert.equal(App.fmtTime(0), '0:00');
    assert.equal(App.fmtTime(65), '1:05');
    assert.equal(App.fmtTime(600), '10:00');
    assert.match(App.fmtTime(3600), /1:00:00/);
    assert.equal(App.fmtTime(NaN), '0:00');
  } finally { teardown(); }
});
