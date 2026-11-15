/* =====================================================================
 *  test/smoke.test.mjs — humo, i18n, versión y escapado
 * ===================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { bootApp, ROOT } from './helpers/app.mjs';

test('la app arranca sin errores de JavaScript', async () => {
  const { App, errors, teardown } = await bootApp();
  try {
    assert.equal(App._initialized, true, 'init() no llegó a completarse');
    assert.deepEqual(errors, [], 'errores durante el arranque');
    assert.equal(App.tracks.length, 0);
  } finally { teardown(); }
});

test('los 14 idiomas cambian sin excepciones', async () => {
  const { App, window, errors, teardown } = await bootApp();
  try {
    const codes = window.SUPPORTED_LANGS.map((l) => l.code);
    assert.equal(codes.length, 14);
    for (const code of codes) {
      App.setLang(code);
      assert.equal(App.lang, code);
      assert.equal(window.document.documentElement.getAttribute('lang'), code);
    }
    assert.deepEqual(errors, []);
  } finally { teardown(); }
});

test('todas las claves de i18n están en los 14 idiomas', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const codes = window.SUPPORTED_LANGS.map((l) => l.code);
    const dict = window.I18N;
    const keys = Object.keys(dict);
    assert.ok(keys.length > 300, 'el diccionario se ha cargado');
    const faltan = [];
    for (const key of keys) {
      for (const code of codes) {
        const value = dict[key][code];
        if (value == null || value === '') faltan.push(code + ':' + key);
      }
    }
    assert.deepEqual(faltan, [], 'traducciones ausentes');
    assert.equal(App.t('no_existe_esta_clave'), 'no_existe_esta_clave',
      'una clave desconocida se devuelve tal cual, no revienta');
  } finally { teardown(); }
});

test('toda clave usada en HTML y JS existe en el diccionario', async () => {
  const { window, teardown } = await bootApp();
  try {
    const dict = window.I18N;
    const usadas = new Set();
    const archivos = ['index.html',
      ...fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f)];

    for (const rel of archivos) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      for (const m of src.matchAll(/\bt\(\s*['"]([A-Za-z0-9_]+)['"]/g)) usadas.add(m[1]);
      for (const m of src.matchAll(/data-i18n(?:-aria|-ph|-title)?="([A-Za-z0-9_]+)"/g)) usadas.add(m[1]);
    }

    // Claves construidas en tiempo de ejecución: t('theme_' + this.theme)
    const dinamicas = new Set(['key', 'theme_', 'accent_']);
    const rotas = [...usadas].filter((k) => !dinamicas.has(k) && !dict[k]);
    assert.deepEqual(rotas, [], 'claves usadas que no existen en data.js');

    const prefijos = [...usadas].filter((k) => dinamicas.has(k));
    assert.deepEqual(prefijos.sort(), ['accent_', 'key', 'theme_'],
      'si aparecen claves dinámicas nuevas, revisa que sus valores existan');
  } finally { teardown(); }
});

test('la versión coincide en la app, el CHANGELOG y el README', async () => {
  const { App, teardown } = await bootApp();
  try {
    const version = App.VERSION;
    assert.match(version, /^\d+\.\d+\.\d+$/);

    const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
    const publicadas = [...changelog.matchAll(/^## (\d+\.\d+\.\d+)/gm)].map((m) => m[1]);
    assert.ok(publicadas.includes(version),
      `App.VERSION=${version} no tiene sección «## ${version}» en el CHANGELOG (las hay: ${publicadas.slice(0, 3).join(', ')})`);

    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const enReadme = readme.match(/\*\*Versión:\*\* (\d+\.\d+\.\d+)/);
    assert.ok(enReadme, 'el README ya no declara la versión');
    assert.equal(enReadme[1], version, 'el README y App.VERSION discrepan');

    // El texto de reserva del HTML también (se ve antes de init()).
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const enHtml = html.match(/id="aboutVersion">([\d.]+)</);
    assert.ok(enHtml && enHtml[1] === version, 'el «Versión» del HTML no coincide');
  } finally { teardown(); }
});

test('los metadatos de una pista no pueden inyectar HTML', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    App.tracks = [{
      id: 'x1',
      title: '<img src=x onerror="window.__pwned=1">',
      artist: '<b>artista</b>',
      album: '"><script>window.__pwned=1</script>',
      fileName: 'x.mp3', fileSize: 1, duration: 10, size: 1, addedAt: Date.now(), rating: 0,
    }];
    App.invalidateTrackIndex();
    App.renderPlaylists();
    if (typeof App.renderHome === 'function') App.renderHome();
    if (typeof App.renderCurrentTrack === 'function') App.renderCurrentTrack();

    assert.equal(window.__pwned, undefined, 'se ejecutó HTML inyectado');
    // Lo que importa: que no exista un nodo con ese atributo. En un nodo
    // de texto las comillas van sueltas, así que no vale buscar la cadena.
    assert.equal(window.document.querySelectorAll('[onerror]').length, 0,
      'el título se convirtió en un <img> con onerror');
    assert.equal(window.document.querySelectorAll('script').length > 0, true,
      'los scripts legítimos siguen ahí (no se ha borrado media página)');
    assert.equal(App.esc('<b>'), '&lt;b&gt;');
    assert.equal(App.esc('a"b\'c&d'), 'a&quot;b&#39;c&amp;d');
  } finally { teardown(); }
});

test('las 20 hojas se abren y se cierran sin dejar el foco perdido', async () => {
  const { App, window, errors, teardown } = await bootApp();
  try {
    const sheets = [...window.document.querySelectorAll('.sheet')].map((s) => s.id);
    assert.ok(sheets.length >= 20, 'se esperaban al menos 20 hojas');
    for (const id of sheets) {
      App.openSheet(id);
      assert.ok(window.document.getElementById(id).classList.contains('open'), id + ' no se abrió');
      const panel = window.document.querySelector('#' + id + ' .sheet-panel');
      assert.equal(panel.getAttribute('role'), 'dialog', id + ' sin role=dialog');
      assert.equal(panel.getAttribute('aria-modal'), 'true');
      assert.ok(panel.getAttribute('aria-label') || panel.getAttribute('aria-labelledby'),
        id + ' sin nombre accesible');
      App.closeSheet(id);
      assert.equal(window.document.getElementById(id).getAttribute('aria-hidden'), 'true');
    }
    assert.deepEqual(errors, []);
  } finally { teardown(); }
});

test('el diagnóstico enseña el último error y se puede copiar', async () => {
  const { App, window, teardown } = await bootApp({ lang: 'es' });
  try {
    const row = window.document.getElementById('aboutLastError');
    assert.ok(row, 'falta la fila de diagnóstico en Acerca de');
    assert.equal(row.hidden, true, 'sin errores la fila no debe verse');

    App._lastError = { msg: 'play() rechazado: NotSupportedError', ts: Date.now() };
    App.renderAboutDiagnostics();
    assert.equal(row.hidden, false);
    assert.match(row.textContent, /play\(\) rechazado/);

    const texto = await App.diagnosticsText();
    assert.match(texto, /Aurora Music Player \d+\.\d+\.\d+/);
    assert.match(texto, /lang=es/);
    assert.match(texto, /ultimo_error=play\(\) rechazado/);

    // Sin portapapeles disponible: la reserva usa execCommand y avisa.
    let copiado = null;
    window.document.execCommand = () => { copiado = true; return true; };
    if (window.navigator.clipboard) delete window.navigator.clipboard;
    await App.copyDiagnostics();
    assert.equal(copiado, true, 'no se intentó la copia de reserva');
  } finally { teardown(); }
});
