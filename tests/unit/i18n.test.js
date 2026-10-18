'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const ctx = { window: {} };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), ctx);
const I18N = ctx.I18N;
const LANGS = Array.from(ctx.SUPPORTED_LANGS, l => l.code);

function projectSources() {
  const files = ['index.html', 'uploader.js', 'webxdc.js'];
  for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
    if (f.endsWith('.js')) files.push('js/' + f);
  }
  return files.map(f => {
    let src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    // Quitar comentarios para no confundir ejemplos de documentación
    // (`data-i18n="key"` en un comentario) con usos reales.
    src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    return { f, src };
  });
}

function usedKeys() {
  const used = new Map();
  for (const { f, src } of projectSources()) {
    let m;
    const re1 = /\bt\(\s*'([a-z0-9_]+)'/g;
    while ((m = re1.exec(src))) {
      // Claves dinámicas: t('accent_' + this.accent). Se validan aparte.
      if (/^\s*\+/.test(src.slice(re1.lastIndex, re1.lastIndex + 8))) continue;
      if (!used.has(m[1])) used.set(m[1], new Set());
      used.get(m[1]).add(f);
    }
    const re2 = /data-i18n(?:-ph|-title|-aria)?="([a-z0-9_]+)"/g;
    while ((m = re2.exec(src))) {
      if (!used.has(m[1])) used.set(m[1], new Set());
      used.get(m[1]).add(f);
    }
  }
  return used;
}

test('los 8 idiomas están completos en todas las claves', () => {
  assert.deepEqual(LANGS.sort(), ['en', 'es', 'fr', 'it', 'ja', 'pt', 'ru', 'zh'].sort());
  const problems = [];
  for (const [key, dict] of Object.entries(I18N)) {
    for (const lang of LANGS) {
      if (!dict[lang] || !String(dict[lang]).trim()) problems.push(key + ':' + lang);
    }
  }
  assert.deepEqual(problems, []);
});

test('las claves dinámicas accent_* existen para todos los acentos', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const accents = [...html.matchAll(/data-accent="([a-z]+)"/g)].map(m => m[1]);
  assert.ok(accents.length >= 4);
  for (const a of accents) assert.ok(I18N['accent_' + a], 'falta accent_' + a);
});

test('todas las claves usadas por el código existen en I18N', () => {
  const used = usedKeys();
  const missing = [...used.keys()].filter(k => !I18N[k]);
  assert.deepEqual(missing, []);
});

test('todas las claves de data-i18n del HTML existen', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const keys = new Set();
  let m;
  const re = /data-i18n(?:-ph|-title|-aria)?="([a-z0-9_]+)"/g;
  while ((m = re.exec(html))) keys.add(m[1]);
  assert.deepEqual([...keys].filter(k => !I18N[k]), []);
  assert.ok(keys.size > 80, 'el HTML debe usar i18n de forma extensiva');
});

test('las claves con placeholders los conservan en los 8 idiomas', () => {
  const checks = [
    ['ab_active', ['X', 'Y']],
    ['ab_set_a', ['X']],
    ['batch_selected_count', ['X']],
    ['batch_updated_toast', ['X']],
    ['batch_deleted_toast', ['X']],
    ['batch_delete_confirm', ['X']],
    ['delete_multiple_confirm', ['X']],
    ['toast_sleep_started', ['X']],
    ['storage_usage', ['X', 'Y']],
    ['relink_pending', ['X']]
  ];
  for (const [key, tokens] of checks) {
    assert.ok(I18N[key], 'falta ' + key);
    for (const lang of LANGS) {
      for (const token of tokens) {
        assert.ok(String(I18N[key][lang]).includes(token),
          `${key}/${lang} no contiene ${token}`);
      }
    }
  }
});

test('no quedan placeholders sin sustituir en textos visibles auditados', () => {
  // La app sustituye con .replace('X', …): un literal X/Y suelto se
  // convertiría en un número por accidente. Solo se revisan las claves
  // que realmente se usan con replace().
  const REPLACED = new Set([
    'ab_active', 'ab_set_a', 'batch_selected_count', 'batch_updated_toast',
    'batch_deleted_toast', 'batch_delete_confirm', 'delete_multiple_confirm',
    'toast_sleep_started', 'storage_usage', 'relink_pending'
  ]);
  for (const key of REPLACED) {
    for (const lang of LANGS) {
      const s = String(I18N[key][lang]);
      assert.ok(!/\{\{|\}\}|%[sd]/.test(s), key + '/' + lang + ' usa un placeholder no soportado');
    }
  }
});
