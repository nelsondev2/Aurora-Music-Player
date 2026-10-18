'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const http = require('http');
const { createApp } = require('../../server.js');

async function withServer(env, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(env || {})) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  const { app } = createApp({ version: '1.2.0-test' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('GET / sirve el index con CSP y cabeceras de seguridad', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(base + '/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-frame-options'), null, 'no bloquear iframes (webxdc)');
    assert.equal(res.headers.get('cache-control'), 'no-cache');
    const body = await res.text();
    assert.match(body, /Aurora Music Player/);
  });
});

function rawPath(base, pathStr) {
  const u = new URL(base);
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: u.hostname, port: u.port, path: pathStr, method: 'GET'
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

function rawGet(url, headers) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers: headers || {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

test('gzip negociado y 304 con ETag', async () => {
  await withServer({}, async (base) => {
    // fetch() descomprime automáticamente: se usa http para ver el byte real.
    const res = await rawGet(base + '/styles.css', { 'accept-encoding': 'gzip' });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-encoding'], 'gzip');
    const css = zlib.gunzipSync(res.body).toString('utf8');
    assert.match(css, /--accent/);

    const etag = res.headers.etag;
    assert.ok(etag);
    const res2 = await fetch(base + '/styles.css', { headers: { 'if-none-match': etag } });
    assert.equal(res2.status, 304);
  });
});

test('/api/health responde JSON y no se cachea', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(base + '/api/health');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const json = await res.json();
    assert.equal(json.status, 'ok');
    assert.equal(json.version, '1.2.0-test');
    assert.equal(typeof json.uptime, 'number');
  });
});

test('/api desconocido → 404 JSON, nunca HTML', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(base + '/api/no-existe');
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const json = await res.json();
    assert.equal(json.error, 'not_found');
  });
});

test('rate limit por IP en /api', async () => {
  await withServer({ API_RATE_LIMIT: '2' }, async (base) => {
    assert.equal((await fetch(base + '/api/health')).status, 200);
    assert.equal((await fetch(base + '/api/health')).status, 200);
    const third = await fetch(base + '/api/health');
    assert.equal(third.status, 429);
    assert.equal(third.headers.get('retry-after') !== null, true);
  });
});

test('API_RATE_LIMIT inválido cae al valor por defecto (no desactiva el límite)', async () => {
  await withServer({ API_RATE_LIMIT: 'no-es-un-numero' }, async (base) => {
    for (let i = 0; i < 5; i++) {
      assert.equal((await fetch(base + '/api/health')).status, 200);
    }
  });
});

test('un query legítimo con «..» no se confunde con path traversal', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(base + '/api/health?probe=..%2Fetc');
    assert.equal(res.status, 200);
  });
});

test('no expone código de servidor, tests ni metadatos', async () => {
  await withServer({}, async (base) => {
    for (const p of ['/server.js', '/package.json', '/package-lock.json', '/.gitignore',
      '/tests/unit/lrc.test.js', '/README.md', '/audit-i18n.js', '/build-xdc.py']) {
      const res = await fetch(base + p);
      assert.equal(res.status, 404, p + ' debería dar 404');
    }
    // Path traversal: fetch normaliza %2e%2e, así que se envía la ruta cruda
    // con http.request para comprobar que el servidor también la rechaza.
    for (const p of ['/js/../server.js', '/js/%2e%2e/server.js', '/assets/%2e%2e/%2e%2e/etc/passwd']) {
      const res = await rawPath(base, p);
      assert.notEqual(res.status, 200, p);
    }
  });
});

test('fallback SPA solo para rutas sin extensión', async () => {
  await withServer({}, async (base) => {
    const spa = await fetch(base + '/biblioteca/playlist-3');
    assert.equal(spa.status, 200);
    assert.match(spa.headers.get('content-type'), /text\/html/);

    const missingJs = await fetch(base + '/js/no-existe.js');
    assert.equal(missingJs.status, 404);
    assert.match(missingJs.headers.get('content-type'), /text\/plain/);

    const missingImg = await fetch(base + '/assets/no-existe.png');
    assert.equal(missingImg.status, 404);
  });
});

test('HEAD y métodos no GET', async () => {
  await withServer({}, async (base) => {
    const head = await fetch(base + '/index.html', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-type'), 'text/html; charset=utf-8');

    const post = await fetch(base + '/', { method: 'POST' });
    assert.equal(post.status, 404);
  });
});
