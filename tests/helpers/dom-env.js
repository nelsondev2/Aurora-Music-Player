/* =====================================================================
 *  tests/helpers/dom-env.js
 *  Arranca la app real (index.html + todos los scripts) dentro de jsdom
 *  con IndexedDB falso. Sin navegador: sirve para unit/integración/e2e
 *  de la lógica y del DOM.
 * ===================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

const ROOT = path.resolve(__dirname, '..', '..');
const INDEX = path.join(ROOT, 'index.html');

/* Extrae los <script src> del HTML y los quita: se inyectan como scripts
 * inline para no depender del resource loader de jsdom (file://). */
function extractScripts(html) {
  const scripts = [];
  const cleaned = html.replace(/<script\s+[^>]*src="([^"]+)"[^>]*>\s*<\/script>/g, (m, src) => {
    scripts.push(src);
    return '';
  });
  return { html: cleaned, scripts };
}

function makeCanvasContext(canvas) {
  const gradient = { addColorStop() {} };
  const data = new Map();
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'canvas') return canvas;
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') {
        return () => gradient;
      }
      if (prop === 'getImageData') {
        return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      }
      if (prop === 'createImageData') {
        return (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      }
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      data.set(prop, value);
      return true;
    }
  });
}

function installMocks(w) {
  const state = {
    blobs: new Map(),
    blobSeq: 0,
    unhandled: []
  };

  w.__testState = state;

  /* IndexedDB aislado por instancia */
  w.indexedDB = new IDBFactory();
  w.IDBKeyRange = IDBKeyRange;
  w.IDBFactory = IDBFactory;

  /* Object URLs con mapa para que fetch() devuelva el blob real */
  w.URL.createObjectURL = (blob) => {
    const url = 'blob:mock/' + (++state.blobSeq);
    state.blobs.set(url, blob);
    return url;
  };
  w.URL.revokeObjectURL = (url) => { state.blobs.delete(url); };
  w.fetch = async (url) => {
    if (state.blobs.has(url)) return { ok: true, blob: async () => state.blobs.get(url) };
    return { ok: false, status: 404, blob: async () => new w.Blob([]) };
  };

  /* localStorage: jsdom la ofrece con URL http */
  try { w.localStorage.setItem('aurora_lang', 'es'); } catch (e) {}

  /* matchMedia */
  w.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent() { return false; }
  });

  /* Canvas */
  const originalGetContext = w.HTMLCanvasElement.prototype.getContext;
  w.HTMLCanvasElement.prototype.getContext = function (type) {
    if (type && type !== '2d') return originalGetContext ? originalGetContext.call(this, type) : null;
    if (!this.__ctx) this.__ctx = makeCanvasContext(this);
    return this.__ctx;
  };
  w.HTMLCanvasElement.prototype.toDataURL = function () {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  };
  w.HTMLCanvasElement.prototype.toBlob = function (cb) {
    cb(new w.Blob(['x'], { type: 'image/png' }));
  };

  /* Media elements: jsdom no implementa play/pause/load ni metadatos. */
  const mediaProto = w.HTMLMediaElement.prototype;
  Object.defineProperty(mediaProto, 'paused', {
    configurable: true,
    get() { return this.__paused !== false; }
  });
  Object.defineProperty(mediaProto, 'ended', {
    configurable: true,
    get() { return this.__ended === true; }
  });
  Object.defineProperty(mediaProto, 'duration', {
    configurable: true,
    get() { return typeof this.__duration === 'number' ? this.__duration : 180; }
  });
  Object.defineProperty(mediaProto, 'currentTime', {
    configurable: true,
    get() { return this.__currentTime || 0; },
    set(v) {
      const n = Number(v);
      if (!Number.isFinite(n)) throw new w.DOMException('non-finite', 'TypeError');
      this.__currentTime = Math.max(0, n);
    }
  });
  Object.defineProperty(mediaProto, 'readyState', {
    configurable: true,
    get() { return 4; }
  });
  Object.defineProperty(mediaProto, 'play', {
    configurable: true,
    value: function () {
      this.__paused = false;
      this.__ended = false;
      this.dispatchEvent(new w.Event('play'));
      this.dispatchEvent(new w.Event('playing'));
      return Promise.resolve();
    }
  });
  Object.defineProperty(mediaProto, 'pause', {
    configurable: true,
    value: function () {
      if (this.__paused === false) this.dispatchEvent(new w.Event('pause'));
      this.__paused = true;
    }
  });
  Object.defineProperty(mediaProto, 'load', {
    configurable: true,
    value: function () {
      this.dispatchEvent(new w.Event('loadstart'));
      // Simula metadatos disponibles en el siguiente tick.
      const self = this;
      w.setTimeout(() => {
        if (typeof self.__duration !== 'number') self.__duration = 180;
        self.dispatchEvent(new w.Event('loadedmetadata'));
        self.dispatchEvent(new w.Event('canplay'));
      }, 0);
    }
  });
  Object.defineProperty(mediaProto, 'buffered', {
    configurable: true,
    get() { return { length: 0, end() { return 0; } }; }
  });

  /* navigator.storage / mediaSession / vibrate */
  const nav = w.navigator;
  Object.defineProperty(nav, 'storage', {
    configurable: true,
    value: {
      estimate: async () => ({ usage: 1024 * 1024, quota: 1024 * 1024 * 100 }),
      persist: async () => true,
      persisted: async () => true
    }
  });
  w.MediaMetadata = class MediaMetadata {
    constructor(o) { Object.assign(this, o || {}); }
  };
  Object.defineProperty(nav, 'mediaSession', {
    configurable: true,
    value: {
      metadata: null,
      playbackState: 'none',
      handlers: {},
      setActionHandler(action, handler) { this.handlers[action] = handler; },
      setPositionState(s) {
        if (!s) return;
        if (!Number.isFinite(s.position) || !Number.isFinite(s.duration)) {
          throw new w.DOMException('bad position', 'TypeError');
        }
        this.positionState = s;
      }
    }
  });
  nav.vibrate = () => true;
  Object.defineProperty(nav, 'wakeLock', {
    configurable: true,
    value: { request: async () => ({ release: async () => {} }) }
  });

  /* APIs varias que usa la app */
  w.scrollTo = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.ResizeObserver = class ResizeObserver {
    observe() {} unobserve() {} disconnect() {}
  };
  w.requestIdleCallback = (cb) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 0);
  w.cancelIdleCallback = (id) => clearTimeout(id);
  // Usar los timers del window: window.close() los cancela y los tests
  // no dejan el proceso vivo (el visualizador y las letras usan RAF).
  w.requestAnimationFrame = (cb) => w.setTimeout(() => cb(Date.now()), 16);
  w.cancelAnimationFrame = (id) => w.clearTimeout(id);
  w.structuredClone = global.structuredClone;
  w.alert = () => {};
  w.confirm = () => false;
  w.prompt = () => null;
  w.print = () => {};
  w.console = w.console || console;

  /* AudioContext no existe en jsdom: la app lo detecta y degrada. */
  delete w.AudioContext;
  delete w.webkitAudioContext;

  /* File/Blob del window deben soportar arrayBuffer() y text() */
  if (w.Blob && !w.Blob.prototype.arrayBuffer) {
    w.Blob.prototype.arrayBuffer = async function () {
      return new Uint8Array(await new Response(this).arrayBuffer()).buffer;
    };
  }

  w.addEventListener('unhandledrejection', (e) => {
    state.unhandled.push(String(e.reason));
  });
}

