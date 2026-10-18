'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { boot, ROOT, waitFor } = require('../helpers/dom-env');

test('la app arranca sin errores de consola ni de jsdom', async (t) => {
  const env = await boot();
  t.after(env.close);
  assert.equal(env.App._initialized, true);
  assert.deepEqual(env.logs.jsdomErrors, []);
  assert.deepEqual(env.logs.errors, []);
  assert.equal(env.window.__testState.unhandled.length, 0,
    'promesas sin manejar: ' + env.window.__testState.unhandled.join(' | '));
});

test('versión coherente entre App, package.json y UI', async (t) => {
  const env = await boot();
  t.after(env.close);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(env.App.VERSION, pkg.version);
  assert.equal(env.window.document.getElementById('aboutVersion').textContent, pkg.version);
});

test('todos los ids del HTML son únicos', async (t) => {
  const env = await boot();
  t.after(env.close);
  const seen = new Map();
  for (const el of env.window.document.querySelectorAll('[id]')) {
    seen.set(el.id, (seen.get(el.id) || 0) + 1);
  }
  const dup = [...seen.entries()].filter(([, n]) => n > 1);
  assert.deepEqual(dup, []);
  assert.ok(seen.size > 250, 'se esperaban >250 ids, hay ' + seen.size);
});

test('los sheets arrancan cerrados, ocultos y con aria-hidden', async (t) => {
  const env = await boot();
  t.after(env.close);
  const sheets = env.window.document.querySelectorAll('.sheet');
  assert.ok(sheets.length >= 20);
  for (const s of sheets) {
    assert.equal(s.classList.contains('open'), false, s.id);
    assert.equal(s.getAttribute('aria-hidden'), 'true', s.id);
  }
});

test('biblioteca vacía muestra el estado vacío y no oculta el volumen', async (t) => {
  const env = await boot();
  t.after(env.close);
  env.App.openNowPlaying(); // crea el estado vacío en la vista de reproducción
  const empty = env.window.document.getElementById('emptyState');
  assert.ok(empty, 'debe existir #emptyState');
  assert.equal(empty.style.display, 'flex');
  assert.equal(env.window.document.querySelector('.np-volume').style.display, 'none');

  env.App.hideEmptyState();
  assert.equal(env.window.document.querySelector('.np-volume').style.display, '',
    '.np-volume debe restaurarse (bug de hideEmptyState)');
});

test('onboarding de idioma aparece solo en el primer arranque', async (t) => {
  const env = await boot({
    beforeScripts(w) {
      try { w.localStorage.removeItem('aurora_lang'); } catch (e) {}
    }
  });
  t.after(env.close);
  await waitFor(() => env.window.document.getElementById('sheetLanguage').classList.contains('open'), 3000);
  const sheet = env.window.document.getElementById('sheetLanguage');
  assert.equal(sheet.classList.contains('onboarding'), true);
  // Elegir idioma desde la lista restaura la UI y cierra el sheet.
  const first = env.window.document.querySelector('#langList li');
  assert.ok(first, 'la lista de idiomas debe renderizarse');
  first.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }));
  assert.equal(sheet.classList.contains('open'), false);
  assert.equal(sheet.classList.contains('onboarding'), false);
  assert.ok(env.window.localStorage.getItem('aurora_lang'));
});

test('con idioma guardado no se muestra el onboarding', async (t) => {
  const env = await boot();
  t.after(env.close);
  await new Promise(r => setTimeout(r, 500));
  const sheet = env.window.document.getElementById('sheetLanguage');
  assert.equal(sheet.classList.contains('onboarding'), false);
});

test('setLang traduce textos y mantiene los 8 idiomas', async (t) => {
  const env = await boot();
  t.after(env.close);
  const tag = env.window.document.querySelector('[data-i18n="settings_title"]');
  env.App.setLang('en');
  assert.equal(tag.textContent, 'Settings');
  assert.equal(env.window.document.documentElement.lang, 'en');
  env.App.setLang('ru');
  assert.notEqual(tag.textContent, 'Settings');
  assert.equal(env.window.document.documentElement.lang, 'ru');
});

test('tema y acento se aplican y persisten en localStorage', async (t) => {
  const env = await boot();
  t.after(env.close);
  env.App.setTheme('light');
  assert.equal(env.window.document.documentElement.getAttribute('data-theme'), 'light');
  env.App.setAccent('ocean');
  assert.equal(env.window.document.documentElement.getAttribute('data-accent'), 'ocean');
  assert.equal(env.window.localStorage.getItem('aurora_theme'), 'light');
  assert.equal(env.window.localStorage.getItem('aurora_accent'), 'ocean');
});

test('persistTrack y deleteTrack funcionan con IndexedDB', async (t) => {
  const env = await boot();
  t.after(env.close);
  const track = { id: 't-test-1', title: 'Demo', artist: 'A', album: '', duration: 3 };
  assert.equal(await env.App.persistTrack(track), true);
  const saved = await env.window.AuroraStorage.getTrack('t-test-1');
  assert.equal(saved.title, 'Demo');
  await env.App.deleteTrackFromStorage('t-test-1');
  assert.equal(await env.window.AuroraStorage.getTrack('t-test-1'), undefined);
});

test('saveSession + restoreSession conservan pista, cola y posición', async (t) => {
  const env = await boot();
  t.after(env.close);
  const a = { id: 't-a', title: 'A', artist: 'X', duration: 100 };
  const b = { id: 't-b', title: 'B', artist: 'Y', duration: 100 };
  env.App.tracks = [a, b];
  env.App.invalidateTrackIndex();
  env.App.currentTrack = b;
  env.App.currentTrackIdx = 1;
  env.App.queue = ['t-a', 't-b'];
  env.App.queueIdx = 1;
  env.App.audio.currentTime = 42;
  await env.App.saveSession();

  env.App.currentTrack = null;
  env.App.queue = [];
  env.App.audio.__currentTime = 0;
  assert.equal(await env.App.restoreSession(), true);
  assert.equal(env.App.currentTrack.id, 't-b');
  assert.deepEqual([...env.App.queue], ['t-a', 't-b']);
  assert.equal(env.App.queueIdx, 1);
});

test('restoreSession ignora sesiones corruptas', async (t) => {
  const env = await boot();
  t.after(env.close);
  await env.window.AuroraStorage.setSetting('session', {
    currentTrackId: 'no-existe', queue: ['x', null, 5], shuffle: false
  });
  assert.equal(await env.App.restoreSession(), false);
  await env.window.AuroraStorage.setSetting('session', { currentTrackId: 't-1', queue: 'no-array' });
  env.App.tracks = [{ id: 't-1', title: 'Uno', duration: 10 }];
  env.App.invalidateTrackIndex();
  assert.equal(await env.App.restoreSession(), true);
  assert.deepEqual([...env.App.queue], ['t-1']);
});

test('no hay errores de sintaxis en los scripts cargados', () => {
  const scripts = ['js/state.js', 'js/init.js', 'js/settings.js', 'js/library.js',
    'js/queue.js', 'js/audio.js', 'js/player-ui.js', 'js/lyrics.js',
    'js/playlist-ui.js', 'js/playlist-edit.js', 'js/ui.js', 'js/nav.js',
    'js/events.js', 'js/stats-ui.js', 'js/main.js', 'data.js', 'storage.js',
    'uploader.js', 'webxdc.js'];
  for (const f of scripts) {
    assert.doesNotThrow(() => new (require('vm').Script)(fs.readFileSync(path.join(ROOT, f), 'utf8')), f);
  }
});
