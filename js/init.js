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

      // La lista predefinida «Mi Música» ya no existe. Si la sesión guardada
      // apuntaba a una lista que ya no está (o a la eliminada), volver a la
      // biblioteca para no mostrar un contexto fantasma en la barra.
      this.sanitizePlayContext();

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

      // Playlists (IndexedDB). No hay ninguna lista predefinida: la
      // biblioteca arranca con cero listas y el usuario crea las que quiera.
      try {
        const pls = await window.AuroraStorage.getAllPlaylists();
        this.playlists = Array.isArray(pls) ? pls : [];
        this.playlists.forEach(pl => {
          if (pl && pl.coverArt && !pl._coverCache) {
            pl._coverCache = pl.coverArt;
            pl._coverCacheHash = pl.coverArtHash || null;
          }
        });
      } catch (e) {
        this.playlists = [];
      }

      // Migración: borrar la antigua lista predefinida «Mi Música» y
      // limpiar isDefault (ninguna lista es especial ya).
      this.migrateRemoveDefaultPlaylist();
    },

    /* Migración (una vez por arranque, idempotente) del modelo antiguo:
     *   - elimina de memoria y de IndexedDB la lista «Mi Música»
     *     (id legacy 'mi-musica');
     *   - quita isDefault de cualquier lista antigua para que todas se
     *     puedan borrar;
     *   - si el contexto de reproducción apuntaba a esa lista, lo pasa a
     *     «biblioteca».
     * Las pistas que estuvieran dentro siguen en la biblioteca: la lista
     * solo agrupaba, nunca era dueña del audio. */
    migrateRemoveDefaultPlaylist() {
      const LEGACY_ID = 'mi-musica';
      const removed = this.playlists.filter(p => p && p.id === LEGACY_ID);
      if (removed.length) {
        this.playlists = this.playlists.filter(p => p && p.id !== LEGACY_ID);
        this.deletePlaylistFromStorage(LEGACY_ID);
      }
      this.playlists.forEach(p => {
        if (p && p.isDefault) {
          p.isDefault = false;
          this.persistPlaylist(p);
        }
      });
      if (this.playContext && this.playContext.type === 'playlist' &&
          (!this.playContext.id || this.playContext.id === LEGACY_ID)) {
        this.playContext = { type: 'all' };
      }
      return removed.length;
    },

    /* Si el contexto guardado apunta a una lista que no existe, se
     * degrada a «biblioteca». Evita etiquetas fantasma tras migrar. */
    sanitizePlayContext() {
      const ctx = this.playContext;
      if (!ctx || ctx.type !== 'playlist') return;
      if (!this.playlists.some(p => p && p.id === ctx.id)) {
        this.playContext = { type: 'all' };
      }
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
        this.playlists = Array.isArray(pls) ? pls : [];
        this.playlists.forEach(pl => {
          if (pl && pl.coverArt && !pl._coverCache) {
            pl._coverCache = pl.coverArt;
            pl._coverCacheHash = pl.coverArtHash || null;
          }
        });
        this.migrateRemoveDefaultPlaylist();
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
