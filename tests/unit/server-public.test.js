'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { resolvePublic, PUBLIC_ROOT_FILES, PUBLIC_DIRS } = require('../../server.js');

const ROOT = path.resolve(__dirname, '../..');

test('resolvePublic permite solo archivos de la lista blanca', () => {
  assert.equal(resolvePublic('/index.html'), path.join(ROOT, 'index.html'));
  assert.equal(resolvePublic('/styles.css'), path.join(ROOT, 'styles.css'));
  assert.equal(resolvePublic('/js/state.js'), path.join(ROOT, 'js/state.js'));
  assert.equal(resolvePublic('/assets/js/jsmediatags.min.js'), path.join(ROOT, 'assets/js/jsmediatags.min.js'));
});

test('resolvePublic bloquea código de servidor, tests y metadatos', () => {
  for (const p of ['/server.js', '/package.json', '/package-lock.json', '/.gitignore',
    '/tests/unit/lrc.test.js', '/README.md', '/docs/x.jpg', '/.env']) {
    assert.equal(resolvePublic(p), null, p + ' no debería ser público');
  }
});

test('resolvePublic bloquea path traversal y codificaciones', () => {
  for (const p of ['/js/../server.js', '/js/%2e%2e/server.js', '/assets/../../server.js',
    '/js/..%2fserver.js', '/%2e%2e/%2e%2e/etc/passwd', '/js\\..\\server.js',
    '/js/%00state.js', '/js/%ZZ']) {
    assert.equal(resolvePublic(p), null, p + ' debería bloquearse');
  }
});

test('resolvePublic rechaza rutas vacías o directorios', () => {
  for (const p of ['', '/', '/js', '/assets/', '///']) {
    assert.equal(resolvePublic(p), null, JSON.stringify(p));
  }
});

test('la lista blanca no incluye archivos sensibles', () => {
  for (const f of ['server.js', 'package.json', 'package-lock.json', '.env', 'README.md']) {
    assert.equal(PUBLIC_ROOT_FILES.has(f), false, f);
  }
  for (const d of ['tests', 'docs', '.git', 'node_modules']) {
    assert.equal(PUBLIC_DIRS.has(d), false, d);
  }
});
