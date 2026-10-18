/* =====================================================================
 *  server.js — Aurora Music Player
 *  Servidor estático de producción (Express 4, sin build).
 *
 *  Endurecido en la auditoría de 2026-10:
 *   - PORT/HOST por entorno (antes 3000 fijo).
 *   - Solo sirve la lista blanca de archivos de la app: server.js,
 *     package.json, .git, tests/, docs/… dejan de ser públicos.
 *   - CSP y cabeceras de seguridad sin romper iframes (webxdc/preview).
 *   - gzip negociado para texto (sin dependencias nuevas).
 *   - ETag/304, Cache-Control diferenciado (index.html siempre revalida).
 *   - /api/* desconocido → 404 JSON (antes devolvía el HTML de la SPA).
 *   - Fallback SPA solo para rutas sin extensión y sin prefijo de assets.
 *   - Rate limit en /api, timeouts, apagado ordenado y logs estructurados.
 * ===================================================================== */

'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = __dirname;
// realpathSync es una llamada al sistema: se resuelve una vez, no por request.
const ROOT_REAL = (() => {
  try { return fs.realpathSync(ROOT); } catch (e) { return ROOT; }
})();

/* Archivos y carpetas que forman parte de la aplicación distribuible.
 * Todo lo demás (código de servidor, tests, docs, .git, backups…) no se
 * expone por HTTP, aunque esté en el repositorio. */
const PUBLIC_ROOT_FILES = new Set([
  'index.html', 'styles.css', 'data.js', 'storage.js', 'uploader.js',
  'webxdc.js', 'manifest.toml', 'metadata.json', 'icon.png', 'LICENSE'
]);
const PUBLIC_DIRS = new Set(['js', 'assets']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.toml': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.lrc': 'text/plain; charset=utf-8',
  '.m3u8': 'application/x-mpegurl; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.webm': 'audio/webm'
};

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|x-mpegurl)|image\/svg\+xml)/;

/* CSP pensada para una SPA sin inline scripts ni handlers inline.
 * `style-src 'unsafe-inline'` es necesario por los atributos style="…"
 * del markup; los scripts siguen restringidos a 'self'.
 * No se envía X-Frame-Options ni frame-ancestors: la app debe poder
 * embeberse (webxdc / vista previa). */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' blob: data:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "worker-src 'none'"
].join('; ');

/* Caché en memoria de archivos estáticos (la app pesa pocos MB).
 * Evita leer disco en cada request y permite precomprimir una vez. */
const fileCache = new Map();
const MAX_CACHED_FILE = 8 * 1024 * 1024;

