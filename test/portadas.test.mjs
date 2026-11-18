/* =====================================================================
 *  test/portadas.test.mjs — la portada generada es una sola
 *
 *  Antes había dos pintores (reproductor y filas) y la misma canción se
 *  veía distinta según dónde miraras. Lo que se prueba aquí es que los
 *  dos caminos pasan por el mismo pintor y que la semilla es estable.
 * ===================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, bootApp, makeTrack, setLibrary } from './helpers/app.mjs';

/** Contexto 2D mínimo que solo apunta qué se ha llamado. */
function contextoEspia() {
  const llamadas = [];
  const grad = () => ({ addColorStop(o, c) { llamadas.push(['stop', o, c]); } });
  const ctx = {
    llamadas,
    fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1, font: '',
    textAlign: '', textBaseline: '', shadowColor: '', shadowBlur: 0, shadowOffsetY: 0,
    save() {}, restore() {},
    fillRect() { llamadas.push(['fillRect']); },
    createLinearGradient() { llamadas.push(['linear']); return grad(); },
    createRadialGradient() { llamadas.push(['radial']); return grad(); },
    beginPath() {}, arc() {}, stroke() {},
    fillText(t, x, y) { llamadas.push(['text', t, x, y]); },
  };
  return ctx;
}

test('el pintor de portadas existe y la semilla depende del texto, no del azar', async () => {
  const { window, teardown } = await bootApp();
  try {
    const C = window.AuroraCover;
    assert.ok(C && typeof C.paint === 'function', 'window.AuroraCover.paint');
    assert.equal(C.seedOf('Nébula'), C.seedOf('Nébula'), 'mismo título, misma semilla');
    assert.notEqual(C.seedOf('Nébula'), C.seedOf('Aurora'));
  } finally { teardown(); }
});

test('la letra de la portada sale del título', async () => {
  const { window, teardown } = await bootApp();
  try {
    const ctx = contextoEspia();
    window.AuroraCover.paint(ctx, 200, 200, { from: '#111111', to: '#333333', text: 'ópera' });
    const texto = ctx.llamadas.find((c) => c[0] === 'text');
    assert.equal(texto[1], 'Ó', 'la inicial se pone en mayúscula');
    // Centrada: x = mitad del lienzo.
    assert.equal(texto[2], 100);
  } finally { teardown(); }
});

test('el reproductor y las filas usan el mismo pintor', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const pista = makeTrack('c1', { cover: { from: '#AA0000', to: '#0000AA' } });
    setLibrary(App, [pista]);

    const original = window.AuroraCover.paint;
    const usos = [];
    window.AuroraCover.paint = function (ctx, W, H, opts) {
      usos.push({ W, H, opts });
      return original.call(this, ctx, W, H, opts);
    };
    try {
      // Camino de las filas y tarjetas.
      App._paintLetterCover(contextoEspia(), 120, 120, pista);
      // Camino del reproductor: necesita su lienzo en el DOM.
      App.currentTrack = pista;
      App.drawCover('coverCanvas', pista);
      App.drawCover('miniCoverCanvas', pista, true);
    } finally {
      window.AuroraCover.paint = original;
    }

    assert.equal(usos.length, 3, 'los tres pintados pasan por AuroraCover.paint');
    for (const u of usos) {
      assert.equal(u.opts.from, '#AA0000', 'la paleta de la pista llega intacta');
      assert.equal(u.opts.to, '#0000AA');
      assert.equal(u.opts.text, pista.title);
    }
  } finally { teardown(); }
});

test('sin el módulo de portadas el lienzo no queda en blanco', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const pista = makeTrack('c2', { cover: { from: '#123456', to: '#654321' } });
    const original = window.AuroraCover;
    const ctx = contextoEspia();
    try {
      delete window.AuroraCover;
      App._paintLetterCover(ctx, 40, 40, pista);
    } finally {
      window.AuroraCover = original;
    }
    assert.ok(ctx.llamadas.some((c) => c[0] === 'fillRect'), 'se pinta al menos el fondo');
  } finally { teardown(); }
});

/* ------------------------------------------------------------------
 *  Portada de una lista sin carátula
 * ------------------------------------------------------------------ */

