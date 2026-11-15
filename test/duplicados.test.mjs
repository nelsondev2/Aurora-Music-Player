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
