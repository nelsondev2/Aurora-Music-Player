/* =====================================================================
 *  test/backup.test.mjs — la copia de respaldo .aurora
 *
 *  Lo que se prueba es justo lo que se rompía al mover la biblioteca
 *  entre versiones: que el archivo lleve el AUDIO, y que al restaurarlo
 *  cada canción vuelva enlazada a su audio (mismo id) y a sus listas.
 *  Además: que restaurar no borre nada, que reconozca la misma canción
 *  aunque en el destino tenga otro id (huella de contenido), y que
 *  rechace lo que no es una copia sin tocar la biblioteca.
 * ===================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, makeTrack, setLibrary } from './helpers/app.mjs';

/* Blob de Node (lo que fake-indexeddb sabe clonar, igual que un navegador
 * real con sus Blobs nativos). */
function audioFalso(bytes, type = 'audio/mpeg') {
  return new Blob([new Uint8Array(bytes)], { type });
}

/* El archivo de copia se arma con los Blob del DOM de jsdom, que
 * fake-indexeddb no sabe clonar (limitación del arnés, no de la app:
 * en un navegador el Blob nativo sí se clona). Para pasar la copia por
 * el almacén, aquí se rehace con los bytes, en el realm de Node. */
async function comoArchivoDeNodo(App, blob) {
  const bytes = await App._readBlobAsBytes(blob);
  return new Blob([bytes], { type: App.BACKUP_MIME });
}

/* Deja una biblioteca conocida: dos pistas con audio, una lista con las
 * dos, un favorito y una estrella. */
async function biblioteca({ App, window }) {
  const a = makeTrack('a1', { title: 'Uno', rating: 4, fileBlob: undefined, hasAudio: false, _file: audioFalso([1, 2, 3, 4]) });
  const b = makeTrack('b1', { title: 'Dos', fileBlob: undefined, hasAudio: false, _file: audioFalso([9, 8, 7, 6, 5]) });
  setLibrary(App, [a, b]);
  await App.persistTrack(a);
  await App.persistTrack(b);
  const pl = { id: 'pl1', name: 'Mezcla', description: '', trackIds: ['a1', 'b1'], cover: null };
  App.playlists = [pl];
  await App.persistPlaylist(pl);
  App.favorites = new Set(['b1']);
  await App.saveFavorites();
  App.stats = { plays: { a1: 3 }, skips: {}, totalSeconds: 120 };
  await App.saveStats();
  return { a, b };
}

test('la copia lleva el audio de cada pista y su manifiesto', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    await biblioteca({ App, window });

    const blob = await App.buildBackupBlob();
    assert.ok(blob && blob.size > 0, 'la copia tiene contenido');

    // Cabecera de texto + JSON: legible sin cargar los audios.
    const head = await App._readBlobAsText(blob.slice(0, 200));
    assert.match(head, /^AURORA-BACKUP 2 \d+\n/);

    const { manifest, payloadStart } = await App._parseBackup(blob);
    assert.equal(manifest.app, 'aurora-music-player');
    assert.equal(manifest.counts.tracks, 2);
    assert.equal(manifest.counts.audio, 2);
    assert.equal(manifest.counts.favorites, 1);
    // El array viene del otro realm (window.eval): se compara su contenido.
    assert.deepEqual([...manifest.favorites], ['b1']);
    assert.equal(manifest.playlists[0].name, 'Mezcla');
    assert.equal(manifest.stats.plays.a1, 3);

    // Los audios están EN CRUDO dentro del archivo, en su tramo.
    const a = manifest.tracks.find((t) => t.id === 'a1');
    assert.ok(a.audio && a.audio.length === 4, 'la pista guarda dónde está su audio');
    const bytes = await App._readBlobAsBytes(
      blob.slice(payloadStart + a.audio.offset, payloadStart + a.audio.offset + a.audio.length));
    assert.deepEqual([...bytes], [1, 2, 3, 4]);
    // Ni base64 ni compresión: el tramo ocupa exactamente lo que el audio.
    assert.equal(a.audio.length, 4);
  } finally { teardown(); }
});

