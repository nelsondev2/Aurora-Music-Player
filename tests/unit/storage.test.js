/* =====================================================================
 *  tests/unit/storage.test.js
 *  Persistencia: apertura única, CRUD de los tres stores, recuperación
 *  cuando la conexión IndexedDB se cierra y cierre explícito.
 *  Usa fake-indexeddb (no hay navegador real en el sandbox).
 * ===================================================================== */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'storage.js'), 'utf8');

/* Crea un window de jsdom con IndexedDB falso y carga storage.js dentro,
 * para que Storage use el realm correcto (y no el global del proceso). */
function makeStorage() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
    runScripts: 'outside-only'
  });
  const w = dom.window;
  w.indexedDB = new IDBFactory();
  w.IDBKeyRange = IDBKeyRange;
  w.IDBFactory = IDBFactory;
  w.console.warn = () => {};
  w.eval(SRC);
  return { storage: w.AuroraStorage, window: w, close: () => w.close() };
}

test('storage: putTrack/getTrack guardan y recuperan el blob', async () => {
  const { storage, close } = makeStorage();
  try {
    await storage.putTrack({ id: 't1', title: 'Uno', blob: 'fake-blob' });
    const got = await storage.getTrack('t1');
    assert.equal(got.title, 'Uno');
    assert.equal(got.blob, 'fake-blob');
    assert.equal(await storage.getTrack('nope'), undefined);
  } finally {
    storage.close();
    close();
  }
});

test('storage: getAllTracks y clearTracks', async () => {
  const { storage, close } = makeStorage();
  try {
    await storage.putTrack({ id: 'a', title: 'A' });
    await storage.putTrack({ id: 'b', title: 'B' });
    const all = await storage.getAllTracks();
    assert.deepEqual(Array.from(all, (t) => t.id).sort(), ['a', 'b']);
    await storage.clearTracks();
    assert.equal((await storage.getAllTracks()).length, 0);
  } finally {
    storage.close();
    close();
  }
});

test('storage: playlists y settings (clave/valor)', async () => {
  const { storage, close } = makeStorage();
  try {
    await storage.putPlaylist({ id: 'p1', name: 'Favoritas', trackIds: ['a'] });
    const pls = await storage.getAllPlaylists();
    assert.equal(pls.length, 1);
    assert.equal(pls[0].name, 'Favoritas');

    await storage.setSetting('volume', 0.42);
    assert.equal(await storage.getSetting('volume'), 0.42);
    await storage.setSetting('volume', 0.9);
    assert.equal(await storage.getSetting('volume'), 0.9);

    await storage.deletePlaylist('p1');
    assert.equal((await storage.getAllPlaylists()).length, 0);
    await storage.clearPlaylists();
  } finally {
    storage.close();
    close();
  }
});

test('storage: open() concurrente devuelve la misma conexión', async () => {
  const { storage, close } = makeStorage();
  try {
    const [a, b] = await Promise.all([storage.open(), storage.open()]);
    assert.equal(a, b);
    assert.equal(storage.db, a);
  } finally {
    storage.close();
    close();
  }
});

test('storage: si la conexión se cierra, la siguiente operación reabre', async () => {
  const { storage, close } = makeStorage();
  try {
    await storage.putTrack({ id: 'x1', title: 'Antes' });
    // Simula cierre externo (navegador limpiando datos, otra pestaña).
    storage.db.close();
    const got = await storage.getTrack('x1');
    assert.equal(got.title, 'Antes');
    assert.ok(storage.db, 'debe haber una conexión nueva');
  } finally {
    storage.close();
    close();
  }
});

test('storage: almacén desconocido falla con mensaje claro', async () => {
  const { storage, close } = makeStorage();
  try {
    await storage.open();
    assert.throws(
      () => storage._tx('no-existe', 'readonly'),
      /almacén desconocido/
    );
  } finally {
    storage.close();
    close();
  }
});

test('storage: _tx sin base de datos abierta falla con mensaje claro', () => {
  const { storage, close } = makeStorage();
  try {
    storage.db = null;
    assert.throws(() => storage._tx('tracks', 'readonly'), /no está abierta/);
  } finally {
    close();
  }
});

test('storage: close() es idempotente y permite reabrir', async () => {
  const { storage, close } = makeStorage();
  try {
    await storage.open();
    storage.close();
    storage.close();
    assert.equal(storage.db, null);
    await storage.putTrack({ id: 'z', title: 'Z' });
    assert.equal((await storage.getTrack('z')).title, 'Z');
  } finally {
    storage.close();
    close();
  }
});
