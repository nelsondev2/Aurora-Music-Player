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
     *                     Si es null, las pistas van SOLO a la biblioteca
     *                     (ya no existe ninguna lista predefinida).
     */
    async handleFileInput(fileList, fromDirectory, targetPlaylistId) {
      if (!fileList || !fileList.length) return;
      if (!window.AuroraUploader || typeof window.AuroraUploader.processFiles !== 'function') {
        this.toast(this.t('toast_load_module_missing'));
        console.error('[Aurora] window.AuroraUploader no está cargado. Revisa que uploader.js se cargue correctamente.');
        return;
      }
      // Dos importaciones simultáneas (arrastrar + selector, o doble toque)
      // mutaban `tracks` a la vez y duplicaban pistas. Una sola a la vez.
      if (this._importing) {
        this.toast(this.t('toast_processing_files'));
        return;
      }
      this._importing = true;
      // Los .m3u/.m3u8 no son audio: se convierten en listas (contra las
      // pistas ya presentes) y no pasan por el importador de pistas. Así,
      // «Cargar música» también sirve para traer listas de fuera.
      const allFiles = Array.from(fileList);
      const m3uFiles = allFiles.filter(f => /\.m3u8?$/i.test(f.name || ''));
      const mediaFiles = allFiles.filter(f => !/\.m3u8?$/i.test(f.name || ''));
      for (const m3uFile of m3uFiles) {
        await this.importM3UFile(m3uFile);
      }
      if (!mediaFiles.length) {
        this._importing = false;
        return;
      }
      const count = mediaFiles.length;
      this._importCancelled = false;
      this.showImportOverlay(0, count, '');
      try {
        const newTracks = await window.AuroraUploader.processFiles(mediaFiles, {
          onProgress: (i, n, name) => this.updateImportOverlay(i, n, name),
          isCancelled: () => this._importCancelled
        });
        const cancelled = this._importCancelled;
        this.hideImportOverlay();
        if (!newTracks.length) {
          this.toast(cancelled ? this.t('toast_import_cancelled').replace('X', '0') : this.t('toast_load_failed'));
          return;
        }

        // #10 Detección de duplicados: comparar por fileName + fileSize.
        // Índice O(1) por clave para que importar 500 archivos no sea O(n²).
        let dupCount = 0;
        let relinked = 0;
        const uniqueTracks = [];
        const existingForPlaylist = [];
        const byKey = new Map();
        for (const ex of this.tracks) byKey.set(this._dupKey(ex.fileName, ex.fileSize), ex);
        for (const t of newTracks) {
          const existing = byKey.get(this._dupKey(t.fileName, t.fileSize)) || null;
          if (existing) {
            dupCount++;
            if (existing._needsRelink && (t._file || t.src)) {
              // Curar pista restaurada de un backup: el backup aportó los
              // metadatos (quizá editados) y el archivo aporta el audio.
              if (t._file) existing._file = t._file;
              if (t.src) {
                if (existing.src && existing.src.startsWith('blob:') && existing.src !== t.src) {
                  try { URL.revokeObjectURL(existing.src); } catch (e) {}
                }
                existing.src = t.src;
                t.src = null; // reutilizada: no revocar abajo
              }
              if (!existing.duration && t.duration) existing.duration = t.duration;
              if (!existing.coverThumb && t.coverThumb) {
                existing.coverThumb = t.coverThumb;
                existing.coverIsImage = t.coverIsImage;
              }
              delete existing._needsRelink;
              this._urlCache.delete(existing.id);
              if (existing.src) this._urlCache.set(existing.id, existing.src);
              this.persistTrack(existing);
              relinked++;
            } else if (t.src && t.src.startsWith('blob:')) {
              URL.revokeObjectURL(t.src);
            }
            // Si se sube a una lista, reutilizar la pista de la biblioteca
            // (p. ej. se quitó de la lista y se vuelve a añadir el mismo archivo).
            existingForPlaylist.push(existing);
          } else {
            uniqueTracks.push(t);
            byKey.set(this._dupKey(t.fileName, t.fileSize), t);
          }
        }
        // Solo se añaden a una lista cuando la importación se lanza desde la
        // pantalla de esa lista. Las subidas normales (+ / Ajustes / menú)
        // van únicamente a la biblioteca: «Mi Música» desapareció.
        const destPlEarly = targetPlaylistId
          ? this.playlists.find(p => p.id === targetPlaylistId)
          : null;
        const destIdEarly = destPlEarly ? destPlEarly.id : null;
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
        if (relinked > 0 && readded === 0 && uniqueTracks.length === 0) {
          this.toast(this.t('relink_done').replace('X', String(relinked)));
        } else if (dupCount > 0 && readded === 0 && uniqueTracks.length === 0) {
          this.toast(dupCount + ' ' + this.t('toast_duplicate_found'));
        }
        if (uniqueTracks.length === 0) {
          if (readded > 0) {
            this.renderPlaylists();
            if (this._editingPlaylistId === destIdEarly) this.renderEditPlaylist();
            let msg = readded + ' ' + this.t('toast_added_to_playlist_plural') + ' ' + destPlEarly.name;
            if (relinked > 0) msg += ' · ' + this.t('relink_done').replace('X', String(relinked));
            this.toast(msg);
          }
          if (typeof this.updateRelinkUI === 'function') this.updateRelinkUI();
          if (relinked > 0) {
            this.renderLibrary();
            if (typeof this.renderHome === 'function') this.renderHome();
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
        this.invalidateTrackIndex();

        // Guardar en IndexedDB en segundo plano para no bloquear la UI/reproducción
        this.persistTracksBatch(tracksToAdd).catch((e) => {
          console.warn('[Aurora] persistencia en segundo plano:', e);
        });

        // Lista destino opcional (solo si se importa desde una lista).
        const destPl = targetPlaylistId
          ? this.playlists.find(p => p.id === targetPlaylistId)
          : null;
        const destId = destPl ? destPl.id : null;
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
        if (typeof this.updateRelinkUI === 'function') this.updateRelinkUI();
        const relinkSuffix = relinked > 0 ? ' · ' + this.t('relink_done').replace('X', String(relinked)) : '';
        const folderSuffix = fromDirectory ? ' ' + this.t('folder_tag') : '';
        if (this._importCancelled) {
          this.toast(this.t('toast_import_cancelled').replace('X', String(tracksToAdd.length)) + relinkSuffix);
        } else {
          const destMsg = destPl
            ? this.t('toast_added_to_playlist_plural') + ' ' + destPl.name
            : this.t('toast_added_to_library');
          this.toast(tracksToAdd.length + ' ' + destMsg + folderSuffix + relinkSuffix);
        }
        // También al importar parcialmente (cancelado): el marcador debe
        // reflejar lo que realmente quedó guardado.
        this.syncLibCountMarker();
      } catch (e) {
        console.error('[Aurora] Error cargando archivos:', e);
        this._lastError = { msg: 'upload: ' + e.message, ts: Date.now() };
        this.toast(this.t('toast_load_error'));
      } finally {
        this._importing = false;
        this.hideImportOverlay();
      }
    },

    /* Libera todos los objectURL de audio (al cerrar la pestaña). */
    releaseAllUrls() {
      try {
        if (this._urlCache) {
          for (const url of this._urlCache.values()) {
            try { URL.revokeObjectURL(url); } catch (e) {}
          }
          this._urlCache.clear();
        }
        for (const t of (this.tracks || [])) {
          if (t && typeof t.src === 'string' && t.src.startsWith('blob:')) {
            try { URL.revokeObjectURL(t.src); } catch (e) {}
            t.src = null; // se reconstruye desde _file/fileBlob si vuelve
          }
        }
      } catch (e) {}
    },

    /* Clave de duplicado tolerante a mayúsculas/espacios del nombre. */
    _dupKey(fileName, fileSize) {
      return String(fileName || '').trim().toLowerCase() + '|' + (Number(fileSize) || 0);
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
        // No decodificar archivos grandes: decodeAudioData reserva del orden
        // de 10x el tamaño en RAM y puede tumbar el WebView en móviles modestos.
        if (file.size && file.size > 15 * 1024 * 1024) return 1.0;
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
          <div class="row-duration">${this.fmtRowDuration(t)}</div>
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
      if (updated > 0 && typeof this._invalidateArtwork === 'function') this._invalidateArtwork();
      return updated;
    },

    /* Utilidad para exportar archivos: usa webxdc.sendToChat en Delta Chat o descarga directa en navegador */
    async exportFile({ name, content, mimeType = 'application/json', caption = '' }) {
      if (window.webxdc && typeof window.webxdc.sendToChat === 'function') {
        // mimeType permite que el stub webxdc descargue el archivo con el
        // tipo correcto (antes todo salía como text/plain).
        const filePayload = { name, mimeType };
        if (typeof content === 'string') {
          filePayload.plainText = content;
        } else if (content instanceof Blob) {
          filePayload.blob = content;
        }
        try {
          await window.webxdc.sendToChat({
            file: filePayload,
            text: caption || name
          });
          return true;
        } catch (err) {
          console.warn('[WebXDC] sendToChat no completado:', err);
          if (!window.webxdc._isStub) {
            // En Delta Chat nativo, el diálogo de compartir se gestionó o canceló
            return false;
          }
        }
      }
      // Fallback para navegador web estándar
      const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    },

    /* Compartir pista (audio o metadatos) en Delta Chat o descargar en navegador */
    async shareTrack(trackId) {
      const id = trackId || (this.currentTrack && this.currentTrack.id);
      if (!id) return;
      const t = this.tracks.find(x => x.id === id) || (this.currentTrack && this.currentTrack.id === id ? this.currentTrack : null);
      if (!t) return;
      this.closeSheet('sheetTrackMenu');
      this.closeSheet('sheetMore');
      this.toast(this.t('toast_preparing_share'));

      try {
        let blob = null;
        if (t._file instanceof Blob) {
          blob = t._file;
        } else if (t.fileBlob instanceof Blob) {
          blob = t.fileBlob;
        } else if (window.AuroraStorage) {
          try {
            const stored = await window.AuroraStorage.getTrack(t.id);
            if (stored && stored.fileBlob instanceof Blob) {
              blob = stored.fileBlob;
            }
          } catch (e) {}
        }

        if (!blob && t.src && t.src.startsWith('blob:')) {
          try {
            const res = await fetch(t.src);
            blob = await res.blob();
          } catch (e) {}
        }

        const safeTitle = (t.title || 'cancion').replace(/[\\/:*?"<>|]/g, '_');
        const safeArtist = (t.artist || '').replace(/[\\/:*?"<>|]/g, '_');
        let ext = 'mp3';
        if (t.fileName && t.fileName.includes('.')) {
          ext = t.fileName.split('.').pop().toLowerCase();
        }
        const fileName = safeArtist ? `${safeArtist} - ${safeTitle}.${ext}` : `${safeTitle}.${ext}`;
        const caption = `🎵 ${t.title || this.t('unknown_track')} · ${t.artist || this.t('unknown_artist')}`;

        if (blob) {
          await this.exportFile({
            name: fileName,
            content: blob,
            mimeType: blob.type || 'audio/mpeg',
            caption
          });
          this.toast(this.t('toast_shared_chat'));
        } else {
          // Si no hay archivo de audio accesible, enviar metadatos y letra
          const txt = `${caption}\n` +
            (t.album ? `Álbum: ${t.album}\n` : '') +
            (t.duration ? `Duración: ${this.fmtTime(t.duration)}\n` : '') +
            (t.lrc && t.lrc.length ? `\n--- Letra ---\n${t.lrc.join('\n')}` : '');
          await this.exportFile({
            name: `${safeTitle}.txt`,
            content: txt,
            mimeType: 'text/plain;charset=utf-8',
            caption
          });
          this.toast(this.t('toast_shared_chat'));
        }
      } catch (err) {
        console.error('[Aurora] error shareTrack:', err);
        this.toast(this.t('toast_share_error'));
      }
    },

    /* Foto de los ajustes del usuario para la copia de seguridad.
     * Solo valores planos y validables: al importar se pasa todo por
     * listas blancas (ver _applyBackupSettings), así un backup
     * manipulado no puede colar temas, idiomas o modos inexistentes. */
    _backupSettings() {
      let eqGains = null;
      let eqPreset = null;
      try {
        const raw = localStorage.getItem('aurora_eq');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) eqGains = parsed.map(v => Number(v));
        }
        eqPreset = localStorage.getItem('aurora_eq_preset') || null;
      } catch (e) {}
      return {
        theme: this.theme,
        accent: this.accent,
        lang: this.lang,
        volume: this.volume,
        gapless: !!this._gaplessEnabled,
        normalize: !!this._normalizeVolume,
        crossfade: this.crossfadeDuration || 0,
        marquee: this._marqueeEnabled !== false,
        vinyl: !!this._vinylEnabled,
        preservesPitch: this.preservesPitch !== false,
        playbackRate: this.playbackRate || 1,
        lrcFontSize: this.lrcFontSize || 19,
        visualizerMode: this.visualizerMode || 'bars',
        eq: { preset: eqPreset, gains: eqGains },
        librarySort: this._librarySort || 'title'
      };
    },

    /* Foto portable de la sesión: la pista actual y la cola se
     * identifican por nombre+tamaño de archivo (los id internos no
     * significan nada en otro dispositivo) y al importar se traducen
     * a los id locales. La posición viaja en segundos. */
    _backupSession() {
      const t = this.currentTrack;
      if (!t || !t.fileName) return null;
      const ident = (track) => track && track.fileName
        ? { f: String(track.fileName), s: Number(track.fileSize) || 0 }
        : null;
      const byId = this.trackMap();
      const queue = (Array.isArray(this.queue) ? this.queue : [])
        .slice(0, 1000)
        .map(id => ident(byId.get(id)))
        .filter(Boolean);
      return {
        track: ident(t),
        queue,
        currentTime: Math.max(0, Math.floor((this.audio && this.audio.currentTime) || 0)),
        shuffle: !!this.shuffle,
        repeat: this.repeat || 'off'
      };
    },

    /* Aplica los ajustes de un backup SIN toasts (los setters con
     * aviso, como setVisualizerMode o setLang, llenarían la pantalla
     * de mensajes): se asigna el estado, se persiste con las mismas
     * claves que usa la app y se repinta lo imprescindible. Todo valor
     * pasa por su lista blanca; lo desconocido se ignora. */
    _applyBackupSettings(s) {
      if (!s || typeof s !== 'object' || Array.isArray(s)) return;
      try {
        if (typeof s.theme === 'string' && this.THEMES && this.THEMES[s.theme]) {
          this.theme = s.theme;
          try { localStorage.setItem('aurora_theme', this.theme); } catch (e) {}
        }
        if (typeof s.accent === 'string' && this.ACCENTS) {
          const acc = this._migrateAccent(s.accent);
          if (this.ACCENTS[acc]) {
            this.accent = acc;
            try { localStorage.setItem('aurora_accent', acc); } catch (e) {}
          }
        }
        if (typeof this.applyTheme === 'function') this.applyTheme();

        if (typeof s.lang === 'string' && typeof this._isValidLang === 'function' && this._isValidLang(s.lang)) {
          this.lang = s.lang;
          try { localStorage.setItem('aurora_lang', s.lang); } catch (e) {}
          this.applyLang();
          if (typeof this.buildLangList === 'function') this.buildLangList();
        }

        if (isFinite(Number(s.volume))) this.setVolume(Number(s.volume));

        let playbackTouched = false;
        if (typeof s.gapless === 'boolean') { this._gaplessEnabled = s.gapless; playbackTouched = true; }
        if (typeof s.normalize === 'boolean') { this._normalizeVolume = s.normalize; playbackTouched = true; }
        if (typeof s.marquee === 'boolean') { this._marqueeEnabled = s.marquee; playbackTouched = true; }
        if (typeof s.vinyl === 'boolean') { this._vinylEnabled = s.vinyl; playbackTouched = true; }
        if ([0, 3, 6, 12].includes(Number(s.crossfade))) {
          this.crossfadeDuration = Number(s.crossfade);
          this.crossfadeEnabled = this.crossfadeDuration > 0;
          playbackTouched = true;
        }
        if (playbackTouched) {
          this.savePlaybackSettings();
          if (typeof this.syncPlaybackSettingsUI === 'function') this.syncPlaybackSettingsUI();
        }

        if (typeof s.preservesPitch === 'boolean') this.setPreservesPitch(s.preservesPitch);
        if (isFinite(Number(s.playbackRate))) this.setPlaybackRate(Number(s.playbackRate));
        if (isFinite(Number(s.lrcFontSize))) this.setLrcFontSize(Number(s.lrcFontSize));

        if (['bars', 'wave', 'off'].includes(s.visualizerMode)) {
          this.visualizerMode = s.visualizerMode;
          try { localStorage.setItem('aurora_visualizer_mode', s.visualizerMode); } catch (e) {}
          if (typeof this.updateVisualizerUI === 'function') this.updateVisualizerUI();
        }

        if (s.eq && typeof s.eq === 'object') {
          const gains = Array.isArray(s.eq.gains) ? s.eq.gains.map(v => Number(v)) : null;
          const gainsOk = gains && gains.length === 5 && gains.every(v => isFinite(v));
          if (gainsOk) {
            const clamped = gains.map(v => Math.max(-12, Math.min(12, v)));
            const inputs = document.querySelectorAll('#eqBands input[type="range"]');
            inputs.forEach((inp, i) => {
              inp.value = clamped[i];
              if (this.eqFilters[i]) this.eqFilters[i].gain.value = clamped[i];
              const val = inp.parentElement && inp.parentElement.querySelector('.eq-band-val');
              if (val) val.textContent = (clamped[i] > 0 ? '+' : '') + clamped[i] + ' dB';
            });
            try {
              localStorage.setItem('aurora_eq', JSON.stringify(clamped));
              localStorage.setItem('aurora_eq_preset', 'custom');
            } catch (e) {}
            document.querySelectorAll('.eq-preset').forEach(b => b.classList.remove('active'));
          } else if (typeof s.eq.preset === 'string' &&
            ['normal', 'bass', 'vocal', 'treble', 'live'].includes(s.eq.preset)) {
            this.applyEqPreset(s.eq.preset);
          }
        }

        if (['title', 'artist', 'recent', 'duration'].includes(s.librarySort)) {
          this._librarySort = s.librarySort;
        }
      } catch (e) {
        console.warn('[Aurora] Ajustes del backup no aplicables:', e && e.message);
      }
    },

    /* #17 Exportar biblioteca a JSON (sin blobs).
     * v2: además de metadatos, listas, favoritos, estadísticas e
     * historial, incluye los AJUSTES (tema, idioma, reproducción,
     * ecualizador…) y la SESIÓN (qué sonaba, la cola y en qué segundo
     * iba), para poder pasar de un dispositivo a otro con un solo
     * archivo enviado por el propio chat, sin sincronización alguna.
     * El audio nunca viaja: en el destino las pistas se reenlazan por
     * nombre de archivo (ver _importLibraryData). */
    async exportLibrary() {
      try {
        const data = {
          version: 2,
          kind: 'aurora-metadata',
          appVersion: this.VERSION,
          exportedAt: new Date().toISOString(),
          settings: this._backupSettings(),
          session: this._backupSession(),
          tracks: this.tracks.map(t => ({
            id: t.id, title: t.title, artist: t.artist, album: t.album,
            duration: t.duration, fileSize: t.fileSize, fileName: t.fileName,
            coverThumb: t.coverThumb || null,
            customCover: t.customCover || null,
            coverIsImage: !!t.coverIsImage, lrc: t.lrc, addedAt: t.addedAt || 0
          })),
          playlists: this.playlists.map(p => ({
            id: p.id, name: p.name, description: p.description,
            trackIds: p.trackIds
          })),
          favorites: [...this.favorites],
          stats: this.stats,
          history: this._playHistory
        };
        const json = JSON.stringify(data, null, 2);
        const stamp = new Date().toISOString().slice(0, 10);
        await this.exportFile({
          name: `aurora-backup-${stamp}.json`,
          content: json,
          mimeType: 'application/json',
          caption: 'Copia de seguridad de Aurora Music Player'
        });
        this.toast(this.t('toast_exported'));
      } catch (e) {
        this.toast(this.t('toast_load_error'));
      }
    },

    /* #17 Importar biblioteca desde JSON.
     * Restaura listas, favoritos, stats, historial y los metadatos de las
     * pistas. Como el JSON no incluye audio, las pistas restauradas quedan
     * marcadas con _needsRelink y se curan al reimportar los mismos
     * archivos (ver handleFileInput) o desde Ajustes → Vincular audio. */
    async importLibrary() {
      // La copia de seguridad es un JSON pequeño (sin audio), pero un archivo
      // manipulado podría tener millones de entradas: se limita el tamaño y
      // se valida cada campo antes de tocar el estado.
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';
      document.body.appendChild(input);
      const cleanup = () => { try { input.remove(); } catch (e) {} };
      let settled = false;
      input.addEventListener('change', async (e) => {
        settled = true;
        const file = e.target.files && e.target.files[0];
        cleanup();
        if (!file) return;
        if (file.size > 25 * 1024 * 1024) {
          this.toast(this.t('toast_file_too_large'));
          return;
        }
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('formato');
          if (data.kind && data.kind !== 'aurora-metadata') throw new Error('kind');
          const result = this._importLibraryData(data);
          this.renderLibrary();
          this.renderPlaylists();
          this.renderQueue();
          this.renderFavorites();
          if (typeof this.renderHome === 'function') this.renderHome();
          if (typeof this.updateRelinkUI === 'function') this.updateRelinkUI();
          if (typeof this.updateStorageUsage === 'function') this.updateStorageUsage();
          // Sesión de otro dispositivo: queda guardada como la sesión a
          // restaurar en el próximo arranque; si ahora no suena nada,
          // se aplica al momento (misma pista, misma cola, mismo segundo).
          if (result.session) {
            try { await window.AuroraStorage.setSetting('session', result.session); } catch (e) {}
            if (!this.isPlaying && typeof this.restoreSession === 'function') {
              await this.restoreSession();
              if (typeof this.updatePlayUI === 'function') this.updatePlayUI();
              if (typeof this.updateChrome === 'function') this.updateChrome();
              if (this.currentTrack) this.renderCurrentTrack();
              if (typeof this.renderHome === 'function') this.renderHome();
            }
          }
          const pending = this.pendingRelinkCount();
          if (result.restoredTracks > 0 && pending > 0) {
            this.toast(this.t('relink_pending').replace('X', String(pending)));
          } else {
            this.toast(this.t('toast_imported_meta'));
          }
          this.syncLibCountMarker();
        } catch (err) {
          console.warn('[Aurora] Importación inválida:', err && err.message);
          this.toast(this.t('toast_load_error'));
        }
      });
      // Si el usuario cancela, algunos navegadores no disparan `change`:
      // al recuperar el foco se retira el input (evita nodos huérfanos).
      window.addEventListener('focus', () => {
        setTimeout(() => { if (!settled) cleanup(); }, 300);
      }, { once: true });
      input.click();
    },

    /* Valida y aplica una copia de seguridad ya parseada.
     * Política de fusión (documentada): la importación es ADITIVA.
     * - Pistas: se añaden las que no existan (por id o por nombre+tamaño).
     * - Listas: se actualizan las del mismo id y se añaden las nuevas; las
     *   listas actuales que no vienen en el backup NO se borran.
     * - Favoritos: unión. Estadísticas: máximo por pista (evita duplicar
     *   reproducciones al reimportar el mismo backup). Historial: unión.
     * Así una copia antigua nunca destruye datos más recientes. */
    _importLibraryData(data) {
      const MAX_TRACKS = 5000;
      const MAX_PLAYLISTS = 500;
      const MAX_TEXT = 500;
      const safeText = (v, max) => {
        if (v == null) return '';
        return String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max || MAX_TEXT);
      };
      const safeNum = (v, max) => {
        const n = Number(v);
        return isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
      };
      const safeId = (v) => {
        const id = safeText(v, 64);
        return /^[A-Za-z0-9._-]{1,64}$/.test(id) ? id : null;
      };
      const newId = () => 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      const idMap = new Map(); // Map, no objeto: un id "__proto__" no contamina
      const knownKeys = new Map();
      for (const ex of this.tracks) knownKeys.set(this._dupKey(ex.fileName, ex.fileSize), ex);
      /* Respaldo por nombre de archivo: en otro dispositivo la misma
       * canción puede pesar distinto (otro ripeo) y el par nombre+tamaño
       * no coincidiría; si el nombre es único en la biblioteca, basta
       * para reenlazarla en vez de crear una pista fantasma sin audio. */
      const normName = (v) => String(v == null ? '' : v).trim().toLowerCase();
      const nameCounts = new Map();
      const nameMap = new Map();
      for (const ex of this.tracks) {
        const n = normName(ex.fileName);
        if (!n) continue;
        nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
        if (!nameMap.has(n)) nameMap.set(n, ex);
      }
      const byNameUnique = (fileName) => {
        const n = normName(fileName);
        return n && nameCounts.get(n) === 1 ? nameMap.get(n) : null;
      };
      const knownIds = new Set(this.tracks.map(t => t.id));
      let restoredTracks = 0;

      const rawTracks = Array.isArray(data.tracks) ? data.tracks.slice(0, MAX_TRACKS) : [];
      for (const mt of rawTracks) {
        if (!mt || typeof mt !== 'object') continue;
        const fileName = safeText(mt.fileName, 255);
        const fileSize = safeNum(mt.fileSize, 1e12);
        const dup = knownKeys.get(this._dupKey(fileName, fileSize)) || byNameUnique(fileName);
        if (dup) {
          const oldId = safeId(mt.id);
          if (oldId) idMap.set(oldId, dup.id);
          // La pista ya existe aquí: si el backup trae una portada
          // personalizada y aquí no hay ninguna, se adopta (no pisa
          // una personalizada local, que podría ser más reciente).
          if (!dup.customCover && mt.customCover && typeof mt.customCover === 'object') {
            const lgOk = this._safeImageDataUrl(mt.customCover.lg) ? mt.customCover.lg : null;
            const thOk = this._safeImageDataUrl(mt.customCover.thumb) ? mt.customCover.thumb : null;
            if (lgOk || thOk) {
              dup.customCover = { thumb: thOk || lgOk, lg: lgOk || thOk };
              this.persistTrack(dup);
              if (typeof this._invalidateArtwork === 'function') this._invalidateArtwork(dup.id);
            }
          }
          continue;
        }
        const oldId = safeId(mt.id);
        let id = oldId && !knownIds.has(oldId) ? oldId : newId();
        while (knownIds.has(id)) id = newId();
        if (oldId) idMap.set(oldId, id);
        knownIds.add(id);
        const coverThumb = this._safeImageDataUrl(mt.coverThumb) ? mt.coverThumb : null;
        // Portada personalizada del backup: se validan ambas miniaturas
        // como cualquier imagen externa (data:image raster acotada).
        let customCover = null;
        if (mt.customCover && typeof mt.customCover === 'object') {
          const lgOk = this._safeImageDataUrl(mt.customCover.lg) ? mt.customCover.lg : null;
          const thOk = this._safeImageDataUrl(mt.customCover.thumb) ? mt.customCover.thumb : null;
          if (lgOk || thOk) customCover = { thumb: thOk || lgOk, lg: lgOk || thOk };
        }
        const t = {
          id,
          title: safeText(mt.title, MAX_TEXT) || fileName || '—',
          artist: safeText(mt.artist, MAX_TEXT),
          album: safeText(mt.album, MAX_TEXT),
          duration: safeNum(mt.duration, 86400),
          fileSize,
          fileName,
          coverThumb,
          customCover,
          coverIsImage: !!coverThumb,
          lrc: Array.isArray(mt.lrc)
            ? mt.lrc.slice(0, 5000).map(l => safeText(l, 2000))
            : null,
          addedAt: safeNum(mt.addedAt, 1e15) || Date.now(),
          _needsRelink: true
        };
        this.tracks.push(t);
        knownKeys.set(this._dupKey(fileName, fileSize), t);
        const nn = normName(fileName);
        if (nn) {
          nameCounts.set(nn, (nameCounts.get(nn) || 0) + 1);
          if (!nameMap.has(nn)) nameMap.set(nn, t);
        }
        this.persistTrack(t);
        restoredTracks++;
      }
      if (restoredTracks > 0) this.invalidateTrackIndex();

      // --- Listas: fusión por id ---
      // Los backups antiguos pueden traer la lista predefinida «Mi Música»;
      // se ignora (sus pistas ya vienen en data.tracks y siguen en la
      // biblioteca). Tampoco se marca ninguna lista como isDefault.
      const LEGACY_DEFAULT_ID = 'mi-musica';
      const rawPls = Array.isArray(data.playlists) ? data.playlists.slice(0, MAX_PLAYLISTS) : [];
      const byId = new Map(this.playlists.map(p => [p.id, p]));
      for (const rp of rawPls) {
        if (!rp || typeof rp !== 'object') continue;
        let pid = safeId(rp.id);
        if (pid === LEGACY_DEFAULT_ID) continue;
        if (!pid) pid = 'pl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        const tids = (Array.isArray(rp.trackIds) ? rp.trackIds : [])
          .map(tid => idMap.get(safeId(tid)) || safeId(tid))
          .filter(tid => tid && this.tracks.some(t => t.id === tid));
        const uniqueTids = [...new Set(tids)];
        const existing = byId.get(pid);
        if (existing) {
          existing.name = safeText(rp.name, 200) || existing.name;
          existing.description = safeText(rp.description, 500) || existing.description || '';
          if (uniqueTids.length || (Array.isArray(rp.trackIds) && rp.trackIds.length === 0)) {
            existing.trackIds = uniqueTids;
          } else {
            existing.trackIds = [...new Set([...(existing.trackIds || []), ...uniqueTids])];
          }
          if (this._safeImageDataUrl(rp.coverArt)) {
            existing._coverCache = rp.coverArt;
            existing._coverCacheHash = null;
          }
        } else {
          const pl = {
            id: pid,
            name: safeText(rp.name, 200) || this.t('playlist_title'),
            description: safeText(rp.description, 500),
            trackIds: uniqueTids,
            _coverCache: this._safeImageDataUrl(rp.coverArt) ? rp.coverArt : null
          };
          this.playlists.push(pl);
          byId.set(pid, pl);
        }
        if (typeof this._invalidatePlaylistCover === 'function') {
          this._invalidatePlaylistCover(byId.get(pid));
        }
      }
      this.playlists.forEach(pl => this.persistPlaylist(pl));

      // --- Favoritos: unión ---
      if (Array.isArray(data.favorites)) {
        const favs = data.favorites
          .slice(0, MAX_TRACKS * 2)
          .map(fid => idMap.get(safeId(fid)) || safeId(fid))
          .filter(fid => fid && this.tracks.some(t => t.id === fid));
        this.favorites = new Set([...this.favorites, ...favs]);
        this.saveFavorites();
      }

      // --- Estadísticas: máximo por pista ---
      if (data.stats && typeof data.stats === 'object' && !Array.isArray(data.stats)) {
        const incomingPlays = (data.stats.plays && typeof data.stats.plays === 'object') ? data.stats.plays : {};
        const plays = Object.assign({}, this.stats.plays);
        for (const [rawId, count] of Object.entries(incomingPlays)) {
          const id = idMap.get(safeId(rawId)) || safeId(rawId);
          if (!id) continue;
          const n = safeNum(count, 1e9);
          plays[id] = Math.max(Number(plays[id]) || 0, n);
        }
        this.stats = {
          plays,
          totalSeconds: Math.max(Number(this.stats.totalSeconds) || 0, safeNum(data.stats.totalSeconds, 1e12)),
          lastPlayed: this.stats.lastPlayed || null,
          sessionStart: this.stats.sessionStart || Date.now()
        };
        this.saveStats();
      }

      // --- Historial: unión sin duplicados, conservando el más reciente ---
      if (Array.isArray(data.history)) {
        const incoming = data.history
          .slice(0, 500)
          .map(hid => idMap.get(safeId(hid)) || safeId(hid))
          .filter(hid => hid && this.tracks.some(t => t.id === hid));
        this._playHistory = [...new Set([...incoming, ...this._playHistory])].slice(-100);
        try { window.AuroraStorage.setSetting('history', this._playHistory); } catch (e) {}
      }

      // --- Ajustes (v2): se aplican con listas blancas, sin toasts ---
      if (data.settings) this._applyBackupSettings(data.settings);

      // --- Sesión (v2): traducir identidades de archivo a id locales ---
      // Se devuelve aparte porque guardarla en IndexedDB y restaurarla
      // es asíncrono y eso lo hace importLibrary().
      let restoredSession = null;
      if (data.session && typeof data.session === 'object' && data.session.track) {
        const findByIdent = (ident) => {
          if (!ident || typeof ident !== 'object') return null;
          const f = safeText(ident.f, 255);
          const snum = safeNum(ident.s, 1e12);
          if (!f) return null;
          return knownKeys.get(this._dupKey(f, snum)) || byNameUnique(f);
        };
        const cur = findByIdent(data.session.track);
        if (cur) {
          const q = (Array.isArray(data.session.queue) ? data.session.queue.slice(0, 1000) : [])
            .map(findByIdent)
            .filter(Boolean)
            .map(t => t.id);
          restoredSession = {
            currentTrackId: cur.id,
            queue: q.length ? [...new Set(q)] : this.tracks.map(t => t.id),
            queueIdx: 0,
            currentTime: safeNum(data.session.currentTime, 86400),
            shuffle: !!data.session.shuffle,
            repeat: ['off', 'all', 'one'].includes(data.session.repeat) ? data.session.repeat : 'off',
            playContext: null,
            ts: Date.now()
          };
        }
      }

      if (!this.currentTrack && this.tracks.length) {
        this.currentTrack = this.tracks[0];
        this.currentTrackIdx = 0;
        this.queue = this.tracks.map(t => t.id);
        this.queueIdx = 0;
      }
      return { restoredTracks, session: restoredSession };
    },

    /* Solo acepta data:image raster en base64; bloquea svg (puede ejecutar
     * scripts si se usa como CSS), comillas y tamaños absurdos. */
    _safeImageDataUrl(v) {
      if (typeof v !== 'string' || v.length > 2 * 1024 * 1024) return false;
      return /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v);
    },

    /* Nº de pistas restauradas de un backup que aún no tienen audio. */
    pendingRelinkCount() {
      return this.tracks.filter(t => t && t._needsRelink).length;
    },

    /* Muestra/oculta la fila «Vincular audio» de Ajustes según haya
     * pistas pendientes de re-vincular. */
    updateRelinkUI() {
      const n = this.pendingRelinkCount();
      const btn = document.getElementById('menuRelinkAudio');
      const label = document.getElementById('relinkAudioLabel');
      if (btn) btn.hidden = n === 0;
      if (label) label.textContent = this.t('relink_pending').replace('X', String(n));
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

    /* Guarda en localStorage cuántas pistas tiene la biblioteca.
     * Sirve para detectar pérdida de datos: si al arrancar hay 0 pistas
     * pero el marcador dice N > 0, el almacenamiento se borró fuera de
     * la app (o se abrió otra copia) y se avisa en vez de callar. */
    syncLibCountMarker() {
      try {
        if (this.tracks.length > 0) {
          localStorage.setItem('aurora_lib_count', String(this.tracks.length));
        } else {
          localStorage.removeItem('aurora_lib_count');
        }
      } catch (e) {}
    },

    async deleteTrack(trackId, opts) {
      opts = opts || {};
      const idx = this.tracks.findIndex(t => t.id === trackId);
      if (idx < 0) return;
      const wasCurrent = this.currentTrack && this.currentTrack.id === trackId;
      const t = this.tracks[idx];
      const cachedUrl = this._urlCache.get(trackId) || null;
      // El borrado de una pista se puede deshacer durante 8 s: mientras
      // tanto NO se revoca el objectURL ni se toca IndexedDB. Así el audio
      // sigue disponible si el usuario pulsa «Deshacer». Al vencer el
      // plazo (o al borrar otra pista) se confirma el borrado real.
      const canUndo = opts.undo !== false;
      if (canUndo) {
        // Si había otro borrado pendiente, confirmarlo antes de abrir uno
        // nuevo: solo se puede deshacer el último.
        if (typeof this._commitPendingTrackDelete === 'function') this._commitPendingTrackDelete();
        this._pendingTrackDelete = {
          track: t,
          idx,
          wasCurrent,
          cachedUrl,
          favorite: this.favorites.has(trackId),
          playlistIds: this.playlists.filter(pl => pl.trackIds.indexOf(trackId) >= 0).map(pl => pl.id),
          timer: null
        };
      } else {
        // Borrado definitivo (lote, «borrar todo»): liberar ya.
        if (cachedUrl) {
          try { URL.revokeObjectURL(cachedUrl); } catch (e) {}
          this._urlCache.delete(trackId);
        }
        if (t.src && t.src.startsWith('blob:') && t.src !== cachedUrl) {
          try { URL.revokeObjectURL(t.src); } catch (e) {}
        }
        this.deleteTrackFromStorage(trackId);
      }
      // Limpiar también la cache de ganancia normalizada (#6)
      this._trackGainCache.delete(trackId);
      if (typeof this._invalidateArtwork === 'function') this._invalidateArtwork(trackId);
      this.tracks.splice(idx, 1);
      this.invalidateTrackIndex();
      this.syncLibCountMarker();
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
      if (typeof this.updateRelinkUI === 'function') this.updateRelinkUI();

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
      if (canUndo) {
        const pending = this._pendingTrackDelete;
        pending.timer = setTimeout(() => this._commitPendingTrackDelete(pending), 8000);
        this.toast(this.t('toast_track_deleted'), {
          danger: true,
          ms: 8000,
          action: { label: this.t('undo'), onClick: () => this._undoDeleteTrack(pending) }
        });
      } else {
        this.toast(this.t('toast_track_deleted'), 'danger');
      }
    },

    /* Confirma (irreversible) el borrado pendiente de una pista. */
    _commitPendingTrackDelete(pending) {
      const p = pending || this._pendingTrackDelete;
      if (!p || p.committed) return;
      // Marca definitiva: si el usuario pulsa «Deshacer» después de que
      // venza el plazo, no se resucita una pista ya borrada de IndexedDB.
      p.committed = true;
      clearTimeout(p.timer);
      if (this._pendingTrackDelete === p) this._pendingTrackDelete = null;
      try { if (p.cachedUrl) URL.revokeObjectURL(p.cachedUrl); } catch (e) {}
      try {
        if (p.track && p.track.src && p.track.src.startsWith('blob:') && p.track.src !== p.cachedUrl) {
          URL.revokeObjectURL(p.track.src);
        }
      } catch (e) {}
      this._urlCache.delete(p.track.id);
      this.deleteTrackFromStorage(p.track.id);
    },

    /* Deshace el borrado: devuelve la pista a la biblioteca, a sus listas
     * y a favoritos, en la misma posición que ocupaba. */
    _undoDeleteTrack(pending) {
      const p = pending || this._pendingTrackDelete;
      if (!p || !p.track || p.committed) return;
      // Si hay otro borrado pendiente distinto, este ya se confirmó.
      if (this._pendingTrackDelete && this._pendingTrackDelete !== p) return;
      clearTimeout(p.timer);
      if (this._pendingTrackDelete === p) this._pendingTrackDelete = null;
      const t = p.track;
      const at = Math.max(0, Math.min(p.idx, this.tracks.length));
      this.tracks.splice(at, 0, t);
      this.invalidateTrackIndex();
      this.syncLibCountMarker();
      p.playlistIds.forEach(plId => {
        const pl = this.playlists.find(x => x.id === plId);
        if (pl && pl.trackIds.indexOf(t.id) < 0) {
          pl.trackIds.push(t.id);
          if (typeof this._invalidatePlaylistCover === 'function') this._invalidatePlaylistCover(pl);
          this.persistPlaylist(pl);
        }
      });
      if (p.favorite) {
        this.favorites.add(t.id);
        this.saveFavorites();
      }
      if (this.currentTrack && this.currentTrack.id === t.id) this.updateFavoriteUI();
      this.renderLibrary();
      this.renderPlaylists();
      this.renderQueue();
      this.renderFavorites();
      if (typeof this.renderHome === 'function') this.renderHome();
      if (typeof this.updateChrome === 'function') this.updateChrome();
      this.toast(this.t('toast_restored'));
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
      // Un borrado individual pendiente de deshacer quedaría vivo después
      // de vaciar la biblioteca: confirmarlo antes de borrar todo.
      if (typeof this._commitPendingTrackDelete === 'function') this._commitPendingTrackDelete();

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
      this.invalidateTrackIndex();
      this.syncLibCountMarker();
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
      }
      // Construcción con DOM + textContent: los textos traducidos nunca se
      // interpretan como HTML (una traducción no debe poder inyectar nodos).
      empty.textContent = '';
      const icon = document.createElement('div');
      icon.className = 'empty-icon';
      icon.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-music"></use></svg>';
      const h2 = document.createElement('h2');
      h2.textContent = this.t('empty_library_title');
      const p = document.createElement('p');
      p.textContent = this.t('empty_library_hint');
      const btn = document.createElement('button');
      btn.className = 'primary-btn empty-cta';
      btn.id = 'btnEmptyLoad';
      btn.type = 'button';
      btn.innerHTML = '<svg class="ico" style="margin-right:8px" aria-hidden="true"><use href="#i-cloud-arrow-up"></use></svg><span></span>';
      btn.querySelector('span').textContent = this.t('load_music');
      btn.addEventListener('click', () => this.openFilePicker());
      const hint = document.createElement('p');
      hint.className = 'empty-hint';
      hint.textContent = this.t('empty_format_hint');
      empty.append(icon, h2, p, btn, hint);
      empty.style.display = 'flex';
      // Ocultar secciones habituales (esta lista debe coincidir con la de
      // hideEmptyState; antes .np-volume quedaba oculto para siempre).
      ['.cover-section','.visualizer','.track-info','.progress-section','.np-volume','.controls-main','.controls-secondary']
        .forEach(sel => { const e = v.querySelector(sel); if (e) e.style.display = 'none'; });
    },

    hideEmptyState() {
      const empty = document.getElementById('emptyState');
      if (empty) empty.style.display = 'none';
      const v = document.getElementById('viewPlayer');
      if (v) {
        ['.cover-section','.visualizer','.track-info','.progress-section','.np-volume','.controls-main','.controls-secondary']
          .forEach(sel => { const e = v.querySelector(sel); if (e) e.style.display = ''; });
      }
    },
});