test('restaurar deja cada canción enlazada a su audio y a sus listas', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    await biblioteca({ App, window });
    const copia = await App.buildBackupBlob();

    // «Otra versión»: biblioteca vacía, como al abrir un .xdc nuevo.
    setLibrary(App, []);
    await window.AuroraStorage.clearTracks();
    await window.AuroraStorage.clearPlaylists();
    App.playlists = [];

    const resumen = await App.restoreBackup(await comoArchivoDeNodo(App, copia));
    assert.equal(resumen.tracks, 2, 'vuelven las dos pistas');
    assert.equal(resumen.audio, 2, 'con su audio');
    assert.equal(App.tracks.length, 2);
    assert.equal(App.playlists.length, 1, 'vuelve la lista');

    // El enlace canción ↔ almacenamiento es lo que se perdía.
    for (const [i, id] of ['a1', 'b1'].entries()) {
      const t = App.getTrackById(id);
      assert.ok(t, 'la pista ' + id + ' está');
      assert.equal(t.hasAudio, true);
      const blob = await window.AuroraStorage.getBlob(id);
      assert.ok(blob, 'el audio de ' + id + ' está en el almacén con SU id');
      assert.equal(blob.size, [4, 5][i]);
    }

    // Y suena: el objectURL sale del blob restaurado.
    const t = App.getTrackById('a1');
    delete t.fileBlob;
    assert.equal(await App.ensureTrackBlob(t), true, 'el audio se recupera del almacén');
    assert.match(App.getTrackUrl(t), /^blob:/);

    // Listas, favoritos y estrellas vuelven.
    assert.deepEqual([...App.playlists[0].trackIds], ['a1', 'b1']);
    assert.equal(App.favorites.has('b1'), true);
    assert.equal(App._ratingOf(App.getTrackById('a1')), 4);
    assert.equal(App.stats.plays.a1, 3);
    // Y la lista restaurada apunta a pistas que existen (no hay huérfanos).
    assert.deepEqual(
      [...App.playlists[0].trackIds].filter((id) => !App.getTrackById(id)), []);
  } finally { teardown(); }
});

test('restaurar fusiona y no borra lo que ya hay', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    await biblioteca({ App, window });
    const copia = await App.buildBackupBlob();

    // En el destino ya hay otra canción (y una valoración propia).
    const propia = makeTrack('z9', { title: 'Mía', fileBlob: undefined, _file: audioFalso([42]) });
    App.tracks = [propia];
    App.invalidateTrackIndex();
    await App.persistTrack(propia);

    const archivo = await comoArchivoDeNodo(App, copia);
    const resumen = await App.restoreBackup(archivo);
    assert.equal(resumen.tracks, 2);
    assert.ok(App.getTrackById('z9'), 'lo que ya estaba sigue ahí');
    assert.equal(App.tracks.length, 3);

    // Restaurar dos veces la misma copia no duplica nada.
    const otra = await App.restoreBackup(archivo);
    assert.equal(otra.tracks, 0, 'la segunda pasada no añade pistas');
    assert.equal(App.tracks.length, 3);
    assert.equal(App.playlists.length, 1, 'tampoco duplica listas');
    assert.equal(App.stats.plays.a1, 3, 'ni infla las reproducciones');
  } finally { teardown(); }
});

