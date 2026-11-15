/* =====================================================================
 *  js/backup.js — Aurora Music Player
 *  Copia de respaldo y restauración de la biblioteca entera
 *
 *  Qué resuelve: hasta ahora la música vivía SOLO dentro de la
 *  instancia del .xdc (IndexedDB) y no había forma de sacarla. Las
 *  listas exportadas a .m3u8 guardan nombres de archivo, no audio, así
 *  que al llevarlas a otra versión las canciones aparecían sin audio y
 *  «se perdía el enlace» entre la canción y su almacenamiento.
 *
 *  Un archivo .aurora lleva todo junto y con los identificadores
 *  intactos:
 *
 *    AURORA-BACKUP 2 <bytes-de-json>\n
 *    { ...manifiesto: pistas, listas, favoritos, estadísticas... }
 *    <audio 1><audio 2><audio 3>...
 *
 *  El manifiesto guarda, para cada pista, DÓNDE empieza y cuánto mide
 *  su audio dentro del archivo. Al restaurar, cada audio se escribe en
 *  el almacén «blobs» con el MISMO id que la pista, que es lo que
 *  mantiene el enlace canción ↔ audio y deja las listas apuntando a
 *  canciones que suenan.
 *
 *  Dos decisiones que conviene no deshacer:
 *
 *   - Nada de base64: engordaría el archivo un tercio y obligaría a
 *     cargarlo entero en memoria para leerlo. El audio va en crudo y
 *     se lee por trozos con slice().
 *   - Nada de compresión: un MP3/M4A ya está comprimido; volver a
 *     comprimirlo cuesta batería y no ahorra casi nada.
 *
 *  Restaurar FUSIONA, nunca borra: lo que ya hay se queda, las pistas
 *  que faltan se añaden y las listas y los favoritos se completan. Una
 *  copia vieja no puede destruir la biblioteca actual. Y si la misma
 *  canción ya está en la biblioteca con otro id (se importó a mano en
 *  la versión nueva), se reconoce por su huella de contenido y las
 *  listas de la copia se reapuntan a la que ya existe: ni duplicados
 *  ni listas rotas.
 *
 *  Cómo llega al chat: webxdc.sendToChat({ file: { name, blob } })
 *  (spec webxdc → sendToChat) a través de exportFile(), que en
 *  navegador descarga el archivo. Y se elige con webxdc.importFiles()
 *  (spec → importFiles, filtrado por extensión .aurora).
 * ===================================================================== */

'use strict';

