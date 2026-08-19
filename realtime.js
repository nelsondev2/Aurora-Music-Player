/* =====================================================================
 *  realtime.js — Sistema de compartir música en tiempo real
 * =====================================================================
 *  Adaptado del sistema usado por "Radio Station" (app.xdc) y portado
 *  a la arquitectura de Aurora Music Player.
 *
 *  Funcionalidad:
 *    1. Canal en tiempo real (webxdc.joinRealtimeChannel)
 *       - Presence: avisa a los peers que estás conectado y comparte
 *         tu estado (pista actual, play/pause, etc.)
 *       - Payload: mensajes punto-a-punto para solicitar y enviar
 *         fragmentos (chunks) de pistas compartidas.
 *    2. Sincronización de reproducción: cuando un peer reproduce una
 *       pista que tú también tienes, saltas a la misma pista y posición.
 *    3. Compartir biblioteca: las pistas nuevas se anuncian a los peers
 *       y se transfieren por chunks (~1MB) bajo demanda.
 *
 *  Integración con Aurora:
 *    - Usa IndexedDB (vía AuroraStorage) para persistir chunks.
 *    - Expone window.AuroraRealtime con métodos para que app.js
 *      avise de eventos (play, pause, next, seek, addTrack, deleteTrack).
 * ===================================================================== */

