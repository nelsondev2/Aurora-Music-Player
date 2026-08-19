/* =====================================================================
 *  storage.js — Persistencia en IndexedDB
 *  Reproductor de música profesional · mobile-first
 *
 *  Guarda:
 *    - store "tracks": metadatos + objectURL del blob de audio
 *    - store "playlists": listas del usuario
 *    - store "settings": favoritos, volumen, etc.
 *
 *  Los blobs de audio se almacenan como File/Blob para crear
 *  objectURLs que el <audio> pueda reproducir sin red.
 * ===================================================================== */

/* eslint-disable no-unused-vars */
(function () {
  'use strict';

  const DB_NAME = 'aurora-db';
  const DB_VERSION = 1;
  const STORE_TRACKS = 'tracks';
  const STORE_PLAYLISTS = 'playlists';
  const STORE_SETTINGS = 'settings';

  const Storage = {
    db: null,

    /* ---------- Abrir / inicializar la BD ---------- */
    open() {
      return new Promise((resolve, reject) => {
        if (this.db) return resolve(this.db);
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => { this.db = req.result; resolve(this.db); };
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_TRACKS)) {
            db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
            db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
            db.createObjectStore(STORE_SETTINGS);
          }
        };
      });
    },

    /* ---------- Operaciones genéricas ---------- */
    _tx(store, mode) {
      return this.db.transaction(store, mode).objectStore(store);
    },
    _req(reqFn) {
      return new Promise((resolve, reject) => {
        reqFn.onsuccess = () => resolve(reqFn.result);
        reqFn.onerror = () => reject(reqFn.error);
      });
    },

    /* ---------- Tracks ---------- */
    async putTrack(track) {
      await this.open();
      return this._req(this._tx(STORE_TRACKS, 'readwrite').put(track));
    },
    async getTrack(id) {
      await this.open();
      return this._req(this._tx(STORE_TRACKS, 'readonly').get(id));
    },
    async getAllTracks() {
      await this.open();
      return this._req(this._tx(STORE_TRACKS, 'readonly').getAll());
    },
    async deleteTrack(id) {
      await this.open();
      return this._req(this._tx(STORE_TRACKS, 'readwrite').delete(id));
    },
    async clearTracks() {
      await this.open();
      return this._req(this._tx(STORE_TRACKS, 'readwrite').clear());
    },

    /* ---------- Playlists ---------- */
    async putPlaylist(pl) {
      await this.open();
      return this._req(this._tx(STORE_PLAYLISTS, 'readwrite').put(pl));
    },
    async getAllPlaylists() {
      await this.open();
      return this._req(this._tx(STORE_PLAYLISTS, 'readonly').getAll());
    },
    async deletePlaylist(id) {
      await this.open();
      return this._req(this._tx(STORE_PLAYLISTS, 'readwrite').delete(id));
    },
    async clearPlaylists() {
      await this.open();
      return this._req(this._tx(STORE_PLAYLISTS, 'readwrite').clear());
    },

    /* ---------- Settings (clave/valor) ---------- */
    async getSetting(key) {
      await this.open();
      return this._req(this._tx(STORE_SETTINGS, 'readonly').get(key));
    },
    async setSetting(key, value) {
      await this.open();
      return this._req(this._tx(STORE_SETTINGS, 'readwrite').put(value, key));
    }
  };

  window.AuroraStorage = Storage;
})();