test('una copia con la misma canción y otro id se reconoce por su huella', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const { a } = await biblioteca({ App, window });
    // La huella de la pista es lo que permite reconocerla luego.
    a.fp = 'huella-a1';
    await App.persistTrack(a);
    const copia = await App.buildBackupBlob();

    // En la versión nueva la misma canción se importó a mano: otro id.
    setLibrary(App, []);
    await window.AuroraStorage.clearTracks();
    const importada = makeTrack('nuevo-7', {
      title: 'Uno', fp: 'huella-a1', fileBlob: undefined, _file: audioFalso([1, 2, 3, 4])
    });
    App.tracks = [importada];
    App.invalidateTrackIndex();
    await App.persistTrack(importada);
    App.playlists = [];
    await window.AuroraStorage.clearPlaylists();

    const resumen = await App.restoreBackup(await comoArchivoDeNodo(App, copia));
    assert.equal(App.getTrackById('nuevo-7'), importada, 'no se duplica: manda la que ya está');
    assert.equal(App.tracks.filter((t) => t.title === 'Uno').length, 1);
    // La lista de la copia se reapunta a la pista que ya existía.
    const pl = App.playlists.find((p) => p.name === 'Mezcla');
    assert.ok(pl, 'la lista vuelve');
    assert.ok(pl.trackIds.includes('nuevo-7'), 'la lista apunta a la pista real');
    assert.equal(pl.trackIds.includes('a1'), false, 'no queda apuntando a un id fantasma');
    assert.ok(resumen);
  } finally { teardown(); }
});

test('se rechaza lo que no es una copia sin tocar la biblioteca', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    await biblioteca({ App, window });
    const antes = App.tracks.length;

    const basura = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);
    await assert.rejects(() => App._parseBackup(basura), /backup_error_not_backup/);

    // Copia de una versión más nueva del formato: se avisa, no se adivina.
    const futuro = new Blob(['AURORA-BACKUP 3 2\n{}']);
    await assert.rejects(() => App._parseBackup(futuro), /backup_error_version/);

    // Copia truncada (el tramo de audio se sale del archivo).
    await biblioteca({ App, window });
    const copia = await App.buildBackupBlob();
    const rota = copia.slice(0, copia.size - 3);
    await assert.rejects(() => App._parseBackup(rota), /backup_error_corrupt/);

    assert.equal(App.tracks.length, antes, 'la biblioteca no se tocó');
  } finally { teardown(); }
});

test('importar desde Ajustes: elige el archivo nativo, confirma y restaura', async () => {
  const { App, window, teardown } = await bootApp({ lang: 'es' });
  try {
    await biblioteca({ App, window });
    const copia = await App.buildBackupBlob();

    setLibrary(App, []);
    await window.AuroraStorage.clearTracks();
    const file = await comoArchivoDeNodo(App, copia);
    let pedido = null;
    // Delta Chat: webxdc.importFiles es el selector del cliente.
    window.webxdc = {
      importFiles: async (filter) => { pedido = filter; return [file]; },
      sendToChat: async () => {}
    };
    App.showConfirm = async () => true;

    const ok = await App.importBackup();
    assert.equal(ok, true, 'la restauración se completó');
    assert.deepEqual([...pedido.extensions], ['.aurora'], 'se filtra por la extensión de la copia');
    assert.equal(App.tracks.length, 2);
    const t = App.getTrackById('a1');
    assert.equal(t.hasAudio, true);
    assert.ok(await window.AuroraStorage.getBlob('a1'));
  } finally {
    delete window.webxdc;
    teardown();
  }
});

test('«Crear copia» la manda al chat con sendToChat', async () => {
  const { App, window, teardown } = await bootApp({ lang: 'es' });
  try {
    await biblioteca({ App, window });
    const enviados = [];
    window.webxdc = {
      sendToChat: async (msg) => { enviados.push(msg); }
    };
    const ok = await App.exportBackup();
    assert.equal(ok, true);
    assert.equal(enviados.length, 1, 'sale exactamente un mensaje');
    assert.match(enviados[0].file.name, /^aurora-\d{4}-\d{2}-\d{2}-\d{4}\.aurora$/);
    // Lo enviado ES el archivo de copia, con su cabecera.
    const cabeza = await App._readBlobAsText(enviados[0].file.blob.slice(0, 16));
    assert.match(cabeza, /^AURORA-BACKUP 2/);
    assert.match(enviados[0].text, /Copia de respaldo de Aurora/);
  } finally {
    delete window.webxdc;
    teardown();
  }
});

