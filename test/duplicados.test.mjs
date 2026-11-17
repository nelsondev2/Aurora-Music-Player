/* =====================================================================
 *  test/duplicados.test.mjs — la importación decide por contenido
 *
 *  Antes, dos archivos que coincidían en nombre y tamaño se daban por
 *  el mismo y uno se descartaba sin avisar (el archivo seguía en el
 *  dispositivo, pero no entraba en la biblioteca). Ahora decide la
 *  huella: nombre y tamaño solo acotan los candidatos.
 * ===================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, makeTrack, setLibrary } from './helpers/app.mjs';

/** Archivo de mentira: un Blob con nombre y tamaño, como el del importador. */
function archivo(bytes, name) {
  return { fileBlob: new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' }), fileName: name };
}

/** Pista ya en la biblioteca, con su audio en memoria. */
function pista(trackId, bytes, name) {
  const a = archivo(bytes, name);
  return makeTrack(trackId, { fileBlob: a.fileBlob, fileName: name, fileSize: a.fileBlob.size });
}

test('la huella distingue archivos y reconoce el mismo contenido', async () => {
  const { App, teardown } = await bootApp();
  try {
    const a = App._fileFingerprint(new Blob([new Uint8Array([1, 2, 3])]));
    const b = App._fileFingerprint(new Blob([new Uint8Array([1, 2, 3])]));
    const c = App._fileFingerprint(new Blob([new Uint8Array([1, 2, 4])]));
    const [fa, fb, fc] = await Promise.all([a, b, c]);
    assert.ok(fa, 'hay huella');
    assert.equal(fa, fb, 'mismo contenido, misma huella');
    assert.notEqual(fa, fc, 'contenido distinto, huella distinta');
    assert.match(fa, /^3:/, 'la huella incluye el tamaño');
  } finally { teardown(); }
});

test('dos archivos distintos con el mismo nombre y tamaño no se confunden', async () => {
  const { App, teardown } = await bootApp();
  try {
    const vieja = pista('v1', [1, 2, 3, 4], 'tema.mp3');
    vieja.fp = await App._fileFingerprint(vieja.fileBlob);
    setLibrary(App, [vieja]);

    // Mismo nombre y mismo tamaño (4 bytes), otro contenido.
    const nueva = makeTrack('n1', { ...archivo([9, 9, 9, 9], 'tema.mp3'), fileSize: 4 });
    const idx = App._buildDupIndex(App.tracks);

    assert.equal(await App.findDuplicateFor(nueva, idx), null,
      'no es un duplicado: es otro archivo');
  } finally { teardown(); }
});

test('la misma canción renombrada se reconoce como duplicada', async () => {
  const { App, teardown } = await bootApp();
  try {
    const vieja = pista('v2', [5, 6, 7], 'original.mp3');
    vieja.fp = await App._fileFingerprint(vieja.fileBlob);
    setLibrary(App, [vieja]);

    const nueva = makeTrack('n2', { ...archivo([5, 6, 7], 'copia renombrada.mp3'), fileSize: 3 });
    const idx = App._buildDupIndex(App.tracks);

    const dup = await App.findDuplicateFor(nueva, idx);
    assert.ok(dup, 'el contenido es el mismo: es la misma canción');
    assert.equal(dup.id, 'v2');
    assert.equal(nueva.fp, vieja.fp, 'la pista nueva se queda con su huella');
  } finally { teardown(); }
});

test('una pista antigua sin huella se comprueba en el momento', async () => {
  const { App, teardown } = await bootApp();
  try {
    // Biblioteca anterior: sin huella guardada.
    const vieja = pista('v3', [1, 1, 2], 'vieja.mp3');
    setLibrary(App, [vieja]);
    const nueva = makeTrack('n3', { ...archivo([1, 1, 2], 'vieja.mp3'), fileSize: 3 });

    const dup = await App.findDuplicateFor(nueva, App._buildDupIndex(App.tracks));
    assert.ok(dup, 'el contenido coincide: sí es un duplicado');
    assert.equal(dup.id, 'v3');
    assert.ok(vieja.fp, 'la pista antigua sale de la importación con huella');
  } finally { teardown(); }
});

test('una pista antigua no se descarta por nombre y tamaño si el contenido difiere', async () => {
  const { App, teardown } = await bootApp();
  try {
    const vieja = pista('v4', [1, 1, 2], 'vieja.mp3');
    setLibrary(App, [vieja]);
    const nueva = makeTrack('n4', { ...archivo([3, 3, 4], 'vieja.mp3'), fileSize: 3 });

    assert.equal(await App.findDuplicateFor(nueva, App._buildDupIndex(App.tracks)), null);
  } finally { teardown(); }
});

test('sin audio legible se mantiene el criterio antiguo', async () => {
  const { App, teardown } = await bootApp();
  try {
    // Registro sin audio detrás (solo metadatos): no hay forma de
    // comparar contenidos, así que se conserva la regla de nombre+tamaño
    // en vez de colar otra copia en la biblioteca.
    const vieja = makeTrack('v5', { fileBlob: undefined, hasAudio: false, fileName: 'rara.mp3', fileSize: 3 });
    setLibrary(App, [vieja]);
    const nueva = makeTrack('n5', { ...archivo([7, 7, 7], 'rara.mp3'), fileSize: 3 });

    const dup = await App.findDuplicateFor(nueva, App._buildDupIndex(App.tracks));
    assert.equal(dup, vieja);
  } finally { teardown(); }
});

test('el índice reconoce la huella aunque el nombre no coincida en mayúsculas', async () => {
  const { App, teardown } = await bootApp();
  try {
    const vieja = pista('v6', [2, 4, 6], 'Tema.MP3');
    vieja.fp = await App._fileFingerprint(vieja.fileBlob);
    setLibrary(App, [vieja]);
    // Mismo archivo, nombre con otro caso y espacios de más.
    const nueva = makeTrack('n6', { ...archivo([2, 4, 6], '  tema.mp3 '), fileSize: 3 });

    const dup = await App.findDuplicateFor(nueva, App._buildDupIndex(App.tracks));
    assert.ok(dup);
    assert.equal(dup.id, 'v6');
  } finally { teardown(); }
});

test('la hoja de duplicados agrupa en tarjetas, cambia la conservada sin saltar y calcula espacio', async () => {
  const { App, window, errors, teardown } = await bootApp({ lang: 'es' });
  try {
    const doc = window.document;
    // Sin duplicados: estado vacío limpio.
    App.openDuplicates();
    assert.ok(doc.querySelector('#duplicatesContent .dup-empty'), 'muestra estado vacío');
    assert.equal(doc.querySelector('#duplicatesContent .dup-summary'), null);

    // Dos grupos: uno de 2 copias (MP3 + FLAC) y otro de 3 copias.
    const a1 = makeTrack('a1', {
      title: 'Aurora', artist: 'Norte', album: 'Disco',
      fileName: 'aurora_128.mp3', fileSize: 4 * 1024 * 1024, duration: 200, addedAt: 10,
    });
    const a2 = makeTrack('a2', {
      title: 'Aurora', artist: 'Norte', album: 'Disco',
      fileName: 'aurora_master.flac', fileSize: 30 * 1024 * 1024, duration: 200, addedAt: 20, rating: 5,
    });
    const b1 = makeTrack('b1', {
      title: 'Brisa', artist: 'Sur', album: 'Ed. 1',
      fileName: 'brisa.mp3', fileSize: 5 * 1024 * 1024, duration: 180, addedAt: 30,
    });
    const b2 = makeTrack('b2', {
      title: 'Brisa', artist: 'Sur', album: 'Ed. 2',
      fileName: 'brisa.m4a', fileSize: 8 * 1024 * 1024, duration: 180, addedAt: 40,
    });
    const b3 = makeTrack('b3', {
      title: 'Brisa', artist: 'Sur', album: 'Ed. 3',
      fileName: 'brisa.opus', fileSize: 3 * 1024 * 1024, duration: 180, addedAt: 50,
    });
    // Dos pistas sin título no deben agruparse entre sí.
    const u1 = makeTrack('u1', { title: '', artist: '', addedAt: 60 });
    const u2 = makeTrack('u2', { title: '   ', artist: '', addedAt: 70 });
    setLibrary(App, [a1, a2, b1, b2, b3, u1, u2]);

    App.renderDuplicates();

    // Sin botones anidados (accesibilidad y HTML válido).
    assert.equal(doc.querySelectorAll('#duplicatesContent button button').length, 0);

    const vals = [...doc.querySelectorAll('#duplicatesContent .dup-stat-val')].map((el) => el.textContent);
    assert.equal(vals[0], '2', '2 canciones con duplicados');
    assert.equal(vals[1], '3', '3 copias sobrantes');
    assert.equal(vals[2], App.fmtBytes((30 + 8 + 3) * 1024 * 1024), 'espacio inicial a liberar');

    const cards = [...doc.querySelectorAll('#duplicatesContent .dup-group')];
    assert.equal(cards.length, 2);
    // El grupo de 2 copias no repite botón de lote; el de 3 copias sí.
    assert.equal(cards[0].querySelector('.dup-del-others'), null);
    assert.ok(cards[1].querySelector('.dup-del-others'));

    // Al elegir la segunda copia (FLAC), el orden de las filas NO salta
    // y el espacio a liberar pasa de 30 MB a 4 MB en ese grupo.
    const orderBefore = [...cards[0].querySelectorAll('.dup-row')].map((r) => r.dataset.trackId);
    assert.deepEqual(orderBefore, ['a1', 'a2']);
    cards[0].querySelector('.dup-row[data-track-id="a2"] .dup-pick').click();

    const cardAfter = doc.querySelectorAll('#duplicatesContent .dup-group')[0];
    const orderAfter = [...cardAfter.querySelectorAll('.dup-row')].map((r) => r.dataset.trackId);
    assert.deepEqual(orderAfter, ['a1', 'a2'], 'las filas mantienen su posición');
    assert.ok(cardAfter.querySelector('.dup-row[data-track-id="a2"]').classList.contains('is-keep'));
    assert.equal(cardAfter.querySelector('.dup-row[data-track-id="a2"] .dup-del-btn'), null,
      'la copia conservada no tiene papelera');
    assert.ok(cardAfter.querySelector('.dup-row[data-track-id="a1"] .dup-del-btn'),
      'la otra copia pasa a tener papelera');

    const sizeAfter = doc.querySelector('#duplicatesContent .dup-stat-size').textContent;
    assert.equal(sizeAfter, App.fmtBytes((4 + 8 + 3) * 1024 * 1024), 'actualiza el espacio a liberar');
    assert.deepEqual(errors, []);
  } finally { teardown(); }
});

test('borrar duplicados sueltos (con deshacer) y eliminar todas las sobrantes', async () => {
  const { App, window, teardown } = await bootApp({ lang: 'es' });
  try {
    const doc = window.document;
    const t1 = makeTrack('d1', { title: 'Eco', artist: 'Luz', fileName: 'eco1.mp3', fileSize: 1000, addedAt: 1 });
    const t2 = makeTrack('d2', { title: 'Eco', artist: 'Luz', fileName: 'eco2.flac', fileSize: 5000, addedAt: 2 });
    const t3 = makeTrack('d3', { title: 'Mar', artist: 'Sal', fileName: 'mar1.mp3', fileSize: 2000, addedAt: 3 });
    const t4 = makeTrack('d4', { title: 'Mar', artist: 'Sal', fileName: 'mar2.mp3', fileSize: 2000, addedAt: 4 });
    setLibrary(App, [t1, t2, t3, t4]);

    App.openDuplicates();
    // Conservar el FLAC en el primer grupo y borrar el MP3 suelto.
    doc.querySelector('.dup-row[data-track-id="d2"] .dup-pick').click();
    doc.querySelector('.dup-row[data-track-id="d1"] .dup-del-btn').click();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(doc.querySelectorAll('#duplicatesContent .dup-group').length, 1);

    // Deshacer con la hoja abierta vuelve a mostrar el grupo.
    App._undoDeleteTrack();
    assert.equal(doc.querySelectorAll('#duplicatesContent .dup-group').length, 2);

    // Acción global «Eliminar sobrantes»: respeta la elegida en cada grupo.
    const cleanBtn = doc.getElementById('btnDeleteAllDuplicates');
    assert.ok(cleanBtn);
    cleanBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    doc.getElementById('btnConfirmOk').click();
    await new Promise((r) => setTimeout(r, 30));

    assert.deepEqual(App.tracks.map((t) => t.id).sort(), ['d2', 'd3']);
    assert.ok(doc.querySelector('#duplicatesContent .dup-empty'));
  } finally { teardown(); }
});