test('la lista sin carátula se distingue por su inicial y su luz', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    setLibrary(App, []);
    App.playlists = [
      { id: 'p1', name: 'Noche larga', trackIds: [], cover: { from: '#123456', to: '#654321' } },
      { id: 'p2', name: 'Mañana', trackIds: [], cover: { from: '#123456', to: '#654321' } },
    ];
    App.renderPlaylists();

    const cards = [...window.document.querySelectorAll('#libraryPlaylists .pl-card')];
    assert.equal(cards.length, 2);

    const letras = cards.map((c) => c.querySelector('.pl-cover-letter'));
    assert.ok(letras.every(Boolean), 'cada lista lleva su inicial');
    assert.deepEqual(letras.map((l) => l.textContent), ['N', 'M']);

    const fondos = cards.map((c) => c.querySelector('.pl-cover-grad').getAttribute('style') || '');
    assert.ok(fondos.every((f) => /radial-gradient/.test(f)), 'el fondo lleva la luz, no solo el degradado');
    assert.ok(fondos.every((f) => /linear-gradient/.test(f)));
    assert.notEqual(fondos[0], fondos[1], 'dos nombres distintos no dan el mismo fondo');
  } finally { teardown(); }
});

test('un color guardado que no es hex no llega al estilo', async () => {
  const { App, teardown } = await bootApp();
  try {
    const style = App.playlistCoverStyle({
      id: 'x', name: 'x',
      cover: { from: "red; background:url('http://malo')", to: '#ABCDEF' },
    });
    assert.equal(/url\(|http|;background/i.test(style), false, 'nada raro dentro del fondo');
    assert.match(style, /#ABCDEF/);
  } finally { teardown(); }
});

test('CSS conserva las reglas base de .pl-cover, .pl-cover-grad, .pl-cover-letter y .pl-play-fab', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
  assert.match(css, /\.pl-cover\s*\{[^}]*position:\s*relative[^}]*overflow:\s*hidden/s,
    '.pl-cover posiciona y recorta sus capas');
  assert.match(css, /\.pl-cover\s+\.pl-cover-grad\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s,
    '.pl-cover-grad cubre toda la tarjeta y no colapsa a 0px');
  assert.match(css, /\.pl-cover-letter\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s,
    '.pl-cover-letter queda centrada sobre el degradado');
  assert.match(css, /\.pl-play-fab\s*\{[^}]*position:\s*absolute[^}]*border-radius:\s*50%/s,
    '.pl-play-fab conserva su geometría flotante');
});

