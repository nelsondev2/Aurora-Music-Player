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
      if (typeof this.updateChrome === 'function') this.updateChrome();

      // Guardar sesión cada 5s mientras se reproduce
      setInterval(() => this.saveSession(), 5000);

      // Aplicar idioma a todos los textos estáticos del DOM
      this.applyLang();
      this.buildLangList();

      // Sincronizar visibilidad de acciones contextuales del menú "Más"
      // según haya o no pista cargada (estado vacío inicial).
      this.updatePlayUI();

      this.loadPlaybackSettings();
      this.syncPlaybackSettingsUI();
      if (typeof this.syncDesktopLayout === 'function') this.syncDesktopLayout();
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

      console.log('[Aurora] App inicializada ·', this.tracks.length, 'pistas', restored ? '· sesión restaurada' : '');
    },

    /* Muestra el sheet de idioma en modo "onboarding" (primer arranque).
     * El botón de cerrar está oculto para obligar al usuario a elegir. */
    showLanguageOnboarding() {
      const sheet = document.getElementById('sheetLanguage');
      if (!sheet) return;
      // Marcar como onboarding para ocultar el botón de cerrar
      sheet.classList.add('onboarding');
      this.buildLangList();
      // Abrir el sheet
      this.openSheet('sheetLanguage');
      // Deshabilitar el backdrop para que no se pueda cerrar tocando fuera
      const backdrop = sheet.querySelector('.sheet-backdrop');
      if (backdrop) {
        backdrop.style.pointerEvents = 'none';
        backdrop.style.background = 'rgba(0,0,0,0.85)';
      }
      // Ocultar el botón "Listo" y el botón X
      const textBtn = sheet.querySelector('.sheet-header .text-btn');
      if (textBtn) textBtn.style.display = 'none';
      const closeBtn = sheet.querySelector('.sheet-header .icon-btn-sm');
      if (closeBtn) closeBtn.style.display = 'none';
      // Cambiar el título del sheet
      const h3 = sheet.querySelector('.sheet-header h3');
      if (h3) h3.textContent = this.t('welcome_choose_lang');
    },

    /* ============================================================
     *  Carga desde IndexedDB + localStorage
     * ============================================================ */
    async loadAllFromStorage() {
      try {
        // Tracks
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
      } catch (e) {
        console.warn('[Aurora] Error cargando pistas:', e);
        this.tracks = [];
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
      } catch (e) {
        console.warn('[Aurora] No se pudo guardar pista:', e);
        if (this._isQuotaError(e)) {
          this.toast(this.t('toast_storage_full'));
          if (typeof this.offerFreeStorage === 'function') this.offerFreeStorage();
        }
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