function waitFor(fn, timeoutMs = 8000, interval = 20) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      let val = false;
      try { val = fn(); } catch (e) { val = false; }
      if (val) return resolve(val);
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timeout'));
      setTimeout(tick, interval);
    };
    tick();
  });
}

/**
 * Arranca la app.
 * @param {object} [opts]
 * @param {number} [opts.timeout] ms de espera para App._initialized
 * @param {function} [opts.beforeScripts] (window) => void, antes de inyectar
 * @returns {Promise<{dom, window, App, logs, close}>}
 */
async function boot(opts = {}) {
  const source = fs.readFileSync(INDEX, 'utf8');
  const { html, scripts } = extractScripts(source);
  const logs = { errors: [], warnings: [], jsdomErrors: [] };

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (err) => {
    logs.jsdomErrors.push(String(err && err.message));
  });
  virtualConsole.on('error', (...args) => logs.errors.push(args.map(String).join(' ')));
  virtualConsole.on('warn', (...args) => logs.warnings.push(args.map(String).join(' ')));

  const dom = new JSDOM(html, {
    url: 'http://localhost:3000/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse: installMocks
  });
  const w = dom.window;

  if (typeof opts.beforeScripts === 'function') opts.beforeScripts(w);

  for (const src of scripts) {
    const abs = path.join(ROOT, src);
    let code = fs.readFileSync(abs, 'utf8');
    // Con cobertura activa, istanbul instrumenta cada script antes de
    // inyectarlo: c8 no ve el VM de jsdom y sin esto la cobertura de la
    // app sería ficticia.
    if (process.env.AURORA_COVERAGE === '1' && global.__coverageCollector) {
      code = global.__coverageCollector.instrument(code, abs);
    }
    const el = w.document.createElement('script');
    el.textContent = code;
    w.document.body.appendChild(el);
  }

  // main.js arranca en DOMContentLoaded o de inmediato si ya cargó.
  await waitFor(() => w.App && w.App._initialized, opts.timeout || 8000);

  const close = () => {
    // Recoger la cobertura del realm ANTES de cerrar el window.
    if (process.env.AURORA_COVERAGE === '1' && global.__coverageCollector) {
      try { global.__coverageCollector.merge(w.__coverage__); } catch (e) {}
    }
    try { w.close(); } catch (e) {}
  };

  return { dom, window: w, App: w.App, logs, close };
}

module.exports = { boot, waitFor, ROOT, INDEX };