test('el collage tolera portadas fallidas, mantiene degradado de respaldo y vuelve al degradado al vaciar', async () => {
  const { App, window, errors, teardown } = await bootApp({ lang: 'es' });
  try {
    // Simulamos carga de imágenes: la segunda falla (3 válidas de 4) para
    // comprobar que drawCollage usa images.length y no selected.length.
    const ART_OK = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';
    const ART_BAD = 'data:image/jpeg;base64,ROTA000000000000000000000000';
    const RealImage = window.Image;
    window.Image = class MockImage {
      constructor() {
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        this.width = 0;
        this.height = 0;
        this.onload = null;
        this.onerror = null;
      }
      set src(v) {
        this._src = v;
        setTimeout(() => {
          if (v === ART_BAD) {
            if (this.onerror) this.onerror(new Error('bad image'));
          } else {
            this.naturalWidth = 128;
            this.naturalHeight = 128;
            this.width = 128;
            this.height = 128;
            if (this.onload) this.onload();
          }
        }, 0);
      }
      get src() { return this._src || ''; }
    };
    const REAL_1PX_PNG =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=';
    window.HTMLCanvasElement.prototype.toDataURL = () => REAL_1PX_PNG;

    const tracks = [
      makeTrack('c1', { cover: ART_OK, coverThumbLg: ART_OK, coverIsImage: true }),
      makeTrack('c2', { cover: ART_BAD, coverThumbLg: ART_BAD, coverIsImage: true }),
      makeTrack('c3', { cover: ART_OK, coverThumbLg: ART_OK, coverIsImage: true }),
      makeTrack('c4', { cover: ART_OK, coverThumbLg: ART_OK, coverIsImage: true }),
    ];
    setLibrary(App, tracks);
    App.playlists = [{
      id: 'pl-mix',
      name: 'Viaje',
      trackIds: ['c1', 'c2', 'c3', 'c4'],
      cover: { from: '#7C3AED', to: '#EC4899', angle: 135 },
    }];

    App.renderPlaylists();
    App.renderHome();
    App.openEditPlaylist('pl-mix');

    await new Promise((r) => setTimeout(r, 40));

    const pl = App.playlists[0];
    assert.equal(pl.coverArt, REAL_1PX_PNG,
      'el collage de 3 imágenes válidas se generó sin lanzar excepción');

    // Re-renderizar Listas e Inicio conserva el collage Y el degradado de respaldo debajo.
    App.renderPlaylists();
    App.renderHome();

    const gradEl = window.document.querySelector('#libraryPlaylists .pl-cover-grad');
    assert.ok(gradEl);
    const libStyle = gradEl.getAttribute('style') || '';
    assert.match(libStyle, /url\(/, 'la tarjeta de biblioteca muestra el collage');
    assert.match(libStyle, /linear-gradient/, 'debajo del collage queda el degradado de respaldo');
    assert.equal(window.document.querySelector('#libraryPlaylists .pl-cover-letter'), null,
      'con collage no se superpone la inicial');

    const homeCover = window.document.querySelector('#homePlaylists .home-card-cover');
    assert.ok(homeCover);
    assert.equal(homeCover.classList.contains('has-art'), true);
    assert.equal(homeCover.querySelector('.pl-cover-letter'), null,
      'en Inicio tampoco queda la inicial encima del collage');
    assert.match(homeCover.getAttribute('style') || '', /linear-gradient/,
      'en Inicio también hay degradado de respaldo');

    const editCover = window.document.getElementById('editPlaylistCover');
    assert.ok(editCover.querySelector('img'), 'el editor enseña la imagen del collage');
    assert.match(editCover.getAttribute('style') || '', /linear-gradient/,
      'el editor conserva el degradado CSS debajo del <img>');

    // Al quitar todas las pistas, el collage se invalida y reaparece el degradado (nunca negro).
    for (const id of ['c1', 'c2', 'c3', 'c4']) App.removeFromPlaylist('pl-mix', id);
    assert.equal(pl.coverArt, null, 'al vaciar la lista se limpia el collage anterior');
    const emptyGrad = window.document.querySelector('#libraryPlaylists .pl-cover-grad');
    assert.match(emptyGrad.getAttribute('style') || '', /linear-gradient/);
    assert.equal(/url\(/.test(emptyGrad.getAttribute('style') || ''), false);
    assert.ok(window.document.querySelector('#libraryPlaylists .pl-cover-letter'),
      'la lista vacía recupera su inicial');
    assert.ok(editCover.querySelector('canvas') || editCover.querySelector('.pl-cover-letter'),
      'el encabezado de la lista vacía recupera su portada generada');

    // Repintado tras volver del segundo plano no lanza errores.
    assert.doesNotThrow(() => App.refreshVisibleCovers());

    window.Image = RealImage;
    assert.deepEqual(errors, []);
  } finally { teardown(); }
});

test('un canvas 2D perdido por la GPU no guarda un collage negro', async () => {
  const { App, window, teardown } = await bootApp();
  try {
    const ART = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';
    window.Image = class {
      set src(v) {
        this._s = v;
        this.naturalWidth = 64;
        this.naturalHeight = 64;
        this.width = 64;
        this.height = 64;
        setTimeout(() => this.onload && this.onload(), 0);
      }
    };
    const origGetCtx = window.HTMLCanvasElement.prototype.getContext;
    window.HTMLCanvasElement.prototype.getContext = function () {
      const base = origGetCtx.call(this);
      return new Proxy(base, {
        get(target, prop) {
          if (prop === 'isContextLost') return () => true;
          return target[prop];
        },
      });
    };

    setLibrary(App, [makeTrack('g1', { cover: ART, coverThumbLg: ART, coverIsImage: true })]);
    const pl = { id: 'pl-gpu', name: 'Nocturna', trackIds: ['g1'], cover: { from: '#14B8A6', to: '#6366F1', angle: 135 } };
    App.playlists = [pl];
    App.renderPlaylists();

    await new Promise((r) => setTimeout(r, 30));
    assert.equal(pl.coverArt || null, null, 'no se cachea ni persiste un JPEG negro');
    const grad = window.document.querySelector('#libraryPlaylists .pl-cover-grad');
    assert.match(grad.getAttribute('style') || '', /linear-gradient/, 'mantiene el degradado vivo');
  } finally { teardown(); }
});
