/* =====================================================================
 *  test/portadas.test.mjs — la portada generada es una sola
 *
 *  Antes había dos pintores (reproductor y filas) y la misma canción se
 *  veía distinta según dónde miraras. Lo que se prueba aquí es que los
 *  dos caminos pasan por el mismo pintor y que la semilla es estable.
 * ===================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootApp, makeTrack, setLibrary } from './helpers/app.mjs';

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
