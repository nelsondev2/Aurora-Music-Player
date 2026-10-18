'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, waitFor } = require('../helpers/dom-env');

function click(env, el) {
  el.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

test('openSheet/closeSheet mantienen pila, z-index e inert', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  const d = env.window.document;
  A.openSheet('sheetLibrary');
  A.openSheet('sheetMore');
  const lib = d.getElementById('sheetLibrary');
  const more = d.getElementById('sheetMore');
  assert.equal(lib.classList.contains('open'), true);
  assert.equal(more.classList.contains('open'), true);
  assert.equal(lib.getAttribute('aria-hidden'), 'true', 'el inferior queda oculto a lectores');
  assert.equal(more.getAttribute('aria-hidden'), 'false');
  assert.equal(lib.inert, true);
  assert.equal(more.inert, false);
  assert.ok(Number(more.style.zIndex) > Number(lib.style.zIndex));

  A.closeSheet('sheetMore');
  assert.equal(more.classList.contains('open'), false);
  assert.equal(lib.getAttribute('aria-hidden'), 'false');
  assert.equal(lib.inert, false);
});

test('Escape cierra el sheet superior', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  A.openSheet('sheetMore');
  env.window.document.dispatchEvent(new env.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(env.window.document.getElementById('sheetMore').classList.contains('open'), false);
});

test('showConfirm resuelve true/false y no deja promesas colgadas', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  const p1 = A.showConfirm({ message: 'uno' });
  env.window.document.getElementById('btnConfirmOk').onclick();
  assert.equal(await p1, true);

  const p2 = A.showConfirm({ message: 'dos' });
  A.closeSheet('sheetConfirm'); // backdrop/X
  assert.equal(await p2, false);

  // Abrir otra confirmación con una pendiente: la primera se cancela.
  const p3 = A.showConfirm({ message: 'tres' });
  const p4 = A.showConfirm({ message: 'cuatro' });
  assert.equal(await p3, false);
  env.window.document.getElementById('btnConfirmCancel').onclick();
  assert.equal(await p4, false);
});

test('el onboarding de idioma no se cierra por backdrop ni Escape', async (t) => {
  const env = await boot({
    beforeScripts(w) { try { w.localStorage.removeItem('aurora_lang'); } catch (e) {} }
  });
  t.after(env.close);
  await waitFor(() => env.window.document.getElementById('sheetLanguage').classList.contains('open'), 3000);
  const A = env.App;
  const sheet = env.window.document.getElementById('sheetLanguage');
  A.closeSheet('sheetLanguage');
  assert.equal(sheet.classList.contains('open'), true);
  A.closeSheet('sheetLanguage', true); // forzado (uso interno)
  assert.equal(sheet.classList.contains('open'), false);
});

test('startSleep valida minutos y programa el temporizador', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  const toasts = [];
  A.toast = (m) => toasts.push(m);
  assert.equal(A.startSleep(0), false);
  assert.equal(A.startSleep(NaN), false);
  assert.equal(A.startSleep(-5), false);
  assert.equal(toasts.length, 3);
  assert.equal(A.startSleep(30), true);
  assert.ok(A.sleepEndAt > Date.now());
  A.cancelSleep();
  assert.equal(A.sleepEndAt, null);
});

test('toast escribe el mensaje y muestra la clase', async (t) => {
  const env = await boot();
  t.after(env.close);
  const el = env.window.document.getElementById('toast');
  env.App.toast('Hola', 'danger');
  assert.equal(el.textContent, 'Hola');
  assert.equal(el.classList.contains('show'), true);
  assert.equal(el.classList.contains('is-danger'), true);
});

test('A-B: el botón existe y alterna A/B con la pista cargada', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  const btn = env.window.document.getElementById('btnABRepeat');
  assert.ok(btn, 'debe existir el botón A-B (antes era código muerto)');
  A.tracks = [{ id: 'a', title: 'A', duration: 100, src: 'blob:mock/a' }];
  A.invalidateTrackIndex();
  A.queue = ['a'];
  A.playTrack('a');
  await waitFor(() => A.isPlaying, 2000);
  A.audio.__currentTime = 5;
  click(env, btn);
  assert.equal(A.abRepeat.a, 5);
  assert.equal(btn.classList.contains('setting-b'), true);
  A.audio.__currentTime = 15;
  click(env, btn);
  assert.equal(A.abRepeat.active, true);
  assert.equal(btn.getAttribute('aria-pressed'), 'true');
  assert.ok(env.window.document.getElementById('progressAbRange').hidden === false);
});