test('una copia elegida con el «+» se restaura en vez de importarse como música', async () => {
  const { App, window, teardown } = await bootApp({ lang: 'es' });
  try {
    await biblioteca({ App, window });
    const copia = await App.buildBackupBlob();

    setLibrary(App, []);
    await window.AuroraStorage.clearTracks();
    const archivo = await comoArchivoDeNodo(App, copia);
    // nombre de la copia, no de una canción
    archivo.name = 'aurora-2026-11-15-1200.aurora';
    App.showConfirm = async () => true;

    await App.handleFileInput([archivo], false, null);
    assert.equal(App.tracks.length, 2, 'la biblioteca volvió');
    assert.equal(App.getTrackById('a1').hasAudio, true);
    assert.equal(App._importing, false, 'la bandera de importación queda libre');
  } finally { teardown(); }
});

test('ida y vuelta por el chat: la copia sale con sendToChat y vuelve con importFiles', async () => {
  // El escenario que se rompía: crear la copia en una instancia, enviarla
  // al chat y restaurarla en OTRA instancia (otra versión, otro teléfono).
  const A = await bootApp({ lang: 'es' });
  let bytes = null;
  let nombre = null;
  try {
    const enviados = [];
    A.window.webxdc = { sendToChat: async (m) => { enviados.push(m); } };
    const uno = makeTrack('a1', { title: 'Uno', fileBlob: undefined, hasAudio: false, _file: audioFalso([1, 2, 3, 4, 5]) });
    const dos = makeTrack('b1', { title: 'Dos', fileBlob: undefined, hasAudio: false, _file: audioFalso([7, 7, 7]) });
    setLibrary(A.App, [uno, dos]);
    await A.App.persistTrack(uno);
    await A.App.persistTrack(dos);
    const pl = { id: 'p1', name: 'Favoritas', description: '', trackIds: ['a1', 'b1'], cover: null };
    A.App.playlists = [pl];
    await A.App.persistPlaylist(pl);
    A.App.favorites = new Set(['a1']);
    await A.App.saveFavorites();

    assert.equal(await A.App.exportBackup(), true);
    assert.equal(enviados.length, 1);
    bytes = await A.App._readBlobAsBytes(enviados[0].file.blob);
    nombre = enviados[0].file.name;
  } finally { A.teardown(); }

  const B = await bootApp({ lang: 'es' });
  try {
    const archivo = new Blob([bytes], { type: B.App.BACKUP_MIME });
    archivo.name = nombre;
    B.window.webxdc = { importFiles: async () => [archivo], sendToChat: async () => {} };
    B.App.showConfirm = async () => true;

    assert.equal(await B.App.importBackup(), true);
    assert.equal(B.App.tracks.length, 2, 'las canciones vuelven');
    assert.equal(B.App.playlists.length, 1, 'las listas vuelven');
    assert.deepEqual([...B.App.playlists[0].trackIds], ['a1', 'b1'], 'enlazadas');
    assert.equal(B.App.favorites.has('a1'), true, 'los favoritos vuelven');

    // Cada audio está en el almacén con su id y la pista suena.
    for (const id of ['a1', 'b1']) {
      assert.equal(B.App.getTrackById(id).hasAudio, true);
      const blob = await B.window.AuroraStorage.getBlob(id);
      assert.ok(blob && blob.size > 0, 'audio de ' + id);
    }
    const t = B.App.getTrackById('a1');
    await B.App.ensureTrackBlob(t);
    assert.match(B.App.getTrackUrl(t), /^blob:/, 'la pista restaurada se puede reproducir');
  } finally {
    delete B.window.webxdc;
    B.teardown();
  }
});
