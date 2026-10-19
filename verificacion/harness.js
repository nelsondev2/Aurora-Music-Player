'use strict';
/* =====================================================================
 *  harness.js — arranque real de Aurora Music Player en jsdom
 *
 *  Carga el index.html del repo y evalúa los mismos scripts que la app,
 *  con stubs mínimos de canvas, audio, URL y matchMedia. No carga CSS
 *  (jsdom no aplica hojas externas): las comprobaciones visuales se hacen
 *  leyendo styles.css y las de estructura sobre el DOM.
 * ===================================================================== */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

// Las suites viven en <repo>/verificacion: la app está un nivel arriba.
// AURORA_ROOT permite apuntar a otro checkout sin editar el arnés.
const ROOT = process.env.AURORA_ROOT || path.resolve(__dirname, '..');
const SCRIPTS = [
  'webxdc.js',
  'assets/js/jsmediatags.min.js',
  'data.js',
  'storage.js',
  'uploader.js',
  'js/state.js',
  'js/init.js',
  'js/settings.js',
  'js/library.js',
  'js/queue.js',
  'js/audio.js',
  'js/player-ui.js',
  'js/lyrics.js',
  'js/playlist-ui.js',
  'js/playlist-edit.js',
  'js/ui.js',
  'js/nav.js',
  'js/events.js',
  'js/stats-ui.js'
];

function canvasContext() {
  const gradient = { addColorStop() {} };
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    font: '', textAlign: '', textBaseline: '',
    clearRect() {}, fillRect() {}, drawImage() {}, beginPath() {},
    moveTo() {}, lineTo() {}, arc() {}, rect() {}, roundRect() {},
    fill() {}, stroke() {}, save() {}, restore() {},
    createLinearGradient() { return gradient; },
    fillText() {}, measureText(t) { return { width: String(t).length * 6 }; }
  };
}

async function boot(opts = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdom: ' + e.message));
  vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
  const dom = new JSDOM(html, {
    url: 'https://aurora.test/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const w = dom.window;

  w.indexedDB = new FDBFactory();
  w.IDBKeyRange = FDBKeyRange;
  w.HTMLCanvasElement.prototype.getContext = function () {
    this.__ctx = this.__ctx || canvasContext();
    return this.__ctx;
  };
  w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
  let urlSeq = 0;
  w.URL.createObjectURL = () => 'blob:mock/' + (++urlSeq);
  w.URL.revokeObjectURL = () => {};
  if (!w.Blob.prototype.arrayBuffer) {
    w.Blob.prototype.arrayBuffer = () => Promise.resolve(new ArrayBuffer(0));
  }
  if (!w.Blob.prototype.text) w.Blob.prototype.text = () => Promise.resolve('');
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.canPlayType = () => 'maybe';

  /* matchMedia controlable: los tests pueden cambiar la preferencia del
   * sistema y disparar el evento 'change' como un navegador real. */
  const mediaState = {
    light: !!opts.prefersLight,
    listeners: new Set()
  };
  w.matchMedia = (query) => {
    const isLight = /prefers-color-scheme:\s*light/.test(query);
    const mq = {
      media: query,
      get matches() { return isLight ? mediaState.light : false; },
      addEventListener(type, cb) { if (type === 'change') mediaState.listeners.add(cb); },
      removeEventListener(type, cb) { if (type === 'change') mediaState.listeners.delete(cb); },
      addListener(cb) { mediaState.listeners.add(cb); },
      removeListener(cb) { mediaState.listeners.delete(cb); }
    };
    return mq;
  };
  w.__setColorScheme = (scheme) => {
    mediaState.light = scheme === 'light';
    mediaState.listeners.forEach(cb => {
      try { cb({ matches: mediaState.light, media: '(prefers-color-scheme: light)' }); } catch (e) {}
    });
  };

  Object.defineProperty(w.navigator, 'languages', { value: ['es-ES', 'es'], configurable: true });
  Object.defineProperty(w.navigator, 'language', { value: 'es-ES', configurable: true });
  w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
  w.cancelAnimationFrame = id => w.clearTimeout(id);
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.scrollTo = function () {};
  w.navigator.vibrate = () => true;

  for (const rel of SCRIPTS) {
    w.eval(fs.readFileSync(path.join(ROOT, rel), 'utf8') + '\n//# sourceURL=' + rel);
  }
  if (opts.tracks) {
    for (const t of opts.tracks) await w.AuroraStorage.putTrack(t);
  }
  if (opts.playlists) {
    for (const p of opts.playlists) await w.AuroraStorage.putPlaylist(p);
  }
  if (opts.init !== false) {
    await w.App.init();
    await wait(60);
  }
  if (opts.colorScheme) w.__setColorScheme(opts.colorScheme);

  return {
    w,
    App: w.App,
    doc: w.document,
    errors,
    mediaState,
    close: () => { try { w.close(); } catch (e) {} }
  };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* Espera activa corta: evita depender de tiempos fijos sin colgar el test. */
async function until(fn, timeout = 1200, step = 20) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (fn()) return true;
    await wait(step);
  }
  return false;
}

function css() {
  return fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
}

const TRACKS = [
  { id: 't1', title: 'Alba', artist: 'Nova', album: 'Aurora', duration: 120, addedAt: 1, src: null },
  { id: 't2', title: 'Bruma', artist: 'Nova', album: 'Aurora', duration: 180, addedAt: 2, src: null },
  { id: 't3', title: 'Cenit', artist: 'Órbita', album: 'Cielo', duration: 240, addedAt: 3, src: null },
  { id: 't4', title: 'Destello', artist: 'Órbita', album: 'Cielo', duration: 90, addedAt: 4, src: null }
];

module.exports = { boot, wait, until, css, ROOT, TRACKS };
