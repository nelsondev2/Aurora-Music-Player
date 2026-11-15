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
    open() {
      if (this.db) return Promise.resolve(this.db);
      // Una única promesa de apertura: dos llamadas concurrentes antes de
      // que onsuccess dispare abrirían dos conexiones y la segunda quedaría
      // huérfana (fuga y bloqueo en futuras migraciones de versión).
      if (this._openPromise) return this._openPromise;
      this._openPromise = new Promise((resolve, reject) => {
        let req;
        try {
          req = indexedDB.open(DB_NAME, DB_VERSION);
        } catch (e) {
          // IndexedDB deshabilitado (modo privado antiguo, política del
          // navegador): la promesa debe rechazar, no colgarse.
          this._openPromise = null;
          reject(e);
          return;
        }
        req.onerror = () => { this._openPromise = null; reject(req.error); };
        // Otra pestaña tiene la versión anterior abierta: el navegador
        // espera. No se rechaza (perderíamos datos al reintentar), pero
        // se deja rastro para diagnosticar.
        req.onblocked = () => {
          console.warn('AuroraStorage: apertura bloqueada por otra pestaña');
        };
        req.onsuccess = () => {
          const db = req.result;
          this.db = db;
          this._openPromise = null;
          // Si el navegador cierra la conexión (p. ej. al limpiar datos),
          // no se debe seguir usando un db muerto: se fuerza reapertura.
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
      return this._openPromise;
    },

    /* ---------- Operaciones genéricas ---------- */
    _tx(store, mode) {
      const db = this.db;
      // Antes se asumía que db existía: si la conexión se cerraba (otra
      // pestaña, el navegador o un test), .transaction lanzaba un
      // TypeError críptico. Mejor fallar con un mensaje accionable.
      if (!db) throw new Error('AuroraStorage: la base de datos no está abierta');
      if (!db.objectStoreNames.contains(store)) {
        throw new Error('AuroraStorage: almacén desconocido «' + store + '»');
      }
      return db.transaction(store, mode).objectStore(store);
    },
    _req(reqFn) {
      return new Promise((resolve, reject) => {
        reqFn.onsuccess = () => resolve(reqFn.result);
        reqFn.onerror = () => reject(reqFn.error);
      });
    },
    /* Ejecuta una operación reintentando UNA vez si la conexión murió
     * entre el await open() y la transacción (InvalidStateError). */
    async _run(store, mode, fn) {
      for (let attempt = 0; attempt < 2; attempt++) {
        await this.open();
        try {
          return await this._req(fn(this._tx(store, mode)));
        } catch (err) {
          const stale = err && (err.name === 'InvalidStateError' ||
            /not open|closed/i.test(String(err.message || '')));
          if (attempt === 0 && stale) {
            this.db = null;
            continue;
          }
          throw err;
        }
      }
      throw new Error('AuroraStorage: operación imposible: ' + store);
    },

    /* Transacción sobre varios almacenes. Hace falta cuando el cambio
     * tiene que ser atómico: borrar una pista y su audio a la vez (si
     * solo se borrara una mitad quedaría un huérfano que ocupa sitio). */
    async _txn(stores, mode, fn) {
      for (let attempt = 0; attempt < 2; attempt++) {
        await this.open();
        try {
          return await fn(this.db.transaction(stores, mode));
        } catch (err) {
          const stale = err && (err.name === 'InvalidStateError' ||
            /not open|closed/i.test(String(err.message || '')));
          if (attempt === 0 && stale) {
            this.db = null;
            continue;
          }
          throw err;
        }
      }
      throw new Error('AuroraStorage: transacción imposible: ' + stores.join(','));
    },

    /* ---------- Tracks ---------- */
    async putTrack(track) {
      return this._run(STORE_TRACKS, 'readwrite', (os) => os.put(track));
    },
    async getTrack(id) {
      return this._run(STORE_TRACKS, 'readonly', (os) => os.get(id));
    },
    async getAllTracks() {
      return this._run(STORE_TRACKS, 'readonly', (os) => os.getAll());
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
      return this._run(STORE_PLAYLISTS, 'readonly', (os) => os.getAll());
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
