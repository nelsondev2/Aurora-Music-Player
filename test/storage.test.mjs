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

test('importar canciones pinta la lista de inmediato antes de persistir los blobs en bloques', async () => {
  const { App, window, teardown } = await bootApp({ lang: 'es' });
  try {
    const Storage = window.AuroraStorage;
    // Evitar los 2.5 s de timeout de <audio> en jsdom (no dispara loadedmetadata).
    window.AuroraUploader.probeDuration = async () => 185;

    const pl = { id: 'pl-fast', name: 'Recientes', trackIds: [], cover: { from: '#6E5CFF', to: '#FF7AB6', angle: 135 } };
    App.playlists = [pl];
    await App.persistPlaylist(pl);
    App.openEditPlaylist('pl-fast');

    const files = [];
    for (let i = 0; i < 15; i++) {
      const bytes = new Uint8Array([i + 1, (i * 7) & 255, 42, 99, i]);
      const f = new File([bytes], `Cancion ${i + 1}.mp3`, { type: 'audio/mpeg' });
      files.push(f);
    }

    await App.handleFileInput(files, false, 'pl-fast');

    // Justo al terminar handleFileInput, las 15 filas ya están pintadas en la lista abierta.
    const rows = window.document.querySelectorAll('#editPlaylistTracks .track-row');
    assert.equal(rows.length, 15, 'las 15 pistas aparecen al instante en la lista abierta');
    assert.ok(App.tracks.every((t) => typeof t.fp === 'string' && t.fp.length > 0),
      'las huellas ya vienen calculadas en paralelo durante la importación');

    // Esperar a que termine la persistencia por bloques en segundo plano.
    await App._bgPersistPromise;
    const savedTracks = await Storage.getAllTracks();
    assert.equal(savedTracks.length, 15, 'todas las pistas quedaron guardadas en IndexedDB');
    assert.ok(savedTracks.every((t) => t.hasAudio === true), 'todas quedaron marcadas con audio confirmado');
    const sampleBlob = await Storage.getBlob(savedTracks[14].id);
    assert.ok(sampleBlob && typeof sampleBlob.size === 'number' && sampleBlob.size === 5,
      'el blob del último bloque también está en IndexedDB');

    // También cuando «Mi Música» está abierta y se importa sin lista destino.
    const extraFile = new File([new Uint8Array([88, 77, 66, 55])], 'Suelta.mp3', { type: 'audio/mpeg' });
    await App.handleFileInput([extraFile], false, null);
    App.openEditPlaylist('mi-musica');
    const extraFile2 = new File([new Uint8Array([11, 22, 33, 44])], 'Suelta 2.mp3', { type: 'audio/mpeg' });
    await App.handleFileInput([extraFile2], false, null);
    assert.equal(window.document.querySelectorAll('#editPlaylistTracks .track-row').length, 2,
      '«Mi Música» abierta se actualiza al instante al importar nuevas pistas');
    await App._bgPersistPromise;
  } finally { teardown(); }
});

test('si falla una transacción en lote, el reintento conserva todos los blobs de audio', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const Storage = window.AuroraStorage;
    await Storage.open();
    const origTx = Storage.db.transaction.bind(Storage.db);
    let failBatchOnce = true;
    Storage.db.transaction = (stores, mode) => {
      if (failBatchOnce && Array.isArray(stores) && stores.includes('blobs') && mode === 'readwrite') {
        failBatchOnce = false;
        throw new Error('transacción abortada simulada');
      }
      return origTx(stores, mode);
    };

    const blob1 = new Blob([new Uint8Array([10, 20, 30])], { type: 'audio/mpeg' });
    const blob2 = new Blob([new Uint8Array([40, 50, 60, 70])], { type: 'audio/mpeg' });
    const t1 = makeTrack('fb-1', { fileBlob: blob1, hasAudio: false });
    const t2 = makeTrack('fb-2', { fileBlob: blob2, hasAudio: false });
    setLibrary(App, [t1, t2]);

    await App.persistTracksBatch([t1, t2]);

    const b1 = await Storage.getBlob('fb-1');
    const b2 = await Storage.getBlob('fb-2');
    assert.ok(esBlob(b1) && b1.size === 3, 'blob 1 guardado pese al fallo del lote');
    assert.ok(esBlob(b2) && b2.size === 4, 'blob 2 guardado pese al fallo del lote');
  } finally { teardown(); }
});

test('getAllTracks pagina bibliotecas grandes y open() se recupera de un fallo transitorio en frío', async () => {
  const { window, teardown } = await bootApp();
  try {
    const Storage = window.AuroraStorage;
    for (let i = 0; i < 125; i++) {
      const id = 'trk-' + String(i).padStart(4, '0');
      await Storage.putTrack(makeTrack(id, { fileBlob: undefined, hasAudio: true }));
    }

    // Cerrar conexión y simular un UnknownError transitorio en la primera reapertura
    // (típico al volver a abrir un WebView tras varios días en reposo).
    Storage.db.close();
    Storage.db = null;
    const origOpen = window.indexedDB.open.bind(window.indexedDB);
    let failedOnce = false;
    window.indexedDB.open = (name, ver) => {
      if (!failedOnce) {
        failedOnce = true;
        const fakeReq = {};
        setTimeout(() => {
          const err = new Error('transient cold open failure');
          err.name = 'UnknownError';
          fakeReq.error = err;
          if (fakeReq.onerror) fakeReq.onerror();
        }, 0);
        return fakeReq;
      }
      return origOpen(name, ver);
    };

    const loaded = await Storage.getAllTracks();
    window.indexedDB.open = origOpen;
    assert.equal(failedOnce, true);
    assert.equal(loaded.length, 125, 'recuperó las 125 pistas en varias páginas sin perder ninguna');
  } finally { teardown(); }
});

