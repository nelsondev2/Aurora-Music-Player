/* =====================================================================
 *  scripts/coverage-hook.js
 *  Instrumentación de cobertura para pruebas que ejecutan la app dentro
 *  de jsdom. c8/V8 no ve los scripts inyectados en el VM de jsdom, así
 *  que se instrumenta con istanbul al cargarlos.
 *
 *  Se activa solo con AURORA_COVERAGE=1 (lo pone scripts/coverage.js).
 *  - Módulos CommonJS del proyecto (server.js, uploader.js…) se
 *    instrumentan al requerirlos.
 *  - Los scripts inyectados en jsdom se instrumentan en dom-env.js y su
 *    cobertura se fusiona aquí con window.__coverage__.
 *  - Al salir el proceso, cada test-file deja su parte en .nyc_output/.
 * ===================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { createInstrumenter } = require('istanbul-lib-instrument');
const { createCoverageMap } = require('istanbul-lib-coverage');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, '.nyc_output');

/* Carpetas que no son código de producto. */
function isProductFile(filename) {
  const rel = path.relative(ROOT, filename);
  if (rel.startsWith('..')) return false;
  if (rel.includes('node_modules')) return false;
  if (rel.startsWith('tests' + path.sep)) return false;
  if (rel.startsWith('scripts' + path.sep)) return false;
  if (rel.startsWith('assets' + path.sep)) return false; // código de terceros
  return filename.endsWith('.js');
}

const instrumenter = createInstrumenter({
  esModules: false,
  compact: false,
  coverageVariable: '__coverage__'
});

const coverageMap = createCoverageMap({});

function merge(obj) {
  if (!obj || typeof obj !== 'object') return;
  try {
    coverageMap.merge(obj);
  } catch (e) {
    // Cobertura corrupta de un realm cerrado: no debe tumbar la suite.
  }
}

/* Disponible para dom-env.js (scripts de jsdom). */
global.__coverageCollector = {
  instrument: (code, filename) => instrumenter.instrumentSync(code, filename),
  merge
};

/* Hook de require: instrumenta el código del proyecto. */
const originalLoader = Module._extensions['.js'];
Module._extensions['.js'] = function patchedLoader(module, filename) {
  if (!isProductFile(filename)) return originalLoader(module, filename);
  const source = fs.readFileSync(filename, 'utf8');
  const instrumented = instrumenter.instrumentSync(source, filename);
  module._compile(instrumented, filename);
};

let flushed = false;
function flush() {
  if (flushed) return;
  flushed = true;
  try {
    merge(global.__coverage__);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OUT_DIR, 'coverage-' + process.pid + '.json'),
      JSON.stringify(coverageMap.toJSON())
    );
  } catch (e) {
    // Nunca fallar el proceso por la cobertura.
  }
}

process.on('exit', flush);
