/* =====================================================================
 *  test/backup.test.mjs — la copia lleva la música y vuelve vinculada
 *
 *  Lo que se prueba aquí es justo lo que hace falta para que restaurar
 *  sirva de algo: que el audio viaje dentro del archivo, que al
 *  restaurar se escriba en el almacén con el mismo id (sin volver a
 *  cargar nada del dispositivo) y que restaurar no borre lo que ya hay.
 * ===================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, makeTrack, setLibrary } from './helpers/app.mjs';

const esBlob = (v) => !!v && Object.prototype.toString.call(v) === '[object Blob]';

function pistaConAudio(id, bytes, over = {}) {
  return makeTrack(id, {
    hasAudio: true,
    fileBlob: new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' }),
    fileSize: bytes.length,
    ...over,
  });
}

/** Crea una copia y la devuelve como el archivo que llega al input. */
async function copiaDe(App, window) {
  const blob = await App.buildBackup();
  assert.ok(blob && blob.size > 0, 'la copia tiene contenido');
  return new window.File([blob], App.backupFileName(), { type: 'application/x-aurora-backup' });
}

test('la copia se crea, se lee y trae el audio dentro', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    setLibrary(App, [pistaConAudio('b1', [1, 2, 3]), pistaConAudio('b2', [4, 5])]);
    App.playlists = [{ id: 'pl1', name: 'Viaje', trackIds: ['b1', 'b2'] }];
    App.favorites = new Set(['b2']);

    const file = await copiaDe(App, window);
    const data = await App.parseBackup(file);

    assert.equal(data.header.tracks.length, 2);
    assert.equal(data.header.blobs.length, 2, 'los dos audios viajan dentro');
    assert.ok(data.hasAudio);
    const blob = data.blobFor('b1');
    assert.ok(esBlob(blob));
    assert.equal(blob.size, 3);
  } finally { teardown(); }
});

test('restaurar en una app vacía devuelve las canciones ya vinculadas', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    setLibrary(App, [pistaConAudio('b1', [1, 2, 3]), pistaConAudio('b2', [4, 5])]);
    App.playlists = [{ id: 'pl1', name: 'Viaje', trackIds: ['b1', 'b2'] }];
    App.favorites = new Set(['b2']);
    const file = await copiaDe(App, window);

    // Como si fuera otra instalación: biblioteca y listas vacías.
    setLibrary(App, []);
    App.playlists = [];
    App.favorites = new Set();

    const info = await App.importBackup(file);

    assert.equal(info.tracks, 2);
    assert.equal(info.playlists, 1);
    assert.equal(App.tracks.length, 2);
    const b1 = App.tracks.find((t) => t.id === 'b1');
    assert.equal(b1.hasAudio, true, 'la pista sabe que tiene audio');
    //  Ojo: el Blob del window de jsdom no sobrevive al clonado de
    //  fake-indexeddb (vuelve como objeto plano); en un navegador real sí.
    //  Que el lector devuelva un Blob de verdad ya se comprueba arriba.
    const audio = await window.AuroraStorage.getBlob('b1');
    assert.ok(audio, 'el audio está en el almacén');

    // Y se puede reproducir sin volver a cargar el archivo del dispositivo:
    // el camino real es hidratar el Blob del almacén y pedir su URL.
    assert.equal(await App.ensureTrackBlob(b1), true);
    const url = App.getTrackUrl(b1);
    assert.match(String(url), /^blob:/);

    const pl = App.playlists.find((p) => p.name === 'Viaje');
    //  join() y no deepEqual: el array nace en el realm de jsdom.
    assert.equal(pl.trackIds.join(','), 'b1,b2');
    assert.ok(App.favorites.has('b2'), 'los favoritos vuelven');
  } finally { teardown(); }
});

test('restaurar no borra lo que ya está en la biblioteca', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    setLibrary(App, [pistaConAudio('b1', [1, 2, 3])]);
    App.playlists = [{ id: 'pl1', name: 'Viaje', trackIds: ['b1'] }];
    const file = await copiaDe(App, window);

    // Instalación que ya tiene otra canción y una lista con el mismo nombre.
    setLibrary(App, [pistaConAudio('propia', [9])]);
    App.playlists = [{ id: 'pl1', name: 'Viaje', trackIds: ['propia'] }];
    App.favorites = new Set(['propia']);

    const info = await App.importBackup(file);

    assert.equal(info.tracks, 1, 'solo entra la que faltaba');
    assert.ok(App.tracks.some((t) => t.id === 'propia'), 'lo propio sigue ahí');
    assert.ok(App.tracks.some((t) => t.id === 'b1'));
    const pl = App.playlists.find((p) => p.id === 'pl1');
    assert.deepEqual(pl.trackIds, ['propia', 'b1'], 'la lista se completa, no se pisa');
    assert.ok(App.favorites.has('propia'), 'los favoritos no se pierden');
    assert.ok(App.favorites.has('b1') === false, 'la copia no marcaba b1 como favorita');
  } finally { teardown(); }
});

test('una copia sin audio restaura las listas y lo dice', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    setLibrary(App, [makeTrack('sin', { hasAudio: false, fileBlob: undefined })]);
    const file = await copiaDe(App, window);
    const data = await App.parseBackup(file);
    assert.equal(data.hasAudio, false);
    assert.equal(data.header.blobs.length, 0);

    setLibrary(App, []);
    await App.importBackup(file);
    const t = App.tracks.find((x) => x.id === 'sin');
    assert.ok(t, 'la pista vuelve');
    assert.equal(t.hasAudio, false, 'pero sin audio, y lo dice');
  } finally { teardown(); }
});

test('un archivo que no es una copia se rechaza', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const malo = new window.File([new window.Blob(['hola, esto no es una copia'])], 'x.aurora');
    await assert.rejects(() => App.parseBackup(malo), /no es una copia/);

    // Cabecera correcta pero JSON imposible.
    const roto = new window.File([App.BACKUP_MAGIC + '999999999\n{}'], 'y.aurora');
    await assert.rejects(() => App.parseBackup(roto));
  } finally { teardown(); }
});
