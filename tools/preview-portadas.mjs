/* =====================================================================
 *  tools/preview-portadas.mjs — vista previa de la portada generada
 *
 *  Pinta con el MISMO código que la app (`js/portadas.js`), no con una
 *  copia: se evalúa el archivo en un contexto mínimo y se le pasa un
 *  contexto 2D que apunta las llamadas y las traduce a SVG. Así la
 *  imagen de `docs/portadas.png` no se puede desincronizar del pintor.
 *
 *  Uso: npm run covers:preview
 * ===================================================================== */

import fs from 'node:fs';
import vm from 'node:vm';
import { Resvg } from '@resvg/resvg-js';

const ROOT = new URL('..', import.meta.url);
const leer = (p) => fs.readFileSync(new URL(p, ROOT), 'utf8');

/* ---------- el pintor real, cargado de su archivo ---------- */
const sandbox = { window: {}, Math, String, Array, Object, Number };
vm.createContext(sandbox);
vm.runInContext(leer('js/portadas.js'), sandbox);
const AuroraCover = sandbox.window.AuroraCover;
if (!AuroraCover || typeof AuroraCover.paint !== 'function') {
  throw new Error('js/portadas.js no expone window.AuroraCover.paint');
}

/* ---------- contexto 2D que dibuja en SVG ---------- */
/* Los ids de los degradados son globales a la lámina: si cada lienzo
 * numerara desde cero, el navegador (y resvg) resolverían todos los
 * `url(#g1)` al último definido y las ocho portadas saldrían del mismo
 * color. */
let seqGlobal = 0;

function svgContext() {
  const defs = [];
  const body = [];
  const base = () => ({
    fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, lineWidth: 1,
    font: '16px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
    shadowColor: 'transparent', shadowBlur: 0, shadowOffsetY: 0,
  });
  let st = base();
  const stack = [];

  const color = (value) => {
    if (value && typeof value === 'object' && value.__gradient) {
      const id = 'g' + (++seqGlobal);
      const g = value;
      const stops = g.stops
        .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`)
        .join('');
      defs.push(g.kind === 'linear'
        ? `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${g.x0}" y1="${g.y0}" x2="${g.x1}" y2="${g.y1}">${stops}</linearGradient>`
        : `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${g.x1}" cy="${g.y1}" r="${g.r1}" fx="${g.x0}" fy="${g.y0}">${stops}</radialGradient>`);
      return `url(#${id})`;
    }
    return String(value);
  };

  const ctx = {
    get fillStyle() { return st.fillStyle; },
    set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; },
    set strokeStyle(v) { st.strokeStyle = v; },
    get globalAlpha() { return st.globalAlpha; },
    set globalAlpha(v) { st.globalAlpha = v; },
    get lineWidth() { return st.lineWidth; },
    set lineWidth(v) { st.lineWidth = v; },
    get font() { return st.font; },
    set font(v) { st.font = v; },
    get textAlign() { return st.textAlign; },
    set textAlign(v) { st.textAlign = v; },
    get textBaseline() { return st.textBaseline; },
    set textBaseline(v) { st.textBaseline = v; },
    get shadowColor() { return st.shadowColor; },
    set shadowColor(v) { st.shadowColor = v; },
    get shadowBlur() { return st.shadowBlur; },
    set shadowBlur(v) { st.shadowBlur = v; },
    get shadowOffsetY() { return st.shadowOffsetY; },
    set shadowOffsetY(v) { st.shadowOffsetY = v; },
    save() { stack.push({ ...st }); },
    restore() { st = stack.pop() || base(); },
    fillRect(x, y, w, h) {
      body.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color(st.fillStyle)}" opacity="${st.globalAlpha}"/>`);
    },
    createLinearGradient(x0, y0, x1, y1) {
      const g = { __gradient: true, kind: 'linear', x0, y0, x1, y1, stops: [], addColorStop(o, c) { g.stops.push({ offset: o, color: c }); } };
      return g;
    },
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      const g = { __gradient: true, kind: 'radial', x0, y0, r0, x1, y1, r1, stops: [], addColorStop(o, c) { g.stops.push({ offset: o, color: c }); } };
      return g;
    },
    beginPath() { ctx._arc = null; },
    arc(x, y, r) { ctx._arc = { x, y, r }; },
    stroke() {
      if (!ctx._arc) return;
      const a = ctx._arc;
      body.push(`<circle cx="${a.x}" cy="${a.y}" r="${a.r}" fill="none" stroke="${color(st.strokeStyle)}" stroke-width="${st.lineWidth}" opacity="${st.globalAlpha}"/>`);
    },
    fillText(text, x, y) {
      const m = /(\d+(?:\.\d+)?)px/.exec(st.font || '');
      const size = m ? Number(m[1]) : 16;
      const weight = /(\d00)\s/.exec(st.font || '');
      const anchor = st.textAlign === 'center' ? 'middle' : (st.textAlign === 'right' ? 'end' : 'start');
      const common = `font-family="Outfit, sans-serif" font-size="${size}" font-weight="${weight ? weight[1] : 400}" text-anchor="${anchor}"`;
      if (st.shadowColor && st.shadowColor !== 'transparent') {
        body.push(`<text x="${x}" y="${y + (st.shadowOffsetY || 0)}" ${common} fill="${st.shadowColor}" opacity="${st.globalAlpha * 0.75}" filter="url(#soft)">${text}</text>`);
      }
      body.push(`<text x="${x}" y="${y}" ${common} fill="${color(st.fillStyle)}" opacity="${st.globalAlpha}">${text}</text>`);
    },
  };
  ctx._arc = null;

  const toSvg = (w, h) =>
    `<g><defs>${defs.join('')}</defs>${body.join('')}</g>`;
  return { ctx, toSvg };
}

