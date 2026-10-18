/* =====================================================================
 *  scripts/coverage.js
 *  Ejecuta toda la suite con instrumentación y publica la cobertura.
 *
 *  Uso: npm run test:coverage
 *  Salida: tabla en consola + coverage/index.html + coverage/lcov.info
 * ===================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createCoverageMap } = require('istanbul-lib-coverage');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, '.nyc_output');
const COV_DIR = path.join(ROOT, 'coverage');

const REPORT_ONLY = process.argv.includes('--report-only');
if (!REPORT_ONLY) fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(COV_DIR, { recursive: true });

const testFiles = [];
for (const dir of ['unit', 'integration', 'a11y', 'e2e']) {
  const abs = path.join(ROOT, 'tests', dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).sort()) {
    if (f.endsWith('.test.js')) testFiles.push(path.join('tests', dir, f));
  }
}

const nodeOptions = [process.env.NODE_OPTIONS, '--require', path.join(__dirname, 'coverage-hook.js')]
  .filter(Boolean).join(' ');

const run = REPORT_ONLY ? { status: 0 } : spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, AURORA_COVERAGE: '1', NODE_OPTIONS: nodeOptions }
});
if (!REPORT_ONLY && run.status !== 0) {
  console.error('\nLa suite falló; no se genera informe de cobertura.');
  process.exit(run.status || 1);
}

const map = createCoverageMap({});
if (!REPORT_ONLY) fs.rmSync(COV_DIR, { recursive: true, force: true });
fs.mkdirSync(COV_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR).filter((x) => x.endsWith('.json'))) {
  try {
    map.merge(JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8')));
  } catch (e) {
    console.warn('Cobertura ilegible en', f, '-', e.message);
  }
}

const rows = map.files()
  .filter((file) => !path.relative(ROOT, file).startsWith('assets' + path.sep))
  .sort().map((file) => {
  const sum = map.fileCoverageFor(file).toSummary();
  return {
    archivo: path.relative(ROOT, file),
    stmts: sum.statements.pct,
    ramas: sum.branches.pct,
    funcs: sum.functions.pct,
    lineas: sum.lines.pct
  };
});

const total = map.getCoverageSummary();
const pad = (v, n) => String(v).padEnd(n);
console.log('\nCobertura por archivo');
console.log(pad('Archivo', 34) + pad('% Stmts', 10) + pad('% Ramas', 10) + pad('% Funcs', 10) + '% Líneas');
console.log('-'.repeat(74));
for (const r of rows) {
  console.log(pad(r.archivo, 34) + pad(r.stmts.toFixed(1), 10) + pad(r.ramas.toFixed(1), 10) +
    pad(r.funcs.toFixed(1), 10) + r.lineas.toFixed(1));
}
console.log('-'.repeat(74));
console.log(pad('TOTAL', 34) + pad(total.statements.pct.toFixed(1), 10) +
  pad(total.branches.pct.toFixed(1), 10) + pad(total.functions.pct.toFixed(1), 10) +
  total.lines.pct.toFixed(1));

/* lcov mínimo (formato estándar, válido para SonarQube/Codecov). */
let lcov = '';
for (const file of map.files().sort()) {
  if (path.relative(ROOT, file).startsWith('assets' + path.sep)) continue;
  const fc = map.fileCoverageFor(file);
  const rel = path.relative(ROOT, file);
  lcov += 'TN:\nSF:' + file + '\n';
  const sm = fc.getLineCoverage();
  const lines = Object.keys(sm).map(Number).sort((a, b) => a - b);
  for (const line of lines) lcov += 'DA:' + line + ',' + sm[line] + '\n';
  const bs = fc.getBranchCoverageByLine();
  for (const line of Object.keys(bs).map(Number).sort((a, b) => a - b)) {
    const b = bs[line];
    for (let i = 0; i < b.locations; i++) {
      lcov += 'BRDA:' + line + ',0,' + i + ',' + (b.coverage > i ? 1 : 0) + '\n';
    }
  }
  // lcov sin FN/FNDA: getFunctionCoverageByLine no forma parte de la API
  // pública de istanbul-lib-coverage; se publican líneas y ramas.
  lcov += 'LF:' + lines.length + '\nLH:' + lines.filter((l) => sm[l] > 0).length + '\n';
  lcov += 'end_of_record\n';
  void rel;
}
fs.writeFileSync(path.join(COV_DIR, 'lcov.info'), lcov);

/* HTML legible (sin dependencias): resumen + tabla por archivo. */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const html = `<!doctype html><html lang="es"><meta charset="utf-8">
<title>Cobertura · Aurora Music Player</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:2rem;color:#1b1b1f;background:#faf7fb}
h1{font-size:1.3rem}table{border-collapse:collapse;width:100%;max-width:820px;background:#fff}
th,td{padding:.45rem .7rem;border-bottom:1px solid #e8e2ee;text-align:right}
th:first-child,td:first-child{text-align:left}th{background:#f0e9f5;font-weight:600}
.lo{color:#b3261e}.mid{color:#8a6d00}.hi{color:#116329}caption{text-align:left;padding:.5rem 0;color:#5b5560}</style>
<h1>Cobertura de pruebas · Aurora Music Player</h1>
<p>Generado por <code>npm run test:coverage</code>. La cobertura incluye los scripts ejecutados dentro de jsdom (instrumentados con istanbul) y los módulos Node del proyecto.</p>
<table><caption>${rows.length} archivos · ${total.statements.pct.toFixed(1)} % de sentencias</caption>
<thead><tr><th>Archivo</th><th>Sentencias</th><th>Ramas</th><th>Funciones</th><th>Líneas</th></tr></thead><tbody>
${rows.map((r) => `<tr><td>${esc(r.archivo)}</td>${[r.stmts, r.ramas, r.funcs, r.lineas].map((v) => `<td class="${v >= 80 ? 'hi' : v >= 50 ? 'mid' : 'lo'}">${v.toFixed(1)} %</td>`).join('')}</tr>`).join('\n')}
<tr><td><strong>TOTAL</strong></td>${[total.statements.pct, total.branches.pct, total.functions.pct, total.lines.pct].map((v) => `<td><strong>${v.toFixed(1)} %</strong></td>`).join('')}</tr>
</tbody></table></html>`;
fs.writeFileSync(path.join(COV_DIR, 'index.html'), html);

console.log('\nInforme HTML: coverage/index.html · lcov: coverage/lcov.info');
