/* =====================================================================
 *  test/helpers/app.mjs — arranque de la app real para las pruebas
 *
 *  Carga index.html y los scripts de js/ en un DOM de jsdom, con
 *  IndexedDB de verdad (fake-indexeddb), <audio> y Web Audio
 *  instrumentados. No modifica el código de la app: la prueba corre
 *  sobre lo mismo que se empaqueta en el .xdc.
 *
 *  Ojo: el orden de los <script> de index.html manda (main.js, el
 *  último). Si se añade un módulo, se recoge solo.
 * ===================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/* Contexto 2D falso: los canvas de portadas se pintan de verdad en la
 * app, pero aquí no hay rasterizador ni falta que hace. */
function fakeCanvasContext() {
  return new Proxy({}, {
    get(_t, prop) {
      if (prop === 'canvas') return { width: 10, height: 10 };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (prop === 'measureText') return () => ({ width: 10 });
      return () => {};
    },
    set: () => true,
  });
}

class FakeAudioContext {
  constructor() {
    this.state = 'running';
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.destination = {};
  }
  createMediaElementSource() { return { connect() {}, disconnect() {} }; }
  createAnalyser() {
    return {
      fftSize: 256,
      frequencyBinCount: 128,
      smoothingTimeConstant: 0.8,
      connect() {},
      getByteFrequencyData(a) { if (a) a.fill(128); },
      getByteTimeDomainData(a) { if (a) a.fill(128); },
    };
  }
  createGain() {
    return {
      gain: {
        value: 1,
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        cancelScheduledValues() {},
        setTargetAtTime() {},
      },
      connect() {}, disconnect() {},
    };
  }
  createBiquadFilter() {
    return {
      type: '',
      frequency: { value: 0 },
      gain: { value: 0 },
      Q: { value: 0 },
      connect() {}, disconnect() {},
    };
  }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

/**
 * Arranca la app completa.
 * @returns {Promise<{dom, window, App, errors, tracks, teardown}>}
 */
export async function bootApp({ lang = null, settleMs = 60 } = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const errors = [];

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    const msg = String(e.message || e);
    // jsdom no implementa canvas.toDataURL ni el audio: no son fallos.
    if (/toDataURL|Not implemented|Could not parse CSS/i.test(msg)) return;
    errors.push('jsdom: ' + msg);
  });
  virtualConsole.on('error', (...args) => errors.push('console.error: ' + args.join(' ')));

  const dom = new JSDOM(html, {
    url: 'http://localhost:8000/index.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });
  const window = dom.window;

  /* --- almacenamiento --- */
  window.indexedDB = new IDBFactory();
  window.IDBKeyRange = IDBKeyRange;

  /* --- canvas --- */
  window.HTMLCanvasElement.prototype.getContext = function () { return fakeCanvasContext(); };
  window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,AA'; };

  /* --- objectURL con contabilidad (para probar el desalojo) --- */
  let urlSeq = 0;
  const liveUrls = new Map();
  window.URL.createObjectURL = () => {
    const url = 'blob:aurora/' + (++urlSeq);
    liveUrls.set(url, true);
    return url;
  };
  window.URL.revokeObjectURL = (url) => { liveUrls.delete(url); };

  /* --- <audio> --- */
  window.HTMLMediaElement.prototype.play = function () { this._playing = true; return Promise.resolve(); };
  window.HTMLMediaElement.prototype.pause = function () { this._playing = false; };
  window.HTMLMediaElement.prototype.load = function () {};
  Object.defineProperty(window.HTMLMediaElement.prototype, 'duration', { get() { return 180; }, configurable: true });
  Object.defineProperty(window.HTMLMediaElement.prototype, 'readyState', { get() { return 4; }, configurable: true });
  Object.defineProperty(window.HTMLMediaElement.prototype, 'paused', { get() { return !this._playing; }, configurable: true });
  Object.defineProperty(window.HTMLMediaElement.prototype, 'currentTime', {
    get() { return this._ct || 0; },
    set(v) { this._ct = v; },
    configurable: true,
  });
  // `audio.played` es lo que decide si una escucha cuenta como completa.
  Object.defineProperty(window.HTMLMediaElement.prototype, 'played', {
    get() {
      const self = this;
      return {
        length: 1,
        start: () => 0,
        end: () => self.duration || 0,
      };
    },
    configurable: true,
  });

  /* --- Web Audio, media session, media queries --- */
  window.AudioContext = FakeAudioContext;
  window.webkitAudioContext = FakeAudioContext;
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  });
  window.navigator.mediaSession = { metadata: null, setActionHandler() {}, setPositionState() {} };
  window.MediaMetadata = function (o) { Object.assign(this, o); };

  /* --- scripts, en el orden del HTML (webxdc.js lo inyecta el cliente) --- */
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((src) => src !== 'webxdc.js');
  for (const src of scripts) {
    const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
    try {
      window.eval(code);
    } catch (e) {
      errors.push('eval ' + src + ': ' + e.message);
    }
  }

  // init() es asíncrono (IndexedDB): se espera a que marque _initialized.
  const App = window.App;
  const deadline = Date.now() + 5000;
  while (App && !App._initialized && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10));
  }
  if (lang) App.setLang(lang);
  await new Promise((r) => setTimeout(r, settleMs));

  /* La app deja timers vivos a propósito (sesión cada 5 s, toasts,
   * visualizador). Si se cierra el DOM con ellos en marcha, disparan
   * contra un documento ya muerto y ensucian la prueba. */
  const teardown = () => {
    const limpiar = (fn) => { try { fn(); } catch (e) {} };
    limpiar(() => App._sessionTimer && clearInterval(App._sessionTimer));
    limpiar(() => App._statsFlushTimer && clearInterval(App._statsFlushTimer));
    limpiar(() => App._toastTimer && clearTimeout(App._toastTimer));
    limpiar(() => App.sleepTimer && clearTimeout(App.sleepTimer));
    limpiar(() => typeof App.stopVisualizer === 'function' && App.stopVisualizer());
    limpiar(() => App._preloadAudio && (App._preloadAudio.src = ''));
    limpiar(() => App.audioCtx && App.audioCtx.close && App.audioCtx.close());
    // Cerrar el DOM al instante aborta las promesas en vuelo (normalización,
    // precarga) y estas revientan contra un `document` ya desaparecido.
    // Se deja que terminen y se cierra después: el proceso de prueba no
    // se queda colgado porque no queda ningún timer vivo.
    setTimeout(() => limpiar(() => dom.window.close()), 80);
  };

  return { dom, window, App, errors, liveUrls, teardown };
}

/** Pista de mentira con la forma que usa la app. */
export function makeTrack(id, over = {}) {
  return {
    id,
    title: 'Título ' + id,
    artist: 'Artista ' + id,
    album: 'Álbum ' + id,
    fileName: id + '.mp3',
    fileSize: 1000,
    duration: 180,
    size: 1000,
    artwork: null,
    addedAt: Date.now(),
    rating: 0,
    // Blob de mentira: sin fuente de audio la app salta la pista (y hace
    // bien), así que las pruebas de reproducción necesitan una.
    fileBlob: { size: 1000 },
    ...over,
  };
}

/** Deja la biblioteca y el estado de reproducción en un punto conocido. */
export function setLibrary(App, tracks) {
  App.tracks = tracks;
  App.invalidateTrackIndex();
  App.queue = [];
  App.queueIdx = 0;
  App.currentTrack = null;
  App.playContext = null;
  App.playlists = [];
  App.favorites = new Set();
  App.shuffle = false;
  App.repeat = 'off';
  return App;
}
