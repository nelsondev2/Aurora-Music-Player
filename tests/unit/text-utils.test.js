'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* data.js define window.I18N / SUPPORTED_LANGS */
const dataCtx = { window: {} };
dataCtx.window = dataCtx;
vm.createContext(dataCtx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../data.js'), 'utf8'), dataCtx);

global.window = global;
global.I18N = dataCtx.I18N;
global.SUPPORTED_LANGS = dataCtx.SUPPORTED_LANGS;
global.COVER_PALETTE = dataCtx.COVER_PALETTE;
global.App = {};

require('../../js/ui.js');
require('../../js/settings.js');
require('../../js/stats-ui.js');

const App = global.App;
App.lang = 'es';

test('esc: escapa los 5 caracteres peligrosos y null', () => {
  assert.equal(App.esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(App.esc(null), '');
  assert.equal(App.esc(undefined), '');
  assert.equal(App.esc(0), '0');
  assert.equal(App.esc(false), 'false');
});

test('esc: neutraliza un payload XSS típico', () => {
  const out = App.esc('<img src=x onerror=alert(1)>');
  assert.ok(!out.includes('<img'));
  assert.ok(out.includes('&lt;img'));
});

test('cleanSearchStr: conserva acentos normalizados, ruso, chino y japonés', () => {
  assert.equal(App.cleanSearchStr('  Canción  Ñandú '), 'cancion nandu');
  assert.equal(App.cleanSearchStr('Песня'), 'песня');
  assert.equal(App.cleanSearchStr('夜に駆ける'), '夜に駆ける');
  assert.equal(App.cleanSearchStr('日本語'), '日本語');
});

test('cleanSearchStr: elimina signos sin perder tokens', () => {
  assert.equal(App.cleanSearchStr('AC/DC - Back in Black!'), 'ac dc back in black');
  assert.equal(App.cleanSearchStr(null), '');
  assert.equal(App.cleanSearchStr(undefined), '');
});

test('fmtDuration: nunca devuelve NaN', () => {
  assert.equal(App.fmtDuration(0), '0s');
  assert.equal(App.fmtDuration(65), '1m 5s');
  assert.equal(App.fmtDuration(3725), '1h 2m');
  assert.equal(App.fmtDuration(NaN), '0s');
  assert.equal(App.fmtDuration(undefined), '0s');
  assert.equal(App.fmtDuration(-5), '0s');
});

test('fmtBytes: unidades y valores límite', () => {
  assert.equal(App.fmtBytes(0), '0 B');
  assert.equal(App.fmtBytes(1023), '1023 B');
  assert.equal(App.fmtBytes(1024), '1.0 KB');
  assert.equal(App.fmtBytes(1024 * 1024), '1.0 MB');
  assert.equal(App.fmtBytes('basura'), '0 B');
});

test('_isValidLang: solo códigos soportados y strings', () => {
  assert.equal(App._isValidLang('es'), true);
  assert.equal(App._isValidLang('ru'), true);
  assert.equal(App._isValidLang('xx'), false);
  assert.equal(App._isValidLang(null), false);
  assert.equal(App._isValidLang({}), false);
});

test('t(): cae a español y luego a la clave', () => {
  assert.equal(App.t('settings_title'), 'Ajustes');
  App.lang = 'xx';
  assert.equal(App.t('settings_title'), 'Ajustes');
  assert.equal(App.t('clave_inexistente'), 'clave_inexistente');
  App.lang = 'es';
});
