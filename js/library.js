/* =====================================================================
 *  js/library.js — Aurora Music Player
 *  Biblioteca: importar, borrar, estado vacío
 *
 *  Parte del refactor (C) de app.js: mismo código, módulos por funcionalidad.
 *  Este archivo se carga tras js/state.js y completa el objeto App con
 *  Object.assign (los scripts son clásicos por compatibilidad webxdc).
 * ===================================================================== */

'use strict';

Object.assign(App, {
    /* ============================================================
     *  Carga de archivos desde el almacenamiento local
     * ============================================================ */
    /* Procesa archivos de audio subidos.
     *   fileList       — FileList o array de File
     *   fromDirectory  — true si se cargó una carpeta entera
     *   targetPlaylistId — ID de playlist a la que añadir las nuevas pistas.
     *                     Si es null, se añaden a la playlist predefinida "Mi Música".
     */
    async handleFileInput(fileList, fromDirectory, targetPlaylistId) {
      if (!fileList || !fileList.length) return;
      if (!window.AuroraUploader || typeof window.AuroraUploader.processFiles !== 'function') {
        this.toast(this.t('toast_load_module_missing'));
        console.error('[Aurora] window.AuroraUploader no está cargado. Revisa que uploader.js se cargue correctamente.');
        return;
      }
      const count = fileList.length;
      this._importCancelled = false;
      this.showImportOverlay(0, count, '');
      try {
        const newTracks = await window.AuroraUploader.processFiles(fileList, {
          onProgress: (i, n, name) => this.updateImportOverlay(i, n, name),
          isCancelled: () => this._importCancelled
        });
        const cancelled = this._importCancelled;
        this.hideImportOverlay();
        if (!newTracks.length) {
          this.toast(cancelled ? this.t('toast_import_cancelled').replace('X', '0') : this.t('toast_load_failed'));
          return;
        }

        // #10 Detección de duplicados: comparar por fileName + fileSize
        let dupCount = 0;
        const uniqueTracks = [];
        const existingForPlaylist = [];
        for (const t of newTracks) {
          const existing = this.findDuplicateTrack(t.fileName, t.fileSize);
          if (existing) {
            dupCount++;
            if (t.src && t.src.startsWith('blob:')) URL.revokeObjectURL(t.src);
            // Si se sube a una lista, reutilizar la pista de la biblioteca
            // (p. ej. se quitó de la lista y se vuelve a añadir el mismo archivo).
            existingForPlaylist.push(existing);
          } else {
            uniqueTracks.push(t);
          }
        }
        const destIdEarly = targetPlaylistId || this.DEFAULT_PLAYLIST_ID;
        const destPlEarly = this.playlists.find(p => p.id === destIdEarly);
        let readded = 0;
        if (destPlEarly && existingForPlaylist.length) {
          existingForPlaylist.forEach(ex => {
            if (!destPlEarly.trackIds.includes(ex.id)) {
              destPlEarly.trackIds.push(ex.id);
              readded++;
            }
          });
          if (readded > 0) {
            if (typeof this._invalidatePlaylistCover === 'function') this._invalidatePlaylistCover(destPlEarly);
            this.persistPlaylist(destPlEarly);
          }
        }
        if (dupCount > 0 && readded === 0 && uniqueTracks.length === 0) {
          this.toast(dupCount + ' ' + this.t('toast_duplicate_found'));
        }
        if (uniqueTracks.length === 0) {
          if (readded > 0) {
            this.renderPlaylists();
            if (this._editingPlaylistId === destIdEarly) this.renderEditPlaylist();
            const destName = destPlEarly ? destPlEarly.name : this.t('my_music_playlist');
            this.toast(readded + ' ' + this.t('toast_added_to_playlist_plural') + ' ' + destName);
          }
          return;
        }
        const tracksToAdd = uniqueTracks;

        // Añadir todas las pistas a memoria primero (rápido)
        const now = Date.now();
        for (const t of tracksToAdd) {
          t.addedAt = t.addedAt || now;
          this.tracks.push(t);
        }

        // Guardar en IndexedDB en segundo plano para no bloquear la UI/reproducción
        this.persistTracksBatch(tracksToAdd).catch((e) => {
          console.warn('[Aurora] persistencia en segundo plano:', e);
        });

        // Determinar playlist destino (default = Mi Música)
        const destId = targetPlaylistId || this.DEFAULT_PLAYLIST_ID;
        const destPl = this.playlists.find(p => p.id === destId);
        if (destPl) {
          tracksToAdd.forEach(t => {
            if (!destPl.trackIds.includes(t.id)) destPl.trackIds.push(t.id);
          });
          if (typeof this._invalidatePlaylistCover === 'function') this._invalidatePlaylistCover(destPl);
          this.persistPlaylist(destPl);
        }

        // Si era el primer track, activarlo como pista actual y cargar el audio
        // (sin reproducir) para que al pulsar Play funcione inmediatamente.
        if (!this.currentTrack && this.tracks.length) {
          this.currentTrack = this.tracks[0];
          this.currentTrackIdx = 0;
          this.queue = this.tracks.map(t => t.id);
          this.queueIdx = 0;
          // Cargar el audio sin reproducir (loadTrackPaused setea audio.src)
          this.loadTrackPaused();
        } else if (!this.playContext || this.playContext.type === 'all') {
          // Solo añadir a la cola si NO hay un contexto de playlist/favoritos activo.
          tracksToAdd.forEach(t => {
            this.queue.push(t.id);
            if (this.shuffle && this._originalQueue) this._originalQueue.push(t.id);
          });
        }
        this.renderLibrary();
        this.renderPlaylists();
        this.renderQueue();
        this.renderFavorites();
        if (typeof this.renderHome === 'function') this.renderHome();
        if (typeof this.updateChrome === 'function') this.updateChrome();
        // Si estábamos editando la playlist destino, refrescar la vista
        if (this._editingPlaylistId === destId) this.renderEditPlaylist();
        this.hideEmptyState();
        const destName = destPl ? destPl.name : this.t('my_music_playlist');
        if (this._importCancelled) {
          this.toast(this.t('toast_import_cancelled').replace('X', String(tracksToAdd.length)));
        } else {
          this.toast(tracksToAdd.length + ' ' + this.t('toast_added_to_playlist_plural') + ' ' + destName + (fromDirectory ? ' (carpeta)' : ''));
        }
      } catch (e) {
        console.error('[Aurora] Error cargando archivos:', e);
        this._lastError = { msg: 'upload: ' + e.message, ts: Date.now() };
        this.toast(this.t('toast_load_error'));
      } finally {
        this.hideImportOverlay();
      }
    },

    showImportOverlay(done, total, name) {
      const el = document.getElementById('importOverlay');
      if (!el) return;
      el.hidden = false;
      this.updateImportOverlay(done, total, name);
      if (!this.tracks.length) this.showImportSkeleton();
    },
    updateImportOverlay(done, total, name) {
      const fill = document.getElementById('importBarFill');
      const count = document.getElementById('importCount');
      const file = document.getElementById('importFileName');
      const n = Math.max(1, total || 1);
      const pct = Math.max(0, Math.min(100, Math.round((done || 0) * 100 / n)));
      if (fill) fill.style.width = pct + '%';
      if (count) count.textContent = (done || 0) + ' / ' + (total || 0);
      if (file) file.textContent = name || '';
    },
    hideImportOverlay() {
      const el = document.getElementById('importOverlay');
      if (el) el.hidden = true;
      const fill = document.getElementById('importBarFill');
      if (fill) fill.style.width = '0%';
      this.hideImportSkeleton();
    },

    _skeletonRowHtml() {
      return '<li class="track-row is-skeleton" aria-hidden="true">' +
        '<div class="row-cover skel"></div>' +
        '<div class="row-text"><div class="skel skel-title"></div><div class="skel skel-sub"></div></div>' +
        '<div class="skel skel-dur"></div>' +
        '</li>';
    },
    showImportSkeleton() {
      if (this.tracks.length) return;
      const html = this._skeletonRowHtml() + this._skeletonRowHtml() + this._skeletonRowHtml();
      const ul = document.getElementById('libraryTracks');
      if (ul) {
        if (typeof this.unbindVirtualList === 'function') this.unbindVirtualList(ul);
        ul.innerHTML = html;
      }
      const home = document.getElementById('homeContent');
      const hv = document.getElementById('viewHome');
      if (home && hv && hv.classList.contains('is-empty')) {
        home.innerHTML = '<ul class="track-list import-skel" aria-hidden="true">' + html + '</ul>';
      }
    },
    hideImportSkeleton() {
      document.querySelectorAll('.track-row.is-skeleton').forEach(el => el.remove());
      const skelList = document.querySelector('.import-skel');
      if (skelList && !this.tracks.length && typeof this.renderHome === 'function') {
        this.renderHome();
      } else if (skelList) skelList.remove();
      if (!this.tracks.length) {
        const ul = document.getElementById('libraryTracks');
        if (ul && !ul.children.length && typeof this.renderLibrary === 'function') this.renderLibrary();
      }
    },

    findDuplicateTrack(fileName, fileSize) {
      return this.tracks.find(ex => ex.fileName === fileName && ex.fileSize === fileSize) || null;
    },

    /* #15 #16 Obtener objectURL con cache para reutilizar */
    getTrackUrl(track) {
      if (!track) return null;
      if (this._urlCache.has(track.id)) {
        return this._urlCache.get(track.id);
      }
      let url = track.src;
      if (!url && track._file) {
        url = URL.createObjectURL(track._file);
        track.src = url;
      } else if (!url && track.fileBlob) {
        url = URL.createObjectURL(track.fileBlob);
        track.src = url;
      }
      if (url) this._urlCache.set(track.id, url);
      return url;
    },

    /* Precarga la siguiente pista en un <audio> NO conectado al grafo EQ. */
    preloadNextTrack() {
      if (!this._gaplessEnabled && !(this.crossfadeEnabled && this.crossfadeDuration > 0)) return;
      let nextIdx = this.queueIdx + 1;
      if (nextIdx >= this.queue.length) {
        if (this.repeat === 'all' && this.queue.length) nextIdx = 0;
        else return;
      }
      if (nextIdx === this.queueIdx) return;
      const nextTrackId = this.queue[nextIdx];
      const nextTrack = this.tracks.find(t => t.id === nextTrackId);
      if (!nextTrack) return;
      const url = this.getTrackUrl(nextTrack);
      if (!url) return;
      if (!this._preloadAudio) {
        this._preloadAudio = new Audio();
        this._preloadAudio.preload = 'auto';
      }
      if (this._preloadAudio.src !== url) {
        this._preloadAudio.src = url;
        this._preloadAudio.load();
      }
    },

    /* Gapless con EQ: mismo <audio> conectado; swap de src ~80 ms antes de ended. */
    gaplessNext() {
      if (!this._gaplessEnabled) return false;
      if (this._sleepEndOfTrack || this._sleepFading) return false;
      if (this.crossfadeEnabled && this.crossfadeDuration > 0) return false;
      if (this.repeat === 'one') return false;
      const nextIdx = this._nextQueueIndex(true);
      if (nextIdx == null) return false;
      const nextTrackId = this.queue[nextIdx];
      const nextTrack = this.tracks.find(t => t.id === nextTrackId);
      if (!nextTrack) return false;
      const url = this.getTrackUrl(nextTrack);
      if (!url || !this.audio) return false;
      this._gaplessConsumed = true;
      this._ignoreEndedUntil = Date.now() + 500;
      this._gaplessArmed = false;
      this.currentTrack = nextTrack;
      this.currentTrackIdx = this.tracks.findIndex(t => t.id === nextTrackId);
      this.queueIdx = nextIdx;
      this.audio.src = url;
      try { this.audio.volume = this.volume; } catch (e) {}
      if (typeof this.restoreLyricsPrefs === 'function') this.restoreLyricsPrefs();
      if (this.playbackRate && this.playbackRate !== 1) {
        try { this.audio.playbackRate = this.playbackRate; } catch (e) {}
      }
      if (typeof this.setBuffering === 'function') this.setBuffering(this.audio.readyState < 3);
      const p = this.audio.play();
      if (p && p.catch) p.catch(() => {});
      this.isPlaying = true;
      this.addToHistory(nextTrack.id);
      this.renderCurrentTrack();
      this.renderLyrics();
      this.updateMediaSession();
      this.updatePlayUI();
      this.preloadNextTrack();
      this.applyNormalization(nextTrack);
      if (typeof this.updateChrome === 'function') this.updateChrome();
      return true;
    },

    /* #6 Normalización de volumen: calcular gain para una pista */
    async computeTrackGain(track) {
      if (!track || this._trackGainCache.has(track.id)) {
        return this._trackGainCache.get(track.id) || 1.0;
      }
      try {
        if (!this.audioCtx) this.initAudioGraph();
        if (!this.audioCtx) return 1.0;
        const file = track._file || track.fileBlob;
        if (!file) return 1.0;
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
        // Calcular RMS (root mean square) como medida de volumen
        const channelData = audioBuffer.getChannelData(0);
        let sum = 0;
        const step = Math.max(1, Math.floor(channelData.length / 100000)); // muestrear para velocidad
        let count = 0;
        for (let i = 0; i < channelData.length; i += step) {
          sum += channelData[i] * channelData[i];
          count++;
        }
        const rms = Math.sqrt(sum / count);
        // Solo subir pistas muy bajas. Nunca atenuar: el target 0.1
        // dejaba la música comercial a la mitad de volumen.
        const targetRms = 0.22;
        let gain = 1.0;
        if (rms > 0.001 && rms < targetRms) {
          gain = Math.min(1.8, targetRms / rms);
        }
        this._trackGainCache.set(track.id, gain);
        return gain;
      } catch (e) {
        return 1.0;
      }
    },

    /* #11 Añadir al historial de reproducción */
    addToHistory(trackId) {
      if (!trackId) return;
      // Quitar si ya existe (mover al final)
      const idx = this._playHistory.indexOf(trackId);
      if (idx >= 0) this._playHistory.splice(idx, 1);
      this._playHistory.push(trackId);
      // Limitar a 100
      if (this._playHistory.length > 100) {
        this._playHistory = this._playHistory.slice(-100);
      }
      // Persistir
      try { window.AuroraStorage.setSetting('history', this._playHistory); } catch (e) {}
    },

    /* #11 Cargar historial */
    async loadHistory() {
      try {
        const stored = await window.AuroraStorage.getSetting('history');
        if (stored && Array.isArray(stored)) {
          this._playHistory = stored;
        }
      } catch (e) {}
    },

    async loadSearchHistory() {
      try {
        const stored = await window.AuroraStorage.getSetting('searchHistory');
        this._searchHistory = Array.isArray(stored) ? stored.slice(0, 8) : [];
      } catch (e) { this._searchHistory = []; }
    },

    pushSearchHistory(q) {
      q = String(q || '').trim();
      if (q.length < 2) return;
      const prev = Array.isArray(this._searchHistory) ? this._searchHistory : [];
      this._searchHistory = [q, ...prev.filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
      try { window.AuroraStorage.setSetting('searchHistory', this._searchHistory); } catch (e) {}
    },

    clearSearchHistory() {
      this._searchHistory = [];
      try { window.AuroraStorage.setSetting('searchHistory', []); } catch (e) {}
    },

    /* #11 Render historial */
    renderHistory() {
      const cont = document.getElementById('historyContent');
      if (!cont) return;
      const history = this._playHistory.slice().reverse(); // más reciente primero
      if (history.length === 0) {
        cont.innerHTML = '<p class="stats-empty">' + this.t('history_empty') + '</p>';
        return;
      }
      let html = '<ul class="track-list">';
      history.forEach(id => {
        const t = this.tracks.find(x => x.id === id);
        if (!t) return;
        html += `<li class="track-row" data-track="${t.id}">
          <div class="row-cover"><canvas width="44" height="44"></canvas></div>
          <div class="row-text">
            <div class="row-title">${this.esc(t.title)}</div>
            <div class="row-sub">${this.esc(t.artist)}</div>
          </div>
          <div class="row-duration">${this.fmtTime(t.duration)}</div>
          <button class="row-action track-menu-btn" type="button" aria-label="${this.esc(this.t('more_options'))}"><svg class="ico" aria-hidden="true"><use href="#i-ellipsis-vertical"></use></svg></button>
        </li>`;
      });
      html += '</ul>';
      html += '<div class="history-reset-wrap"><button class="primary-btn compact ghost danger" id="btnResetHistory"><svg class="ico" aria-hidden="true"><use href="#i-trash-can"></use></svg> ' + this.esc(this.t('history_reset_btn')) + '</button></div>';
      cont.innerHTML = html;
      const btnRH = document.getElementById('btnResetHistory');
      if (btnRH) btnRH.addEventListener('click', async () => {
        if (await this.showConfirm({ message: this.t('history_reset_confirm'), danger: false })) this.resetHistory();
      });
      cont.querySelectorAll('.track-row[data-track]').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('.track-menu-btn')) return;
          this.playTrack(row.dataset.track, { type: 'all' });
        });
        if (typeof this.wireTrackLongPress === 'function') this.wireTrackLongPress(row, row.dataset.track);
        const cv = row.querySelector('canvas');
        const t = this.tracks.find(x => x.id === row.dataset.track);
        if (cv && t) this.drawRowCover(cv, t);
      });
    },

    isPlaceholderAlbum(album) {
      if (!album) return true;
      const a = String(album).trim().toLowerCase();
      const set = new Set(['sin álbum', 'sin album', 'no album', 'unknown album', 'unknown']);
      const dict = window.I18N && window.I18N.no_album;
      if (dict) Object.keys(dict).forEach(k => { if (dict[k]) set.add(String(dict[k]).toLowerCase()); });
      return set.has(a);
    },

    isPlaceholderArtist(artist) {
      if (!artist) return true;
      const a = String(artist).trim().toLowerCase();
      const set = new Set(['artista desconocido', 'unknown artist']);
      const dict = window.I18N && window.I18N.unknown_artist;
      if (dict) Object.keys(dict).forEach(k => { if (dict[k]) set.add(String(dict[k]).toLowerCase()); });
      return set.has(a);
    },

    /* Relee tags de pistas ya guardadas (portada, artista, letras). */
    async retagExistingTracks(opts) {
      const silent = !!(opts && opts.silent);
      const U = window.AuroraUploader;
      if (!U || typeof U.processOne !== 'function') return 0;
      let updated = 0;
      for (const t of this.tracks) {
        const file = t._file || t.fileBlob;
        if (!file) continue;
        try {
          const fresh = await U.processOne(file, null);
          let changed = false;
          if (fresh.title && fresh.title !== t.title) { t.title = fresh.title; changed = true; }
          if (fresh.artist && !this.isPlaceholderArtist(fresh.artist)) {
            if (t.artist !== fresh.artist) { t.artist = fresh.artist; changed = true; }
          }
          if (fresh.album && !this.isPlaceholderAlbum(fresh.album)) {
            if (t.album !== fresh.album) { t.album = fresh.album; changed = true; }
          }
          if (fresh.coverIsImage && fresh.cover) {
            t.cover = fresh.cover;
            t.coverIsImage = true;
            changed = true;
          }
          if (fresh.lrc && (!t.lrc || (Array.isArray(t.lrc) && !t.lrc.length))) {
            t.lrc = fresh.lrc;
            t._lrcCache = null;
            changed = true;
          }
          if (fresh.src && fresh.src.startsWith('blob:')) {
            try { URL.revokeObjectURL(fresh.src); } catch (e) {}
          }
          if (changed) {
            updated++;
            await this.persistTrack(t);
          }
        } catch (e) {}
      }
      if (updated) {
        this.renderLibrary();
        this.renderPlaylists();
        this.renderQueue();
        this.renderFavorites();
        if (typeof this.renderHome === 'function') this.renderHome();
        if (this.currentTrack) this.renderCurrentTrack();
      }
      if (!silent) {
        this.toast(updated
          ? this.t('toast_retag_done').replace('X', String(updated))
          : this.t('toast_retag_none'));
      }
      return updated;
    },

    /* #17 Exportar biblioteca a JSON (sin blobs) */
    async exportLibrary() {
      try {
        const data = {
          version: 1,
          kind: 'aurora-metadata',
          tracks: this.tracks.map(t => ({
            id: t.id, title: t.title, artist: t.artist, album: t.album,
            duration: t.duration, fileSize: t.fileSize, fileName: t.fileName,
            coverThumb: t.coverThumb || null,
            coverIsImage: !!t.coverIsImage, lrc: t.lrc, addedAt: t.addedAt || 0
          })),
          playlists: this.playlists.map(p => ({
            id: p.id, name: p.name, description: p.description,
            trackIds: p.trackIds, isDefault: p.isDefault
          })),
          favorites: [...this.favorites],
          stats: this.stats,
          history: this._playHistory
        };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'aurora-backup.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.toast(this.t('toast_exported'));
      } catch (e) {
        this.toast(this.t('toast_load_error'));
      }
    },

    /* #17 Importar biblioteca desde JSON */
    async importLibrary() {
      let input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (data.playlists) {
            this.playlists = data.playlists;
            this.playlists.forEach(p => this.persistPlaylist(p));
          }
          if (data.favorites) {
            this.favorites = new Set(data.favorites);
            this.saveFavorites();
          }
          if (data.stats) {
            this.stats = data.stats;
            this.saveStats();
          }
          if (data.history) {
            this._playHistory = data.history;
            try { window.AuroraStorage.setSetting('history', this._playHistory); } catch (e) {}
          }
          this.renderLibrary();
          this.renderPlaylists();
          this.renderFavorites();
          this.toast(this.t('toast_imported_meta'));
        } catch (e) {
          this.toast(this.t('toast_load_error'));
        }
        input.remove();
      });
      input.click();
    },

    /* Persiste múltiples pistas en una sola transacción de IndexedDB.
     * Mucho más rápido que llamar persistTrack() N veces secuencialmente. */
    async persistTracksBatch(tracks) {
      try {
        await window.AuroraStorage.open();
        const db = window.AuroraStorage.db;
        if (!db) {
          // Fallback: persistir una por una
          for (const t of tracks) await this.persistTrack(t);
          return;
        }
        const tx = db.transaction('tracks', 'readwrite');
        const store = tx.objectStore('tracks');
        const promises = [];
        for (const track of tracks) {
          const toSave = Object.assign({}, track);
          if (track._file) {
            toSave.fileBlob = track._file;
            delete toSave._file;
          }
          promises.push(new Promise((resolve, reject) => {
            const req = store.put(toSave);
            req.onsuccess = resolve;
            req.onerror = () => reject(req.error);
          }));
        }
        await Promise.all(promises);
        // Esperar a que la transacción se complete
        await new Promise((resolve, reject) => {
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      } catch (e) {
        console.warn('[Aurora] persistTracksBatch falló, intentando uno por uno:', e);
        if (this._isQuotaError(e)) {
          this.toast(this.t('toast_storage_full'));
          this.offerFreeStorage();
          return;
        }
        for (const t of tracks) await this.persistTrack(t);
      }
    },

    async deleteTrack(trackId, opts) {
      opts = opts || {};
      const idx = this.tracks.findIndex(t => t.id === trackId);
      if (idx < 0) return;
      const wasCurrent = this.currentTrack && this.currentTrack.id === trackId;
      // Liberar objectURL (la del track y la que pueda haber en la cache #15)
      const t = this.tracks[idx];
      const cachedUrl = this._urlCache.get(trackId);
      if (cachedUrl) {
        try { URL.revokeObjectURL(cachedUrl); } catch (e) {}
        this._urlCache.delete(trackId);
      }
      if (t.src && t.src.startsWith('blob:') && t.src !== cachedUrl) {
        URL.revokeObjectURL(t.src);
      }
      // Limpiar también la cache de ganancia normalizada (#6)
      this._trackGainCache.delete(trackId);
      this.tracks.splice(idx, 1);
      // Quitar de la cola
      const qIdx = this.queue.indexOf(trackId);
      if (qIdx >= 0) {
        this.queue.splice(qIdx, 1);
        if (qIdx < this.queueIdx) this.queueIdx--;
        else if (qIdx === this.queueIdx) this.queueIdx = Math.min(this.queueIdx, this.queue.length - 1);
      }
      if (typeof this._removeFromOriginalQueue === 'function') this._removeFromOriginalQueue(trackId);
      // Quitar de playlists
      this.playlists.forEach(pl => {
        const i = pl.trackIds.indexOf(trackId);
        if (i >= 0) {
          pl.trackIds.splice(i, 1);
          if (typeof this._invalidatePlaylistCover === 'function') this._invalidatePlaylistCover(pl);
        }
        this.persistPlaylist(pl);
      });
      // Quitar de favoritos
      this.favorites.delete(trackId);
      this.saveFavorites();
      // Eliminar de IndexedDB
      await this.deleteTrackFromStorage(trackId);

      if (wasCurrent) {
        // Detener la reproducción de la pista eliminada
        this.stopPlayback();
        // Saltar a siguiente/anterior en modo pausa, o quedar vacío
        this.skipToNextOrPrevPaused();
      }
      this.renderLibrary();
      this.renderPlaylists();
      this.renderQueue();
      this.renderFavorites();
      if (typeof this.renderHome === 'function') this.renderHome();
      if (typeof this.updateChrome === 'function') this.updateChrome();
      this.toast(this.t('toast_track_deleted'), 'danger');
    },

    /* ============================================================
     *  Borrar TODAS las pistas de la biblioteca
     * ============================================================ */
    async deleteAllTracks() {
      if (this.tracks.length === 0) {
        this.toast(this.t('no_tracks_loaded'));
        return;
      }
      const okAll = await this.showConfirm({
        message: this.t('delete_all_confirm'),
        okLabel: this.t('confirm_delete')
      });
      if (!okAll) return;

      // 1. Detener reproducción si la hay
      if (this.isPlaying) this.stopPlayback();

      // 2. Liberar todas las objectURLs de la memoria
      for (const t of this.tracks) {
        if (t.src && t.src.startsWith('blob:')) {
          try { URL.revokeObjectURL(t.src); } catch (e) {}
        }
      }
      // ...incluidas las que estén en la cache #15 y la de ganancias #6
      for (const url of this._urlCache.values()) {
        try { URL.revokeObjectURL(url); } catch (e) {}
      }
      this._urlCache.clear();
      this._trackGainCache.clear();

      // 3. Vaciar estado en memoria
      this.tracks = [];
      this.queue = [];
      this.queueIdx = 0;
      this._originalQueue = null;
      this.currentTrackIdx = 0;
      this.currentTrack = null;
      this.favorites = new Set();
      this.saveFavorites();

      // 4. Quitar trackIds de todas las playlists (sin borrar las listas)
      this.playlists.forEach(pl => {
        pl.trackIds = [];
        if (typeof this._invalidatePlaylistCover === 'function') this._invalidatePlaylistCover(pl);
        this.persistPlaylist(pl);
      });

      // 5. Limpiar audio
      try {
        if (this.audio) {
          this.audio.pause();
          this.audio.removeAttribute('src');
          try { this.audio.load(); } catch (e) {}
        }
      } catch (e) {}

      // 6. Vaciar IndexedDB (tracks)
      try {
        if (window.AuroraStorage && typeof window.AuroraStorage.clearTracks === 'function') {
          await window.AuroraStorage.clearTracks();
        }
      } catch (e) {
        console.warn('[Aurora] No se pudo vaciar IndexedDB:', e);
      }

      // 7. Reset de sesión guardada
      try {
        if (window.AuroraStorage) await window.AuroraStorage.setSetting('session', null);
      } catch (e) {}

      // 8. Re-renderizar todo y mostrar estado vacío
      this.showEmptyState();
      this.renderCurrentTrack();
      this.renderLibrary();
      this.renderPlaylists();
      this.renderQueue();
      this.renderFavorites();
      if (typeof this.renderHome === 'function') this.renderHome();
      if (typeof this.goNav === 'function') this.goNav('home');
      else if (typeof this.updateChrome === 'function') this.updateChrome();
      this.toast(this.t('toast_all_deleted'), 'danger');
    },

    /* ============================================================
     *  Estado vacío
     * ============================================================ */
    showEmptyState() {
      const v = document.getElementById('viewPlayer');
      if (!v) return;
      let empty = document.getElementById('emptyState');
      if (!empty) {
        empty = document.createElement('div');
        empty.id = 'emptyState';
        empty.className = 'empty-state';
        v.appendChild(empty);
        // Botón creado una sola vez; su listener también
        const btn = document.createElement('button');
        btn.className = 'primary-btn empty-cta';
        btn.id = 'btnEmptyLoad';
        btn.innerHTML = '<svg class="ico" style="margin-right:8px" aria-hidden="true"><use href="#i-cloud-arrow-up"></use></svg><span></span>';
        btn.addEventListener('click', () => this.openFilePicker());
        empty.appendChild(btn);
      }
      // Re-pintar contenido traducido cada vez
      empty.innerHTML = `
        <div class="empty-icon">
          <svg class="ico" aria-hidden="true"><use href="#i-music"></use></svg>
        </div>
        <h2>${this.t('empty_library_title')}</h2>
        <p>${this.t('empty_library_hint')}</p>
        <button class="primary-btn empty-cta" id="btnEmptyLoad">
          <svg class="ico" style="margin-right:8px" aria-hidden="true"><use href="#i-cloud-arrow-up"></use></svg>
          <span>${this.t('load_music')}</span>
        </button>
        <p class="empty-hint">${this.t('empty_format_hint')}</p>
      `;
      document.getElementById('btnEmptyLoad').addEventListener('click', () => this.openFilePicker());
      empty.style.display = 'flex';
      // Ocultar secciones habituales
      ['.cover-section','.visualizer','.track-info','.progress-section','.np-volume','.controls-main','.controls-secondary']
        .forEach(sel => { const e = v.querySelector(sel); if (e) e.style.display = 'none'; });
    },

    hideEmptyState() {
      const empty = document.getElementById('emptyState');
      if (empty) empty.style.display = 'none';
      const v = document.getElementById('viewPlayer');
      if (v) {
        ['.cover-section','.visualizer','.track-info','.progress-section','.controls-main','.controls-secondary']
          .forEach(sel => { const e = v.querySelector(sel); if (e) e.style.display = ''; });
      }
    },
});
