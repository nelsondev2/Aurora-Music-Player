/* =====================================================================
 *  tests.js — Aurora Music Player
 *  Suite sin framework. Abrir tests.html o: no hay runner de Node para el DOM,
 *  pero audit-i18n.js cubre i18n en CLI.
 * ===================================================================== */
'use strict';

(function () {
  const results = document.getElementById('results');
  const summary = document.getElementById('summary');
  let passed = 0, failed = 0;

  function assert(name, cond, detail) {
    const li = document.createElement('li');
    if (cond) {
      passed++;
      li.className = 'ok';
      li.textContent = '✓ ' + name;
    } else {
      failed++;
      li.className = 'fail';
      li.textContent = '✗ ' + name + (detail ? ' — ' + detail : '');
    }
    if (results) results.appendChild(li);
    if (!cond) console.error('[FAIL]', name, detail || '');
  }

  const LANGS = ['es', 'en', 'pt', 'zh', 'ja', 'fr', 'it', 'ru'];

  /* ---- i18n ---- */
  (function i18n() {
    const dict = window.I18N || {};
    const keys = Object.keys(dict);
    assert('I18N está definido', keys.length > 0, 'keys=' + keys.length);
    let missing = 0;
    const bad = [];
    keys.forEach((k) => {
      const o = dict[k];
      if (!o || typeof o !== 'object') { missing++; bad.push(k + ':not-obj'); return; }
      LANGS.forEach((l) => {
        if (typeof o[l] !== 'string' || !o[l].length) {
          missing++;
          if (bad.length < 8) bad.push(k + ':' + l);
        }
      });
    });
    assert('Cada clave i18n tiene 8 idiomas', missing === 0, bad.join(', ') || ('n=' + keys.length));
  })();

  /* ---- fmtTime ---- */
  (function time() {
    const A = window.App;
    assert('fmtTime existe', typeof A.fmtTime === 'function');
    if (typeof A.fmtTime !== 'function') return;
    assert('fmtTime(0) → 0:00', A.fmtTime(0) === '0:00', A.fmtTime(0));
    assert('fmtTime(NaN) → 0:00', A.fmtTime(NaN) === '0:00');
    assert('fmtTime(65) → 1:05', A.fmtTime(65) === '1:05', A.fmtTime(65));
    assert('fmtTime(3599) → 59:59', A.fmtTime(3599) === '59:59', A.fmtTime(3599));
  })();

  /* ---- parseLrc ---- */
  (function lrc() {
    const A = window.App;
    assert('parseLrc existe', typeof A.parseLrc === 'function');
    if (typeof A.parseLrc !== 'function') return;
    const lines = A.parseLrc([
      '[ar:Test]',
      '[00:12.00]Hello',
      '[00:15.00][00:30.00]Twice',
      'Plain line',
      '[00:40.00]<00:40.00>One <00:40.50>Two'
    ]);
    assert('parseLrc omite metadata [ar:]', !lines.some((l) => /ar:/i.test(l.text)));
    const hello = lines.find((l) => l.text === 'Hello');
    assert('parseLrc timestamp simple', !!(hello && hello.timed && Math.abs(hello.time - 12) < 0.01), JSON.stringify(hello));
    const twice = lines.filter((l) => l.text === 'Twice' && l.timed);
    assert('parseLrc timestamps múltiples', twice.length === 2, 'n=' + twice.length);
    assert('parseLrc línea plana untimed', lines.some((l) => l.text === 'Plain line' && !l.timed));
    const kar = lines.find((l) => l.words && l.words.length >= 2);
    assert('parseLrc karaoke solo con tags <mm:ss>', !!(kar && kar.words.length === 2), kar ? JSON.stringify(kar.words) : 'no words');
    const none = A.parseLrc(['Just words without stamps']);
    assert('parseLrc no inventa karaoke', !none.some((l) => l.words), 'invented');
  })();

  /* ---- shuffle Fisher–Yates ---- */
  (function shuffle() {
    const A = window.App;
    assert('_fisherYates existe', typeof A._fisherYates === 'function');
    if (typeof A._fisherYates !== 'function') return;
    const src = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const once = src.slice();
    A._fisherYates(once);
    assert('shuffle conserva elementos', once.slice().sort((a, b) => a - b).join() === src.join(), once.join());
    let different = false;
    for (let i = 0; i < 24; i++) {
      const t = src.slice();
      A._fisherYates(t);
      if (t.join() !== src.join()) { different = true; break; }
    }
    assert('shuffle no es identidad (24 intentos)', different);
  })();

  /* ---- duplicados ---- */
  (function dups() {
    const A = window.App;
    assert('findDuplicateTrack existe', typeof A.findDuplicateTrack === 'function');
    if (typeof A.findDuplicateTrack !== 'function') return;
    A.tracks = [
      { id: 'a', fileName: 'song.mp3', fileSize: 1234 },
      { id: 'b', fileName: 'other.mp3', fileSize: 99 }
    ];
    assert('detecta duplicado name+size', !!A.findDuplicateTrack('song.mp3', 1234));
    assert('no marca distinto size', !A.findDuplicateTrack('song.mp3', 9999));
    assert('no marca distinto name', !A.findDuplicateTrack('nope.mp3', 1234));
  })();

  if (summary) {
    summary.textContent = passed + ' ok · ' + failed + ' fallos';
    summary.className = failed ? 'fail' : 'ok';
  }
  document.title = (failed ? 'FAIL' : 'OK') + ' · Aurora tests';
  window.__AURORA_TEST_FAILS = failed;
})();
