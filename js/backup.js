/* =====================================================================
 *  backup.js — Copia de seguridad de la biblioteca, con la música dentro
 *  Reproductor de música profesional · mobile-first
 *
 *  El problema que resuelve: exportar una lista a .m3u8 guarda los
 *  NOMBRES, no la música, así que al restaurar hay que volver a buscar
 *  cada archivo en el dispositivo y volver a vincularlo a mano. Aquí el
 *  audio viaja dentro del archivo de copia y al restaurar se escribe en
 *  el almacén de blobs con su mismo id, así que las canciones y las
 *  listas vuelven vinculadas.
 *
 *  Formato (un solo archivo, sin comprimir y sin librerías):
 *
 *      aurora-backup/1\n
 *      <longitud del JSON en bytes>\n
 *      <JSON: pistas, listas, favoritos, estadísticas y dónde empieza cada audio>
 *      <audio 1><audio 2>…            (bytes tal cual, sin base64)
 *
 *  Los audios se guardan en crudo: un MP3 no comprime, y meterlo en
 *  base64 lo engordaría un tercio. Los offsets del JSON son relativos al
 *  final de la cabecera, así que se puede leer cada audio con un slice()
 *  sin cargar el archivo entero en memoria.
 * ===================================================================== */

'use strict';

Object.assign(App, {
  BACKUP_MAGIC: 'aurora-backup/1\n',

  /* ---------- Leer un Blob como texto (FileReader: WebView antiguo) ---------- */
  _readBlobText(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(r.error || new Error('lectura fallida'));
      r.readAsText(blob);
    });
  },

  /* Registro de pista listo para guardar: fuera los campos de sesión
   * (objectURL, File en memoria, cachés) que no sirven de nada en otro
   * dispositivo. */
  _backupTrackRecord(t) {
    const rec = Object.assign({}, t);
    delete rec.src;
    delete rec._file;
    delete rec.fileBlob;
    delete rec._lrcCache;
    delete rec._lrcCacheKey;
    delete rec._thumbsHiRes;
    delete rec._thumbing;
    delete rec._thumbsDirty;
    return rec;
  },

  /* ---------- Crear la copia ----------
   * Devuelve un Blob (el archivo). No se compone con base64: los Blobs
   * del audio se pasan tal cual, así que una biblioteca grande no se
   * copia en memoria dos veces. */
  async buildBackup() {
    const now = new Date();
    const tracks = [];
    const blobs = [];
    const parts = [];
    let offset = 0;
    const total = this.tracks.length;
    this.showImportOverlay(0, total, '');
    try {
      for (let i = 0; i < total; i++) {
        const t = this.tracks[i];
        const rec = this._backupTrackRecord(t);
        if (i % 10 === 0) this.updateImportOverlay(i, total, t.title || '');
        if (t.hasAudio) {
          //  ¿Estaba ya en memoria antes de la copia? Si no, se suelta al
          //  terminar con esta pista: quien guarda el archivo es el Blob
          //  final (que referencia los trozos sin copiarlos), no la pista.
          const enMemoria = !!(t._file || t.fileBlob);
          const ok = await this.ensureTrackBlob(t);
          const audio = ok ? (t._file || t.fileBlob) : null;
          if (audio && typeof audio.size === 'number') {
            blobs.push({ id: t.id, offset, size: audio.size, type: audio.type || 'audio/mpeg' });
            parts.push(audio);
            offset += audio.size;
            rec.hasAudio = true;
          } else {
            //  Metadato sin audio detrás: la copia lo dice en vez de mentir.
            rec.hasAudio = false;
          }
          if (!enMemoria) delete t.fileBlob;
        }
        tracks.push(rec);
      }
    } finally {
      this.hideImportOverlay();
    }

    const header = {
      v: 1,
      app: 'Aurora Music Player',
      version: this.VERSION || '',
      createdAt: now.toISOString(),
      audioBytes: offset,
      tracks,
      blobs,
      playlists: (this.playlists || []).map((pl) => ({
        id: pl.id,
        name: pl.name,
        description: pl.description || '',
        trackIds: (pl.trackIds || []).slice(),
        cover: pl.cover || null,
        coverArt: pl.coverArt || null,
        coverArtHash: pl.coverArtHash || null,
        sort: pl.sort || null,
      })),
      favorites: [...(this.favorites || [])],
      stats: this.stats || null,
    };
    //  La longitud va en BYTES, no en caracteres: los títulos con acentos
    //  ocupan más de un byte y el lector cortaría el JSON a mitad.
    const jsonBlob = new Blob([JSON.stringify(header)]);
    const head = new Blob([this.BACKUP_MAGIC, String(jsonBlob.size) + '\n', jsonBlob]);
    const blob = new Blob([head, ...parts], { type: 'application/x-aurora-backup' });
    this._lastBackupInfo = { tracks: tracks.length, playlists: header.playlists.length, audioBytes: offset, size: blob.size };
    return blob;
  },

  /* Nombre del archivo: se ordena solo en una carpeta o en el chat. */
  backupFileName() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return 'aurora-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
      '-' + p(d.getHours()) + p(d.getMinutes()) + '.aurora';
  },

  /* Botón «Guardar copia»: la manda al chat (webxdc) o la descarga. */
  async exportBackup() {
    if (!this.tracks.length) {
      this.toast(this.t('toast_backup_empty'), 'danger');
      return false;
    }
    try {
      const blob = await this.buildBackup();
      const info = this._lastBackupInfo || {};
      const res = await this.exportFile({
        name: this.backupFileName(),
        content: blob,
        mimeType: 'application/x-aurora-backup',
        //  Pie del mensaje en el chat: sin clave nueva, el título de la
        //  sección y las cifras.
        caption: this.t('settings_backup') + ' · ' + (info.tracks || 0) +
          ' · ' + (typeof this.fmtBytes === 'function' ? this.fmtBytes(info.audioBytes || 0) : '')
      });
      this.toastExportResult(res);
      return res !== false;
    } catch (e) {
      console.warn('[Aurora] No se pudo crear la copia:', e);
      this._lastError = { msg: 'backup: ' + e.message, ts: Date.now() };
      this.toast(this.t('toast_share_error'), 'danger');
      return false;
    }
  },

  /* ---------- Leer la cabecera de una copia ----------
   * Devuelve { header, blobFor(id) } sin cargar el archivo entero. */
  async parseBackup(file) {
    if (!file || typeof file.slice !== 'function') throw new Error('archivo no válido');
    const magicLen = this.BACKUP_MAGIC.length;
    const head = await this._readBlobText(file.slice(0, 48));
    if (head.slice(0, magicLen) !== this.BACKUP_MAGIC) {
      throw new Error('no es una copia de Aurora');
    }
    const m = /^(\d+)\n/.exec(head.slice(magicLen));
    if (!m) throw new Error('cabecera incompleta');
    const jsonLen = Number(m[1]);
    if (!(jsonLen > 0) || jsonLen > 64 * 1024 * 1024) throw new Error('cabecera imposible');
    const jsonStart = magicLen + m[0].length;
    const json = JSON.parse(await this._readBlobText(file.slice(jsonStart, jsonStart + jsonLen)));
    if (!json || json.v !== 1 || !Array.isArray(json.tracks)) throw new Error('copia de otra versión');
    const binStart = jsonStart + jsonLen;
    const byId = new Map((json.blobs || []).map((b) => [b.id, b]));
    return {
      header: json,
      hasAudio: (json.blobs || []).length > 0,
      blobFor: (id) => {
        const b = byId.get(id);
        if (!b) return null;
        //  Un tamaño absurdo (o que se sale del archivo) no debe intentar
        //  reservar memoria: se descarta ese audio y sigue el resto.
        if (!(b.size >= 0) || binStart + b.offset + b.size > file.size) return null;
        return file.slice(binStart + b.offset, binStart + b.offset + b.size, b.type || 'audio/mpeg');
      },
    };
  },

  /* ---------- Restaurar ----------
   * Fusiona, nunca borra: lo que ya está en la biblioteca se queda como
   * está y se completa con lo que traiga la copia. Así restaurar una
   * copia vieja no puede destruir la biblioteca actual. */
  async importBackup(file) {
    const data = await this.parseBackup(file);
    const header = data.header;
    const known = new Set(this.tracks.map((t) => t.id));
    const total = header.tracks.length;
    let addTracks = 0, addAudio = 0, addPlaylists = 0, kept = 0;
    this.showImportOverlay(0, total, '');
    try {
      for (let i = 0; i < total; i++) {
        const rec = header.tracks[i];
        if (!rec || !rec.id) continue;
        if (i % 10 === 0) this.updateImportOverlay(i, total, rec.title || '');
        if (known.has(rec.id)) { kept++; continue; }
        const audio = data.blobFor(rec.id);
        if (audio) { await window.AuroraStorage.putBlob(rec.id, audio); addAudio++; }
        rec.hasAudio = !!audio;
        rec.addedAt = rec.addedAt || Date.now();
        await window.AuroraStorage.putTrack(rec);
        this.tracks.push(rec);
        known.add(rec.id);
        addTracks++;
      }
      this.invalidateTrackIndex();

      //  Listas: por id y, si no, por nombre (una copia antigua puede
      //  traer un id distinto del mismo nombre).
      for (const pl of header.playlists || []) {
        if (!pl || !pl.name) continue;
        const dst = this.playlists.find((p) => p.id === pl.id)
          || this.playlists.find((p) => p.name === pl.name);
        if (dst) {
          (pl.trackIds || []).forEach((id) => {
            if (known.has(id) && dst.trackIds.indexOf(id) < 0) dst.trackIds.push(id);
          });
          if (!dst.cover && pl.cover) dst.cover = pl.cover;
          await this.persistPlaylist(dst);
        } else {
          const fresh = {
            id: pl.id || ('pl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
            name: pl.name,
            description: pl.description || '',
            trackIds: (pl.trackIds || []).filter((id) => known.has(id)),
            cover: pl.cover || null,
            coverArt: pl.coverArt || null,
            coverArtHash: pl.coverArtHash || null,
            sort: pl.sort || null,
          };
          this.playlists.push(fresh);
          await this.persistPlaylist(fresh);
          addPlaylists++;
        }
      }
      //  Favoritos: unión. Nunca se quita ninguno.
      (header.favorites || []).forEach((id) => {
        if (known.has(id)) this.favorites.add(id);
      });
      this.saveFavorites();
    } finally {
      this.hideImportOverlay();
    }

    this.syncLibCountMarker();
    this.renderPlaylists();
    this.renderFavorites();
    if (typeof this.renderHome === 'function') this.renderHome();
    if (typeof this.renderLibrarySections === 'function') this.renderLibrarySections();
    if (typeof this.updateChrome === 'function') this.updateChrome();
    this._lastRestoreInfo = { tracks: addTracks, audio: addAudio, playlists: addPlaylists, kept };
    return this._lastRestoreInfo;
  },
});