/* ---------- composición de la lámina ---------- */
const PARES = [
  ['#6E5CFF', '#FF7AB6'], ['#1A508C', '#5AD4DC'], ['#C45C18', '#E8B84A'], ['#7A1E3C', '#E85A7A'],
  ['#2A6B48', '#A8C86A'], ['#2846A0', '#B48CFF'], ['#C8505A', '#FFA078'], ['#0C4A5E', '#46C8DC'],
];
const TEMAS = ['Nébula', 'Aurora', 'Costa Norte', 'Bruma', 'Raíz', 'Cobalto', 'Ámbar', 'Marea'];

function portada(x, y, size, i) {
  const [from, to] = PARES[i % PARES.length];
  const { ctx, toSvg } = svgContext();
  AuroraCover.paint(ctx, size, size, { from, to, text: TEMAS[i % TEMAS.length] });
  return `<g transform="translate(${x},${y})"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.06)}"/>` +
    `<clipPath id="c${i}${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.06)}"/></clipPath>` +
    `<g clip-path="url(#c${i}${size})">${toSvg(size, size)}</g></g>`;
}

const W = 1180;
const PAD = 40;
const BIG = 250;
let svg = '';
let y = 118;

svg += `<text x="${PAD}" y="46" font-family="sans-serif" font-size="22" font-weight="700" fill="#EDEAF7">Portada generada · Aurora Music Player</text>`;
svg += `<text x="${PAD}" y="72" font-family="sans-serif" font-size="13" fill="#9A94B4">Sale de js/portadas.js. Paleta COVER_PALETTE, semilla = título: la misma canción siempre se ve igual.</text>`;
svg += `<text x="${PAD}" y="94" font-family="sans-serif" font-size="13" fill="#9A94B4">La inicial, el ángulo del degradado y el sitio del resplandor cambian con el título; el estilo no.</text>`;

// fila 1: tamaño de reproductor / tarjeta grande
for (let i = 0; i < 4; i++) {
  const x = PAD + i * (BIG + 26);
  svg += portada(x, y, BIG, i);
  svg += `<text x="${x}" y="${y + BIG + 22}" font-family="sans-serif" font-size="13" fill="#EDEAF7">${TEMAS[i]}</text>`;
}
svg += `<text x="${W - PAD}" y="${y + BIG + 22}" font-family="sans-serif" font-size="12" fill="#9A94B4" text-anchor="end">${BIG} px · reproductor y tarjetas</text>`;

// fila 2: tamaño de lista y de miniatura
y += BIG + 66;
svg += `<text x="${PAD}" y="${y - 22}" font-family="sans-serif" font-size="12" fill="#9A94B4">120 px · tarjetas de lista y miniaturas</text>`;
for (let i = 0; i < 8; i++) {
  svg += portada(PAD + i * 140, y, 120, i);
}
y += 120 + 58;
svg += `<text x="${PAD}" y="${y - 22}" font-family="sans-serif" font-size="12" fill="#9A94B4">40 px · filas de pista (sin surcos: a este tamaño solo ensucian)</text>`;
for (let i = 0; i < 8; i++) {
  svg += portada(PAD + i * 140, y, 40, i);
}
y += 40 + 40;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}">
<defs><filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter></defs>
<rect width="100%" height="100%" fill="#0B0A10"/>${svg}</svg>`;

const fuentes = new URL('assets/fonts/outfit-latin-700.woff2', ROOT);
const opciones = { fitTo: { mode: 'width', value: W } };
try {
  opciones.font = { fontFiles: [fuentes.pathname], loadSystemFonts: true, defaultFontFamily: 'Outfit' };
} catch (e) { /* sin la fuente del proyecto: se usa una del sistema */ }

const png = new Resvg(SVG, opciones).render().asPng();
const salida = new URL('docs/portadas.png', ROOT);
fs.writeFileSync(salida, png);
console.log(`preview: ${W} x ${Math.round(y)} · ${png.length} bytes · docs/portadas.png`);