test('un fallo al leer IndexedDB no sobrescribe la sesión, favoritos ni estadísticas guardadas', async () => {
  const { App, window, teardown } = await bootApp({ lang: 'es' });
  try {
    const Storage = window.AuroraStorage;
    const t = makeTrack('safe-1', { fileBlob: new Blob([new Uint8Array([1, 2])]), hasAudio: false });
    await App.persistTrack(t);
    setLibrary(App, [t]);
    App.currentTrack = t;
    App.queue = ['safe-1'];
    App.favorites = new Set(['safe-1']);
    App.stats = { plays: { 'safe-1': 4 }, skips: {}, totalSeconds: 720 };
    await App.saveSession();
    await App.saveFavorites();
    await App.saveStats();

    // Simular fallo de lectura en el arranque siguiente.
    const origGetAll = Storage.getAllTracks.bind(Storage);
    Storage.getAllTracks = async () => { throw new Error('disco ocupado'); };
    await App.loadAllFromStorage();
    Storage.getAllTracks = origGetAll;

    assert.equal(App._storageOk, false);
    assert.equal(App._storageReadFailed, true);

    // Aunque corran los guardados periódicos, los datos reales siguen intactos.
    App.currentTrack = null;
    App.queue = [];
    App.favorites = new Set();
    App.stats = { plays: {}, skips: {}, totalSeconds: 0 };
    await App.saveSession();
    await App.saveFavorites();
    await App.saveStats();

    const sess = await Storage.getSetting('session');
    const favs = await Storage.getSetting('favorites');
    const stats = await Storage.getSetting('stats');
    assert.equal(sess.currentTrackId, 'safe-1', 'la sesión guardada no se pisó con vacío');
    assert.deepEqual(favs, ['safe-1'], 'los favoritos guardados siguen intactos');
    assert.equal(stats.plays['safe-1'], 4, 'las estadísticas guardadas siguen intactas');
  } finally { teardown(); }
});

test('Ajustes permite activar almacenamiento persistente y liberar cachés sin borrar la música', async () => {
  const { App, window, teardown } = await bootApp({ lang: 'es' });
  try {
    let persisted = false;
    let persistCalls = 0;
    Object.defineProperty(window.navigator, 'storage', {
      configurable: true,
      value: {
        estimate: async () => ({ usage: 10 * 1024 * 1024, quota: 1024 * 1024 * 1024 }),
        persisted: async () => persisted,
        persist: async () => { persistCalls++; persisted = true; return true; },
      },
    });

    const blob = new Blob([new Uint8Array([5, 6, 7, 8])], { type: 'audio/mpeg' });
    const t = makeTrack('keep-1', { fileBlob: blob, hasAudio: false });
    await App.persistTrack(t);
    setLibrary(App, [t]);
    const pl = {
      id: 'pl-cache',
      name: 'Favoritas del mes',
      trackIds: ['keep-1'],
      coverArt: 'data:image/jpeg;base64,/9j/CACHE000000000000000000',
      coverArtHash: 'v384|keep-1#keep-1:39',
    };
    App.playlists = [pl];
    await App.persistPlaylist(pl);

    await App.updateStorageUsage();
    const btnPersist = window.document.getElementById('menuPersistStorage');
    const hint = window.document.getElementById('storagePersistHint');
    const label = window.document.getElementById('storageUsageLabel');
    assert.equal(btnPersist.hidden, false, 'muestra el botón para proteger almacenamiento');
    assert.equal(hint.hidden, false, 'explica cómo evitar borrados por inactividad');

    await App.requestStorageProtection();
    assert.equal(persistCalls, 1);
    assert.equal(App._storagePersisted, true);
    assert.equal(btnPersist.hidden, true, 'una vez protegido se oculta el botón');
    assert.ok(
      label.textContent.includes(App.t('storage_protected_badge')),
      'la etiqueta indica almacenamiento protegido con texto traducible'
    );

    await App.freeStorageCaches();
    assert.equal(pl.coverArt, null, 'se liberó el collage en caché');
    assert.equal((await window.AuroraStorage.getAllTracks()).length, 1, 'la canción sigue guardada');
    assert.ok(esBlob(await window.AuroraStorage.getBlob('keep-1')), 'el audio sigue intacto');
    assert.equal((await window.AuroraStorage.getAllPlaylists()).length, 1, 'la lista sigue guardada');
  } finally { teardown(); }
});