test('preserve pitch: toggle existe, se aplica y persiste', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  const chk = env.window.document.getElementById('chkPreservePitch');
  assert.ok(chk, 'debe existir el toggle');
  assert.equal(chk.checked, true);
  chk.checked = false;
  chk.dispatchEvent(new env.window.Event('change'));
  assert.equal(A.preservesPitch, false);
  assert.equal(env.window.localStorage.getItem('aurora_preserves_pitch'), 'false');
  assert.equal(A.audio.preservesPitch, false);
});

test('modo lote: activar, seleccionar todo, contar y cancelar', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  A.tracks = [
    { id: 'a', title: 'A', artist: 'X', duration: 1 },
    { id: 'b', title: 'B', artist: 'Y', duration: 1 }
  ];
  A.invalidateTrackIndex();
  A.renderLibrary();
  click(env, env.window.document.getElementById('btnBatchSelect'));
  assert.equal(A._batchMode, true);
  const bar = env.window.document.getElementById('batchActionBar');
  assert.equal(bar.hasAttribute('hidden'), false);
  assert.equal(env.window.document.querySelectorAll('.track-row .row-batch-check').length >= 2, true);

  click(env, env.window.document.getElementById('btnBatchSelectAll'));
  assert.equal(A._selectedTrackIds.size, 2);
  assert.equal(env.window.document.getElementById('batchCount').textContent.includes('2'), true);
  assert.equal(env.window.document.getElementById('btnBatchDelete').disabled, false);

  click(env, env.window.document.getElementById('btnBatchCancel'));
  assert.equal(A._batchMode, false);
  assert.equal(A._selectedTrackIds.size, 0);
});

test('edición por lote: guarda etiquetas y avisa con el recuento', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  A.tracks = [
    { id: 'a', title: 'A', artist: 'X', duration: 1 },
    { id: 'b', title: 'B', artist: 'Y', duration: 1 }
  ];
  A.invalidateTrackIndex();
  A.toggleBatchMode(true);
  A.toggleTrackSelection('a');
  A.toggleTrackSelection('b');
  A.openBatchEditModal();
  env.window.document.getElementById('batchEditArtist').value = 'Nuevo';
  const toasts = [];
  A.toast = (m) => toasts.push(m);
  await A.saveBatchEditTags();
  assert.equal(A.tracks[0].artist, 'Nuevo');
  assert.equal(A.tracks[1].artist, 'Nuevo');
  assert.ok(toasts.some(m => m.includes('2')), 'el toast debe incluir 2 pistas');
  assert.equal(A._batchMode, false);
});

test('borrado por lote pide confirmación y respeta cancelar', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  A.tracks = [{ id: 'a', title: 'A', artist: 'X', duration: 1 }];
  A.invalidateTrackIndex();
  A.toggleBatchMode(true);
  A.toggleTrackSelection('a');
  let asked = false;
  A.showConfirm = async () => { asked = true; return false; };
  await A.batchDeleteTracks();
  assert.equal(asked, true);
  assert.equal(A.tracks.length, 1, 'cancelar no borra');

  A.showConfirm = async () => true;
  await A.batchDeleteTracks();
  assert.equal(A.tracks.length, 0);
});

test('las filas de pista tienen aria-label traducido', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  A.tracks = [{ id: 'a', title: 'A', artist: 'X', duration: 1 }];
  A.invalidateTrackIndex();
  A.renderLibrary();
  const chk = env.window.document.querySelector('.batch-checkbox');
  assert.equal(chk.getAttribute('aria-label'), 'Seleccionar pista');
  A.setLang('en');
  A.renderLibrary();
  assert.equal(env.window.document.querySelector('.batch-checkbox').getAttribute('aria-label'), 'Select track');
});
