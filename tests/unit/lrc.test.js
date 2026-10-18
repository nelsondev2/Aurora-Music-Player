'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

/* lyrics.js es un script clásico que amplía el global App. */
global.App = { esc: (s) => String(s), t: (k) => k };
require('../../js/lyrics.js');
const App = global.App;

test('parseLrc: timestamps simples, ordenados', () => {
  const lines = App.parseLrc([
    '[00:10.00]Segunda',
    '[00:02.50]Primera'
  ]);
  assert.equal(lines.hasTimed, true);
  assert.deepEqual(lines.map(l => l.text), ['Primera', 'Segunda']);
  assert.equal(lines[0].time, 2.5);
});

test('parseLrc: varios timestamps en una línea generan varias entradas', () => {
  const lines = App.parseLrc(['[00:01.00][00:11.00]Coro']);
  assert.equal(lines.filter(l => l.text === 'Coro').length, 2);
  assert.deepEqual(lines.map(l => l.time), [1, 11]);
});

test('parseLrc: aplica [offset:] (positivo y negativo)', () => {
  const plus = App.parseLrc(['[offset:500]', '[00:10.00]Hola']);
  assert.equal(plus[0].time, 10.5);
  const minus = App.parseLrc(['[offset:-1500]', '[00:10.00]Hola']);
  assert.equal(minus[0].time, 8.5);
});

test('parseLrc: nunca devuelve tiempos negativos', () => {
  const lines = App.parseLrc(['[offset:-99000]', '[00:01.00]Hola']);
  assert.equal(lines[0].time, 0);
});

test('parseLrc: fusiona líneas con el mismo timestamp como traducción', () => {
  const lines = App.parseLrc(['[00:01.00]Hello', '[00:01.00]Hola']);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, 'Hello');
  assert.equal(lines[0].translation, 'Hola');
});

test('parseLrc: metadata [ar:] no se muestra y texto plano se conserva', () => {
  const lines = App.parseLrc(['[ar:Artista]', '[ti:Título]', 'Sin timestamp']);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, 'Sin timestamp');
  assert.equal(lines[0].timed, false);
});

test('parseLrc: acepta string además de array', () => {
  const lines = App.parseLrc('[00:03.00]Uno\r\n[00:04.00]Dos');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].text, 'Uno');
});

test('parseLrc: karaoke aplica el offset global a los tags <mm:ss>', () => {
  const lines = App.parseLrc([
    '[offset:1000]',
    '[00:10.00]<00:10.00>Hola <00:11.00>mundo'
  ]);
  assert.equal(lines.length, 1);
  assert.ok(Array.isArray(lines[0].words));
  assert.deepEqual(lines[0].words.map(w => w.time), [11, 12]);
  assert.equal(lines[0].words[0].text, 'Hola ');
  assert.equal(lines[0].words[1].text, 'mundo');
});

test('stripKaraokeTags elimina solo tags bien formados', () => {
  assert.equal(App.stripKaraokeTags('a <00:01.00>b'), 'a b');
  assert.equal(App.stripKaraokeTags('a <b> c'), 'a <b> c');
});

test('parseLrc: entrada vacía o basura no explota', () => {
  assert.deepEqual(App.parseLrc(null), []);
  assert.deepEqual(App.parseLrc([]), []);
  assert.equal(App.parseLrc([null, 42, '[00:01.00]ok']).length, 1);
});

test('parseKaraokeWords: exige al menos 2 tags con texto', () => {
  assert.equal(App.parseKaraokeWords('sin tags', 0, 0), null);
  assert.equal(App.parseKaraokeWords('<00:01.00>Solo', 0, 0), null);
  const words = App.parseKaraokeWords('<00:01.00>a<00:02.00>b', 0, 0);
  assert.deepEqual(words.map(w => w.time), [1, 2]);
});
