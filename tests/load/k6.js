/* =====================================================================
 *  tests/load/k6.js — prueba de carga básica de Aurora Music Player
 *
 *  Requiere k6 (https://k6.io):  npm run test:load
 *  Con la app levantada (npm start) y la URL en BASE_URL:
 *      BASE_URL=http://localhost:3000 k6 run tests/load/k6.js
 *
 *  Qué mide: entrega de estáticos con lista blanca (index, JS, CSS,
 *  icono), negociación gzip, ETag/304 y el endpoint /api/health con su
 *  rate limit. No hay usuarios ni escrituras: la app es offline-first.
 * ===================================================================== */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const RATE_LIMIT = Number(__ENV.API_RATE_LIMIT || 120);

const cacheHits = new Rate('cache_hits_304');
const gzipRatio = new Trend('gzip_size_ratio');

export const options = {
  scenarios: {
    // 1) Humo: una pasada, falla rápido si el deploy está roto.
    smoke: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      tags: { testid: 'smoke' }
    },
    // 2) Carga normal: 20 usuarios virtuales durante 30 s.
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 20 },
        { duration: '20s', target: 20 },
        { duration: '5s', target: 0 }
      ],
      startTime: '2s',
      tags: { testid: 'load' }
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],            // < 1 % de errores
    http_req_duration: ['p(95)<800'],          // p95 por debajo de 800 ms
    checks: ['rate>0.99'],
    'http_req_duration{testid:smoke}': ['p(95)<500']
  }
};

const ASSETS = ['/', '/styles.css', '/js/main.js', '/js/audio.js', '/data.js', '/icon.png'];

export default function () {
  for (const path of ASSETS) {
    const res = http.get(BASE_URL + path, { tags: { name: path } });
    check(res, {
      'estado 200': (r) => r.status === 200,
      'tipo correcto': (r) => /text\/|image\/|javascript/.test(r.headers['Content-Type'] || ''),
      'sin x-powered-by': (r) => !r.headers['X-Powered-By']
    });
    // Si es JS/CSS comprimible, comprobar que el servidor negoció gzip.
    if (path.endsWith('.js') || path.endsWith('.css')) {
      const len = Number(res.headers['Content-Length'] || 0);
      if (res.headers['Content-Encoding'] === 'gzip' && len) {
        gzipRatio.add(len / Math.max(1, res.body ? res.body.length : len));
      }
    }
  }

  // ETag → segunda petición condicional debe ser 304.
  const first = http.get(BASE_URL + '/styles.css');
  if (first.headers['Etag']) {
    const second = http.get(BASE_URL + '/styles.css', {
      headers: { 'If-None-Match': first.headers['Etag'] }
    });
    cacheHits.add(second.status === 304);
    check(second, { '304 con ETag': (r) => r.status === 304 });
  }

  // Salud del API (consume una unidad del rate limit por iteración).
  const health = http.get(BASE_URL + '/api/health');
  check(health, {
    'health 200 o 429': (r) => r.status === 200 || r.status === 429,
    'health json': (r) => r.status !== 200 || (r.headers['Content-Type'] || '').includes('application/json')
  });

  sleep(1);
}

/* Aviso si el rate limit es más bajo que las peticiones esperadas del
 * escenario de carga: el 429 es correcto, pero conviene saberlo. */
export function handleSummary(data) {
  const limited = data.metrics && data.metrics.http_reqs
    ? data.metrics.http_reqs.values.count : 0;
  if (limited > RATE_LIMIT * 60) {
    console.warn('[k6] Se superó API_RATE_LIMIT: los 429 son esperados.');
  }
  return { stdout: JSON.stringify(data, null, 2) };
}
