import fs from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const symbols = {};
for (const m of html.matchAll(/<symbol id="i-([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/symbol>/g)) {
  symbols[m[1]] = m[2];
}
const ids = Object.keys(symbols);
const USE = (id) => `<use href="#i-${id}"/>`;

/* Paleta real de la app (css/styles.css) */
const THEMES = [
  { name: 'Oscuro (por defecto)', bg: '#050509', panel: '#0a0a12', card: '#14141f', text: '#ffffff', dim: 'rgba(255,255,255,0.72)', accent: '#9D8BFF', onAccent: '#ffffff' },
  { name: 'AMOLED', bg: '#000000', panel: '#000000', card: '#0a0a0a', text: '#ffffff', dim: 'rgba(255,255,255,0.72)', accent: '#9D8BFF', onAccent: '#ffffff' },
  { name: 'Claro', bg: '#fbf7f2', panel: '#fffaf4', card: '#f1eae1', text: '#1A1612', dim: 'rgba(26,22,18,0.62)', accent: '#5B45D6', onAccent: '#ffffff' },
];

const COLS = 7, CELL = 104;
const rows = Math.ceil(ids.length / COLS);
const W = 1090;
const GRID_TOP = 300;
const GRID_W = COLS * CELL;
const GRID_X = (W - GRID_W) / 2;
const H = GRID_TOP + rows * CELL + 20;

let themePanels = '';
THEMES.forEach((t, i) => {
  const x = 24 + i * 348, y = 54, w = 324, h = 210;
  themePanels += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${t.bg}"/>`;
  themePanels += `<text x="${x + 16}" y="${y + 24}" font-family="sans-serif" font-size="11" fill="${t.dim}">${t.name}</text>`;
  // barra inferior de navegación
  themePanels += `<rect x="${x + 14}" y="${y + 40}" width="${w - 28}" height="40" rx="12" fill="${t.panel}" stroke="rgba(128,128,128,0.18)"/>`;
  ['house', 'magnifying-glass', 'library'].forEach((id, k) => {
    const cx = x + 46 + k * 54;
    const active = k === 0;
    themePanels += `<g transform="translate(${cx - 10},${y + 50}) scale(${20 / 24})" color="${active ? t.accent : t.dim}">${symbols[id]}</g>`;
  });
  themePanels += `<text x="${x + w - 16}" y="${y + 66}" font-family="sans-serif" font-size="10" fill="${t.dim}" text-anchor="end">nav 20 px</text>`;
  // transporte del reproductor
  themePanels += `<rect x="${x + 14}" y="${y + 88}" width="${w - 28}" height="56" rx="14" fill="${t.card}"/>`;
  const play = ['backward-step', 'play', 'pause', 'forward-step'];
  play.forEach((id, k) => {
    const cx = x + 52 + k * 62;
    const big = id === 'play' || id === 'pause';
    const size = big ? 26 : 22;
    if (id === 'play') return; // va en el botón circular de abajo
    themePanels += `<g transform="translate(${cx - size / 2},${y + 102 + (26 - size) / 2}) scale(${size / 24})" color="${t.text}">${symbols[id]}</g>`;
  });
  // El play del reproductor es un botón circular con el acento de fondo
  // (.ctrl-play): se reproduce igual para ver el icono sobre el acento.
  themePanels += `<circle cx="${x + 114}" cy="${y + 116}" r="24" fill="${t.accent}"/>`;
  themePanels += `<g transform="translate(${x + 114 - 13},${y + 116 - 13}) scale(${26 / 24})" color="#ffffff">${symbols.play}</g>`;
  // filas de menú
  ['list-ul', 'heart', 'gear', 'trash-can'].forEach((id, k) => {
    const cx = x + 40 + k * 66;
    themePanels += `<g transform="translate(${cx - 8},${y + 160}) scale(${16 / 24})" color="${t.dim}">${symbols[id]}</g>`;
  });
  themePanels += `<text x="${x + w - 16}" y="${y + 172}" font-family="sans-serif" font-size="10" fill="${t.dim}" text-anchor="end">menú 16 px</text>`;
});

let cells = '';
ids.forEach((id, i) => {
  const x = GRID_X + (i % COLS) * CELL;
  const y = GRID_TOP + Math.floor(i / COLS) * CELL;
  cells += `<g transform="translate(${x + CELL / 2 - 24},${y + 18}) scale(2)" color="#e9e9f2">${symbols[id]}</g>`;
  cells += `<text x="${x + CELL / 2}" y="${y + 78}" font-family="monospace" font-size="9" fill="#6f6f85" text-anchor="middle">${id}</text>`;
  cells += `<g transform="translate(${x + CELL / 2 - 8},${y + 84}) scale(${16 / 24})" color="#e9e9f2">${symbols[id]}</g>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${Object.entries(symbols).map(([id, body]) => `<g id="i-${id}">${body}</g>`).join('')}</defs>
  <rect width="${W}" height="${H}" fill="#08080f"/>
  <text x="24" y="30" font-family="sans-serif" font-size="15" fill="#e9e9f2">Aurora Music Player · sprite de iconos</text>
  <text x="${W - 24}" y="30" font-family="monospace" font-size="10" fill="#6f6f85" text-anchor="end">${ids.length} símbolos · rejilla 24 · trazo 1,9 · currentColor</text>
  ${themePanels}
  <text x="${GRID_X}" y="${GRID_TOP - 18}" font-family="sans-serif" font-size="11" fill="#6f6f85">Todos los símbolos · 48 px y 16 px</text>
  ${cells}
</svg>`;

const r = new Resvg(svg, { fitTo: { mode: 'width', value: W * 2 } });
fs.writeFileSync(new URL('../docs/iconos-sprite.png', import.meta.url), r.render().asPng());
console.log('preview:', W * 2, 'x', H * 2, '· símbolos', ids.length);