Object.assign(App, {
    /* ---------- Constantes del formato ---------- */
    BACKUP_MAGIC: 'AURORA-BACKUP',
    BACKUP_FORMAT: 2,
    BACKUP_EXT: '.aurora',
    BACKUP_MIME: 'application/x-aurora-backup',

    /* Campos de trabajo de la sesión que no deben viajar en la copia:
     * el audio va aparte, los objectURL son de esta sesión y las cachés
     * de letras/miniaturas se reconstruyen solas. */
    _BACKUP_SKIP_FIELDS: [
      '_file', 'fileBlob', 'src', 'hasAudio', 'audio',
      '_lrcCache', '_lrcCacheKey', '_thumbsHiRes', '_thumbing', '_thumbsDirty',
      '_coverToken', '_blobLoads'
    ],

    /* ============================================================
     *  Lectura de blobs (compatible con WebView antiguos)
     * ============================================================ */
    /* readAsText/readAsArrayBuffer existen desde siempre; blob.text()
     * y blob.arrayBuffer() no, y además aquí pueden llegar Blobs de
     * otro «realm» (las pruebas usan los de Node): se prueban ambos. */
    _readBlobAsText(blob) {
      return new Promise((resolve, reject) => {
        try {
          if (blob instanceof Blob) {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result == null ? '' : fr.result));
            fr.onerror = () => reject(fr.error || new Error('read'));
            fr.readAsText(blob);
            return;
          }
          if (blob && typeof blob.text === 'function') {
            blob.text().then(
              (v) => resolve(String(v == null ? '' : v)),
              (e) => reject(e)
            );
            return;
          }
          reject(new Error('blob ilegible'));
        } catch (e) { reject(e); }
      });
    },

    _readBlobAsBytes(blob) {
      return new Promise((resolve, reject) => {
        try {
          if (blob instanceof Blob) {
            const fr = new FileReader();
            fr.onload = () => resolve(new Uint8Array(fr.result || new ArrayBuffer(0)));
            fr.onerror = () => reject(fr.error || new Error('read'));
            fr.readAsArrayBuffer(blob);
            return;
          }
          if (blob && typeof blob.arrayBuffer === 'function') {
            blob.arrayBuffer().then(
              (buf) => resolve(new Uint8Array(buf || new ArrayBuffer(0))),
              (e) => reject(e)
            );
            return;
          }
          reject(new Error('blob ilegible'));
        } catch (e) { reject(e); }
      });
    },

    /* ============================================================
     *  Crear la copia
     * ============================================================ */
    /* Construye el archivo de copia y lo devuelve como Blob. Separado
     * de exportBackup() para poder probarlo (y para no mezclar «armar
     * el archivo» con «enviarlo al chat o descargarlo»). */
    async buildBackupBlob(onProgress) {
      if (!window.AuroraStorage) throw new Error('backup_error_not_backup');
      const tracks = Array.isArray(this.tracks) ? this.tracks : [];
      const conAudio = tracks.filter((t) => t && t.hasAudio);

      /* 1. Metadatos: copia de todo menos los campos de sesión, más la
       *    huella (fingerprint) que luego permite reconocer la misma
       *    canción si en el destino entró con otro id. */
      const records = tracks.map((t) => {
        const rec = {};
        for (const k of Object.keys(t)) {
          if (this._BACKUP_SKIP_FIELDS.indexOf(k) >= 0) continue;
          const v = t[k];
          if (v === undefined) continue;
          rec[k] = v;
        }
        return rec;
      });
      const recById = new Map(records.map((r) => [r.id, r]));

      /* 2. Audio: se lee del almacén uno a uno y se apunta su tramo.
       *    Los Blob del propio entorno se encadenan tal cual (sin
       *    copiarlos a memoria); si el Blob viene de otro realm (las
       *    pruebas), se leen sus bytes. */
      const parts = [];
      let offset = 0;
      let included = 0;
      for (let i = 0; i < conAudio.length; i++) {
        const t = conAudio[i];
        if (typeof onProgress === 'function') onProgress(i, conAudio.length, t.title || t.fileName || '');
        let audio = null;
        try { audio = await window.AuroraStorage.getBlob(t.id); } catch (e) { audio = null; }
        if (!audio) continue;
        const rec = recById.get(t.id);
        if (!rec) continue;
        let size = Number(audio.size) || 0;
        let part = audio;
        if (!(audio instanceof Blob)) {
          try {
            part = await this._readBlobAsBytes(audio);
            size = part.byteLength;
          } catch (e) { continue; }
        }
        if (!size) continue;
        rec.audio = {
          offset,
          length: size,
          type: audio.type || 'audio/mpeg',
          name: t.fileName || ''
        };
        parts.push(part);
        offset += size;
        included++;
      }

      /* 3. Listas, favoritos y estadísticas: sin ellas, restaurar la
       *    música deja la biblioteca «a medias» (sin tus listas ni tus
       *    estrellas), que es justo lo que se quería evitar. */
      const manifest = {
        app: 'aurora-music-player',
        format: this.BACKUP_FORMAT,
        version: this.VERSION || null,
        createdAt: new Date().toISOString(),
        counts: {
          tracks: tracks.length,
          audio: included,
          playlists: (this.playlists || []).length,
          favorites: this.favorites ? this.favorites.size : 0
        },
        tracks: records,
        playlists: (this.playlists || []).map((pl) => {
          const out = {
            id: pl.id,
            name: pl.name,
            description: pl.description || '',
            trackIds: Array.isArray(pl.trackIds) ? pl.trackIds.slice() : [],
            cover: pl.cover || null,
            sort: pl.sort || null,
            coverArt: pl.coverArt || pl._coverCache || null,
            coverArtHash: pl.coverArtHash || pl._coverCacheHash || null
          };
          return out;
        }),
        favorites: this.favorites ? [...this.favorites] : [],
        stats: (this.stats && typeof this.stats === 'object') ? this.stats : null
      };

      const json = JSON.stringify(manifest);
      const jsonBytes = new Blob([json]).size;
      const header = this.BACKUP_MAGIC + ' ' + this.BACKUP_FORMAT + ' ' + jsonBytes + '\n';
      return new Blob([header, json, ...parts], { type: this.BACKUP_MIME });
    },

    /* Nombre del archivo: fecha para reconocer la copia más nueva. */
    backupFileName() {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      return 'aurora-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
        '-' + p(d.getHours()) + p(d.getMinutes()) + this.BACKUP_EXT;
    },

    /* Ajustes → Copia de respaldo. Mismo camino que «Compartir»: en
     * Delta Chat el archivo va al chat (webxdc.sendToChat); en
     * navegador se descarga. */
    async exportBackup() {
      if (!this.tracks || !this.tracks.length) {
        this.toast(this.t('backup_empty'));
        return false;
      }
      this._showBackupProgress('backup_preparing', 0, this.tracks.length);
      let blob = null;
      try {
        blob = await this.buildBackupBlob((i, n) => {
          this.updateImportOverlay(i, n, this.t('backup_preparing_audio').replace('X', String(n)));
        });
      } catch (e) {
        console.warn('[Aurora] No se pudo crear la copia de respaldo:', e);
        this._hideBackupProgress();
        this.toast(this.t('toast_backup_error'), 'danger');
        return false;
      }
      this.updateImportOverlay(1, 1, this.fmtBytes(blob.size || 0));
      let res = false;
      try {
        res = await this.exportFile({
          name: this.backupFileName(),
          content: blob,
          mimeType: this.BACKUP_MIME,
          caption: this.t('backup_chat_caption')
            .replace('X', String(this.tracks.length))
            .replace('Y', this.fmtBytes(blob.size || 0))
        });
      } catch (e) {
        res = false;
      }
      this._hideBackupProgress();
      if (res === 'chat' || res === 'download') {
        this.toast(this.t('toast_backup_done')
          .replace('X', String(this.tracks.length))
          .replace('Y', this.fmtBytes(blob.size || 0)));
        return true;
      }
      this.toast(this.t('toast_backup_error'), 'danger');
      return false;
    },

    /* ============================================================
     *  Leer la copia
     * ============================================================ */
    /* Devuelve { manifest, payloadStart } o lanza un error cuyo
     * mensaje ES una clave i18n (el llamador la traduce). */
    async _parseBackup(file) {
      if (!file || typeof file.slice !== 'function') throw new Error('backup_error_not_backup');
      const head = await this._readBlobAsText(file.slice(0, 256));
      const nl = head.indexOf('\n');
      if (nl < 0) throw new Error('backup_error_not_backup');
      const line = head.slice(0, nl).trim();
      const magic = new RegExp('^' + this.BACKUP_MAGIC + ' (\\d+) (\\d+)$');
      const m = magic.exec(line);
      if (!m) throw new Error('backup_error_not_backup');
      const format = parseInt(m[1], 10);
      if (format !== this.BACKUP_FORMAT) throw new Error('backup_error_version');
      const jsonBytes = parseInt(m[2], 10);
      const headerBytes = nl + 1;   // la cabecera es ASCII: 1 carácter = 1 byte
      if (!(jsonBytes > 0) || headerBytes + jsonBytes > file.size) {
        throw new Error('backup_error_corrupt');
      }
      let manifest = null;
      try {
        const json = await this._readBlobAsText(file.slice(headerBytes, headerBytes + jsonBytes));
        manifest = JSON.parse(json);
      } catch (e) {
        throw new Error('backup_error_corrupt');
      }
      if (!manifest || manifest.app !== 'aurora-music-player' || !Array.isArray(manifest.tracks)) {
        throw new Error('backup_error_corrupt');
      }
      const payloadStart = headerBytes + jsonBytes;
      // Cada tramo de audio tiene que caber DENTRO del archivo: una copia
      // truncada debe avisar, no escribir medio MP3 en la biblioteca.
      for (const rec of manifest.tracks) {
        if (!rec || !rec.audio) continue;
        const a = rec.audio;
        if (!(a.offset >= 0) || !(a.length >= 0) || payloadStart + a.offset + a.length > file.size) {
          throw new Error('backup_error_corrupt');
        }
      }
      return { manifest, payloadStart };
    },

    /* ============================================================
     *  Restaurar (fusionar, nunca borrar)
     * ============================================================ */
    /* opts.onProgress(done, total, name) para la barra de progreso. */
    async restoreBackup(file, opts) {
      opts = opts || {};
      const { manifest, payloadStart } = await this._parseBackup(file);
      const store = window.AuroraStorage;
      const summary = { tracks: 0, linked: 0, audio: 0, playlists: 0, favorites: 0, skipped: 0, cancelled: false };

      /* --- 1. Pistas --- */
      // Índice por id y por huella: con lo que YA hay en la biblioteca
      // para no duplicar, y con lo que va entrando en esta restauración
      // (una copia con la misma canción dos veces no la duplica).
      const byFp = new Map();
      for (const t of this.tracks) if (t && t.fp) byFp.set(t.fp, t);
      const idMap = new Map();   // id de la copia → id final en la biblioteca
      const total = manifest.tracks.length;
      let done = 0;

      for (const rec of manifest.tracks) {
        // Cancelable: lo ya restaurado se queda (fusionar es
        // idempotente, volver a lanzar la restauración no duplica nada).
        if (typeof opts.isCancelled === 'function' && opts.isCancelled()) {
          summary.cancelled = true;
          break;
        }
        if (typeof opts.onProgress === 'function') {
          opts.onProgress(done, total, rec.title || rec.fileName || '');
        }
        done++;
        if (!rec || typeof rec.id !== 'string' || !rec.id) { summary.skipped++; continue; }

        const existing = this.getTrackById(rec.id) || (rec.fp ? byFp.get(rec.fp) : null) || null;

        /* Escribe el audio de la copia en el almacén con el id final.
         * Este es el paso que mantiene el enlace canción ↔ audio. */
        const writeAudio = async (targetId, targetHasAudio) => {
          if (!rec.audio) return false;
          // Si ya tenía audio, no se reescribe (una copia vieja no debe
          // pisar el archivo bueno que ya está guardado).
          if (targetHasAudio) return false;
          const from = payloadStart + rec.audio.offset;
          const to = from + rec.audio.length;
          let piece;
          try { piece = file.slice(from, to, rec.audio.type || 'audio/mpeg'); }
          catch (e) { return false; }
          try { await store.putBlob(targetId, piece); }
          catch (e) { throw e; }
          return true;
        };

        if (existing) {
          // Ya está: solo se rellenan huecos. Nunca se pisa lo del usuario.
          idMap.set(rec.id, existing.id);
          let touched = false;
          if (!existing.hasAudio && rec.audio) {
            if (await writeAudio(existing.id, false)) {
              existing.hasAudio = true;
              summary.audio++;
              touched = true;
            }
          }
          // Estrellas: si la copia las trae y aquí no hay ninguna.
          if (!this._ratingOf(existing) && this._ratingOf(rec)) {
            existing.rating = rec.rating;
            touched = true;
          }
          if (!existing.lrc && Array.isArray(rec.lrc) && rec.lrc.length) {
            existing.lrc = rec.lrc;
            touched = true;
          }
          if (!existing.coverIsImage && rec.coverIsImage && rec.cover) {
            existing.cover = rec.cover;
            existing.coverIsImage = true;
            existing.coverThumb = rec.coverThumb || existing.coverThumb;
            existing.coverThumbLg = rec.coverThumbLg || existing.coverThumbLg;
            touched = true;
          }
          if (!existing.fp && rec.fp) { existing.fp = rec.fp; touched = true; }
          if (touched) {
            if (typeof this.persistTrack === 'function') await this.persistTrack(existing);
            summary.linked++;
          } else {
            summary.skipped++;
          }
          continue;
        }

        // Pista nueva: entra con SU id, para que las listas de la copia
        // (y las referencias entre pistas) sigan valiendo tal cual.
        const track = {};
        for (const k of Object.keys(rec)) {
          if (this._BACKUP_SKIP_FIELDS.indexOf(k) >= 0) continue;
          track[k] = rec[k];
        }
        delete track.audio;
        track.id = rec.id;
        if (!track.addedAt) track.addedAt = Date.now();
        track.hasAudio = false;
        if (rec.audio) {
          track.hasAudio = await writeAudio(track.id, false);
          if (track.hasAudio) summary.audio++;
        } else {
          track.hasAudio = false;
        }
        this.tracks.push(track);
        idMap.set(rec.id, track.id);
        if (track.fp) byFp.set(track.fp, track);
        if (typeof this.persistTrack === 'function') await this.persistTrack(track);
        summary.tracks++;
      }
      this.invalidateTrackIndex();

      /* --- 2. Listas: por id o, si no, por nombre. Se completan. --- */
      const norm = (v) => String(v == null ? '' : v).trim().toLocaleLowerCase();
      const mapIds = (ids) => {
        const out = [];
        const seen = new Set();
        for (const id of Array.isArray(ids) ? ids : []) {
          const t = this.getTrackById(idMap.get(id) || id);
          if (!t) continue;
          if (seen.has(t.id)) continue;
          seen.add(t.id);
          out.push(t.id);
        }
        return out;
      };
      for (const bp of Array.isArray(manifest.playlists) ? manifest.playlists : []) {
        if (!bp || (!bp.id && !bp.name)) continue;
        const ids = mapIds(bp.trackIds);
        const found = this.playlists.find((p) => p && (p.id === bp.id || norm(p.name) === norm(bp.name)));
        if (found) {
          let touched = false;
          for (const id of ids) {
            if (!found.trackIds.includes(id)) { found.trackIds.push(id); touched = true; }
          }
          if (!found.coverArt && bp.coverArt) { found.coverArt = bp.coverArt; touched = true; }
          if (!found.description && bp.description) { found.description = bp.description; touched = true; }
          if (touched) {
            if (typeof this._invalidatePlaylistCover === 'function') this._invalidatePlaylistCover(found);
            if (typeof this.persistPlaylist === 'function') await this.persistPlaylist(found);
            summary.playlists++;
          }
        } else {
          const pl = {
            id: bp.id || ('pl-' + Date.now() + '-' + Math.floor(Math.random() * 1e6).toString(36)),
            // Sin nombre en la copia no se inventa nada traducido: se
            // deja un rótulo genérico que el usuario puede renombrar.
            name: String(bp.name || 'Playlist').slice(0, 120),
            description: bp.description || '',
            trackIds: ids,
            cover: bp.cover || null,
            sort: bp.sort || null,
            coverArt: bp.coverArt || null,
            coverArtHash: bp.coverArtHash || null
          };
          this.playlists.push(pl);
          if (typeof this.persistPlaylist === 'function') await this.persistPlaylist(pl);
          summary.playlists++;
        }
      }

      /* --- 3. Favoritos: unión con los ids reapuntados. --- */
      const favs = Array.isArray(manifest.favorites) ? manifest.favorites : [];
      let favsChanged = false;
      for (const id of favs) {
        const t = this.getTrackById(idMap.get(id) || id);
        if (!t) continue;
        if (!this.favorites.has(t.id)) {
          this.favorites.add(t.id);
          favsChanged = true;
          summary.favorites++;
        }
      }
      if (favsChanged && typeof this.saveFavorites === 'function') await this.saveFavorites();

      /* --- 4. Estadísticas: se fusionan sin inflar los contadores.
       *    Restaurar la misma copia dos veces no debe duplicar las
       *    reproducciones, así que se toma el máximo, no la suma. --- */
      const st = manifest.stats;
      if (st && typeof st === 'object') {
        if (!this.stats || typeof this.stats !== 'object') this.stats = { plays: {}, skips: {}, totalSeconds: 0 };
        this._normalizeStats();
        for (const key of ['plays', 'skips']) {
          const src = st[key];
          if (!src || typeof src !== 'object') continue;
          for (const id of Object.keys(src)) {
            const t = this.getTrackById(idMap.get(id) || id);
            if (!t) continue;
            const n = Number(src[id]) || 0;
            const cur = Number(this.stats[key][t.id]) || 0;
            if (n > cur) this.stats[key][t.id] = n;
          }
        }
        const secs = Number(st.totalSeconds) || 0;
        if (secs > (Number(this.stats.totalSeconds) || 0)) this.stats.totalSeconds = secs;
        if (typeof this.saveStats === 'function') await this.saveStats();
      }

      return summary;
    },

    /* ============================================================
     *  Importar (elegir archivo → confirmar → restaurar → refrescar)
     * ============================================================ */
    /* Selector de archivo: en Delta Chat, webxdc.importFiles (el
     * selector del propio cliente, para poder elegir la copia que
     * acabas de recibir en el chat sin salir de él). Devuelve
     * File | null; null = hay que usar el <input> del navegador. */
    async pickBackupFile() {
      const ext = this.BACKUP_EXT;
      const native = await this.pickFilesWebxdc({
        extensions: [ext],
        mimeTypes: [this.BACKUP_MIME, 'application/octet-stream'],
        multiple: false
      });
      if (native) return native[0] || null;   // [] = el usuario canceló
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = ext + ',' + this.BACKUP_MIME + ',application/octet-stream';
        input.style.display = 'none';
        document.body.appendChild(input);
        let settled = false;
        const finish = (file) => {
          if (settled) return;
          settled = true;
          try { input.remove(); } catch (e) {}
          resolve(file);
        };
        input.addEventListener('change', () => finish((input.files && input.files[0]) || null));
        input.addEventListener('cancel', () => finish(null));
        // Sin `change` (diálogo cancelado) el input se quedaría en el DOM:
        // se retira al recuperar el foco, igual que hace el selector de música.
        window.addEventListener('focus', () => {
          setTimeout(() => { if (!input.files || !input.files.length) finish(null); }, 400);
        }, { once: true });
        try {
          document.body.appendChild(input);
          input.click();
        } catch (e) { finish(null); }
      });
    },

    /* Elegir el archivo y restaurarlo (Ajustes → Importar). */
    async importBackup() {
      if (this._restoringBackup) return false;
      let file = null;
      try {
        file = await this.pickBackupFile();
      } catch (e) {
        file = null;
      }
      if (!file) return false;
      return this.restoreBackupFromFile(file);
    },

    /* Restaurar un archivo que ya se tiene en la mano (elegido en
     * Ajustes, soltado sobre la app o abierto con el «+»). Confirma
     * antes de tocar nada y valida el archivo primero: un archivo que
     * no es una copia se rechaza sin marear. */
    async restoreBackupFromFile(file) {
      if (this._restoringBackup) return false;
      if (!file) return false;

      let parsed = null;
      try {
        parsed = await this._parseBackup(file);
      } catch (e) {
        this.toast(this.t(e && e.message ? e.message : 'backup_error_not_backup'), 'danger');
        return false;
      }
      const m = parsed.manifest;
      const nTracks = m.tracks.length;
      if (!nTracks) {
        this.toast(this.t('backup_empty'));
        return false;
      }
      let when = '';
      try { when = new Date(m.createdAt || 0).toLocaleString(); } catch (e) {}
      const ok = await this.showConfirm({
        message: this.t('backup_confirm_restore')
          .replace('X', String(nTracks))
          .replace('Y', String((m.playlists || []).length))
          .replace('Z', when || '?'),
        okLabel: this.t('backup_restore_ok'),
        danger: false
      });
      if (!ok) return false;

      this._restoringBackup = true;
      this._importCancelled = false;
      this._showBackupProgress('backup_restoring', 0, nTracks);
      let summary = null;
      try {
        summary = await this.restoreBackup(file, {
          onProgress: (i, n, name) => this.updateImportOverlay(i, n, name),
          isCancelled: () => this._importCancelled
        });
      } catch (e) {
        console.warn('[Aurora] No se pudo restaurar la copia:', e);
        this._hideBackupProgress();
        this._restoringBackup = false;
        if (this._isQuotaError(e)) {
          this.toast(this.t('toast_storage_full'), 'danger');
          if (typeof this.offerFreeStorage === 'function') this.offerFreeStorage();
        } else {
          const key = (e && e.message && /^backup_error_/.test(e.message)) ? e.message : 'toast_backup_error';
          this.toast(this.t(key), 'danger');
        }
        return false;
      }
      this._hideBackupProgress();
      this._restoringBackup = false;

      this._afterRestore(summary);
      return true;
    },

    /* Deja la interfaz contando lo restaurado: pinta las listas y la
     * biblioteca, prepara la reproducción si no había nada y avisa. */
    _afterRestore(summary) {
      const added = summary ? summary.tracks : 0;
      const playlists = summary ? summary.playlists : 0;
      if (typeof this.invalidateTrackIndex === 'function') this.invalidateTrackIndex();
      if (typeof this.syncLibCountMarker === 'function') this.syncLibCountMarker();
      try {
        this.renderPlaylists();
        this.renderQueue();
        this.renderFavorites();
        if (typeof this.renderHome === 'function') this.renderHome();
        if (typeof this.updateChrome === 'function') this.updateChrome();
        if (this.currentTrack) this.renderCurrentTrack();
      } catch (e) {}
      // Sin pista actual (biblioteca recién restaurada): se deja lista
      // la primera para que el ▶ funcione al instante. Con contexto
      // «biblioteca», las nuevas se suman a la cola.
      if (!this.currentTrack && this.tracks.length) {
        this.currentTrack = this.tracks[0];
        this.currentTrackIdx = 0;
        this.queue = this.tracks.map((t) => t.id);
        this.queueIdx = 0;
        if (typeof this.loadTrackPaused === 'function') this.loadTrackPaused();
        if (typeof this.hideEmptyState === 'function') this.hideEmptyState();
      } else if ((!this.playContext || this.playContext.type === 'all') && this.queue) {
        const inQueue = new Set(this.queue);
        for (const t of this.tracks) if (!inQueue.has(t.id)) this.queue.push(t.id);
      }
      if (typeof this.updateStorageUsage === 'function') this.updateStorageUsage();
      if (this.stats && typeof this.renderStats === 'function') {
        const el = document.getElementById('statsContent');
        if (el && el.innerHTML) this.renderStats();
      }
      if (added || playlists) {
        this.toast(this.t('toast_backup_restored')
          .replace('X', String(added))
          .replace('Y', String(playlists)));
      } else {
        this.toast(this.t('toast_backup_restored_none'));
      }
    },

    /* ============================================================
     *  Barra de progreso (reutiliza la de importación)
     * ============================================================ */
    _showBackupProgress(titleKey, done, total) {
      const el = document.getElementById('importOverlay');
      if (!el) return;
      const title = document.getElementById('importTitle');
      if (title) title.textContent = this.t(titleKey);
      // Preparar la copia no se puede cancelar (solo se lee el almacén);
      // restaurar sí: lo restaurado se queda y repetir no duplica nada.
      const cancel = document.getElementById('btnCancelImport');
      if (cancel) cancel.hidden = titleKey !== 'backup_restoring';
      el.hidden = false;
      this.updateImportOverlay(done || 0, total || 0, '');
    },
    _hideBackupProgress() {
      const title = document.getElementById('importTitle');
      if (title) title.textContent = this.t('import_title');
      const cancel = document.getElementById('btnCancelImport');
      if (cancel) cancel.hidden = false;
      this.hideImportOverlay();
    }
});