/* eslint-disable no-unused-vars */
(function () {
  'use strict';

  /* ============================================================
   *  Codificación binaria de mensajes (igual que en app.xdc)
   * ============================================================
   *  Usamos un formato binario compacto para los mensajes del canal
   *  realtime, igual que en la app de Radio Station original.
   *  Cada mensaje tiene la forma:
   *    [messageType: u8][deviceId: string][payload: json]
   *  Y los mensajes grandes se fragmentan en paquetes:
   *    [deviceId: string][packetId: u32][chunkIdx: u32][total: u32][data: bytes]
   */

  // ----- Escritor de bytes -----
  function ByteWriter() {
    this.cpos = 0;
    this.cbuf = new Uint8Array(100);
    this.bufs = [];
  }
  ByteWriter.prototype.length = function () {
    let total = this.cpos;
    for (let i = 0; i < this.bufs.length; i++) total += this.bufs[i].length;
    return total;
  };
  ByteWriter.prototype.toArray = function () {
    const total = this.length();
    const out = new Uint8Array(total);
    let offset = 0;
    for (let i = 0; i < this.bufs.length; i++) {
      out.set(this.bufs[i], offset);
      offset += this.bufs[i].length;
    }
    out.set(new Uint8Array(this.cbuf.buffer, 0, this.cpos), offset);
    return out;
  };
  function _ensure(writer, n) {
    const cap = writer.cbuf.length;
    if (cap - writer.cpos < n) {
      writer.bufs.push(new Uint8Array(writer.cbuf.buffer, 0, writer.cpos));
      const newSize = Math.max(cap * 2, n * 2);
      writer.cbuf = new Uint8Array(newSize);
      writer.cpos = 0;
    }
  }
  ByteWriter.prototype.u8 = function (v) {
    const cap = this.cbuf.length;
    if (this.cpos === cap) {
      this.bufs.push(this.cbuf);
      this.cbuf = new Uint8Array(cap * 2);
      this.cpos = 0;
    }
    this.cbuf[this.cpos++] = v & 0xff;
  };
  ByteWriter.prototype.u32 = function (v) {
    _ensure(this, 5);
    // varint encoding (igual que app.xdc)
    v = v >>> 0;
    while (v > 0x7f) {
      this.u8(0x80 | (v & 0x7f));
      v = Math.floor(v / 128);
    }
    this.u8(v & 0x7f);
  };
  ByteWriter.prototype.i32 = function (v) {
    _ensure(this, 5);
    const negative = v < 0;
    if (negative) v = -v;
    this.u8((v > 0x3f ? 0x80 : 0) | (negative ? 0x40 : 0) | (v & 0x3f));
    v = Math.floor(v / 64);
    while (v > 0) {
      this.u8((v > 0x7f ? 0x80 : 0) | (v & 0x7f));
      v = Math.floor(v / 128);
    }
  };
  ByteWriter.prototype.bytes = function (arr) {
    this.u32(arr.length);
    this._rawBytes(arr);
  };
  // _rawBytes: escribe bytes SIN prefijo de longitud (uso interno)
  ByteWriter.prototype._rawBytes = function (arr) {
    _ensure(this, arr.length);
    const cap = this.cbuf.length;
    const space = cap - this.cpos;
    const first = Math.min(space, arr.length);
    this.cbuf.set(arr.subarray(0, first), this.cpos);
    this.cpos += first;
    if (first < arr.length) {
      this.bufs.push(this.cbuf);
      const rest = arr.length - first;
      this.cbuf = new Uint8Array(Math.max(cap * 2, rest));
      this.cbuf.set(arr.subarray(first));
      this.cpos = rest;
    }
  };
  // Escribe un string en UTF-8
  ByteWriter.prototype.str = function (s) {
    const enc = new TextEncoder();
    const bytes = enc.encode(s);
    this.u32(bytes.length);
    this._rawBytes(bytes);
  };
  // Escribe un valor JSON serializado
  ByteWriter.prototype.json = function (v) {
    this.str(JSON.stringify(v));
  };

  // ----- Lector de bytes -----
  function ByteReader(arr) {
    this.arr = arr;
    this.pos = 0;
  }
  ByteReader.prototype.u8 = function () {
    return this.arr[this.pos++];
  };
  ByteReader.prototype.u32 = function () {
    let v = 0;
    let mul = 1;
    while (true) {
      const b = this.arr[this.pos++];
      v += (b & 0x7f) * mul;
      mul *= 128;
      if (b < 0x80) return v;
      if (v > Number.MAX_SAFE_INTEGER) throw new Error('Integer out of range');
    }
  };
  ByteReader.prototype.bytes = function () {
    const len = this.u32();
    return this.rawBytes(len);
  };
  // rawBytes: lee exactamente `len` bytes SIN prefijo de longitud.
  // Devuelve una COPIA para evitar referencias al buffer de reensamblado.
  ByteReader.prototype.rawBytes = function (len) {
    const src = new Uint8Array(this.arr.buffer, this.pos + this.arr.byteOffset, len);
    const out = new Uint8Array(len);
    out.set(src);
    this.pos += len;
    return out;
  };
  ByteReader.prototype.str = function () {
    const bytes = this.bytes();
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  };
  ByteReader.prototype.json = function () {
    return JSON.parse(this.str());
  };

  /* ============================================================
   *  Constantes del protocolo
   * ============================================================ */
  const MAX_PACKET_BYTES = 126 * 1000;       // 126 KB por paquete (igual que app.xdc)
  const CHUNK_SIZE = 1024 * 1024;            // 1 MB por chunk de audio
  const MESSAGE_PRESENCE = 0;
  const MESSAGE_PAYLOAD = 1;
  const STATUS_OFFLINE = 0;
  const STATUS_ONLINE = 1;
  const PRESENCE_TIMEOUT = 5;                // segundos sin señal antes de eliminar peer
  const PRESENCE_INTERVAL = 2;               // cada cuánto enviar presence

  /* ============================================================
   *  Almacenamiento de chunks (separado del Storage principal)
   * ============================================================ */
  const ChunksStore = {
    _dbPromise: null,
    _getDb() {
      if (this._dbPromise) return this._dbPromise;
      this._dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('aurora-realtime', 2);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('chunks')) {
            const store = db.createObjectStore('chunks', { keyPath: ['file', 'id'] });
            store.createIndex('file', 'file', { unique: false });
          } else {
            // Upgrade from v1: add 'file' index if missing
            const store = e.target.transaction.objectStore('chunks');
            if (!store.indexNames.contains('file')) {
              store.createIndex('file', 'file', { unique: false });
            }
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return this._dbPromise;
    },
    async addChunk(fileId, chunkId, blob) {
      const db = await this._getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('chunks', 'readwrite');
        tx.objectStore('chunks').put({ file: fileId, id: chunkId, blob });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    },
    async getChunk(fileId, chunkId) {
      const db = await this._getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('chunks', 'readonly');
        const req = tx.objectStore('chunks').get([fileId, chunkId]);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    async getAllChunks(fileId) {
      const db = await this._getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('chunks', 'readonly');
        const store = tx.objectStore('chunks');
        // Usar el índice 'file' si existe; si no, getAll y filtrar.
        let req;
        if (store.indexNames.contains('file')) {
          req = store.index('file').getAll(fileId);
        } else {
          req = store.getAll();
        }
        req.onsuccess = () => {
          const all = req.result || [];
          const filtered = all
            .filter(c => c.file === fileId)
            .sort((a, b) => a.id - b.id);
          resolve(filtered);
        };
        req.onerror = () => reject(req.error);
      });
    },
    async deleteChunks(fileId) {
      const db = await this._getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('chunks', 'readwrite');
        const store = tx.objectStore('chunks');
        // Usar índice si existe para eficiencia
        if (store.indexNames.contains('file')) {
          const idxReq = store.index('file').openCursor(fileId);
          idxReq.onsuccess = () => {
            const cursor = idxReq.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            }
          };
        } else {
          const req = store.getAll();
          req.onsuccess = () => {
            (req.result || []).forEach(c => {
              if (c.file === fileId) store.delete([c.file, c.id]);
            });
          };
        }
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }
  };

  /* ============================================================
   *  Generación / persistencia del deviceId
   * ============================================================
   *  Usamos sessionStorage para que cada pestaña del navegador
   *  tenga su propio deviceId en desarrollo (cada pestaña = un peer).
   *  En Delta Chat, sessionStorage/localStorage están aislados por
   *  dispositivo, así que el comportamiento es equivalente.
   */
  function getDeviceId() {
    const KEY = '__realtime__.deviceId';
    // Probar sessionStorage primero (cada pestaña = un peer en dev)
    let v = null;
    try { v = sessionStorage.getItem(KEY); } catch (e) {}
    if (v) return v;
    // Fallback a localStorage (para entornos sin sessionStorage)
    try { v = localStorage.getItem(KEY); } catch (e) {}
    if (v) return v;
    // Generar nuevo
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      v = crypto.randomUUID();
    } else {
      const r = () => Math.floor((1 + Math.random()) * 65536).toString(16).substring(1);
      v = r() + r() + '-' + r() + '-' + r() + '-' + r() + '-' + r() + r() + r();
    }
    try { sessionStorage.setItem(KEY, v); } catch (e) {
      try { localStorage.setItem(KEY, v); } catch (e2) {}
    }
    return v;
  }

  /* ============================================================
   *  Tipo-guardias para payloads de request/response
   * ============================================================ */
  function isRequestPayload(p) {
    return !!p && typeof p === 'object' && typeof p.request === 'object' && p.request !== null;
  }
  function isResponsePayload(p) {
    return !!p && typeof p === 'object' && typeof p.response === 'object' && p.response !== null;
  }

  /* ============================================================
   *  RealtimeChannel
   * ============================================================
   *  Mantiene:
   *    - lista de peers (con su último estado conocido)
   *    -deviceId propio
   *    - canal de mensajería (webxdc.joinRealtimeChannel)
   *    - sistema de fragmentación de mensajes grandes
   *    - envío periódico de presence
   */
  function RealtimeChannel(opts) {
    this.peers = {};              // deviceId → { id, lastSeen, state }
    this.channel = null;
    this.packetId = 0;
    this.packets = {};            // deviceId → packetId → { chunkIdx → bytes }
    this.timeout = opts.presenceTimeout || PRESENCE_TIMEOUT;
    this.tick = opts.presenceInterval || PRESENCE_INTERVAL;
    this.onPeersChanged = opts.onPeersChanged || function () {};
    this.onPayload = opts.onPayload || function () {};
    this.interval = 0;
    this.deviceId = getDeviceId();
    this.status = STATUS_OFFLINE;
    this.state = null;
  }

  RealtimeChannel.prototype.connect = function () {
    if (this.status === STATUS_ONLINE) return;
    if (!window.webxdc || typeof window.webxdc.joinRealtimeChannel !== 'function') {
      console.warn('[Realtime] joinRealtimeChannel no disponible — realtime deshabilitado');
      return;
    }
    this.status = STATUS_ONLINE;
    try {
      this.channel = window.webxdc.joinRealtimeChannel();
    } catch (e) {
      console.warn('[Realtime] No se pudo unir al canal realtime:', e);
      this.status = STATUS_OFFLINE;
      return;
    }
    if (!this.channel || typeof this.channel.setListener !== 'function') {
      console.warn('[Realtime] Canal realtime inválido');
      this.status = STATUS_OFFLINE;
      return;
    }
    this.channel.setListener((rawData) => {
      try {
        // rawData puede ser Uint8Array o ArrayBuffer
        let arr = rawData;
        if (arr instanceof ArrayBuffer) arr = new Uint8Array(arr);
        if (!arr || arr.length === 0) return;
        const r = new ByteReader(arr);
        const deviceId = r.str();
        const packetId = r.u32();
        const chunkIdx = r.u32();
        const total = r.u32();
        const data = r.bytes();
        // Ignorar mensajes propios (el canal puede hacer eco)
        if (deviceId === this.deviceId) return;
        if (total === 1) {
          // Mensaje completo en un solo paquete
          this._handlePacket(data);
        } else {
          // Reensamblar
          if (!this.packets[deviceId]) this.packets[deviceId] = {};
          if (!this.packets[deviceId][packetId]) this.packets[deviceId][packetId] = {};
          this.packets[deviceId][packetId][chunkIdx] = data;
          const got = Object.keys(this.packets[deviceId][packetId]).length;
          if (got === total) {
            const parts = this.packets[deviceId][packetId];
            delete this.packets[deviceId][packetId];
            // Concatenar en orden
            const merged = [];
            for (let i = 0; i < total; i++) merged.push(parts[i]);
            const totalLen = merged.reduce((a, b) => a + b.length, 0);
            const combined = new Uint8Array(totalLen);
            let off = 0;
            for (const p of merged) { combined.set(p, off); off += p.length; }
            this._handlePacket(combined);
          }
        }
      } catch (e) {
        console.warn('[Realtime] Error procesando paquete realtime:', e);
      }
    });
    // Enviar presence cada N segundos
    this.interval = window.setInterval(() => this._sync(), this.tick * 1000);
    // Enviar presence inicial
    this._sendPresence();
  };

  RealtimeChannel.prototype.disconnect = function () {
    if (this.status !== STATUS_ONLINE) return;
    clearInterval(this.interval);
    this.status = STATUS_OFFLINE;
    this._sendPresence();
  };

  RealtimeChannel.prototype.setState = function (state) {
    this.state = state;
  };

  RealtimeChannel.prototype.getState = function () {
    return this.state;
  };

  RealtimeChannel.prototype.getPeers = function () {
    return Object.values(this.peers);
  };

  RealtimeChannel.prototype.getDeviceId = function () {
    return this.deviceId;
  };

  RealtimeChannel.prototype.sendPayload = function (payload) {
    const w = new ByteWriter();
    w.u8(MESSAGE_PAYLOAD);
    w.str(this.deviceId);
    // Si el payload contiene response.data (Uint8Array), extraerlo
    // y adjuntarlo como bytes crudos DESPUÉS del JSON para evitar
    // que JSON.stringify lo convierta en un objeto gigante.
    let rawAppend = null;
    let safePayload = payload;
    if (payload && payload.response && payload.response.data instanceof Uint8Array) {
      rawAppend = payload.response.data;
      safePayload = {
        response: {
          file: payload.response.file,
          lastModified: payload.response.lastModified,
          chunk: payload.response.chunk,
          dataLength: rawAppend.length
        }
      };
    }
    w.json(safePayload);
    if (rawAppend) {
      w._rawBytes(rawAppend);
    }
    this._sendToChannel(w.toArray());
  };

  RealtimeChannel.prototype._handlePacket = function (data) {
    const r = new ByteReader(data);
    const msgType = r.u8();
    const deviceId = r.str();
    if (msgType === MESSAGE_PRESENCE) {
      const status = r.u32();
      if (status === STATUS_ONLINE) {
        let state = null;
        try { state = r.json(); } catch (e) {}
        this.peers[deviceId] = { id: deviceId, lastSeen: Date.now(), state };
      } else {
        delete this.peers[deviceId];
        delete this.packets[deviceId];
      }
      this.onPeersChanged(this.getPeers());
    } else if (msgType === MESSAGE_PAYLOAD) {
      let payload = null;
      try { payload = r.json(); } catch (e) {}
      // Si el payload tiene response.dataLength, leer los bytes crudos
      // que se adjuntaron después del JSON.
      if (payload && payload.response && payload.response.dataLength) {
        try {
          payload.response.data = r.rawBytes(payload.response.dataLength);
        } catch (e) {
          console.warn('[Realtime] Error leyendo datos crudos del response:', e);
        }
      }
      this.onPayload(deviceId, payload);
    }
  };

  RealtimeChannel.prototype._sendToChannel = function (bytes) {
    if (!this.channel) return;
    const pid = ++this.packetId;
    const total = Math.ceil(bytes.length / MAX_PACKET_BYTES);
    for (let i = 0; i < total; i++) {
      const start = i * MAX_PACKET_BYTES;
      const end = Math.min(start + MAX_PACKET_BYTES, bytes.length);
      const slice = bytes.subarray(start, end);
      const w = new ByteWriter();
      w.str(this.deviceId);
      w.u32(pid);
      w.u32(i);
      w.u32(total);
      w.bytes(slice);
      try {
        this.channel.send(w.toArray());
      } catch (e) {
        console.warn('[Realtime] Error enviando paquete:', e);
        break;
      }
    }
  };

  RealtimeChannel.prototype._sendPresence = function () {
    const w = new ByteWriter();
    w.u8(MESSAGE_PRESENCE);
    w.str(this.deviceId);
    w.u32(this.status);
    if (this.status !== STATUS_OFFLINE) {
      w.json(this.state);
    }
    this._sendToChannel(w.toArray());
  };

  RealtimeChannel.prototype._sync = function () {
    this._sendPresence();
    let changed = false;
    const now = Date.now();
    Object.keys(this.peers).forEach((id) => {
      if (now - this.peers[id].lastSeen > this.timeout * 1000) {
        delete this.peers[id];
        delete this.packets[id];
        changed = true;
      }
    });
    if (changed) this.onPeersChanged(this.getPeers());
  };

  /* ============================================================
   *  Utilidades
   * ============================================================ */
  function shuffleArray(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }
  function debounce(fn, ms) {
    let timer = null;
    return function (...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; fn.apply(this, args); }, ms);
    };
  }
  function throttle(fn, ms) {
    let last = 0;
    let timer = null;
    let lastArgs = null;
    return function (...args) {
      const now = performance.now();
      lastArgs = args;
      const remaining = ms - (now - last);
      if (remaining <= 0) {
        if (timer) { clearTimeout(timer); timer = null; }
        last = now;
        fn.apply(this, lastArgs);
      } else if (!timer) {
        timer = setTimeout(() => {
          last = performance.now();
          timer = null;
          fn.apply(this, lastArgs);
        }, remaining);
      }
    };
  }

  /* ============================================================
   *  AuroraRealtime — Fachada para app.js
   * ============================================================
   *  Métodos públicos:
   *    connect()
   *    disconnect()
   *    getPeers() → [{ id, state }]
   *    getState() → estado propio actual
   *    broadcastLastAction({ trackId, isPlaying, currentTime, alert })
   *    announceTrack(track)  → registra una pista local como compartible
   *    unannounceTrack(trackId) → avisa a los peers que se eliminó
   *    onPeersChanged(fn)
   *    onStateChange(fn)
   *    onSharedTrackReady(fn)  → fn(trackMeta, blob)
   *    onPlaybackSync(fn)  → fn(lastAction)  → saltar a la pista del peer
   *    onTrackListChanged(fn)  → fn()  → actualizar UI porque llegó una pista
   */
  const AuroraRealtime = {
    _channel: null,
    _listeners: { peers: [], state: [], sharedTrack: [], playback: [], tracklist: [] },
    _deviceName: 'Developer',
    _state: null,
    _knownFiles: {},        // fileId → { id, name, size, type, lastModified, pending, uploadedBy }
    _activeRequest: null,   // { file, chunk, peer, time }
    _requestCooldownMs: 10000,
    _requestPollFastMs: 50,
    _requestPollSlowMs: 1000,
    _lastSyncedActionTime: 0,
    _lastAnnouncedJam: false,
    _summaryDebouncer: null,
    _initDone: false,

    /* ---------- Suscripciones ---------- */
    onPeersChanged(fn) { this._listeners.peers.push(fn); },
    onStateChange(fn) { this._listeners.state.push(fn); },
    onSharedTrackReady(fn) { this._listeners.sharedTrack.push(fn); },
    onPlaybackSync(fn) { this._listeners.playback.push(fn); },
    onTrackListChanged(fn) { this._listeners.tracklist.push(fn); },

    _emit(evt, ...args) {
      (this._listeners[evt] || []).forEach(fn => { try { fn(...args); } catch (e) {} });
    },

    /* ---------- Estado ---------- */
    getPeers() { return this._channel ? this._channel.getPeers() : []; },
    getDeviceId() { return this._channel ? this._channel.getDeviceId() : null; },
    getState() { return this._state; },

    /* ---------- Conexión ---------- */
    connect() {
      if (this._initDone) return;
      this._initDone = true;
      this._deviceName = (window.webxdc && window.webxdc.selfName) || 'Anonymous';
      this._channel = new RealtimeChannel({
        onPeersChanged: (peers) => this._onPeersChanged(peers),
        onPayload: (fromDeviceId, payload) => this._onPayload(fromDeviceId, payload),
      });
      // Estado inicial: sin lastAction, sin pista activa
      this._state = {
        files: [],
        lastAction: null,
        selfName: this._deviceName,
        playlistName: 'Aurora'
      };
      this._channel.setState(this._state);
      this._channel.connect();
      window.addEventListener('beforeunload', () => this.disconnect());
      // Iniciar bucle de solicitud de chunks
      setTimeout(() => this._requestLoop(), 200);
      // Resumen periódico (similar a app.xdc)
      this._summaryDebouncer = debounce(() => {
        if (window.webxdc && window.webxdc.sendUpdate) {
          window.webxdc.sendUpdate({ payload: null, summary: this._summary() }, '');
        }
      }, 10000);
    },

    disconnect() {
      if (this._channel) this._channel.disconnect();
    },

    /* ---------- Estado: pistas conocidas ---------- */
    setKnownFiles(files) {
      this._state.files = files;
      this._channel.setState(this._state);
    },

    /* ---------- Acciones de reproducción ---------- */
    broadcastLastAction(action) {
      if (!this._channel) return;
      const a = Object.assign({}, action, { actionTime: Date.now() });
      this._state.lastAction = a;
      this._channel.setState(this._state);
      // Avanzar el estado del peer local; el presence lo difunde automáticamente.
      this._emit('state', this._state);
      // Anunciar "jam" al chat la primera vez
      this._maybeAnnounceJam();
      this._summaryDebouncer && this._summaryDebouncer();
    },

    _maybeAnnounceJam() {
      if (this._lastAnnouncedJam) return;
      const anyPeerActive = this.getPeers().some(p => p.state && p.state.lastAction);
      if (!anyPeerActive) {
        this._lastAnnouncedJam = true;
        if (window.webxdc && window.webxdc.sendUpdate) {
          window.webxdc.sendUpdate(
            {
              payload: null,
              info: `${this._deviceName} started a jam on Aurora`,
              summary: this._summary()
            },
            ''
          );
        }
      }
    },

    /* ---------- Anunciar / quitar pista ---------- */
    announceTrack(track) {
      if (!this._channel) return;
      // Construir entrada "file" estilo app.xdc
      const file = {
        id: track.id,
        name: track.fileName || track.title || 'Unknown',
        lastModified: Date.now(),
        size: track.fileSize || 0,
        type: 'audio/mpeg',
        pending: [],
        uploadedBy: this._deviceName,
        // Solo metadatos de texto — NO cover ni lrc (demasiado grandes
        // para el broadcast de presence cada 2s). El receptor re-lee
        // los tags ID3 del blob descargado.
        meta: {
          title: track.title,
          artist: track.artist,
          album: track.album
        }
      };
      // Añadir o reemplazar
      const existingIdx = this._state.files.findIndex(f => f.id === file.id);
      if (existingIdx >= 0) this._state.files[existingIdx] = file;
      else this._state.files.push(file);
      this._channel.setState(this._state);
      this._summaryDebouncer && this._summaryDebouncer();
    },

    unannounceTrack(trackId) {
      if (!this._channel) return;
      const idx = this._state.files.findIndex(f => f.id === trackId);
      if (idx < 0) return;
      this._state.files.splice(idx, 1);
      this._channel.setState(this._state);
      // Borrar chunks locales también
      ChunksStore.deleteChunks(trackId).catch(() => {});
      this._summaryDebouncer && this._summaryDebouncer();
    },

    /* ---------- Callback de peers ---------- */
    _onPeersChanged(peers) {
      // Procesar archivos de peers (alta/baja de pistas compartidas)
      this._mergePeerFiles(peers);
      // Intentar sincronizar lastAction
      this._tryApplyLastAction(peers);
      // Notificar UI
      this._emit('peers', peers);
    },

    /* ---------- Procesa los archivos anunciados por los peers ---------- */
    async _mergePeerFiles(peers) {
      let changed = false;
      for (const peer of peers) {
        const peerFiles = (peer.state && peer.state.files) || [];
        for (let pf of peerFiles) {
          if (pf.size === 0) continue;
          const local = this._knownFiles[pf.id];
          if (local) {
            // ¿Versión más nueva?
            if (local.lastModified < pf.lastModified) {
              pf = Object.assign({}, pf, { pending: [] });
              const numChunks = Math.ceil(pf.size / CHUNK_SIZE);
              for (let i = 0; i < numChunks; i++) pf.pending.push(i);
              this._knownFiles[pf.id] = pf;
              await ChunksStore.deleteChunks(pf.id).catch(() => {});
              changed = true;
            }
          } else {
            // Nueva pista compartida
            pf = Object.assign({}, pf, { pending: [] });
            const numChunks = Math.ceil(pf.size / CHUNK_SIZE);
            for (let i = 0; i < numChunks; i++) pf.pending.push(i);
            this._knownFiles[pf.id] = pf;
            changed = true;
          }
        }
      }
      if (changed) this._emit('tracklist');
    },

    /* ---------- Intentar aplicar lastAction de un peer ---------- */
    _tryApplyLastAction(peers) {
      const myLast = this._state.lastAction?.actionTime ?? 0;
      let best = null;
      for (const peer of peers) {
        const a = peer.state && peer.state.lastAction;
        if (!a) continue;
        if (a.actionTime <= myLast) continue;
        // Solo aplicar si tenemos la pista localmente
        const haveIt = this._hasLocalTrack(a.trackId);
        if (!haveIt) continue;
        if (!best || a.actionTime > best.actionTime) best = a;
      }
      if (!best) return;
      if (best.actionTime <= this._lastSyncedActionTime) return;
      this._lastSyncedActionTime = best.actionTime;
      // Actualizar nuestro lastAction con el del peer
      this._state.lastAction = best;
      this._channel.setState(this._state);
      // Notificar a app.js para que salte a esa pista/posición
      this._emit('playback', best);
      if (best.alert) this._emit('state', this._state);
    },

    _hasLocalTrack(trackId) {
      if (!window.AuroraApp) return false;
      return window.AuroraApp.tracks.some(t => t.id === trackId);
    },

    /* ---------- Recepción de payload (request/response) ---------- */
    async _onPayload(fromDeviceId, payload) {
      if (isRequestPayload(payload)) {
        const req = payload.request;
        // Solo responder si el request es para mí
        if (req.peer !== this._channel.getDeviceId()) return;
        const fileMeta = this._state.files.find(f => f.id === req.file);
        if (!fileMeta) return;
        // Buscar el chunk en IndexedDB (vía AuroraStorage) o en memoria
        const chunk = await this._readLocalChunk(req.file, req.chunk);
        if (!chunk) return;
        const arr = new Uint8Array(await chunk.arrayBuffer());
        this._channel.sendPayload({
          response: {
            file: req.file,
            lastModified: fileMeta.lastModified,
            chunk: req.chunk,
            data: arr
          }
        });
      } else if (isResponsePayload(payload)) {
        const resp = payload.response;
        const meta = this._knownFiles[resp.file];
        if (!meta) return;
        if (meta.lastModified !== resp.lastModified) return;
        const idx = meta.pending.indexOf(resp.chunk);
        if (idx < 0) return;
        meta.pending.splice(idx, 1);
        await ChunksStore.addChunk(resp.file, resp.chunk, new Blob([resp.data]));
        // ¿Chunk en curso resuelto?
        if (this._activeRequest &&
            this._activeRequest.file === resp.file &&
            this._activeRequest.chunk === resp.chunk) {
          this._activeRequest = null;
        }
        // ¿Pista completa?
        if (meta.pending.length === 0) {
          await this._assembleAndDeliverTrack(meta);
        }
        this._emit('tracklist');
      }
    },

    /* ---------- Lee un chunk local (de AuroraStorage o de ChunksStore) ---------- */
    async _readLocalChunk(fileId, chunkIdx) {
      // 1) Buscar en AuroraStorage (donde Aurora guarda el blob completo)
      if (window.AuroraStorage) {
        try {
          const t = await window.AuroraStorage.getTrack(fileId);
          if (t && (t.fileBlob || t._file)) {
            const blob = t.fileBlob || t._file;
            const start = chunkIdx * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, blob.size);
            return blob.slice(start, end, 'audio/mpeg');
          }
        } catch (e) {}
      }
      // 2) Buscar en ChunksStore (chunks previamente recibidos)
      try {
        const c = await ChunksStore.getChunk(fileId, chunkIdx);
        return c ? c.blob : null;
      } catch (e) { return null; }
    },

    /* ---------- Bucle de solicitud de chunks pendientes ---------- */
    _requestLoop() {
      if (!this._activeRequest || (Date.now() - this._activeRequest.time) > this._requestCooldownMs) {
        let next = null;
        // Priorizar: pista en reproducción > siguiente en cola > el resto
        if (window.AuroraApp && window.AuroraApp.currentTrack) {
          const cur = window.AuroraApp.currentTrack;
          if (this._knownFiles[cur.id] && this._knownFiles[cur.id].pending.length > 0) {
            next = this._pickChunkToRequest(this._knownFiles[cur.id]);
          }
        }
        if (!next) {
          // Buscar cualquier pista con chunks pendientes
          const shuffled = shuffleArray(Object.values(this._knownFiles));
          for (const f of shuffled) {
            if (f.pending.length > 0) {
              next = this._pickChunkToRequest(f);
              if (next) break;
            }
          }
        }
        if (next) {
          this._activeRequest = next;
          this._channel.sendPayload({ request: next });
        }
      }
      const delay = this._activeRequest ? this._requestPollFastMs : this._requestPollSlowMs;
      setTimeout(() => this._requestLoop(), delay);
    },

    _pickChunkToRequest(fileMeta) {
      // Elegir un peer que tenga la pista completa (sin ese chunk en pending)
      const peers = shuffleArray(this.getPeers());
      for (const peer of peers) {
        const peerFile = (peer.state && peer.state.files || []).find(f => f.id === fileMeta.id);
        if (peerFile && peerFile.lastModified === fileMeta.lastModified) {
          // Tomar el primer chunk pendiente
          const chunkIdx = fileMeta.pending[0];
          return { time: Date.now(), file: fileMeta.id, chunk: chunkIdx, peer: peer.id };
        }
      }
      return null;
    },

    /* ---------- Ensambla y entrega una pista completa ---------- */
    async _assembleAndDeliverTrack(meta) {
      try {
        const chunks = await ChunksStore.getAllChunks(meta.id);
        if (!chunks.length) return;
        const blob = new Blob(chunks.map(c => c.blob), { type: 'audio/mpeg' });

        // Re-leer tags ID3 del blob descargado para obtener cover y lrc
        // (no se envían por presence para mantener los mensajes pequeños).
        let parsedMeta = null;
        if (window.AuroraUploader && typeof window.AuroraUploader.processOne === 'function') {
          try {
            const file = new File([blob], meta.name || 'shared.mp3', { type: 'audio/mpeg' });
            const parsed = await window.AuroraUploader.processOne(file, {});
            if (parsed) {
              parsedMeta = parsed;
            }
          } catch (e) {
            console.warn('[Realtime] Error re-parseando ID3:', e);
          }
        }

        // Construir el track final: ID del anuncio + metadatos parseados
        // (con cover y lrc) o fallback a los metadatos del anuncio.
        const track = {
          id: meta.id,
          title: (parsedMeta && parsedMeta.title) || (meta.meta && meta.meta.title) || meta.name || 'Shared track',
          artist: (parsedMeta && parsedMeta.artist) || (meta.meta && meta.meta.artist) || 'Unknown artist',
          album: (parsedMeta && parsedMeta.album) || (meta.meta && meta.meta.album) || '',
          duration: 0,
          src: (parsedMeta && parsedMeta.src) || URL.createObjectURL(blob),
          cover: (parsedMeta && parsedMeta.cover) || null,
          coverIsImage: (parsedMeta && parsedMeta.coverIsImage) || false,
          lrc: (parsedMeta && parsedMeta.lrc) || null,
          fileSize: meta.size,
          fileName: meta.name,
          fileBlob: blob,
          shared: true,
          uploadedBy: meta.uploadedBy || 'Unknown'
        };
        this._emit('sharedTrack', track);
      } catch (e) {
        console.warn('[Realtime] Error ensamblando pista compartida:', e);
      }
    },

    /* ---------- Resume para el chat ---------- */
    _summary() {
      const n = this._state.files.length;
      return `${n} song${n === 1 ? '' : 's'}`;
    },

    /* ---------- API para refrescar lista de archivos desde app.js ---------- */
    refreshKnownFiles(tracks) {
      const files = tracks
        .filter(t => t.fileSize && t.fileSize > 0)
        .map(t => ({
          id: t.id,
          name: t.fileName || t.title || 'Unknown',
          lastModified: t._rtLastModified || Date.now(),
          size: t.fileSize,
          type: 'audio/mpeg',
          pending: [],
          uploadedBy: this._deviceName,
          // Solo metadatos de texto pequeños — NO cover ni lrc
          // (pueden ser cientos de KB cada uno). El receptor
          // re-lee los tags ID3 del blob descargado.
          meta: {
            title: t.title,
            artist: t.artist,
            album: t.album
          }
        }));
      this.setKnownFiles(files);
    }
  };

  window.AuroraRealtime = AuroraRealtime;
  window.AuroraRealtimeChunksStore = ChunksStore;
})();