function getFile(absPath) {
  let stat;
  try {
    stat = fs.statSync(absPath);
  } catch (e) {
    return null;
  }
  if (!stat.isFile()) return null;
  // En desarrollo el archivo cambia: invalidar por mtime+tamaño. En prod
  // el primer hit llena la caché y los siguientes son lecturas de RAM.
  const cached = fileCache.get(absPath);
  if (cached && cached.stat.mtimeMs === stat.mtimeMs && cached.stat.size === stat.size) {
    return cached;
  }
  let entry;
  const ext = path.extname(absPath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const tooBig = stat.size > MAX_CACHED_FILE;
  const body = tooBig ? null : fs.readFileSync(absPath);
  const etag = tooBig
    ? 'W/"' + stat.size.toString(16) + '-' + Math.round(stat.mtimeMs).toString(16) + '"'
    : '"' + crypto.createHash('sha1').update(body).digest('base64url') + '"';
  entry = {
    absPath, stat, ext, type, body, etag,
    gzip: body && COMPRESSIBLE.test(type) && body.length > 1024
      ? zlib.gzipSync(body, { level: 6 })
      : null
  };
  fileCache.set(absPath, entry);
  return entry;
}

/* Resuelve una URL a un archivo permitido o null. */
function resolvePublic(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch (e) {
    return null; // %ZZ
  }
  if (decoded.includes('\0')) return null;
  const clean = decoded.replace(/^\/+/, '');
  if (!clean) return null;
  // path.resolve + comprobación de prefijo bloquea ../ y enlaces raros.
  let abs = path.resolve(ROOT, clean);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  // Resolver symlinks antes de aplicar la lista blanca: un enlace dentro
  // de js/ podría apuntar a server.js.
  try {
    abs = fs.realpathSync(abs);
  } catch (e) {
    return null;
  }
  const rootReal = ROOT_REAL;
  if (abs !== rootReal && !abs.startsWith(rootReal + path.sep)) return null;
  const rel = path.relative(rootReal, abs);
  const parts = rel.split(path.sep);
  if (parts.length === 1 && PUBLIC_ROOT_FILES.has(parts[0])) return abs;
  if (parts.length > 1 && PUBLIC_DIRS.has(parts[0])) return abs;
  return null;
}

function createApp(opts) {
  const options = opts || {};
  const app = express();
  app.disable('x-powered-by');
  // Detrás de un proxy (Railway/Fly/Nginx) se usa X-Forwarded-For para el
  // rate limit. Configurable para no confiar en cabeceras falsificables.
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

  /* Rechazo temprano de path traversal (también codificado) antes de que
   * Express normalice la URL y pierda la evidencia. */
  app.use((req, res, next) => {
    // Se inspecciona solo la ruta: un query legítimo (?q=..) no debe 400.
    const raw = String(req.originalUrl || req.url || '').split('?')[0];
    if (/\.\./.test(raw) || /%2e%2e|%2f%2e|%00/i.test(raw)) {
      return res.status(400).type('text/plain').send('400 Bad Request');
    }
    next();
  });

  /* ---------------- Cabeceras de seguridad ---------------- */
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=(), usb=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (process.env.ENABLE_HSTS === '1') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  /* ---------------- Rate limit básico para /api ---------------- */
  const buckets = new Map();
  const WINDOW_MS = 60 * 1000;
  const rawLimit = Number(process.env.API_RATE_LIMIT);
  // Number('abc') === NaN y `count > NaN` siempre es false: el límite
  // quedaría desactivado en silencio. Se valida y se cae al valor seguro.
  const MAX_HITS = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.floor(rawLimit)
    : 120;
  const rateLimit = (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    let b = buckets.get(ip);
    if (!b || now - b.start > WINDOW_MS) {
      b = { start: now, count: 0 };
      buckets.set(ip, b);
    }
    b.count++;
    res.setHeader('X-RateLimit-Limit', String(MAX_HITS));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, MAX_HITS - b.count)));
    if (b.count > MAX_HITS) {
      res.setHeader('Retry-After', String(Math.ceil((b.start + WINDOW_MS - now) / 1000)));
      return res.status(429).json({ status: 'error', error: 'rate_limited' });
    }
    next();
  };
  // Limpieza periódica sin retener el proceso.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, b] of buckets) if (now - b.start > WINDOW_MS * 2) buckets.delete(ip);
  }, WINDOW_MS);
  if (cleanup.unref) cleanup.unref();

  /* ---------------- API ---------------- */
  app.get('/api/health', rateLimit, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      app: 'Aurora Music Player',
      version: options.version || require('./package.json').version,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  app.all('/api/*', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(404).json({ status: 'error', error: 'not_found', path: req.path });
  });

  /* ---------------- Estáticos con lista blanca ---------------- */
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const abs = resolvePublic(req.path);
    if (!abs) return next();
    const file = getFile(abs);
    if (!file) return next();

    const isIndex = file.absPath === path.join(ROOT, 'index.html');
    // index.html siempre revalida (los deploys no cambian de nombre);
    // el resto puede cachearse una hora porque no hay build con hashes.
    res.setHeader('Cache-Control', isIndex
      ? 'no-cache'
      : 'public, max-age=3600, must-revalidate');
    res.setHeader('ETag', file.etag);
    res.setHeader('Vary', 'Accept-Encoding');
    if (req.headers['if-none-match'] === file.etag) {
      return res.status(304).end();
    }
    res.setHeader('Content-Type', file.type);
    if (!file.body) {
      // Archivo grande: streaming (no se cachea en RAM).
      return res.sendFile(file.absPath);
    }
    const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (file.gzip && acceptsGzip) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', String(file.gzip.length));
      if (req.method === 'HEAD') return res.status(200).end();
      return res.status(200).end(file.gzip);
    }
    res.setHeader('Content-Length', String(file.body.length));
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).end(file.body);
  });

  /* ---------------- Fallback SPA ---------------- */
  app.get('*', (req, res, next) => {
    // Un asset que no existe debe dar 404, no HTML (evita errores MIME
    // confusos del tipo «Unexpected token '<'»).
    // Rutas con extensión, dotfiles o prefijos de assets nunca deben
    // devolver HTML: un 404 claro evita errores MIME («Unexpected token <»).
    if (path.extname(req.path) || /\/\./.test(req.path) ||
        /^\/(js|assets|docs|tests)\//.test(req.path)) {
      return next();
    }
    const index = getFile(path.join(ROOT, 'index.html'));
    if (!index) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('ETag', index.etag);
    if (req.headers['if-none-match'] === index.etag) return res.status(304).end();
    return res.status(200).end(index.body);
  });

  /* ---------------- 404 / errores ---------------- */
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ status: 'error', error: 'not_found' });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(404).type('text/plain').send('404 Not Found');
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err && err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status >= 500) {
      console.error(JSON.stringify({
        level: 'error',
        msg: 'request_failed',
        path: req.path,
        error: err && err.message
      }));
    }
    if (res.headersSent) return;
    res.status(status);
    if (req.path.startsWith('/api/')) {
      return res.json({ status: 'error', error: status >= 500 ? 'internal' : 'bad_request' });
    }
    res.type('text/plain').send(status >= 500 ? '500 Internal Server Error' : '400 Bad Request');
  });

  return { app, buckets };
}

function start() {
  const { app } = createApp();
  const rawPort = process.env.PORT || '3000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error('PORT inválido:', rawPort);
    process.exit(1);
  }
  const host = process.env.HOST || '0.0.0.0';
  const server = app.listen(port, host, () => {
    const addr = server.address();
    const shown = typeof addr === 'object' && addr ? addr.port : port;
    console.log(JSON.stringify({
      level: 'info', msg: 'server_started',
      url: `http://${host === '0.0.0.0' ? 'localhost' : host}:${shown}`,
      env: process.env.NODE_ENV || 'development'
    }));
  });
  const positiveInt = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
  };
  // Un NaN en estos campos hace que Node ignore el timeout o lance al
  // arrancar; se normaliza siempre.
  server.requestTimeout = positiveInt(process.env.REQUEST_TIMEOUT_MS, 30000);
  server.headersTimeout = positiveInt(process.env.HEADERS_TIMEOUT_MS, 35000);
  server.keepAliveTimeout = 5000;

  const shutdown = (signal) => {
    console.log(JSON.stringify({ level: 'info', msg: 'shutdown', signal }));
    server.close(() => process.exit(0));
    // Fuerza la salida si una conexión keep-alive se queda colgada.
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('unhandledRejection', (reason) => {
    console.error(JSON.stringify({ level: 'error', msg: 'unhandled_rejection', error: String(reason) }));
  });
  return server;
}

if (require.main === module) start();

module.exports = { createApp, resolvePublic, start, CSP, PUBLIC_ROOT_FILES, PUBLIC_DIRS };
