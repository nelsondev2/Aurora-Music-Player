'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, waitFor } = require('../helpers/dom-env');

function seed(env) {
  const A = env.App;
  A.tracks = [
    { id: 'a', title: 'A', artist: 'X', album: 'Alb', duration: 100, src: 'blob:mock/a' },
    { id: 'b', title: 'B', artist: 'X', album: 'Alb', duration: 110, src: 'blob:mock/b' },
    { id: 'c', title: 'C', artist: 'Y', album: 'Otro', duration: 120, src: 'blob:mock/c' }
  ];
  A.invalidateTrackIndex();
  A.queue = ['a', 'b', 'c'];
  A.queueIdx = 0;
  A.currentTrack = A.tracks[0];
  A.currentTrackIdx = 0;
  return A;
}

test('playTrack carga la pista y reproduce', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = seed(env);
  A.playTrack('b');
  await waitFor(() => A.isPlaying === true, 2000);
  assert.equal(A.currentTrack.id, 'b');
  assert.equal(A.queueIdx, 1);
  assert.equal(A.audio.src, 'blob:mock/b');
  assert.equal(A.audio.paused, false);
});

test('playTrack desde playlist inserta la pista si ya no está en la lista', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = seed(env);
  const pl = A.playlists[0];
  pl.trackIds = ['a'];
  A.playTrack('c', { type: 'playlist', id: pl.id, name: pl.name });
  assert.equal(A.currentTrack.id, 'c');
  assert.equal(A.queue[0], 'c');
  assert.equal(A.queueIdx, 0);
});

test('seekTo ignora NaN/Infinity y hace clamp 0..1', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = seed(env);
  A.audio.__duration = 100;
  assert.doesNotThrow(() => A.seekTo(NaN));
  assert.doesNotThrow(() => A.seekTo(Infinity));
  assert.equal(A.audio.currentTime, 0);
  A.seekTo(2);
  assert.equal(A.audio.currentTime, 100);
  A.seekTo(-1);
  assert.equal(A.audio.currentTime, 0);
  A.seekTo(0.5);
  assert.equal(A.audio.currentTime, 50);
});

test('seekToTime ignora valores no numéricos', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = seed(env);
  A.audio.__duration = 100;
  A.seekToTime(20);
  assert.equal(A.audio.currentTime, 20);
  A.seekToTime(NaN);
  assert.equal(A.audio.currentTime, 20);
  A.seekToTime(500);
  assert.ok(A.audio.currentTime <= 100);
  assert.ok(A.audio.currentTime >= 99.9);
});

test('setVolume ignora NaN y limita 0..1', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = seed(env);
  A.setVolume(0.5);
  assert.equal(A.volume, 0.5);
  assert.equal(A.audio.volume, 0.5);
  A.setVolume(NaN);
  assert.equal(A.volume, 0.5);
  A.setVolume(99);
  assert.equal(A.volume, 1);
  A.setVolume(-3);
  assert.equal(A.volume, 0);
});

test('next/prev respetan repeat=off y repeat=all', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = seed(env);
  A.repeat = 'off';
  A.queueIdx = 2;
  assert.equal(A._nextQueueIndex(true), null);
  A.repeat = 'all';
  assert.equal(A._nextQueueIndex(true), 0);
  A.repeat = 'off';
  assert.equal(A._nextQueueIndex(false), 0, 'manual siempre vuelve al inicio');
});

test('shuffle baraja y restore devuelve el orden original', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = seed(env);
  A.currentTrack = A.tracks[1];
  A.queueIdx = 1;
  A.toggleShuffle();
  assert.equal(A.shuffle, true);
  assert.equal(A.queue[0], 'b', 'la pista actual queda primero');
  assert.deepEqual([...A._originalQueue], ['a', 'b', 'c']);
  A.toggleShuffle();
  assert.equal(A.shuffle, false);
  assert.deepEqual([...A.queue], ['a', 'b', 'c']);
  assert.equal(A.queue[A.queueIdx], 'b');
});

test('repeat one reinicia la misma pista al terminar', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = seed(env);
  A.repeat = 'one';
  A.playTrack('a');
  await waitFor(() => A.isPlaying, 2000);
  A.audio.__currentTime = 99;
  A.next(true);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(A.currentTrack.id, 'a');
  assert.equal(A.audio.currentTime, 0);
});

test('A-B repeat: fija A, fija B, hace bucle y limpia', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = seed(env);
  A.playTrack('a');
  await waitFor(() => A.isPlaying, 2000);
  A.audio.__currentTime = 10;
  A.toggleABRepeat();
  assert.equal(A.abRepeat.a, 10);
  assert.equal(A.abRepeat.b, null);
  A.audio.__currentTime = 20;
  A.toggleABRepeat();
  assert.equal(A.abRepeat.active, true);
  assert.equal(A.abRepeat.b, 20);
  // Simula que el tiempo sobrepasa B: updateProgress corrige a A.
  A.audio.__currentTime = 25;
  A.updateProgress();
  assert.ok(A.audio.currentTime < 21, 'debe volver al punto A');
  A.toggleABRepeat();
  assert.equal(A.abRepeat.active, false);
  assert.equal(A.abRepeat.a, null);
});

test('A-B repeat no hace nada sin pista cargada', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  const toasts = [];
  A.toast = (m) => toasts.push(m);
  A.toggleABRepeat();
  assert.equal(A.abRepeat.a, null);
  assert.equal(toasts.length, 1);
});

test('crossfade no salta dos pistas si ended llega antes que el timer', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = seed(env);
  let nextCalls = 0;
  const realNext = A.next.bind(A);
  A.next = (...args) => { nextCalls++; return realNext(...args); };
  A.playTrack('a');
  await waitFor(() => A.isPlaying, 2000);
  A._xfadeStarted = true;
  A._xfadeTimer = setTimeout(() => {}, 5000);
  A.audio.dispatchEvent(new env.window.Event('ended'));
  assert.equal(nextCalls, 1);
  assert.equal(A._xfadeTimer, null, 'el timer debe cancelarse');
  assert.equal(A.currentTrack.id, 'b');
});

test('gaplessNext respeta repeat one y crossfade', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = seed(env);
  A._gaplessEnabled = true;
  A.repeat = 'one';
  assert.equal(A.gaplessNext(), false);
  A.repeat = 'off';
  A.crossfadeEnabled = true;
  A.crossfadeDuration = 3;
  assert.equal(A.gaplessNext(), false);
});

test('stopPlayback pausa y reinicia la barra', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = seed(env);
  A.playTrack('b');
  await waitFor(() => A.isPlaying, 2000);
  A.audio.__currentTime = 30;
  A.stopPlayback();
  assert.equal(A.isPlaying, false);
  assert.equal(A.audio.paused, true);
  assert.equal(A.audio.currentTime, 0);
  assert.equal(env.window.document.getElementById('progressFill').style.width, '0%');
});
