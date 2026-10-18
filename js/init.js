/* =====================================================================
 *  js/init.js — Aurora Music Player
 *  Inicialización · carga desde IndexedDB
 *
 *  Parte del refactor (C) de app.js: mismo código, módulos por funcionalidad.
 *  Este archivo se carga tras js/state.js y completa el objeto App con
 *  Object.assign (los scripts son clásicos por compatibilidad webxdc).
 * ===================================================================== */

'use strict';

Object.assign(App, {
    /* ============================================================
     *  Inicialización
     * ============================================================ */
    async init() {
      this.tracks = [];
      this.audio = document.getElementById('audioEl');
      this.audio.volume = this.volume;

      this.buildEqualizer();
      this.renderPickTracks();

      // Cargar tema guardado antes que nada
      this.loadTheme();

      // Cargar idioma guardado
      this.loadLang();

      // Cargar datos persistentes (IndexedDB + localStorage)
      await this.loadAllFromStorage();
      this.loadFavorites();
      this.loadStats();

      // Restaurar sesión (cola, pista actual, posición, shuffle, repeat)
      const restored = await this.restoreSession();

      if (!restored) {
        this.queue = this.tracks.map(t => t.id);
        this.queueIdx = 0;
        this.currentTrackIdx = 0;
        this.currentTrack = this.tracks[0] || null;
      }

      this.wireEvents();
      this.wireGestures();
      this.renderLibrary();
      this.renderPlaylists();
      if (typeof this.updateRelinkUI === 'function') this.updateRelinkUI();
      if (typeof this.renderHome === 'function') this.renderHome();
      this.showView('home');
      this.setNavActive('home');

      if (this.currentTrack) {
        if (typeof this.restoreLyricsPrefs === 'function') this.restoreLyricsPrefs();
        this.renderCurrentTrack();
        this.renderLyrics();
        this.updateMediaSession();
        this.hideEmptyState();
      }
      this.setShuffleUI();
      this.setRepeatUI();
      if (typeof this.updateLrcOffsetUI === 'function') this.updateLrcOffsetUI();
      if (typeof this.updateChrome === 'function') this.updateChrome();

      // Guardar sesión cada 5 s. saveSession() deduplica: no escribe si
      // nada cambió y está en pausa. Se guarda el id para poder limpiarlo.
      if (this._sessionTimer) clearInterval(this._sessionTimer);
      this._sessionTimer = setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        this.saveSession();
      }, 5000);
      // Persistir una última vez al ocultar/cerrar y liberar objectURLs.
      this._onPageHide = (e) => {
        // En bfcache (pagehide persisted=true) NO revocar: al volver atrás
        // los objectURL deben seguir vivos.
        if (e && e.type === 'pagehide' && e.persisted) return;
        try { this.saveSession(); } catch (err) {}
        try { this.releaseAllUrls(); } catch (err) {}
      };
      window.addEventListener('pagehide', this._onPageHide);
      window.addEventListener('beforeunload', this._onPageHide);

      // Aplicar idioma a todos los textos estáticos del DOM
      this.applyLang();
      this.buildLangList();

      // Sincronizar visibilidad de acciones contextuales del menú "Más"
      // según haya o no pista cargada (estado vacío inicial).
      this.updatePlayUI();

      this.loadPlaybackSettings();
      this.syncPlaybackSettingsUI();
      // Versión siempre desde App.VERSION (evita el 1.1.1 hardcodeado en HTML)
      const aboutVer = document.getElementById('aboutVersion');
      if (aboutVer) aboutVer.textContent = this.VERSION;
      if (typeof this.syncDesktopLayout === 'function') this.syncDesktopLayout();
      // Cargar preferencias de visualizador y preservación de tono
      try {
        const savedPitch = localStorage.getItem('aurora_preserves_pitch');
        this.preservesPitch = savedPitch !== 'false';
      } catch (e) {
        this.preservesPitch = true;
      }
      this.setPreservesPitch(this.preservesPitch);
      if (typeof this.initVisualizer === 'function') this.initVisualizer();
      if (typeof this.updateABRepeatUI === 'function') this.updateABRepeatUI();
      // #11 Cargar historial
      this.loadHistory();
      this.loadSearchHistory();

      document.querySelectorAll('.sheet').forEach(s => s.setAttribute('aria-hidden', 'true'));

      // Releer tags de pistas antiguas (sin portada / artista / letras)
      const needsRetag = this.tracks.some(t =>
        (t._file || t.fileBlob) &&
        (!t.coverIsImage || this.isPlaceholderArtist(t.artist) || !t.lrc)
      );
      if (needsRetag) {
        this.retagExistingTracks({ silent: true }).catch(() => {});
      }

      if (typeof this.maybeShowBackgroundNotice === 'function') this.maybeShowBackgroundNotice();
      if (typeof this.maybeShowLibraryMissingNotice === 'function') this.maybeShowLibraryMissingNotice();

      this._initialized = true;
      document.dispatchEvent(new CustomEvent('aurora:ready', { detail: { tracks: this.tracks.length } }));
      console.log('[Aurora] App inicializada ·', this.tracks.length, 'pistas', restored ? '· sesión restaurada' : '');
    },

    /* Consejo de primer arranque en Delta Chat nativo: el webxdc vive en
     * su propia actividad y sigue sonando al pulsar inicio, pero el botón
     * atrás la destruye y detiene la música. Una sola vez y sin tapar
     * otros avisos (reintenta si hay un sheet abierto). */
    maybeShowBackgroundNotice() {
      try {
        const native = !!(window.webxdc && !window.webxdc._isStub);
        if (!native) return;
        if (localStorage.getItem('aurora_bg_notice') === '1') return;
        const attempt = (left) => {
          if (document.querySelector('.sheet.open')) {
            if (left > 0) setTimeout(() => attempt(left - 1), 1000);
            return;
          }
          try { localStorage.setItem('aurora_bg_notice', '1'); } catch (e) {}
          this.showConfirm({
            message: this.t('bg_notice_text'),
            okLabel: this.t('bg_notice_ok'),
            danger: false,
            hideCancel: true
          }).catch(() => {});
        };
        setTimeout(() => attempt(8), 700);
      } catch (e) {}
    },

    /* Si la biblioteca está vacía pero el marcador dice que había música,
     * el almacenamiento se perdió fuera de la app (limpieza del sistema,
     * cuota, u otra copia del .xdc): avisar y ofrecer importar un backup
     * en vez de mostrar un estado vacío silencioso. */
    maybeShowLibraryMissingNotice() {
      try {
        if (this.tracks.length > 0) return;
        let expected = 0;
        try { expected = parseInt(localStorage.getItem('aurora_lib_count') || '0', 10) || 0; } catch (e) {}
        if (expected <= 0) return;
        const attempt = (left) => {
          if (document.querySelector('.sheet.open')) {
            if (left > 0) setTimeout(() => attempt(left - 1), 1000);
            return;
          }
          this.showConfirm({
            message: this.t('library_missing_text'),
            okLabel: this.t('settings_import'),
            cancelLabel: this.t('cancel'),
            danger: false
          }).then((ok) => {
            if (ok && typeof this.importLibrary === 'function') this.importLibrary();
          }).catch(() => {});
        };
        setTimeout(() => attempt(8), 1400);
      } catch (e) {}
    },

    /* ============================================================
     *  Carga desde IndexedDB + localStorage
     * ============================================================ */
    async loadAllFromStorage() {
      // Pedir almacenamiento persistente: evita que el sistema borre la
      // biblioteca solo por falta de espacio (orígenes «best-effort»).
      try {
        if (navigator.storage && typeof navigator.storage.persist === 'function') {
          navigator.storage.persist().then((g) => { this._storagePersisted = !!g; }).catch(() => {});
        }
      } catch (e) {}
      this._storageOk = true;
      try {
        // Tracks
        if (!window.AuroraStorage) throw new Error('IndexedDB no disponible');
        const stored = await window.AuroraStorage.getAllTracks();
        // Reconstruir objectURLs (no se pueden guardar en IDB)
        this.tracks = stored.map(t => {
          if (t._file) {
            t.src = URL.createObjectURL(t._file);
          } else if (t.fileBlob) {
            t.src = URL.createObjectURL(t.fileBlob);
          }
          if (!t.addedAt) t.addedAt = 0;
          return t;
        });
        this.tracks.forEach((t, i) => {
          if (!t.addedAt) t.addedAt = i + 1;
        });
        this.invalidateTrackIndex();
      } catch (e) {
        console.warn('[Aurora] Error cargando pistas:', e);
        this.tracks = [];
        this._storageOk = false;
      }
      // Refrescar el marcador «la biblioteca tenía N pistas» (solo si hay):
      // en el próximo arranque, 0 pistas + marcador > 0 = posible pérdida.
      if (this.tracks.length > 0 && typeof this.syncLibCountMarker === 'function') {
        this.syncLibCountMarker();
      }

      // Playlists (IndexedDB → fallback localStorage)
      try {
        const pls = await window.AuroraStorage.getAllPlaylists();
        if (pls && pls.length) {
          this.playlists = pls;
          this.playlists.forEach(pl => {
            if (pl && pl.coverArt && !pl._coverCache) {
              pl._coverCache = pl.coverArt;
              pl._coverCacheHash = pl.coverArtHash || null;
            }
          });
        } else {
          this.playlists = JSON.parse(JSON.stringify(window.DEFAULT_PLAYLISTS || []));
        }
      } catch (e) {
        this.playlists = [];
      }

      // Garantizar que exista la playlist predefinida "Mi Música"
      this.ensureDefaultPlaylist();
    },

    /* Crea (si no existe) la playlist predefinida "Mi Música".
     * No se puede eliminar. Es el destino por defecto de las canciones
     * subidas desde el botón "+" del reproductor. */
    ensureDefaultPlaylist() {
      let pl = this.playlists.find(p => p.id === this.DEFAULT_PLAYLIST_ID);
      if (!pl) {
        pl = {
          id: this.DEFAULT_PLAYLIST_ID,
          name: this.t('my_music_playlist'),
          description: this.t('my_music_desc'),
          trackIds: [],
          cover: (this.coverFallback ? this.coverFallback() : { from: '#6E5CFF', to: '#FF7AB6', angle: 135 }),
          isDefault: true
        };
        this.playlists.unshift(pl);  // Al principio de la lista
        this.persistPlaylist(pl);
      } else {
        // Asegurar flags aunque la playlist ya existiera (carga desde IDB vieja)
        pl.isDefault = true;
        if (!pl.trackIds) pl.trackIds = [];
      }
      return pl;
    },

    async persistTrack(track) {
      try {
        // Guardamos el File en el track para poder reconstruir el objectURL después
        const toSave = Object.assign({}, track);
        if (track._file) {
          toSave.fileBlob = track._file;  // IndexedDB guarda Blobs directamente
          delete toSave._file;
        }
        await window.AuroraStorage.putTrack(toSave);
        return true;
      } catch (e) {
        console.warn('[Aurora] No se pudo guardar pista:', e);
        if (this._isQuotaError(e)) {
          this.toast(this.t('toast_storage_full'));
          if (typeof this.offerFreeStorage === 'function') this.offerFreeStorage();
        }
        return false;
      }
    },

    _isQuotaError(e) {
      if (!e) return false;
      return e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014;
    },

    async deleteTrackFromStorage(trackId) {
      try { await window.AuroraStorage.deleteTrack(trackId); } catch (e) {}
    },

    async persistPlaylist(pl) {
      try {
        const toSave = {
          id: pl.id,
          name: pl.name,
          description: pl.description || '',
          trackIds: Array.isArray(pl.trackIds) ? pl.trackIds.slice() : [],
          cover: pl.cover || null,
          isDefault: !!pl.isDefault,
          coverArt: pl.coverArt || pl._coverCache || null,
          coverArtHash: pl.coverArtHash || pl._coverCacheHash || null
        };
        await window.AuroraStorage.putPlaylist(toSave);
      } catch (e) {
        console.warn('[Aurora] No se pudo guardar playlist:', e);
      }
    },

    async deletePlaylistFromStorage(id) {
      try { await window.AuroraStorage.deletePlaylist(id); } catch (e) {}
    },

    /* ===== Compat: loadPlaylists/savePlaylists ahora usan IndexedDB ===== */
    async loadPlaylists() {
      // Mantenido para el test #14 (que llama a loadPlaylists)
      try {
        const pls = await window.AuroraStorage.getAllPlaylists();
        this.playlists = (pls && pls.length) ? pls : JSON.parse(JSON.stringify(window.DEFAULT_PLAYLISTS || []));
        this.playlists.forEach(pl => {
          if (pl && pl.coverArt && !pl._coverCache) {
            pl._coverCache = pl.coverArt;
            pl._coverCacheHash = pl.coverArtHash || null;
          }
        });
      } catch (e) {
        this.playlists = [];
      }
    },
    savePlaylists() {
      if (this.playlists && this.playlists.length) {
        this.playlists.forEach(p => this.persistPlaylist(p));
      }
    },

    async loadFavorites() {
      // #3 Persistencia robusta: IndexedDB primero, localStorage como fallback
      try {
        const stored = await window.AuroraStorage.getSetting('favorites');
        if (stored && Array.isArray(stored)) {
          this.favorites = new Set(stored);
        } else {
          const raw = localStorage.getItem('aurora_favs');
          if (raw) this.favorites = new Set(JSON.parse(raw));
        }
      } catch (e) {
        try {
          const raw = localStorage.getItem('aurora_favs');
          if (raw) this.favorites = new Set(JSON.parse(raw));
        } catch (e2) {}
      }
    },
    async saveFavorites() {
      try {
        const arr = [...this.favorites];
        await window.AuroraStorage.setSetting('favorites', arr);
        localStorage.setItem('aurora_favs', JSON.stringify(arr));
      } catch (e) {}
    },
});
