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

      this.buildVisualizer();
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

      if (this.currentTrack) {
        this.renderCurrentTrack();
        this.renderLyrics();
        this.updateMediaSession();
        // Aplicar shuffle/repeat restaurados
        document.getElementById('btnShuffle').classList.toggle('active', this.shuffle);
        const btnRep = document.getElementById('btnRepeat');
        btnRep.classList.toggle('active', this.repeat !== 'off');
        btnRep.dataset.mode = this.repeat;
        if (this.repeat === 'one') {
          const b = document.createElement('span');
          b.className = 'repeat-badge';
          b.textContent = '1';
          b.style.cssText = 'position:absolute;top:4px;right:4px;font-size:9px;font-weight:700;color:var(--accent);background:var(--bg-1);border-radius:50%;width:12px;height:12px;display:flex;align-items:center;justify-content:center;';
          btnRep.appendChild(b);
        }
      } else {
        this.showEmptyState();
      }

      // Guardar sesión cada 5s mientras se reproduce
      setInterval(() => this.saveSession(), 5000);

      // Aplicar idioma a todos los textos estáticos del DOM
      this.applyLang();
      this.buildLangList();

      // Sincronizar visibilidad de acciones contextuales del menú "Más"
      // según haya o no pista cargada (estado vacío inicial).
      this.updatePlayUI();

      // #4 #6 Gapless y normalización siempre activos
      this._gaplessEnabled = true;
      this._normalizeVolume = false;
      // #11 Cargar historial
      this.loadHistory();

      // Primer arranque: si no hay idioma guardado, pedir al usuario que lo elija.
      // El sheet de idioma es modal (no se puede cerrar sin elegir).
      if (!this._langAlreadyChosen) {
        setTimeout(() => this.showLanguageOnboarding(), 300);
      }

      // === Sistema de tiempo real (compartir música) ===
      this.initRealtime();

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
          return t;
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
          cover: { from: '#7C3AED', to: '#EC4899', angle: 135 },
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
      }
    },

    async deleteTrackFromStorage(trackId) {
      try { await window.AuroraStorage.deleteTrack(trackId); } catch (e) {}
    },

    async persistPlaylist(pl) {
      try { await window.AuroraStorage.putPlaylist(pl); } catch (e) {}
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
