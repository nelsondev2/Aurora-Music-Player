/* =====================================================================
 *  test/storage.test.mjs — el audio vive aparte de sus metadatos
 *
 *  Desde la 1.3 los registros de "tracks" solo llevan metadatos y el
 *  audio se guarda en el almacén "blobs". Lo que se prueba aquí es lo
 *  que hace falta para que eso sea cierto de verdad: que al guardar no
 *  se cuele el Blob, que al reabrir la biblioteca no se cargue nada de
 *  audio, que reproducir lo traiga cuando toca, que borrar no deje
 *  huérfanos y que las bibliotecas antiguas se migren una sola vez.
 * ===================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, makeTrack, setLibrary } from './helpers/app.mjs';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/* El Blob que devuelve el almacén es un Blob de verdad (clonado), no el
 * del window de jsdom: se comprueba por su forma, no por la clase. */
const esBlob = (v) => !!v && Object.prototype.toString.call(v) === '[object Blob]';

/* Blob de audio de mentira con contenido reconocible. Se usa el Blob
 * de Node, no el del window de jsdom: fake-indexeddb no sabe clonar el
 * segundo y devolvería un objeto plano (con el de Node sí, igual que el
 * navegador real con sus Blobs nativos). */
function audioFalso(bytes = [1, 2, 3, 4]) {
  return new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' });
}

test('al guardar, el audio va a su propio almacén y no dentro de la pista', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const blob = audioFalso();
    const pista = makeTrack('s1', { fileBlob: undefined, _file: blob });
    App.tracks = [pista];

    assert.equal(await App.persistTrack(pista), true);

    const guardada = (await window.AuroraStorage.getAllTracks()).find((t) => t.id === 's1');
    assert.ok(guardada, 'la pista se guarda');
    assert.equal('fileBlob' in guardada, false, 'el Blob no puede viajar dentro del registro');
    assert.equal(guardada.hasAudio, true, 'queda constancia de que hay audio guardado');
    assert.equal(guardada.hasOwnProperty('_file'), false, 'el File de la sesión no se persiste');

    const audio = await window.AuroraStorage.getBlob('s1');
    assert.ok(esBlob(audio), 'el audio está en el almacén de blobs');
    assert.equal(audio.size, blob.size);
  } finally { teardown(); }
});

test('reabrir la biblioteca no carga el audio de las pistas', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const pista = makeTrack('s2', { fileBlob: undefined, _file: audioFalso(
      [9, 9]) });
    App.tracks = [pista];
    await App.persistTrack(pista);

    // Como si se cerrara y volviera a abrir la app.
    App.tracks = [];
    App.releaseAllUrls();
    await App.loadAllFromStorage();

    assert.equal(App.tracks.length, 1);
    const t = App.tracks[0];
    assert.equal(t.hasAudio, true);
    assert.equal(t.fileBlob, undefined, 'ningún Blob en memoria tras el arranque');
    assert.equal(t._file, undefined);
  } finally { teardown(); }
});

test('reproducir trae el audio del almacén y suena', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const pista = makeTrack('s3', { fileBlob: undefined, _file: audioFalso() });
    App.tracks = [pista];
    await App.persistTrack(pista);

    // Estado de arranque: metadatos en memoria, sin audio.
    App.tracks = [];
    App.releaseAllUrls();
    await App.loadAllFromStorage();
    setLibrary(App, App.tracks);

    App.playTrack('s3', { type: 'all' });
    // loadAndPlay() espera la lectura del Blob: se deja terminar.
    for (let i = 0; i < 40 && !(App.audio.src || '').startsWith('blob:'); i++) {
      await esperar(10);
    }

    assert.equal(App.currentTrack.id, 's3');
    assert.match(String(App.audio.src), /^blob:/, 'el <audio> recibió una URL del audio guardado');
    assert.ok(esBlob(App.currentTrack.fileBlob), 'el Blob se quedó en memoria para reutilizarlo');
  } finally { teardown(); }
});

test('una pista sin audio guardado no se queda colgada', async () => {
  const { App, teardown } = await bootApp();
  try {
    // hasAudio miente: no hay Blob detrás. Debe resolver a false y
    // limpiar la bandera, no rechazar ni colgarse.
    const pista = makeTrack('s4', { fileBlob: undefined, hasAudio: true });
    App.tracks = [pista];
    const ok = await App.ensureTrackBlob(pista);
    assert.equal(ok, false);
    assert.equal(pista.hasAudio, false, 'la bandera se corrige para no reintentar siempre');
    assert.equal(App.getTrackUrl(pista), null);
  } finally { teardown(); }
});

test('borrar una pista se lleva también su audio', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const pista = makeTrack('s5', { fileBlob: undefined, _file: audioFalso() });
    App.tracks = [pista];
    await App.persistTrack(pista);
    assert.ok(await window.AuroraStorage.getBlob('s5'));

    await window.AuroraStorage.deleteTrack('s5');

    assert.equal(await window.AuroraStorage.getBlob('s5'), undefined,
      'el audio no puede quedarse ocupando espacio sin dueño');
    assert.equal((await window.AuroraStorage.getAllTracks()).length, 0);
  } finally { teardown(); }
});

test('vaciar la biblioteca vacía también el almacén de audio', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const pista = makeTrack('s6', { fileBlob: undefined, _file: audioFalso() });
    App.tracks = [pista];
    await App.persistTrack(pista);

    await window.AuroraStorage.clearTracks();

    assert.equal(await window.AuroraStorage.getBlob('s6'), undefined);
  } finally { teardown(); }
});

test('la migración saca el audio de los registros antiguos una sola vez', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const Storage = window.AuroraStorage;
    const blob = audioFalso([7, 7, 7]);
    // Registro con la forma anterior a la 1.3: el audio dentro.
    const antigua = makeTrack('vieja', { fileBlob: blob });
    await Storage.putTrack(antigua);
    // Nadie ha migrado todavía (el arranque limpio no tenía nada que mover).
    await Storage.setSetting('blob_store_v2', false);

    const movidas = await Storage.migrateBlobsToStore();
    assert.equal(movidas, 1, 'se mueve el audio de la pista antigua');

    const guardada = await Storage.getTrack('vieja');
    assert.equal('fileBlob' in guardada, false, 'el registro queda sin audio');
    assert.equal(guardada.hasAudio, true);
    assert.equal(guardada.title, antigua.title, 'los metadatos se conservan');
    const audio = await Storage.getBlob('vieja');
    assert.ok(esBlob(audio));
    assert.equal(audio.size, blob.size);

    assert.equal(await Storage.migrateBlobsToStore(), 0, 'no se repite en cada arranque');
  } finally { teardown(); }
});

test('la precarga y el cambio sin pausa no se rompen sin audio en memoria', async () => {
  const { App, teardown } = await bootApp();
  try {
    // Tres pistas con audio guardado pero sin Blob en memoria: el
    // camino de precarga debe pedirlo y no lanzar excepciones.
    const pistas = [1, 2, 3].map((i) => makeTrack('p' + i, { fileBlob: undefined, hasAudio: false }));
    setLibrary(App, pistas);
    App._gaplessEnabled = true;

    assert.doesNotThrow(() => App.preloadNextTrack());
    App.queue = ['p1', 'p2'];
    App.queueIdx = 0;
    App._gaplessEnabled = true;
    assert.equal(App.gaplessNext(), false, 'sin audio no hay empalme, pero tampoco error');
  } finally { teardown(); }
});
