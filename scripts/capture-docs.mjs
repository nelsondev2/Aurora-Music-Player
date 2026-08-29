#!/usr/bin/env node
/**
 * Captura docs/{now-playing,library,lyrics}.jpg desde la app real (390×844).
 * Uso: NODE_PATH=…/node_modules node scripts/capture-docs.mjs
 * Requiere puppeteer-core + Chromium (@sparticuz/chromium o PLAYWRIGHT_CHROMIUM).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function resolveChromium() {
  const env = process.env.CHROMIUM_PATH;
  if (env && fs.existsSync(env)) return { executablePath: env, args: ['--no-sandbox', '--disable-gpu'] };
  try {
    const chromium = (await import('@sparticuz/chromium')).default;
    chromium.setGraphicsMode = false;
    return {
      executablePath: await chromium.executablePath(),
      args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage'],
    };
  } catch (e) {
    throw new Error('No Chromium. Instala @sparticuz/chromium o define CHROMIUM_PATH. ' + e.message);
  }
}

async function shot(page, name) {
  const el = await page.$('#deviceScreen');
  if (!el) throw new Error('no #deviceScreen');
  const dest = path.join(DOCS, name);
  await el.screenshot({ path: dest, type: 'jpeg', quality: 86 });
  const st = fs.statSync(dest);
  console.log('wrote', dest, st.size, 'bytes');
}

async function main() {
  const puppeteer = (await import('puppeteer-core')).default;
  const { executablePath, args } = await resolveChromium();
  const { server, port } = await serve();
  const browser = await puppeteer.launch({
    executablePath,
    args,
    headless: 'shell',
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
  });
  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('aurora_lang', 'es'); } catch (e) {}
    });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForFunction(() => window.App && typeof App.renderCurrentTrack === 'function', { timeout: 20000 });
    await page.evaluate(() => {
      const A = window.App;
      const lrc = [
        '[00:00.00]Bailamos bajo',
        '[00:04.20]una luna sintética',
        '[00:08.50]Seguimos los ríos',
        '[00:12.80]de neón hasta casa',
        '[00:17.10]Tu latido',
        '[00:21.40]en el rumor de la ciudad',
        '[00:25.80]Y así, sin rumbo,',
        '[00:30.20]no teníamos a dónde ir',
        '[00:34.50]la noche abre un túnel',
        '[00:38.80]de cristal y lluvia',
      ];
      const mk = (id, title, artist, album, dur, from, to, extra) => ({
        id, title, artist, album, duration: dur,
        cover: { from, to, angle: 135 },
        coverIsImage: false,
        lrc: extra || null,
        addedAt: Date.now() - Math.random() * 1e7,
        fileName: title + '.mp3',
        fileSize: 3200000,
      });
      A.tracks = [
        mk('t1', 'Ríos de neón', 'Luna Park', 'Aurora', 227, '#6E5CFF', '#FF7AB6', lrc),
        mk('t2', 'Cristal de medianoche', 'The Midnight', 'Endless Summer', 238, '#1A508C', '#5AD4DC'),
        mk('t3', 'Estática ámbar', 'Luna Wave', 'Amber Static', 261, '#C45C18', '#E8B84A'),
        mk('t4', 'Lluvia polaroid', 'Hotel Pools', 'Polaroid Rain', 223, '#2846A0', '#B48CFF'),
        mk('t5', 'Ecos', 'Com Truise', 'Iteration', 287, '#14285A', '#508CDC'),
        mk('t6', 'Horizonte de terciopelo', 'Tycho', 'Dive', 279, '#C8505A', '#FFA078'),
      ];
      A.lang = 'es';
      if (typeof A.applyLang === 'function') A.applyLang();
      A.currentTrack = A.tracks[0];
      A.queue = A.tracks.map(t => t.id);
      A.queueIdx = 0;
      A.isPlaying = true;
      A.playContext = { type: 'playlist', name: 'Aurora' };
      if (A.favorites && A.favorites.add) A.favorites.add('t1');
      if (typeof A.hideEmptyState === 'function') A.hideEmptyState();
      A.renderCurrentTrack();
      A.updatePlayUI();
      A.renderLibrary();
      if (typeof A.renderHome === 'function') A.renderHome();
      A.renderLyrics();
      A.setShuffleUI();
      A.setRepeatUI();
      if (typeof A.updateFavoriteUI === 'function') A.updateFavoriteUI();
      const fill = document.getElementById('progressFill');
      if (fill) fill.style.width = '38%';
      const cur = document.getElementById('timeCurrent');
      if (cur) cur.textContent = '1:24';
      const mini = document.getElementById('miniProgress');
      if (mini) mini.style.width = '38%';
    });
    await page.waitForTimeout ? page.waitForTimeout(200) : page.waitForFunction(() => true);

    await page.evaluate(() => {
      const A = window.App;
      A.showView('player');
      A.setNavActive('home');
      if (typeof A.updateChrome === 'function') A.updateChrome();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
    await new Promise(r => setTimeout(r, 350));
    await shot(page, 'now-playing.jpg');

    await page.evaluate(() => {
      const A = window.App;
      A.goNav('library');
    });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
    await shot(page, 'library.jpg');

    await page.evaluate(() => {
      const A = window.App;
      A.closeAllSheets && A.closeAllSheets();
      A.showView('lyrics');
      A.renderLyrics();
      A.updatePlayUI();
      if (A.lrcRafId) { cancelAnimationFrame(A.lrcRafId); A.lrcRafId = null; }
      A.startLrcRafSync = function () {};
      A.lrcUserScrolling = true;
      if (typeof A.updateLyricsHighlight === 'function') A.updateLyricsHighlight(12.9);
      if (typeof A.updateChrome === 'function') A.updateChrome();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
    await new Promise(r => setTimeout(r, 200));
    await page.evaluate(() => {
      const A = window.App;
      if (typeof A.updateLyricsHighlight === 'function') A.updateLyricsHighlight(12.9);
    });
    await shot(page, 'lyrics.jpg');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
