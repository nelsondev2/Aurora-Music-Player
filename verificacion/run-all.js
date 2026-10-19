'use strict';
/* Ejecuta las tres suites en procesos separados y resume el resultado.
 * Uso: npm test  (o node run-all.js) */
const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
  ['ui-polish.js', 'Pulido de interfaz (12 hallazgos)'],
  ['smoke.js', 'Regresiones generales'],
  ['a11y.js', 'Accesibilidad axe-core']
];

let failed = 0;
for (const [file, label] of suites) {
  console.log('\n' + '='.repeat(64));
  console.log('▶ ' + label + ' — ' + file);
  console.log('='.repeat(64));
  const res = spawnSync(process.execPath, [path.join(__dirname, file)], {
    stdio: 'inherit',
    cwd: __dirname
  });
  if (res.status !== 0) failed++;
}

console.log('\n' + '='.repeat(64));
if (failed) {
  console.log(`${failed} suite(s) con fallos.`);
  process.exit(1);
}
console.log('Todas las suites pasaron.');
