/* =====================================================================
 *  test/package.test.mjs — el .xdc que se publica
 *
 *  Si falta python3 (no hace falta para usar la app), las pruebas se
 *  saltan en vez de fallar: el paquete solo se construye al publicar.
 * ===================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ROOT } from './helpers/app.mjs';

function hayPython() {
  try {
    execFileSync('python3', ['--version'], { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

const tienePython = hayPython();

test('el .xdc se construye, se valida y es reproducible', { skip: !tienePython && 'sin python3' }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-xdc-'));
  const a = path.join(tmp, 'a.xdc');
  const b = path.join(tmp, 'b.xdc');

  execFileSync('python3', ['build-xdc.py', '-o', a], { cwd: ROOT, stdio: 'pipe' });
  execFileSync('python3', ['build-xdc.py', '-o', b], { cwd: ROOT, stdio: 'pipe' });

  const hash = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  assert.equal(hash(a), hash(b), 'dos builds del mismo contenido deben dar el mismo hash');

  const salida = execFileSync('python3', ['build-xdc.py', '--check', a], { cwd: ROOT, encoding: 'utf8' });
  assert.match(salida, /válido para Delta Chat/);

  // Lo que no debe viajar: la API webxdc es del cliente, y las pruebas
  // o la documentación no hacen falta dentro del paquete.
  execFileSync('python3', ['-c', `
import sys, zipfile
names = zipfile.ZipFile(${JSON.stringify(a)}).namelist()
assert 'index.html' in names, 'index.html fuera de la raíz'
assert not any(n.split('/')[-1] == 'webxdc.js' for n in names), 'webxdc.js no debe viajar'
assert not any(n.startswith(('test/', 'docs/', 'node_modules/')) for n in names), names
assert 'manifest.toml' in names and 'icon.png' in names
`], { cwd: ROOT, stdio: 'pipe' });

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('el paquete no carga nada de la red', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const remoto = [...html.matchAll(/<(?:script|link|img|iframe|source|audio|video)[^>]+(?:src|href)="((?:https?:)?\/\/[^"]+)"/gi)]
    .map((m) => m[1]);
  assert.deepEqual(remoto, [], 'un .xdc no tiene red');
});
