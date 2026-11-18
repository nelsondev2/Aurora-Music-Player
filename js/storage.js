/* =====================================================================
 *  storage.js — Persistencia en IndexedDB
 *  Reproductor de música profesional · mobile-first
 *
 *  Guarda:
 *    - store "tracks": SOLO metadatos (título, artista, portada…)
 *    - store "blobs": el audio de cada pista, en su propio almacén
 *    - store "playlists": listas del usuario
 *    - store "settings": favoritos, volumen, etc.
 *
 *  El audio vive aparte desde la versión 1.3: al arrancar la app lee
 *  los metadatos de toda la biblioteca (ligero) y trae el Blob de una
 *  pista solo cuando hace falta reproducirla, compartirla o releer sus
 *  etiquetas. Antes cada registro de "tracks" llevaba dentro su audio y
 *  abrir la app con 500 canciones deserializaba 500 Blobs antes de
 *  pintar nada. Los blobs se guardan como File/Blob para crear
 *  objectURLs que el <audio> pueda reproducir sin red.
 * ===================================================================== */

/* eslint-disable no-unused-vars */
(function () {
  'use strict';

  const DB_NAME = 'aurora-db';
  //  2: almacén "blobs" (el audio deja de viajar dentro de la pista).
  const DB_VERSION = 2;
  const STORE_TRACKS = 'tracks';
  const STORE_BLOBS = 'blobs';
  const STORE_PLAYLISTS = 'playlists';
  const STORE_SETTINGS = 'settings';

  const Storage = {
    db: null,

    /* ---------- Abrir / inicializar la BD ---------- */
    _openOnce() {
      return new Promise((resolve, reject) => {
        let req;
        try {
          req = indexedDB.open(DB_NAME, DB_VERSION);
        } catch (e) {
          reject(e);
          return;
        }
        req.onerror = () => reject(req.error || new Error('AuroraStorage: fallo al abrir IndexedDB'));
        // Otra pestaña tiene la versión anterior abierta: el navegador
        // espera. No se rechaza (perderíamos datos al reintentar), pero
        // se deja rastro para diagnosticar.
        req.onblocked = () => {
          console.warn('AuroraStorage: apertura bloqueada por otra pestaña');
        };
        req.onsuccess = () => {
          const db = req.result;
          this.db = db;
          // Si el navegador cierra la conexión (p. ej. tras varios días en
          // reposo o actualización de WebView), forzar reapertura limpia.
          db.onclose = () => { if (this.db === db) this.db = null; };
          // Otra pestaña quiere migrar: cerrar aquí evita dejarla bloqueada.
          db.onversionchange = () => {
            try { db.close(); } catch (e) {}
            if (this.db === db) this.db = null;
          };
          resolve(db);
        };
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_TRACKS)) {
            db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
            db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_BLOBS)) {
            //  clave externa (el id de la pista): el valor es el Blob.
            db.createObjectStore(STORE_BLOBS);
          }
          if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
            db.createObjectStore(STORE_SETTINGS);
          }
        };
      });
    },

    open() {
      if (this.db) return Promise.resolve(this.db);
      // Una única promesa de apertura: dos llamadas concurrentes comparten
      // conexión. Si un WebView en frío tras días sin abrirse devuelve un
      // error transitorio (UnknownError / InvalidStateError / AbortError),
      // se reintenta antes de dar la biblioteca por vacía.
      if (this._openPromise) return this._openPromise;
      this._openPromise = (async () => {
        const delays = [0, 120, 320];
        let lastErr = null;
        for (let i = 0; i < delays.length; i++) {
          if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
          try {
            return await this._openOnce();
          } catch (err) {
            lastErr = err;
            const name = (err && err.name) || '';
            const transient = name === 'UnknownError' || name === 'InvalidStateError' || name === 'AbortError';
            if (!transient) break;
          }
        }
        throw lastErr;
      })();
      this._openPromise.then(
        () => { this._openPromise = null; },
        () => { this._openPromise = null; }
      );
      return this._openPromise;
    },

    /* ---------- Operaciones genéricas ---------- */
    _openTx(store, mode) {
      const db = this.db;
      if (!db) throw new Error('AuroraStorage: la base de datos no está abierta');
      if (!db.objectStoreNames.contains(store)) {
        throw new Error('AuroraStorage: almacén desconocido «' + store + '»');
      }
      return db.transaction(store, mode);
    },
    _tx(store, mode) {
      return this._openTx(store, mode).objectStore(store);
    },
    _req(reqFn) {
      return new Promise((resolve, reject) => {
        reqFn.onsuccess = () => resolve(reqFn.result);
        reqFn.onerror = () => reject(reqFn.error);
      });
    },
    _awaitCommit(tx) {
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('AuroraStorage: error de transacción'));
        tx.onabort = () => reject(tx.error || new Error('AuroraStorage: transacción abortada'));
      });
    },
    _isStaleError(err) {
      return !!(err && (err.name === 'InvalidStateError' ||
        /not open|closed|closing/i.test(String(err.message || ''))));
    },
    /* Ejecuta una operación reintentando UNA vez si la conexión murió
     * entre el await open() y la transacción, y en escrituras espera a
     * tx.oncomplete para confirmar que el dato llegó realmente a disco
     * (en Safari/Chromium QuotaExceededError salta al confirmar). */
    async _run(store, mode, fn) {
      for (let attempt = 0; attempt < 2; attempt++) {
        await this.open();
        try {
          const tx = this._openTx(store, mode);
          const commit = mode === 'readwrite' ? this._awaitCommit(tx) : null;
          const req = fn(tx.objectStore(store));
          const reqP = this._req(req);
          if (commit) {
            const [res] = await Promise.all([reqP, commit]);
            return res;
          }
          return await reqP;
        } catch (err) {
          if (attempt === 0 && this._isStaleError(err)) {
            this.db = null;
            continue;
          }
          throw err;
        }
      }
      throw new Error('AuroraStorage: operación imposible: ' + store);
    },

    /* Transacción sobre varios almacenes (con confirmación en disco si es readwrite). */
    async _txn(stores, mode, fn) {
      for (let attempt = 0; attempt < 2; attempt++) {
        await this.open();
        try {
          const db = this.db;
          if (!db) throw new Error('AuroraStorage: la base de datos no está abierta');
          const tx = db.transaction(stores, mode);
          const commit = mode === 'readwrite' ? this._awaitCommit(tx) : null;
          const fnP = Promise.resolve().then(() => fn(tx));
          if (commit) {
            const [res] = await Promise.all([fnP, commit]);
            return res;
          }
          return await fnP;
        } catch (err) {
          if (attempt === 0 && this._isStaleError(err)) {
            this.db = null;
            continue;
          }
          throw err;
        }
      }
      throw new Error('AuroraStorage: transacción imposible: ' + stores.join(','));
    },

    /* Lee un almacén con keyPath 'id' por páginas para no rebasar el
     * límite IPC de getAll() en Chromium/WebView (~64-128 MB) cuando la
     * biblioteca acumula cientos de portadas embebidas, y abre una
     * transacción por página para no caer en el autocierre entre awaits
     * de Safari/WebKit. Si una página falla por tamaño, cae a openCursor(). */
    async _getAllByCursor(store) {
      return this._txn([store], 'readonly', (tx) => new Promise((resolve, reject) => {
        const items = [];
        const req = tx.objectStore(store).openCursor();
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) return resolve(items);
          if (cur.value) items.push(cur.value);
          cur.continue();
        };
      }));
    },

    async _getAllPaged(store, pageSize) {
      const size = pageSize || 50;
      if (typeof IDBKeyRange === 'undefined' || typeof IDBKeyRange.lowerBound !== 'function') {
        return this._getAllByCursor(store);
      }
      try {
        const all = [];
        let range = null;
        while (true) {
          const page = await this._run(store, 'readonly', (os) => {
            if (typeof os.getAll !== 'function') throw new Error('no-getAll');
            return range ? os.getAll(range, size) : os.getAll(undefined, size);
          });
          if (!Array.isArray(page) || page.length === 0) break;
          for (let i = 0; i < page.length; i++) {
            if (page[i]) all.push(page[i]);
          }
          if (page.length < size) break;
          const last = page[page.length - 1];
          if (!last || last.id == null) break;
          range = IDBKeyRange.lowerBound(last.id, true);
        }
        return all;
      } catch (err) {
        return this._getAllByCursor(store);
      }
    },

    /* ---------- Tracks ---------- */
    async putTrack(track) {
      return this._run(STORE_TRACKS, 'readwrite', (os) => os.put(track));
    },
    async getTrack(id) {
      return this._run(STORE_TRACKS, 'readonly', (os) => os.get(id));
    },
    async getAllTracks() {
      return this._getAllPaged(STORE_TRACKS, 50);
    },
    async deleteTrack(id) {
      //  metadatos + audio: si se borrara solo la pista, su Blob se
      // quedaría ocupando espacio para siempre.
      //  Las dos peticiones se lanzan sin esperar: si se encadenaran con
      //  .then() la transacción podría cerrarse entre una y otra.
      return this._txn([STORE_TRACKS, STORE_BLOBS], 'readwrite', (tx) => Promise.all([
        this._req(tx.objectStore(STORE_BLOBS).delete(id)),
        this._req(tx.objectStore(STORE_TRACKS).delete(id))
      ]));
    },
    async clearTracks() {
      return this._txn([STORE_TRACKS, STORE_BLOBS], 'readwrite', (tx) => Promise.all([
        this._req(tx.objectStore(STORE_BLOBS).clear()),
        this._req(tx.objectStore(STORE_TRACKS).clear())
      ]));
    },

    /* ---------- Blobs (el audio, aparte de sus metadatos) ---------- */
    async putBlob(id, blob) {
      return this._run(STORE_BLOBS, 'readwrite', (os) => os.put(blob, id));
    },
    /* Devuelve el Blob de una pista o undefined si no hay audio guardado. */
    async getBlob(id) {
      return this._run(STORE_BLOBS, 'readonly', (os) => os.get(id));
    },
    async deleteBlob(id) {
      return this._run(STORE_BLOBS, 'readwrite', (os) => os.delete(id));
    },
    async clearBlobs() {
      return this._run(STORE_BLOBS, 'readwrite', (os) => os.clear());
    },

    /* ---------- Migración: sacar el audio de los registros de pista ----
     * Las bibliotecas anteriores a la 1.3 guardaban el Blob dentro del
     * registro de la pista. Esta pasada, con cursor (no carga la
     * biblioteca entera en memoria), mueve cada audio a "blobs" y
     * reescribe el registro sin él. Es idempotente: si se corta a
     * medias, la siguiente ejecución sigue donde lo dejó; el testigo
     * evita repetirla en cada arranque. Devuelve cuántas movió. */
    async migrateBlobsToStore() {
      let done = null;
      try { done = await this.getSetting('blob_store_v2'); } catch (e) {}
      if (done) return 0;
      let moved = 0;
      await this._txn([STORE_TRACKS, STORE_BLOBS], 'readwrite', (tx) => {
        const store = tx.objectStore(STORE_TRACKS);
        const blobs = tx.objectStore(STORE_BLOBS);
        return new Promise((resolve, reject) => {
          const req = store.openCursor();
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const cur = req.result;
            if (!cur) return resolve();
            const rec = cur.value;
            try {
              if (rec && rec.fileBlob) {
                blobs.put(rec.fileBlob, rec.id);
                delete rec.fileBlob;
                rec.hasAudio = true;
                cur.update(rec);
                moved++;
              }
            } catch (e) {
              // Un registro corrupto no debe impedir migrar el resto.
              console.warn('AuroraStorage: registro ilegible al migrar:', e);
            }
            cur.continue();
          };
        });
      });
      try { await this.setSetting('blob_store_v2', true); } catch (e) {}
      return moved;
    },

    /* ---------- Playlists ---------- */
    async putPlaylist(pl) {
      return this._run(STORE_PLAYLISTS, 'readwrite', (os) => os.put(pl));
    },
    async getAllPlaylists() {
      return this._getAllPaged(STORE_PLAYLISTS, 40);
    },
    async deletePlaylist(id) {
      return this._run(STORE_PLAYLISTS, 'readwrite', (os) => os.delete(id));
    },
    async clearPlaylists() {
      return this._run(STORE_PLAYLISTS, 'readwrite', (os) => os.clear());
    },

    /* ---------- Settings (clave/valor) ---------- */
    async getSetting(key) {
      return this._run(STORE_SETTINGS, 'readonly', (os) => os.get(key));
    },
    async setSetting(key, value) {
      return this._run(STORE_SETTINGS, 'readwrite', (os) => os.put(value, key));
    }
  };

  window.AuroraStorage = Storage;
})();
