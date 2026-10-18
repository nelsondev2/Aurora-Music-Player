'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global;
global.App = { t: (k) => ({ unknown_artist: 'Artista', no_album: 'Álbum' }[k] || k) };
global.COVER_PALETTE = [{ from: '#000', to: '#fff', angle: 135 }];
global.URL.createObjectURL = () => 'blob:test';
global.URL.revokeObjectURL = () => {};
require('../../uploader.js');
const U = global.AuroraUploader;

function syltFrame({ encoding = 3, text = 'Hola', ms = 1500, descriptor = '' } = {}) {
  const enc = encoding === 1 || encoding === 2 ? 'utf16le' : 'utf8';
  const parts = [
    Buffer.from([encoding, 0x65, 0x6e, 0x67, 1, 1]), // enc + "eng" + ms + lyrics
    Buffer.from(descriptor + '\0', enc === 'utf16le' ? 'utf16le' : 'latin1'),
    Buffer.from(text + '\0', enc),
    Buffer.from([(ms >>> 24) & 0xff, (ms >>> 16) & 0xff, (ms >>> 8) & 0xff, ms & 0xff])
  ];
  return new Uint8Array(Buffer.concat(parts));
}

test('parseSyltFrame: header de 6 bytes y timestamp correcto', () => {
  const out = U.parseSyltFrame(syltFrame({ text: 'Hola', ms: 1500 }));
  assert.deepEqual(out, ['[00:01.50]Hola']);
});

test('parseSyltFrame: descriptor no vacío no desalinea el primer texto', () => {
  const out = U.parseSyltFrame(syltFrame({ text: 'Intro', descriptor: 'desc', ms: 250 }));
  assert.deepEqual(out, ['[00:00.25]Intro']);
});

test('parseSyltFrame: datos truncados no lanzan', () => {
  assert.doesNotThrow(() => U.parseSyltFrame(new Uint8Array([3, 1, 2])));
});

test('normalizeLyrics: texto plano se conserva línea a línea', () => {
  assert.deepEqual(U.normalizeLyrics('uno\r\ndos\rtres'), ['uno', 'dos', 'tres']);
  assert.equal(U.normalizeLyrics(''), null);
  assert.deepEqual(U.normalizeLyrics(['a', 'b']), ['a', 'b']);
});

test('normalizeLyrics: con timestamps filtra metadata pero conserva vacías', () => {
  const out = U.normalizeLyrics('[ar:Artista]\n[00:01.00]Hola\n\n[ti:T]\n[00:02.00]Adiós');
  assert.deepEqual(out, ['[00:01.00]Hola', '', '[00:02.00]Adiós']);
});

test('findMatchingLrc: empareja por nombre exacto', () => {
  const lrc = { name: 'cancion.lrc' };
  assert.equal(U.findMatchingLrc('cancion.mp3', { cancion: lrc }), lrc);
});

test('findMatchingLrc: empareja cirílico y japonés (Unicode)', () => {
  const lrc = { name: 'песня.lrc' };
  assert.equal(U.findMatchingLrc('Песня.mp3', { 'песня': lrc }), lrc);
  const jp = { name: 'yoru.lrc' };
  assert.equal(U.findMatchingLrc('夜に駆ける.mp3', { '夜に駆ける': jp }), jp);
});

test('findMatchingLrc: no empareja nombres cortos por subcadena', () => {
  assert.equal(U.findMatchingLrc('01 intro.mp3', { '1': { name: 'x.lrc' } }), null);
});

test('cleanName y parseFilename', () => {
  assert.equal(U.cleanName('01 - Mi_Cancion.mp3'), 'Mi Cancion');
  assert.deepEqual(U.parseFilename('Artista - Tema.mp3'), { artist: 'Artista', title: 'Tema' });
  assert.equal(U.parseFilename('Tema.mp3').title, 'Tema');
});

test('fallbackTrack: metadatos mínimos y sin campos undefined', () => {
  const file = { name: 'vacio.mp3', size: 10, type: 'audio/mpeg' };
  const t = U.fallbackTrack(file);
  assert.equal(t.title, 'vacio');
  assert.equal(t.artist, 'Artista');
  assert.equal(t.album, 'Álbum');
  assert.equal(t.fileName, 'vacio.mp3');
  assert.equal(t.duration, 0);
  assert.ok(t.id.startsWith('t-'));
  assert.ok(t.src.startsWith('blob:'));
});
