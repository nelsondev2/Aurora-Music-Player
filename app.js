/* =====================================================================
 *  Aurora · Reproductor Pro · app.js
 *  Motor de audio · visualizador Web Audio API · LRC sincronizado
 *  Listas de reproducción · Media Session · Wake Lock · gestos touch
 * ===================================================================== */

/* eslint-disable no-unused-vars */
(function () {
  'use strict';

  /* ============================================================
   *  Estado global de la aplicación
   * ============================================================ */
  const App = {
    /* Datos */
    tracks: [],
    playlists: [],

    /* Audio */
    audio: null,
    audioCtx: null,
    analyser: null,
    sourceNode: null,
    gainNode: null,
    eqFilters: [],
    freqData: null,

    /* Estado de reproducción */
    queue: [],
    queueIdx: 0,
    currentTrackIdx: 0,
    currentTrack: null,
    isPlaying: false,
    shuffle: false,
    repeat: 'off', // 'off' | 'all' | 'one'
    volume: 0.8,
    playbackRate: 1,

    /* Visualizador — deshabilitado (eliminado por decisión del usuario).
     * Los métodos buildVisualizer/startVisualizer/stopVisualizer se
     * mantienen como no-ops para no romper las llamadas existentes. */

    /* Letras */
    lrcLines: [], // {time, text, timed, translation?}
    activeLrcIdx: -1,
    lrcHasTimed: false,
    lrcOffset: 0,        // desfase manual en segundos (positivo = retrasa)
    lrcFontSize: 19,     // tamaño de fuente ajustable
    lrcRafId: null,      // requestAnimationFrame para sync precisa
    lrcUserScrolling: false,  // true cuando el usuario hace scroll manual
    lrcUserScrollTimer: null,
    lrcLoop: null,       // {startIdx, endIdx} para loop de sección

    /* #15 #16 Cache de objectURLs y preload */
    _urlCache: new Map(),     // trackId → objectURL (cache para reutilizar)
    _preloadAudio: null,      // elemento audio para precargar siguiente pista
    _gaplessEnabled: true,    // #4 reproducción sin pausa (siempre activo)
    _normalizeVolume: true,   // #6 normalización de volumen (siempre activo)
    _trackGainCache: new Map(), // trackId → gain normalizado
    _playHistory: [],         // #11 historial de reproducción

    /* Sleep timer */
    sleepTimer: null,
    sleepEndAt: null,

    /* Wake Lock */
    wakeLock: null,

    /* Favoritos */
    favorites: new Set(),

    /* Estadísticas de reproducción */
    stats: {
      plays: {},        // {trackId: count}
      totalSeconds: 0,
      lastPlayed: null,  // ISO string
      sessionStart: Date.now()
    },
    _statsFlushTimer: null,
    _currentPlayStart: null,
    _currentPlayBaseTime: 0,

    /* Crossfade / transición entre pistas — desactivado por defecto porque
     * causa retardo perceptible al cambiar de canción (1.6s de fundido). */
    crossfadeEnabled: false,
    crossfadeDuration: 0.3,  // segundos (solo si se activa manualmente)

    /* Tema */
    theme: 'dark',  // 'dark' | 'light' | 'amoled'
    accent: 'purple',  // 'purple' | 'blue' | 'green' | 'orange' | 'pink'

    /* Idioma */
    lang: 'es',  // código ISO 639-1: 'es' | 'en' | 'pt' | 'zh' | 'ja' | 'fr' | 'it' | 'ru'

    /* Edición de playlist:
     *   _editingPlaylistId = ID de playlist que se está editando (en sheetEditPlaylist)
     *   _addingToPlaylistId = ID de playlist a la que se van a añadir pistas (modo "add" en sheetCreatePlaylist)
     *   _selectPlaylistForAdd = true cuando el sheet de listas se abrió para elegir
     *                            a qué playlist añadir la pista actual (desde el menú "Más")
     * Todos null/false cuando no hay edición en curso. */
    _editingPlaylistId: null,
    _addingToPlaylistId: null,
    _selectPlaylistForAdd: false,

    /* ID fijo de la playlist predefinida "Mi Música" (no eliminable).
     * Sirve también como destino por defecto de las canciones subidas
     * desde el botón "+" del reproductor. */
    DEFAULT_PLAYLIST_ID: 'mi-musica',

    /* Contexto de reproducción actual: indica desde qué lista se está
     * reproduciendo. Puede ser:
     *   { type: 'playlist', id, name }
     *   { type: 'favorites' }
     *   { type: 'queue' }       // cola manual / "todas las pistas"
     *   { type: 'all' }         // biblioteca entera
     *   null                    // sin contexto definido
     * Se usa para mostrar "Reproduciendo desde X" en la barra superior. */
    playContext: null,

    /* Utilidades */
    _wired: {},
    _lastError: null,

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
      this._normalizeVolume = true;
      // #11 Cargar historial
      this.loadHistory();

      // Primer arranque: si no hay idioma guardado, pedir al usuario que lo elija.
      // El sheet de idioma es modal (no se puede cerrar sin elegir).
      if (!this._langAlreadyChosen) {
        setTimeout(() => this.showLanguageOnboarding(), 300);
      }

      // === Sistema de tiempo real (compartir música) ===
      this.initRealtime();

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

    /* ============================================================
     *  Persistencia de sesión (#5)
     * ============================================================ */
    async saveSession() {
      try {
        const t = this.currentTrack;
        const session = {
          currentTrackId: t?.id || null,
          currentTrackTitle: t?.title || null,
          currentTrackArtist: t?.artist || null,
          currentTrackAlbum: t?.album || null,
          currentTrackCover: t?.cover || null,
          currentTrackCoverIsImage: t?.coverIsImage || false,
          currentTrackDuration: t?.duration || 0,
          currentTrackLrc: t?.lrc || null,
          queue: this.queue,
          queueIdx: this.queueIdx,
          currentTime: this.audio?.currentTime || 0,
          shuffle: this.shuffle,
          repeat: this.repeat,
          playContext: this.playContext,
          ts: Date.now()
        };
        await window.AuroraStorage.setSetting('session', session);
      } catch (e) {}
    },

    async restoreSession() {
      try {
        const session = await window.AuroraStorage.getSetting('session');
        if (!session || !session.currentTrackId) return false;
        // Verificar que la pista todavía existe
        const trackIdx = this.tracks.findIndex(t => t.id === session.currentTrackId);
        if (trackIdx < 0) return false;
        // Restaurar estado
        this.currentTrackIdx = trackIdx;
        this.currentTrack = this.tracks[trackIdx];
        // Filtrar cola para que solo contenga pistas existentes
        this.queue = (session.queue || []).filter(id => this.tracks.some(t => t.id === id));
        if (this.queue.length === 0) {
          this.queue = this.tracks.map(t => t.id);
        }
        // Restaurar queueIdx al índice de la pista actual
        const qIdx = this.queue.indexOf(session.currentTrackId);
        this.queueIdx = qIdx >= 0 ? qIdx : 0;
        this.shuffle = !!session.shuffle;
        this.repeat = session.repeat || 'off';

        // Cargar la pista en el audio SIN reproducir (el usuario debe tocar play)
        this.audio.src = this.currentTrack.src;
        this.audio.load();
        // Restaurar posición cuando los metadatos carguen
        const restoreTime = session.currentTime || 0;
        const onMeta = () => {
          if (isFinite(restoreTime) && restoreTime > 0 && restoreTime < (this.audio.duration || 0)) {
            this.audio.currentTime = restoreTime;
          }
          this.updateProgress();
          this.audio.removeEventListener('loadedmetadata', onMeta);
        };
        this.audio.addEventListener('loadedmetadata', onMeta);

        return true;
      } catch (e) {
        console.warn('[Aurora] Error restaurando sesión:', e);
        return false;
      }
    },

    /* ============================================================
     *  Estadísticas de reproducción (#13)
     * ============================================================ */
    async loadStats() {
      // #3 Persistencia robusta: intentar IndexedDB primero, fallback a localStorage
      try {
        const stored = await window.AuroraStorage.getSetting('stats');
        if (stored) {
          this.stats = stored;
        } else {
          const raw = localStorage.getItem('aurora_stats');
          if (raw) this.stats = JSON.parse(raw);
        }
        if (!this.stats.plays) this.stats.plays = {};
        if (typeof this.stats.totalSeconds !== 'number') this.stats.totalSeconds = 0;
      } catch (e) {
        try {
          const raw = localStorage.getItem('aurora_stats');
          if (raw) this.stats = JSON.parse(raw);
        } catch (e2) {}
      }
    },
    async saveStats() {
      try {
        this.stats.lastPlayed = new Date().toISOString();
        await window.AuroraStorage.setSetting('stats', this.stats);
        // También en localStorage como respaldo
        localStorage.setItem('aurora_stats', JSON.stringify(this.stats));
      } catch (e) {}
    },

    /* Reiniciar estadísticas de reproducción */
    async resetStats() {
      this.stats = {
        plays: {},
        totalSeconds: 0,
        lastPlayed: null,
        sessionStart: Date.now()
      };
      await this.saveStats();
      this.renderStats();
      this.toast(this.t('stats_reset_toast'));
    },

    /* Reiniciar historial de reproducción */
    async resetHistory() {
      this._playHistory = [];
      try { await window.AuroraStorage.setSetting('history', this._playHistory); } catch (e) {}
      this.renderHistory();
      this.toast(this.t('history_reset_toast'));
    },

    /* Registrar que una pista empezó a sonar */
    trackPlayStarted() {
      this._currentPlayStart = Date.now();
      this._currentPlayBaseTime = this.audio.currentTime || 0;
      // Incrementar contador de reproducciones
      if (this.currentTrack) {
        const id = this.currentTrack.id;
        this.stats.plays[id] = (this.stats.plays[id] || 0) + 1;
        this.saveStats();
      }
      // Iniciar flush periódico de tiempo escuchado
      if (this._statsFlushTimer) clearInterval(this._statsFlushTimer);
      this._statsFlushTimer = setInterval(() => {
        if (this.isPlaying && this.audio) {
          const elapsed = (this.audio.currentTime - this._currentPlayBaseTime);
          if (elapsed > 0) {
            this.stats.totalSeconds += elapsed;
            this._currentPlayBaseTime = this.audio.currentTime;
            this.saveStats();
          }
        }
      }, 10000);  // cada 10s
    },

    trackPlayStopped() {
      if (this._statsFlushTimer) {
        clearInterval(this._statsFlushTimer);
        this._statsFlushTimer = null;
      }
      // Última actualización
      if (this._currentPlayStart && this.audio) {
        const elapsed = (this.audio.currentTime - this._currentPlayBaseTime);
        if (elapsed > 0) {
          this.stats.totalSeconds += elapsed;
          this._currentPlayBaseTime = this.audio.currentTime;
          this.saveStats();
        }
      }
      this._currentPlayStart = null;
    },

    /* Devuelve las N pistas más reproducidas */
    getTopTracks(n = 10) {
      return Object.entries(this.stats.plays)
        .map(([id, count]) => ({ track: this.tracks.find(t => t.id === id), count }))
        .filter(x => x.track)
        .sort((a, b) => b.count - a.count)
        .slice(0, n);
    },

    /* Devuelve el artista más escuchado */
    getTopArtists(n = 5) {
      const artistCounts = {};
      Object.entries(this.stats.plays).forEach(([id, count]) => {
        const t = this.tracks.find(x => x.id === id);
        if (t) artistCounts[t.artist] = (artistCounts[t.artist] || 0) + count;
      });
      return Object.entries(artistCounts)
        .map(([artist, count]) => ({ artist, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, n);
    },

    fmtDuration(s) {
      s = Math.floor(s);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      if (h > 0) return h + 'h ' + m + 'm';
      if (m > 0) return m + 'm ' + sec + 's';
      return sec + 's';
    },

    /* ============================================================
     *  Temas personalizables (#11)
     * ============================================================ */
    THEMES: {
      dark:   { bg0: '#050509', bg1: '#0a0a12', bg2: '#14141f', bg3: '#1d1d2b', text1: '#ffffff' },
      light:  { bg0: '#f5f5f8', bg1: '#ffffff', bg2: '#f0f0f5', bg3: '#e8e8f0', text1: '#0a0a12' },
      amoled: { bg0: '#000000', bg1: '#000000', bg2: '#0a0a0a', bg3: '#141414', text1: '#ffffff' }
    },
    ACCENTS: {
      purple: { from: '#7C3AED', to: '#EC4899', accent: '#a855f7', accent2: '#ec4899' },
      blue:   { from: '#2563EB', to: '#06B6D4', accent: '#3b82f6', accent2: '#06b6d4' },
      green:  { from: '#059669', to: '#10B981', accent: '#10b981', accent2: '#84cc16' },
      orange: { from: '#EA580C', to: '#F59E0B', accent: '#f97316', accent2: '#f59e0b' },
      pink:   { from: '#DB2777', to: '#EC4899', accent: '#ec4899', accent2: '#f472b6' }
    },

    loadTheme() {
      try {
        this.theme = localStorage.getItem('aurora_theme') || 'dark';
        this.accent = localStorage.getItem('aurora_accent') || 'purple';
      } catch (e) {}
      this.applyTheme();
    },

    applyTheme() {
      const root = document.documentElement;
      const t = this.THEMES[this.theme] || this.THEMES.dark;
      const a = this.ACCENTS[this.accent] || this.ACCENTS.purple;
      root.style.setProperty('--bg-0', t.bg0);
      root.style.setProperty('--bg-1', t.bg1);
      root.style.setProperty('--bg-2', t.bg2);
      root.style.setProperty('--bg-3', t.bg3);
      root.style.setProperty('--text-1', t.text1);
      root.style.setProperty('--accent', a.accent);
      root.style.setProperty('--accent-2', a.accent2);
      // Para el tema claro, ajustar variables derivadas
      if (this.theme === 'light') {
        root.style.setProperty('--surface', 'rgba(0,0,0,0.05)');
        root.style.setProperty('--surface-2', 'rgba(0,0,0,0.08)');
        root.style.setProperty('--surface-hi', 'rgba(0,0,0,0.12)');
        root.style.setProperty('--border', 'rgba(0,0,0,0.10)');
        root.style.setProperty('--text-2', 'rgba(0,0,0,0.72)');
        root.style.setProperty('--text-3', 'rgba(0,0,0,0.48)');
        root.style.setProperty('--text-4', 'rgba(0,0,0,0.40)');
        // Nav inferior y toast: fondo claro, texto oscuro
        root.style.setProperty('--blur-bg', 'rgba(255, 255, 255, 0.92)');
        root.style.setProperty('--toast-bg', 'rgba(245, 245, 248, 0.96)');
        root.style.setProperty('--toast-text', '#0a0a12');
        // Marcar el tema en el <html> para reglas CSS específicas
        root.setAttribute('data-theme', 'light');
      } else {
        root.style.setProperty('--surface', 'rgba(255,255,255,0.05)');
        root.style.setProperty('--surface-2', 'rgba(255,255,255,0.08)');
        root.style.setProperty('--surface-hi', 'rgba(255,255,255,0.12)');
        root.style.setProperty('--border', 'rgba(255,255,255,0.08)');
        root.style.setProperty('--text-2', 'rgba(255,255,255,0.72)');
        root.style.setProperty('--text-3', 'rgba(255,255,255,0.48)');
        root.style.setProperty('--text-4', 'rgba(255,255,255,0.30)');
        // Nav inferior y toast: fondo oscuro, texto claro
        root.style.setProperty('--blur-bg', 'rgba(10, 10, 18, 0.85)');
        root.style.setProperty('--toast-bg', 'rgba(20, 20, 30, 0.95)');
        root.style.setProperty('--toast-text', '#ffffff');
        root.setAttribute('data-theme', this.theme);
      }
      // Actualizar meta theme-color
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', t.bg0);
    },

    setTheme(theme) {
      this.theme = theme;
      try { localStorage.setItem('aurora_theme', theme); } catch (e) {}
      this.applyTheme();
      this.toast(this.t('toast_theme_applied') + ' ' + theme);
    },

    setAccent(accent) {
      this.accent = accent;
      try { localStorage.setItem('aurora_accent', accent); } catch (e) {}
      this.applyTheme();
      this.toast(this.t('toast_accent') + ' ' + accent);
    },

    /* ============================================================
     *  Idioma (i18n)
     * ============================================================ */
    t(key) {
      const dict = window.I18N && window.I18N[key];
      if (!dict) return key;
      const v = dict[this.lang] || dict.es || key;
      return v;
    },

    loadLang() {
      try {
        const saved = localStorage.getItem('aurora_lang');
        if (saved && this._isValidLang(saved)) {
          this.lang = saved;
          this._langAlreadyChosen = true;  // ya hay idioma guardado
        } else {
          // Primer arranque: no hay idioma guardado.
          // Detectar idioma del navegador como sugerencia inicial,
          // pero pedir al usuario que confirme.
          const nav = (navigator.language || 'es').slice(0, 2).toLowerCase();
          if (this._isValidLang(nav)) this.lang = nav;
          this._langAlreadyChosen = false;
        }
      } catch (e) {}
    },

    _isValidLang(code) {
      return !!(window.SUPPORTED_LANGS || []).find(l => l.code === code);
    },

    applyLang() {
      const dict = window.I18N || {};
      // Texto: data-i18n="key"
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const e = dict[key];
        if (e) el.textContent = e[this.lang] || e.es || key;
      });
      // aria-label: data-i18n-aria="key"
      document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        const e = dict[key];
        if (e) el.setAttribute('aria-label', e[this.lang] || e.es || key);
      });
      // placeholder: data-i18n-ph="key"
      document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        const e = dict[key];
        if (e) el.setAttribute('placeholder', e[this.lang] || e.es || key);
      });
      // Atributo lang del <html>
      document.documentElement.setAttribute('lang', this.lang);
      // Nota: document.title es ignorado en WebXDC; el nombre viene de manifest.toml
      // Re-renderizar listas dinámicas para que se traduzcan
      try {
        this.renderLibrary();
        this.renderPlaylists();
        this.renderQueue();
        this.renderFavorites();
        if (this.currentTrack) this.renderCurrentTrack(); else this.showEmptyState();
        if (document.getElementById('statsContent').innerHTML) this.renderStats();
      } catch (e) {}
    },

    setLang(code) {
      if (!this._isValidLang(code)) {
        console.warn('[Aurora] Idioma no soportado:', code);
        return;
      }
      this.lang = code;
      this._langAlreadyChosen = true;
      try { localStorage.setItem('aurora_lang', code); } catch (e) {}
      this.applyLang();
      this.buildLangList();
      // Si el sheet de idioma está en modo onboarding, restaurar la UI
      // antes de cerrarlo para que la próxima vez se vea normal.
      const sheet = document.getElementById('sheetLanguage');
      if (sheet && sheet.classList.contains('onboarding')) {
        this.restoreLanguageSheet();
      }
      this.toast(this.t('toast_lang_applied'));
    },

    /* Restaura el sheet de idioma a su estado normal (tras onboarding) */
    restoreLanguageSheet() {
      const sheet = document.getElementById('sheetLanguage');
      if (!sheet) return;
      sheet.classList.remove('onboarding');
      // Restaurar backdrop
      const backdrop = sheet.querySelector('.sheet-backdrop');
      if (backdrop) {
        backdrop.style.pointerEvents = '';
        backdrop.style.background = '';
      }
      // Restaurar botones
      const textBtn = sheet.querySelector('.sheet-header .text-btn');
      if (textBtn) textBtn.style.display = '';
      const closeBtn = sheet.querySelector('.sheet-header .icon-btn-sm');
      if (closeBtn) closeBtn.style.display = '';
      // Restaurar título
      const h3 = sheet.querySelector('.sheet-header h3');
      if (h3) h3.textContent = this.t('language_title');
    },

    buildLangList() {
      const ul = document.getElementById('langList');
      if (!ul) return;
      ul.innerHTML = '';
      const langs = window.SUPPORTED_LANGS || [];
      langs.forEach(l => {
        const li = document.createElement('li');
        li.className = 'lang-row' + (l.code === this.lang ? ' active' : '');
        li.innerHTML = `
          <span class="lang-flag">${l.flag}</span>
          <span class="lang-name">${l.name}</span>
          ${l.code === this.lang ? '<i class="fa-solid fa-check lang-check"></i>' : ''}
        `;
        li.addEventListener('click', () => {
          this.setLang(l.code);
          this.closeSheet('sheetLanguage');
        });
        ul.appendChild(li);
      });
    },

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
      this.toast(this.t('toast_processing_files').replace('X', count), 2000);
      try {
        const newTracks = await window.AuroraUploader.processFiles(fileList);
        if (!newTracks.length) {
          this.toast(this.t('toast_load_failed'));
          return;
        }

        // #10 Detección de duplicados: comparar por fileName + fileSize
        let dupCount = 0;
        const uniqueTracks = [];
        for (const t of newTracks) {
          const isDup = this.tracks.some(existing =>
            existing.fileName === t.fileName &&
            existing.fileSize === t.fileSize
          );
          if (isDup) {
            dupCount++;
            // Liberar objectURL del duplicado
            if (t.src && t.src.startsWith('blob:')) URL.revokeObjectURL(t.src);
          } else {
            uniqueTracks.push(t);
          }
        }
        if (dupCount > 0) {
          this.toast(dupCount + ' ' + this.t('toast_duplicate_found'));
        }
        if (uniqueTracks.length === 0) return;
        const tracksToAdd = uniqueTracks;

        // Añadir todas las pistas a memoria primero (rápido)
        for (const t of tracksToAdd) {
          this.tracks.push(t);
        }

        // Persistir en IndexedDB en lotes usando una sola transacción
        // para evitar abrir N transacciones separadas (que es lento).
        await this.persistTracksBatch(tracksToAdd);

        // Determinar playlist destino (default = Mi Música)
        const destId = targetPlaylistId || this.DEFAULT_PLAYLIST_ID;
        const destPl = this.playlists.find(p => p.id === destId);
        if (destPl) {
          tracksToAdd.forEach(t => {
            if (!destPl.trackIds.includes(t.id)) destPl.trackIds.push(t.id);
          });
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
          tracksToAdd.forEach(t => this.queue.push(t.id));
        }
        this.renderLibrary();
        this.renderPlaylists();
        this.renderQueue();
        this.renderFavorites();
        // Si estábamos editando la playlist destino, refrescar la vista
        if (this._editingPlaylistId === destId) this.renderEditPlaylist();
        this.hideEmptyState();
        // Anunciar las nuevas pistas al canal realtime (para que los peers
        // puedan solicitar los chunks y escucharlas también).
        tracksToAdd.forEach(t => this._rtAnnounceTrack(t));
        const destName = destPl ? destPl.name : this.t('my_music_playlist');
        this.toast(tracksToAdd.length + ' ' + this.t('toast_added_to_playlist_plural') + ' ' + destName + (fromDirectory ? ' (carpeta)' : ''));
      } catch (e) {
        console.error('[Aurora] Error cargando archivos:', e);
        this._lastError = { msg: 'upload: ' + e.message, ts: Date.now() };
        this.toast(this.t('toast_load_error'));
      }
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

    /* #15 Precargar la siguiente pista para gapless playback */
    preloadNextTrack() {
      if (!this._gaplessEnabled) return;
      const nextIdx = this.queueIdx + 1;
      if (nextIdx >= this.queue.length) return;
      const nextTrackId = this.queue[nextIdx];
      const nextTrack = this.tracks.find(t => t.id === nextTrackId);
      if (!nextTrack) return;
      // Usar el URL cacheado
      const url = this.getTrackUrl(nextTrack);
      if (!url) return;
      // Crear o reutilizar elemento de preload
      if (!this._preloadAudio) {
        this._preloadAudio = new Audio();
        this._preloadAudio.preload = 'auto';
      }
      if (this._preloadAudio.src !== url) {
        this._preloadAudio.src = url;
        this._preloadAudio.load();
      }
    },

    /* #4 Gapless: cambiar a la siguiente pista sin pausa */
    gaplessNext() {
      if (!this._gaplessEnabled || !this._preloadAudio) return false;
      const nextIdx = this.queueIdx + 1;
      if (nextIdx >= this.queue.length) return false;
      const nextTrackId = this.queue[nextIdx];
      const nextTrack = this.tracks.find(t => t.id === nextTrackId);
      if (!nextTrack) return false;
      // Intercambiar: el preload se vuelve el principal
      const oldAudio = this.audio;
      this.audio = this._preloadAudio;
      this._preloadAudio = oldAudio;
      // Actualizar estado
      this.currentTrack = nextTrack;
      this.currentTrackIdx = this.tracks.findIndex(t => t.id === nextTrackId);
      this.queueIdx = nextIdx;
      this.isPlaying = true;
      this.audio.play();
      this.renderCurrentTrack();
      this.renderLyrics();
      this.updateMediaSession();
      this.updatePlayUI();
      // Precargar la siguiente
      this.preloadNextTrack();
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
        // Gain objetivo: normalizar a RMS ~0.1
        const targetRms = 0.1;
        const gain = rms > 0.001 ? Math.min(2.0, Math.max(0.5, targetRms / rms)) : 1.0;
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

    /* #11 Render historial */
    renderHistory() {
      const cont = document.getElementById('statsContent');
      if (!cont) return;
      const history = this._playHistory.slice().reverse(); // más reciente primero
      if (history.length === 0) {
        cont.innerHTML = '<p class="stats-empty">' + this.t('history_empty') + '</p>';
        return;
      }
      let html = '<h4 class="section-title">' + this.t('history_title') + '</h4><ul class="track-list">';
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
        </li>`;
      });
      html += '</ul>';
      cont.innerHTML = html;
      // Cablear clicks
      cont.querySelectorAll('.track-row[data-track]').forEach(row => {
        row.addEventListener('click', () => {
          this.playTrack(row.dataset.track, { type: 'all' });
          this.closeSheet('sheetStats');
        });
        const cv = row.querySelector('canvas');
        const t = this.tracks.find(x => x.id === row.dataset.track);
        if (cv && t) this.drawRowCover(cv, t);
      });
    },

    /* #17 Exportar biblioteca a JSON (sin blobs) */
    async exportLibrary() {
      try {
        const data = {
          version: 1,
          tracks: this.tracks.map(t => ({
            id: t.id, title: t.title, artist: t.artist, album: t.album,
            duration: t.duration, fileSize: t.fileSize, fileName: t.fileName,
            cover: (typeof t.cover === 'string') ? t.cover : null,
            coverIsImage: t.coverIsImage, lrc: t.lrc
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
          this.toast(this.t('toast_imported'));
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
        for (const t of tracks) await this.persistTrack(t);
      }
    },

    async deleteTrack(trackId) {
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
      // Quitar de playlists
      this.playlists.forEach(pl => {
        const i = pl.trackIds.indexOf(trackId);
        if (i >= 0) pl.trackIds.splice(i, 1);
        this.persistPlaylist(pl);
      });
      // Quitar de favoritos
      this.favorites.delete(trackId);
      this.saveFavorites();
      // Eliminar de IndexedDB
      await this.deleteTrackFromStorage(trackId);
      // Avisar al canal realtime que la pista ya no está disponible
      this._rtUnannounceTrack(trackId);

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
      this.toast(this.t('toast_track_deleted'));
    },

    /* ============================================================
     *  Borrar TODAS las pistas de la biblioteca
     * ============================================================ */
    async deleteAllTracks() {
      if (this.tracks.length === 0) {
        this.toast(this.t('no_tracks_loaded'));
        return;
      }
      if (!confirm(this.t('delete_all_confirm'))) return;

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
      this.currentTrackIdx = 0;
      this.currentTrack = null;
      this.favorites = new Set();
      this.saveFavorites();

      // 4. Quitar trackIds de todas las playlists (sin borrar las listas)
      this.playlists.forEach(pl => {
        pl.trackIds = [];
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
      this.toast(this.t('toast_all_deleted'));
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
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up" style="margin-right:8px"></i><span></span>';
        btn.addEventListener('click', () => this.openFilePicker());
        empty.appendChild(btn);
      }
      // Re-pintar contenido traducido cada vez
      empty.innerHTML = `
        <div class="empty-icon">
          <i class="fa-solid fa-music"></i>
        </div>
        <h2>${this.t('empty_library_title')}</h2>
        <p>${this.t('empty_library_hint')}</p>
        <button class="primary-btn empty-cta" id="btnEmptyLoad">
          <i class="fa-solid fa-cloud-arrow-up" style="margin-right:8px"></i>
          <span>${this.t('load_music')}</span>
        </button>
        <p class="empty-hint">${this.t('empty_format_hint')}</p>
      `;
      document.getElementById('btnEmptyLoad').addEventListener('click', () => this.openFilePicker());
      empty.style.display = 'flex';
      // Ocultar secciones habituales
      ['.cover-section','.visualizer','.track-info','.progress-section','.controls-main','.controls-secondary']
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

    /* ============================================================
     *  Sistema de tiempo real (compartir música)
     *  ----------------------------------------------------------
     *  Conecta con el canal realtime de webxdc, anuncia las pistas
     *  locales a los peers, recibe pistas compartidas y sincroniza
     *  la reproducción (play/pause/skip/seek) entre todos los
     *  oyentes del chat.
     * ============================================================ */

    /* Inicializa el sistema de tiempo real tras cargar la app. */
    initRealtime() {
      if (!window.AuroraRealtime) {
        console.warn('[Aurora] AuroraRealtime no disponible — tiempo real deshabilitado');
        return;
      }
      const RT = window.AuroraRealtime;

      // Suscripciones
      RT.onPeersChanged(() => this._rtOnPeersChanged());
      RT.onSharedTrackReady((track) => this._rtOnSharedTrackReady(track));
      RT.onPlaybackSync((action) => this._rtOnPlaybackSync(action));
      RT.onTrackListChanged(() => this._rtOnTrackListChanged());

      // Conectar (de forma segura; si no hay canal realtime, no hace nada)
      try {
        RT.connect();
      } catch (e) {
        console.warn('[Aurora] Error conectando al canal realtime:', e);
      }

      // Anunciar todas las pistas locales que ya tenemos cargadas
      this._rtAnnounceAllTracks();

      // Wiring del botón "Listeners" en la barra superior
      const btnSync = document.getElementById('btnSync');
      if (btnSync) {
        btnSync.addEventListener('click', () => {
          this.renderListeners();
          this.openSheet('sheetListeners');
        });
      }

      // Actualizar badge inicial
      this._rtUpdatePeerCountBadge();
    },

    /* Anuncia TODAS las pistas locales al sistema realtime.
     * Se llama al iniciar y tras cargas/eliminaciones masivas. */
    _rtAnnounceAllTracks() {
      if (!window.AuroraRealtime) return;
      try {
        window.AuroraRealtime.refreshKnownFiles(this.tracks);
      } catch (e) {
        console.warn('[Aurora] Error anunciando pistas al realtime:', e);
      }
    },

    /* Anuncia UNA pista nueva al sistema realtime. */
    _rtAnnounceTrack(track) {
      if (!window.AuroraRealtime || !track) return;
      try {
        window.AuroraRealtime.announceTrack(track);
      } catch (e) {}
    },

    /* Quita una pista del sistema realtime. */
    _rtUnannounceTrack(trackId) {
      if (!window.AuroraRealtime) return;
      try {
        window.AuroraRealtime.unannounceTrack(trackId);
      } catch (e) {}
    },

    /* Difunde una acción de reproducción al canal realtime. */
    _rtBroadcastAction(alert) {
      if (!window.AuroraRealtime || !this.currentTrack) return;
      try {
        window.AuroraRealtime.broadcastLastAction({
          trackId: this.currentTrack.id,
          isPlaying: this.isPlaying,
          currentTime: this.audio?.currentTime || 0,
          alert: alert || null
        });
      } catch (e) {}
    },

    /* Callback: cambió la lista de peers. Actualiza badge y sheet. */
    _rtOnPeersChanged() {
      this._rtUpdatePeerCountBadge();
      // Si el sheet de listeners está abierto, refrescarlo
      const sheet = document.getElementById('sheetListeners');
      if (sheet && sheet.classList.contains('open')) {
        this.renderListeners();
      }
    },

    /* Callback: llegó una pista compartida completa desde un peer. */
    async _rtOnSharedTrackReady(track) {
      // Evitar duplicados
      if (this.tracks.some(t => t.id === track.id)) {
        // Ya la teníamos; ignorar
        return;
      }
      // Añadirla a la biblioteca
      this.tracks.push(track);
      // Persistirla como cualquier otra pista
      await this.persistTrack(track);
      // Añadirla a la playlist "Mi Música" si existe
      const destPl = this.playlists.find(p => p.id === this.DEFAULT_PLAYLIST_ID);
      if (destPl && !destPl.trackIds.includes(track.id)) {
        destPl.trackIds.push(track.id);
        this.persistPlaylist(destPl);
      }
      // Re-anunciar (por si queremos que otros peers la descarguen de nosotros)
      this._rtAnnounceTrack(track);
      // Refrescar UI
      this.renderLibrary();
      this.renderPlaylists();
      this.renderQueue();
      this.renderFavorites();
      this.hideEmptyState();
      // Toast informativo
      const who = track.uploadedBy || 'Unknown';
      this.toast(this.t('toast_shared_track_received') + ' ' + who, 3500);
    },

    /* Callback: un peer hizo una acción de reproducción y debo sincronizar. */
    async _rtOnPlaybackSync(action) {
      if (!action || !action.trackId) return;
      // ¿Tenemos la pista?
      const idx = this.tracks.findIndex(t => t.id === action.trackId);
      if (idx < 0) return;
      // ¿Es la pista actualmente cargada?
      const isCurrent = this.currentTrack && this.currentTrack.id === action.trackId;
      // Evitar re-broadcast: este evento vino de un peer, no debemos
      // reenviarlo al canal realtime (evita bucle infinito).
      this._rtSuppressBroadcast = true;
      try {
        if (!isCurrent) {
          // Cambiar a esa pista sin contexto de playlist
          this.currentTrackIdx = idx;
          this.currentTrack = this.tracks[idx];
          // Cargar el audio sin autoplay todavía
          this.audio.src = this.currentTrack.src;
          this.audio.load();
          this.renderCurrentTrack();
          this.renderLyrics();
          this.updateMediaSession();
        }
        // Calcular posición objetivo (compensar el tiempo transcurrido desde actionTime)
        const elapsed = action.isPlaying ? (Date.now() - action.actionTime) / 1000 : 0;
        const targetTime = (action.currentTime || 0) + elapsed;
        // Esperar a que el audio tenga metadata para hacer seek
        const trySeek = () => {
          if (isFinite(this.audio.duration) && this.audio.duration > 0) {
            let t = targetTime;
            // Si pasó del final, saltar a la siguiente pista (lo maneja 'ended')
            if (t >= this.audio.duration) {
              t = this.audio.duration - 0.1;
            }
            try { this.audio.currentTime = Math.max(0, t); } catch (e) {}
            if (action.isPlaying) {
              this.togglePlay(true);
            } else {
              this.togglePlay(false);
            }
            this.updateProgress();
          } else {
            // Aún no cargó la metadata; reintentar
            setTimeout(trySeek, 100);
          }
        };
        // Si ya está cargada, intentar de inmediato; si no, esperar metadata
        if (isCurrent && isFinite(this.audio.duration) && this.audio.duration > 0) {
          trySeek();
        } else {
          const onMeta = () => {
            this.audio.removeEventListener('loadedmetadata', onMeta);
            trySeek();
          };
          this.audio.addEventListener('loadedmetadata', onMeta);
          // Fallback por si metadata ya cargó
          setTimeout(() => {
            this.audio.removeEventListener('loadedmetadata', onMeta);
            if (isFinite(this.audio.duration) && this.audio.duration > 0) trySeek();
          }, 500);
        }
        // Mostrar toast si hay alerta
        if (action.alert) {
          this.toast(action.alert, 2000);
        }
      } finally {
        // Liberar el flag tras un breve delay (para que el togglePlay que
        // acabamos de llamar no rebrote el broadcast).
        setTimeout(() => { this._rtSuppressBroadcast = false; }, 600);
      }
    },

    /* Callback: la lista de pistas conocidas (incluidas las de peers)
     * cambió. Refresca el badge de peer count. */
    _rtOnTrackListChanged() {
      // Nada por ahora; las pistas nuevas se entregan vía _rtOnSharedTrackReady
    },

    /* Actualiza el badge del botón Listeners en la barra superior. */
    _rtUpdatePeerCountBadge() {
      const btn = document.getElementById('btnSync');
      const badge = document.getElementById('syncPeerCount');
      if (!btn || !badge) return;
      const peers = window.AuroraRealtime ? window.AuroraRealtime.getPeers() : [];
      const total = peers.length + 1; // +1 = yo
      badge.textContent = String(total);
      // Pulso animado si subió el número
      const prev = parseInt(btn.dataset.peers || '0', 10);
      if (total > prev) {
        btn.classList.add('pulse');
        setTimeout(() => btn.classList.remove('pulse'), 400);
      }
      btn.dataset.peers = String(total);
    },

    /* Renderiza la lista de oyentes dentro del sheet "Listeners". */
    renderListeners() {
      const list = document.getElementById('listenersList');
      if (!list) return;
      list.innerHTML = '';
      const RT = window.AuroraRealtime;
      const peers = RT ? RT.getPeers() : [];
      const myState = RT ? RT.getState() : null;
      const myLast = myState && myState.lastAction;

      // Fila "yo"
      const myRow = document.createElement('div');
      myRow.className = 'listener-row';
      const myName = (window.webxdc && window.webxdc.selfName) || 'Tú';
      const myInitial = (myName || '?').charAt(0).toUpperCase();
      const myTrackLabel = this._rtFormatTrackLabel(this.currentTrack, this.isPlaying);
      myRow.innerHTML = `
        <div class="listener-avatar">${this.esc(myInitial)}</div>
        <div class="listener-info">
          <div class="listener-name">${this.esc(myName)} <span style="color:var(--text-3);font-weight:400">(${this.esc(this.t('listeners_you'))})</span></div>
          <div class="listener-track ${this.isPlaying ? 'playing' : (this.currentTrack ? 'paused' : '')}">${this.esc(myTrackLabel)}</div>
        </div>
        <div class="listener-status-dot"></div>
      `;
      list.appendChild(myRow);

      // Filas de peers
      if (peers.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'listeners-empty';
        empty.innerHTML = `<i class="fa-solid fa-headphones"></i>${this.esc(this.t('listeners_no_peers'))}`;
        list.appendChild(empty);
        return;
      }
      for (const peer of peers) {
        const row = document.createElement('div');
        row.className = 'listener-row';
        const name = (peer.state && peer.state.selfName) || 'Unknown';
        const initial = (name || '?').charAt(0).toUpperCase();
        const last = peer.state && peer.state.lastAction;
        let trackLabel = this.t('listeners_not_playing');
        let trackClass = '';
        if (last) {
          const t = this.tracks.find(x => x.id === last.trackId)
            || (myState && (myState.files || []).find(f => f.id === last.trackId));
          const label = t ? (t.title || t.name || 'Unknown') : (last.trackId || 'Unknown');
          trackLabel = label;
          trackClass = last.isPlaying ? 'playing' : 'paused';
        }
        row.innerHTML = `
          <div class="listener-avatar">${this.esc(initial)}</div>
          <div class="listener-info">
            <div class="listener-name">${this.esc(name)}</div>
            <div class="listener-track ${trackClass}">${this.esc(trackLabel)}</div>
          </div>
          <div class="listener-status-dot"></div>
        `;
        list.appendChild(row);
      }
    },

    /* Formatea el texto de pista para la lista de oyentes. */
    _rtFormatTrackLabel(track, isPlaying) {
      if (!track) return this.t('listeners_not_playing');
      const name = track.title || track.fileName || 'Unknown';
      return name;
    },

    /* Comparte la pista actual al chat de Delta Chat (vía webxdc.sendToChat).
     * Genera un Blob con el audio y lo envía como archivo adjunto. */
    async shareCurrentTrackToChat() {
      if (!this.currentTrack) {
        this.toast(this.t('no_tracks_loaded'));
        return;
      }
      if (!window.webxdc || typeof window.webxdc.sendToChat !== 'function') {
        this.toast(this.t('sendtochat_unavailable'));
        return;
      }
      try {
        const t = this.currentTrack;
        let blob = t._file || t.fileBlob;
        if (!blob) {
          // Intentar descargarlo del objectURL
          const resp = await fetch(t.src);
          blob = await resp.blob();
        }
        const name = t.fileName || (t.title || 'track') + '.mp3';
        window.webxdc.sendToChat({ file: { name, blob } });
        this.toast(this.t('toast_track_shared'));
      } catch (e) {
        console.warn('[Aurora] Error compartiendo pista al chat:', e);
        this.toast(this.t('error_toast').replace('X', e.message || ''));
      }
    },

    /* ============================================================
     *  FIN del bloque de tiempo real
     * ============================================================ */

    /* ============================================================
     *  File picker (input file oculto)
     *  - Se crea UNA sola vez y se reutiliza
     *  - multiple=true para permitir varios archivos
     *  - Soporta selección de carpeta (webkitdirectory)
     *  - Se resetea el value ANTES de click() para que el mismo
     *    archivo pueda seleccionarse otra vez, y DESPUÉS de procesar
     *    para que la próxima apertura empiece limpia.
     * ============================================================ */
    /* Abre el selector de archivos del sistema.
     *   useDirectory    — true para activar el modo "carpeta completa"
     *   targetPlaylistId — ID de playlist a la que añadir las pistas subidas.
     *                      Si es null/undefined, las pistas van a "Mi Música".
     * Creamos un input NUEVO cada vez para evitar problemas de reutilización
     * y asegurar que el click() se ejecute dentro del gesto de usuario. */
    openFilePicker(useDirectory, targetPlaylistId) {
      const UPLOADER = window.AuroraUploader;
      const acceptedTypes = (UPLOADER && typeof UPLOADER.ACCEPTED === 'string')
        ? UPLOADER.ACCEPTED
        : '.mp3,.m4a,.flac,.wav,.ogg,.webm,.opus,audio/*';

      // Crear input SIEMPRE nuevo para evitar problemas de reutilización
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.style.display = 'none';

      if (useDirectory) {
        // Modo carpeta: NO usar accept (interfiere en algunos navegadores)
        // y añadir todos los atributos de directorio conocidos.
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
        input.setAttribute('mozdirectory', '');
        input.setAttribute('nwdirectory', '');
      } else {
        input.accept = acceptedTypes + ',.lrc,.txt';
      }

      document.body.appendChild(input);

      input.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          const arr = Array.from(files);
          const destId = targetPlaylistId || null;
          // Filtrar solo archivos de audio + .lrc/.txt si venimos de carpeta
          // (webkitdirectory devuelve TODOS los archivos de la carpeta)
          const filtered = useDirectory
            ? arr.filter(f => {
                const name = f.name.toLowerCase();
                return f.type.startsWith('audio/') ||
                       /\.(mp3|m4a|flac|wav|ogg|webm|opus|lrc|txt)$/i.test(name);
              })
            : arr;
          if (filtered.length > 0) {
            await this.handleFileInput(filtered, useDirectory, destId);
          } else if (useDirectory) {
            this.toast(this.t('toast_load_failed'));
          }
        }
        // Limpiar el input del DOM tras usarlo
        setTimeout(() => { try { input.remove(); } catch (er) {} }, 100);
      });

      // click() dentro del gesto de usuario
      input.click();
    },

    /* ============================================================
     *  Cola inteligente (#4)
     * ============================================================ */

    /* Añadir pista al final de la cola */
    addToQueue(trackId) {
      this.queue.push(trackId);
      this.renderQueue();
      this.toast(this.t('toast_added_to_queue'));
    },

    /* "Reproducir siguiente": inserta en la posición inmediatamente
     * después de la pista actual, desplazando el resto */
    playNext(trackId) {
      const insertAt = this.queueIdx + 1;
      this.queue.splice(insertAt, 0, trackId);
      this.renderQueue();
      this.toast(this.t('toast_play_next'));
    },

    /* Modo "Radio": genera una cola a partir de la pista actual,
     * mezclando pistas del mismo artista/álbum primero, luego el resto */
    startRadio(trackId) {
      const seed = this.tracks.find(t => t.id === trackId);
      if (!seed) return;
      const sameArtist = this.tracks.filter(t => t.id !== trackId && t.artist === seed.artist);
      const sameAlbum = this.tracks.filter(t => t.id !== trackId && t.album === seed.album && t.artist !== seed.artist);
      const others = this.tracks.filter(t =>
        t.id !== trackId && t.artist !== seed.artist && t.album !== seed.album
      );
      // Mezclar cada grupo
      const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
      this.queue = [trackId, ...shuffle(sameArtist), ...shuffle(sameAlbum), ...shuffle(others)];
      this.queueIdx = 0;
      this.playFromQueue(0);
      this.toast(this.t('toast_radio_based') + ' ' + seed.title);
    },

    /* ============================================================
     *  Web Audio API · grafo de audio
     * ============================================================ */
    initAudioGraph() {
      if (this.audioCtx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.audioCtx = new AC();
        this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);

        /* Ecualizador: 5 bandas */
        const bands = [60, 230, 910, 3600, 14000];
        this.eqFilters = bands.map((freq, i) => {
          const f = this.audioCtx.createBiquadFilter();
          f.type = i === 0 ? 'lowshelf' : i === bands.length - 1 ? 'highshelf' : 'peaking';
          f.frequency.value = freq;
          f.Q.value = 1;
          f.gain.value = 0;
          return f;
        });

        /* Cadena: source → eq0 → eq1 → … → analyser → gain → destination */
        let node = this.sourceNode;
        for (const f of this.eqFilters) { node.connect(f); node = f; }

        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;       // 128 bins — mejor resolución
        this.analyser.smoothingTimeConstant = 0.82;
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
        node.connect(this.analyser);

        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.value = 1;
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
      } catch (e) {
        console.warn('[Aurora] Web Audio no disponible, visualizador en modo simulado:', e.message);
        this.audioCtx = null;
      }
    },

    /* ============================================================
     *  Visualizador — DESHABILITADO
     * ============================================================
     *  El visualizador de barras de frecuencia ha sido eliminado por
     *  decisión del usuario. Estos métodos se mantienen como no-ops
     *  para no romper las llamadas existentes en togglePlay/next/etc.
     * ============================================================ */
    buildVisualizer() { /* no-op: visualizador eliminado */ },
    startVisualizer() {
      // Asegurar que el grafo de audio está inicializado (necesario para EQ y volumen)
      if (!this.audioCtx) {
        try { this.initAudioGraph(); } catch (e) {}
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        try { this.audioCtx.resume(); } catch (e) {}
      }
    },
    stopVisualizer() { /* no-op: visualizador eliminado */ },

    /* ============================================================
     *  Ecualizador
     * ============================================================ */
    buildEqualizer() {
      const c = document.getElementById('eqBands');
      if (!c) return;
      c.innerHTML = '';
      const labels = ['60Hz','230Hz','910Hz','3.6k','14k'];
      // #5 Cargar valores guardados
      let savedEq = [0,0,0,0,0];
      try {
        const s = localStorage.getItem('aurora_eq');
        if (s) savedEq = JSON.parse(s);
      } catch (e) {}
      labels.forEach((lbl, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'eq-band';
        const input = document.createElement('input');
        input.type = 'range';
        input.min = -12; input.max = 12; input.value = savedEq[i] || 0; input.step = 1;
        input.addEventListener('input', () => {
          if (this.eqFilters[i]) this.eqFilters[i].gain.value = parseFloat(input.value);
          this.saveEqValues();
        });
        const lab = document.createElement('span');
        lab.className = 'eq-band-label';
        lab.textContent = lbl;
        wrap.appendChild(input);
        wrap.appendChild(lab);
        c.appendChild(wrap);
        // Aplicar valor guardado al filtro
        if (this.eqFilters[i]) this.eqFilters[i].gain.value = savedEq[i] || 0;
      });
    },
    /* #5 Guardar valores del EQ */
    saveEqValues() {
      const inputs = document.querySelectorAll('#eqBands input[type="range"]');
      const vals = Array.from(inputs).map(i => parseFloat(i.value));
      try { localStorage.setItem('aurora_eq', JSON.stringify(vals)); } catch (e) {}
    },
    /* #5 Resetear EQ */
    resetEqValues() {
      const inputs = document.querySelectorAll('#eqBands input[type="range"]');
      inputs.forEach((inp, i) => {
        inp.value = 0;
        if (this.eqFilters[i]) this.eqFilters[i].gain.value = 0;
      });
      this.saveEqValues();
    },

    applyEqPreset(preset) {
      const presets = {
        normal:[0, 0, 0, 0, 0],
        flat:  [0, 0, 0, 0, 0],
        bass:  [6, 4, 0, -2, -3],
        vocal: [-2, 0, 4, 3, 1],
        treble:[-2, -1, 0, 4, 6],
        live:  [3, 1, 0, 2, 4]
      };
      const vals = presets[preset] || presets.flat;
      const inputs = document.querySelectorAll('#eqBands input[type="range"]');
      inputs.forEach((inp, i) => {
        inp.value = vals[i];
        if (this.eqFilters[i]) this.eqFilters[i].gain.value = vals[i];
      });
      document.querySelectorAll('.eq-preset').forEach(b => b.classList.toggle('active', b.dataset.preset === preset));
    },

    /* ============================================================
     *  Reproducción
     * ============================================================ */
    /* Reproduce una pista concreta.
     *   context — opcional: { type: 'playlist'|'favorites'|'all'|'queue', id?, name? }
     *             Indica desde qué lista se reproduce, para mostrarlo en la UI.
     * Si el contexto es 'playlist' o 'favorites', la cola se reemplaza por
     * las pistas de esa lista (no por todas las de la biblioteca). */
    playTrack(trackId, context) {
      const idx = this.tracks.findIndex(t => t.id === trackId);
      if (idx < 0) return;
      this.currentTrackIdx = idx;
      this.currentTrack = this.tracks[idx];

      // Determinar la cola según el contexto
      if (context && context.type === 'playlist' && context.id) {
        // Cola = pistas de esa playlist (en orden), filtrando las que existen
        const pl = this.playlists.find(p => p.id === context.id);
        if (pl) {
          this.queue = pl.trackIds.filter(id => this.tracks.some(t => t.id === id));
          const qIdx = this.queue.indexOf(trackId);
          this.queueIdx = qIdx >= 0 ? qIdx : 0;
        } else {
          this.queue = [trackId];
          this.queueIdx = 0;
        }
      } else if (context && context.type === 'favorites') {
        // Cola = pistas favoritas
        const favIds = this.tracks.filter(t => this.favorites.has(t.id)).map(t => t.id);
        this.queue = favIds;
        const qIdx = this.queue.indexOf(trackId);
        this.queueIdx = qIdx >= 0 ? qIdx : 0;
      } else {
        // Sin contexto específico o 'all'/'queue': cola = todas las pistas
        this.queue = this.tracks.map(t => t.id);
        this.queueIdx = idx;
      }

      // Si se pasa contexto, usarlo; si no, mantener el actual
      if (context) this.playContext = context;
      this.loadAndPlay();
    },

    playFromQueue(idx) {
      if (idx < 0 || idx >= this.queue.length) return;
      this.queueIdx = idx;
      const trackId = this.queue[idx];
      const tIdx = this.tracks.findIndex(t => t.id === trackId);
      if (tIdx < 0) return;
      this.currentTrackIdx = tIdx;
      this.currentTrack = this.tracks[tIdx];
      this.loadAndPlay();
    },

    loadAndPlay() {
      const t = this.currentTrack;
      if (!t) return;
      // Asegurar que el gain está a 1 inmediatamente (sin crossfade que retrase)
      if (this.gainNode && this.audioCtx) {
        try {
          const now = this.audioCtx.currentTime;
          this.gainNode.gain.cancelScheduledValues(now);
          this.gainNode.gain.setValueAtTime(1, now);
        } catch (e) {}
      }
      // Asignar src SIEMPRE (no comparar) y reproducir inmediatamente.
      // audio.load() fuerza al navegador a empezar a cargar el nuevo src.
      this.audio.src = t.src;
      this.audio.load();
      // #6 Normalización de volumen
      if (this._normalizeVolume) {
        this.computeTrackGain(t).then(gain => {
          if (this.gainNode && this.audioCtx) {
            try {
              this.gainNode.gain.setValueAtTime(gain, this.audioCtx.currentTime);
            } catch (e) {}
          }
        });
      }
      // #11 Añadir al historial
      this.addToHistory(t.id);
      // #15 Precargar siguiente pista
      this.preloadNextTrack();
      // Reproducir inmediatamente (el audio cargará en paralelo)
      this.togglePlay(true);
      // Los renders se hacen DESPUÉS de iniciar la reproducción
      // para no bloquear el inicio del audio.
      this.renderCurrentTrack();
      this.renderLyrics();
      this.updateMediaSession();
      // Pre-analizar para visualizador (archivos locales blob:)
      this.precomputeVisualizerData(t);
      // Animar el cambio de portada con fundido
      this.animateCoverTransition();
      // Anunciar la acción de reproducción al canal realtime
      const selfName = (window.webxdc && window.webxdc.selfName) || 'Listener';
      this._rtBroadcastAction(selfName + ' played');
    },

    /* Carga la pista actual en el elemento <audio> pero SIN reproducir.
     * Usado al eliminar la pista en reproducción: salta a la siguiente
     * y queda en modo pausa (ready to play). */
    loadTrackPaused() {
      const t = this.currentTrack;
      if (!t) {
        // Sin pista: limpiar
        if (this.audio) {
          try { this.audio.pause(); } catch (e) {}
          this.audio.removeAttribute('src');
          try { this.audio.load(); } catch (e) {}
        }
        this.isPlaying = false;
        this.updatePlayUI();
        return;
      }
      this.audio.src = t.src;
      this.audio.load();
      this.isPlaying = false;
      this.renderCurrentTrack();
      this.renderLyrics();
      this.updateMediaSession();
      this.precomputeVisualizerData(t);
      this.updatePlayUI();
      this.animateCoverTransition();
    },

    /* Animación de transición de portada y fondo (#12) */
    animateCoverTransition() {
      const cover = document.getElementById('coverArt');
      const bg = document.getElementById('bgGradient');
      if (!cover) return;
      cover.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      cover.style.opacity = '0';
      cover.style.transform = 'scale(0.92) rotateY(8deg)';
      setTimeout(() => {
        cover.style.opacity = '1';
        cover.style.transform = 'scale(1) rotateY(0deg)';
        setTimeout(() => {
          cover.style.transition = '';
          cover.style.transform = '';
        }, 400);
      }, 200);
      if (bg) {
        bg.style.transition = 'opacity 0.6s ease';
        bg.style.opacity = '0.2';
        setTimeout(() => { bg.style.opacity = ''; }, 50);
      }
    },

    /* Pre-analizar audio para visualizador — DESHABILITADO
     * El visualizador fue eliminado, pero mantenemos el método como no-op
     * para no romper las llamadas en loadAndPlay() / loadTrackPaused(). */
    async precomputeVisualizerData(track) { /* no-op */ },

    async togglePlay(forcePlay) {
      if (!this.currentTrack) return;
      const wantPlay = forcePlay !== undefined ? forcePlay : !this.isPlaying;
      if (wantPlay) {
        // Inicializar Web Audio al primer play (política iOS)
        // Pero NO esperar al resume antes de play() — llamar play() inmediatamente
        // para que el audio empiece a cargar/reproducir sin retardo.
        if (!this.audioCtx) this.initAudioGraph();
        // Llamar play() inmediatamente (sin await)
        const p = this.audio.play();
        // Resume del audioCtx en paralelo (no bloquea el play)
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          try { this.audioCtx.resume(); } catch (e) {}
        }
        if (p && p.then) {
          p.then(() => {
            this.isPlaying = true;
            // Setear gain a 1 inmediatamente (sin fundido de entrada que retrase)
            if (this.gainNode && this.audioCtx) {
              try {
                const now = this.audioCtx.currentTime;
                this.gainNode.gain.cancelScheduledValues(now);
                this.gainNode.gain.setValueAtTime(1, now);
              } catch (e) {}
            }
            this.updatePlayUI();
            this.startVisualizer();
            this.requestWakeLock();
            this.trackPlayStarted();
            // Anunciar al canal realtime (solo si el play NO vino de un sync)
            if (!this._rtSuppressBroadcast) {
              const sn = (window.webxdc && window.webxdc.selfName) || 'Listener';
              this._rtBroadcastAction(sn + ' played');
            }
          }).catch((e) => {
            console.warn('[Aurora] play() rechazado:', e.message);
            this._lastError = { msg: 'play() rechazado: ' + e.message, ts: Date.now() };
            this.isPlaying = false;
            this.updatePlayUI();
          });
        }
      } else {
        // Fundido de salida si crossfade activo
        if (this.crossfadeEnabled && this.gainNode && this.audioCtx) {
          try {
            const now = this.audioCtx.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            this.gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
            setTimeout(() => {
              this.audio.pause();
              if (this.gainNode) this.gainNode.gain.value = 1;
            }, 300);
          } catch (e) {
            this.audio.pause();
          }
        } else {
          this.audio.pause();
        }
        this.isPlaying = false;
        this.updatePlayUI();
        this.stopVisualizer();
        this.releaseWakeLock();
        this.trackPlayStopped();
        // Anunciar al canal realtime (solo si la pausa NO vino de un sync)
        if (!this._rtSuppressBroadcast) {
          const sn = (window.webxdc && window.webxdc.selfName) || 'Listener';
          this._rtBroadcastAction(sn + ' paused');
        }
      }
    },

    /* Detener la reproducción por completo (pausa + reset a 0) sin tocar la cola.
     * Usado cuando la pista actual se quita manualmente de la cola. */
    stopPlayback() {
      try {
        if (this.audio) {
          this.audio.pause();
          try { this.audio.currentTime = 0; } catch (e) {}
        }
      } catch (e) {}
      this.isPlaying = false;
      this.updatePlayUI();
      this.stopVisualizer();
      this.releaseWakeLock();
      this.trackPlayStopped();
      // Reset visual de la barra de progreso
      const fill = document.getElementById('progressFill');
      if (fill) fill.style.width = '0%';
      const cur = document.getElementById('timeCurrent');
      if (cur) cur.textContent = '0:00';
    },

    /* Salta a la siguiente pista disponible en la cola, o a la anterior
     * si no hay siguiente. La pista cargada queda en MODO PAUSA (lista
     * para reanudar con un toque en ▶). Si no hay ninguna pista más en
     * la cola ni en la biblioteca, el reproductor queda vacío.
     *
     * Usado al eliminar la pista que se está reproduciendo. */
    skipToNextOrPrevPaused() {
      // Caso 1: hay cola con pistas restantes
      if (this.queue.length > 0) {
        // queueIdx ya fue ajustado por deleteTrack/removeFromPlaylist.
        // Asegurar que esté en rango válido.
        if (this.queueIdx >= this.queue.length) this.queueIdx = this.queue.length - 1;
        if (this.queueIdx < 0) this.queueIdx = 0;
        const nextId = this.queue[this.queueIdx];
        const tIdx = this.tracks.findIndex(t => t.id === nextId);
        if (tIdx >= 0) {
          this.currentTrackIdx = tIdx;
          this.currentTrack = this.tracks[tIdx];
          this.loadTrackPaused();
          return;
        }
        // Si la pista no se encontró (poco probable), intentar con la anterior
        if (this.queueIdx > 0) {
          this.queueIdx--;
          const prevId = this.queue[this.queueIdx];
          const ptIdx = this.tracks.findIndex(t => t.id === prevId);
          if (ptIdx >= 0) {
            this.currentTrackIdx = ptIdx;
            this.currentTrack = this.tracks[ptIdx];
            this.loadTrackPaused();
            return;
          }
        }
      }

      // Caso 2: no hay cola, pero sí pistas en la biblioteca
      if (this.tracks.length > 0) {
        // Intentar la siguiente pista de la biblioteca, o la anterior
        let idx = Math.min(this.currentTrackIdx, this.tracks.length - 1);
        if (idx < 0) idx = 0;
        this.currentTrackIdx = idx;
        this.currentTrack = this.tracks[idx];
        // Reconstruir cola con todas las pistas restantes
        this.queue = this.tracks.map(t => t.id);
        this.queueIdx = idx;
        this.loadTrackPaused();
        return;
      }

      // Caso 3: no hay ninguna pista — reproductor vacío
      this.currentTrack = null;
      this.currentTrackIdx = 0;
      this.queueIdx = 0;
      this.queue = [];
      this.showEmptyState();
      this.renderCurrentTrack();
    },

    next(auto) {
      // #4 Intentar gapless si es auto-advance y está habilitado
      if (auto && this._gaplessEnabled && this.gaplessNext()) {
        return;
      }
      if (this.repeat === 'one' && auto) {
        this.audio.currentTime = 0;
        this.togglePlay(true);
        return;
      }
      let nextIdx;
      if (this.shuffle) {
        if (this.queue.length > 1) {
          do { nextIdx = Math.floor(Math.random() * this.queue.length); }
          while (nextIdx === this.queueIdx);
        } else nextIdx = 0;
      } else {
        nextIdx = this.queueIdx + 1;
        if (nextIdx >= this.queue.length) {
          if (this.repeat === 'all' || !auto) {
            nextIdx = 0;
          } else {
            this.togglePlay(false);
            return;
          }
        }
      }
      this.playFromQueue(nextIdx);
      // Anunciar salto al realtime (solo si fue manual)
      if (!this._rtSuppressBroadcast && !auto) {
        const sn = (window.webxdc && window.webxdc.selfName) || 'Listener';
        this._rtBroadcastAction(sn + ' skipped');
      }
    },

    prev() {
      if (this.audio.currentTime > 3) {
        this.audio.currentTime = 0;
        if (!this._rtSuppressBroadcast) {
          const sn = (window.webxdc && window.webxdc.selfName) || 'Listener';
          this._rtBroadcastAction(sn + ' seeked');
        }
        return;
      }
      let prev = this.queueIdx - 1;
      if (prev < 0) prev = this.queue.length - 1;
      this.playFromQueue(prev);
      if (!this._rtSuppressBroadcast) {
        const sn = (window.webxdc && window.webxdc.selfName) || 'Listener';
        this._rtBroadcastAction(sn + ' rewinded');
      }
    },

    seekTo(ratio) {
      if (!this.audio || !this.audio.duration || isNaN(this.audio.duration)) return;
      this.audio.currentTime = ratio * this.audio.duration;
      this.updateProgress();
      // Anunciar seek al realtime (con throttle para no saturar)
      if (!this._rtSuppressBroadcast) {
        if (!this._rtSeekThrottle) {
          this._rtSeekThrottle = (() => {
            let timer = null;
            return () => {
              if (timer) return;
              timer = setTimeout(() => {
                timer = null;
                const sn = (window.webxdc && window.webxdc.selfName) || 'Listener';
                this._rtBroadcastAction(sn + ' seeked');
              }, 400);
            };
          })();
        }
        this._rtSeekThrottle();
      }
    },

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      this.audio.volume = this.volume;
      if (this.gainNode) this.gainNode.gain.value = 1;
      const sv = document.getElementById('volumeSlider');
      const vv = document.getElementById('volumeValue');
      if (sv) sv.value = Math.round(this.volume * 100);
      if (vv) vv.textContent = Math.round(this.volume * 100) + '%';
      try { localStorage.setItem('aurora_volume', String(this.volume)); } catch(e){}
    },

    toggleShuffle() {
      this.shuffle = !this.shuffle;
      document.getElementById('btnShuffle').classList.toggle('active', this.shuffle);
      this.toast(this.shuffle ? this.t('toast_shuffle_on') : this.t('toast_shuffle_off'));
    },

    cycleRepeat() {
      this.repeat = this.repeat === 'off' ? 'all' : this.repeat === 'all' ? 'one' : 'off';
      const btn = document.getElementById('btnRepeat');
      btn.classList.toggle('active', this.repeat !== 'off');
      btn.dataset.mode = this.repeat;
      // Añadir badge "1" si repeat one
      btn.style.position = 'relative';
      const existing = btn.querySelector('.repeat-badge');
      if (this.repeat === 'one') {
        if (!existing) {
          const b = document.createElement('span');
          b.className = 'repeat-badge';
          b.textContent = '1';
          b.style.cssText = 'position:absolute;top:4px;right:4px;font-size:9px;font-weight:700;color:var(--accent);background:var(--bg-1);border-radius:50%;width:12px;height:12px;display:flex;align-items:center;justify-content:center;';
          btn.appendChild(b);
        }
      } else if (existing) existing.remove();
      const repLabel = this.repeat === 'off' ? this.t('toast_repeat_off')
                     : this.repeat === 'all' ? this.t('toast_repeat_all')
                     : this.t('toast_repeat_one');
      this.toast(this.t('repeat') + ': ' + repLabel);
    },

    toggleFavorite() {
      if (!this.currentTrack) return;
      const id = this.currentTrack.id;
      if (this.favorites.has(id)) this.favorites.delete(id);
      else this.favorites.add(id);
      this.saveFavorites();
      this.updateFavoriteUI();
      this.renderFavorites();
      this.toast(this.favorites.has(id) ? this.t('toast_added_fav') : this.t('toast_removed_fav'));
    },

    updateFavoriteUI() {
      const liked = this.currentTrack && this.favorites.has(this.currentTrack.id);
      ['btnLike','btnLike2'].forEach(id => {
        const b = document.getElementById(id);
        if (!b) return;
        b.classList.toggle('liked', liked);
        // Cambiar icono FA: corazón vacío (regular) vs lleno (solid)
        const icon = b.querySelector('i');
        if (icon) {
          if (liked) {
            icon.classList.remove('fa-regular');
            icon.classList.add('fa-solid');
          } else {
            icon.classList.remove('fa-solid');
            icon.classList.add('fa-regular');
          }
        }
      });
    },

    /* ============================================================
     *  UI: render pista actual
     * ============================================================ */
    renderCurrentTrack() {
      const t = this.currentTrack;
      if (!t) {
        // Limpiar UI
        document.getElementById('trackTitle').textContent = '—';
        document.getElementById('trackArtist').textContent = this.t('load_track_to_start');
        document.getElementById('timeTotal').textContent = '0:00';
        document.getElementById('timeCurrent').textContent = '0:00';
        document.getElementById('progressFill').style.width = '0%';
        return;
      }
      document.getElementById('trackTitle').textContent = t.title;
      document.getElementById('trackArtist').textContent = t.artist + (t.album && t.album !== this.t('no_album') ? ' · ' + t.album : '');
      document.getElementById('timeTotal').textContent = this.fmtTime(t.duration);
      document.getElementById('miniTitle').textContent = t.title;
      document.getElementById('miniArtist').textContent = t.artist;
      document.getElementById('lyricsTrackName').textContent = t.title + ' — ' + t.artist;
      // Mostrar contexto de reproducción ("Reproduciendo desde X") o álbum/artista
      const ctxLabel = this.getPlayContextLabel();
      const ctxEl = document.getElementById('nowPlayingContext');
      if (ctxLabel) {
        ctxEl.textContent = this.t('playing_from') + ' · ' + ctxLabel;
      } else if (t.album && t.album !== this.t('no_album')) {
        ctxEl.textContent = t.album;
      } else {
        ctxEl.textContent = t.artist;
      }

      // Colores dinámicos (para el fondo y visualizador)
      const cover = (typeof t.cover === 'object' && t.cover.from) ? t.cover : { from: '#7C3AED', to: '#EC4899', angle: 135 };
      document.documentElement.style.setProperty('--cover-from', cover.from);
      document.documentElement.style.setProperty('--cover-to', cover.to);
      document.documentElement.style.setProperty('--cover-angle', (cover.angle || 135) + 'deg');

      // Portada canvas (imagen si existe, si no, gradiente generado)
      this.drawCover('coverCanvas', t);
      this.drawCover('miniCoverCanvas', t, true);

      // Vinilo en lugar de cover si está reproduciendo
      const ca = document.getElementById('coverArt');
      ca.classList.toggle('playing', this.isPlaying);

      // Favorito
      this.updateFavoriteUI();

      // Render cola
      this.renderQueue();
    },

    drawCover(canvasId, track, mini) {
      const c = document.getElementById(canvasId);
      if (!c) return;
      const ctx = c.getContext('2d');
      const w = c.width, h = c.height;

      // Si la portada es una imagen (dataURL), dibujarla
      const isImage = track.coverIsImage || (typeof track.cover === 'string' && track.cover.startsWith('data:'));
      if (isImage) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, w, h);
          // Modo "cover"
          const ratio = Math.max(w / img.width, h / img.height);
          const dw = img.width * ratio, dh = img.height * ratio;
          ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        };
        img.src = typeof track.cover === 'string' ? track.cover : (track.cover.dataURL || '');
        // Fondo provisional mientras carga
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, w, h);
        return;
      }

      // Generar gradiente dinámico
      const cover = (typeof track.cover === 'object' && track.cover.from) ? track.cover : { from: '#7C3AED', to: '#EC4899' };
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, cover.from);
      grad.addColorStop(1, cover.to);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Patrón de ondas circulares
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = mini ? 1 : 2;
      const cx = w / 2, cy = h / 2;
      for (let r = 30; r < Math.max(w, h); r += 30) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Letra inicial
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#fff';
      ctx.font = (mini ? '700 38px ' : '900 220px ') + "'Space Grotesk', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(track.title.charAt(0).toUpperCase(), cx, cy);
      ctx.globalAlpha = 1;
    },

    updatePlayUI() {
      const play = document.getElementById('btnPlay');
      const playLyrics = document.getElementById('btnPlayLyrics');
      [play, playLyrics].forEach(b => {
        if (!b) return;
        const ip = b.querySelector('.icon-play');
        const ips = b.querySelector('.icon-pause');
        if (this.isPlaying) {
          if (ip) ip.style.display = 'none';
          if (ips) ips.style.display = 'block';
        } else {
          if (ip) ip.style.display = 'block';
          if (ips) ips.style.display = 'none';
        }
      });
      const ca = document.getElementById('coverArt');
      if (ca) ca.classList.toggle('playing', this.isPlaying);

      // Visibilidad de las acciones del menú "Más opciones" según haya pista
      // actual. Si no hay pista (estado vacío), las acciones contextuales
      // (ir al artista, añadir a lista) no tienen sentido y se ocultan.
      const hasTrack = !!(this.currentTrack);
      const contextualMenuIds = ['menuAddToPlaylist', 'menuGoToArtist'];
      contextualMenuIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = hasTrack ? '' : 'none';
      });
    },

    updateProgress() {
      const a = this.audio;
      const cur = a.currentTime || 0;
      const dur = a.duration || this.currentTrack?.duration || 0;
      const pct = dur > 0 ? (cur / dur) * 100 : 0;
      const fill = document.getElementById('progressFill');
      const curEl = document.getElementById('timeCurrent');
      if (fill) fill.style.width = pct + '%';
      if (curEl) curEl.textContent = this.fmtTime(cur);

      // Buffer
      const buf = document.getElementById('progressBuffer');
      if (buf && a.buffered && a.buffered.length > 0) {
        try {
          const end = a.buffered.end(a.buffered.length - 1);
          buf.style.width = ((end / dur) * 100) + '%';
        } catch (e) {}
      }

      // Letras: el RAF loop (startLrcRafSync) ya llama a updateLyricsHighlight
      // en cada frame, no necesitamos llamarlo también desde aquí.
    },

    fmtTime(s) {
      if (!s || isNaN(s)) return '0:00';
      s = Math.floor(s);
      const m = Math.floor(s / 60);
      const r = s % 60;
      return m + ':' + (r < 10 ? '0' : '') + r;
    },

    /* ============================================================
     *  Letras LRC
     * ============================================================
     *  Soporta dos tipos de letras:
     *   1. LRC sincronizado: líneas con timestamps [mm:ss.xx]texto
     *   2. Texto plano: líneas sin timestamps (de USLT ID3)
     *  El parser marca cada línea como timed/untimed para que el
     *  highlight sepa si sincronizar o mostrar estático.
     * ============================================================ */
    /* ============================================================
     *  Parser LRC tolerante (#21)
     * ============================================================
     *  Soporta:
     *   - Timestamps múltiples en una línea: [00:01.00][00:15.00]Letra
     *   - Metadata LRC: [ar:], [ti:], [al:], [by:], [offset:], etc.
     *   - Compensación [offset:] aplicada a todos los timestamps
     *   - Espacios irregulares y formatos variados
     *   - Líneas de texto plano (sin timestamp)
     *   - Traducciones embebidas (formato [tr:xx] o doble línea)
     * ============================================================ */
    parseLrc(arr) {
      if (!arr || !arr.length) return [];
      // Si arr es un string (no array), dividirlo por líneas
      if (typeof arr === 'string') {
        arr = arr.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      }
      const result = [];
      let hasTimed = false;
      let globalOffset = 0;

      // Primera pasada: detectar offset global
      for (const line of arr) {
        if (typeof line !== 'string') continue;
        const offMatch = line.match(/\[offset:\s*(-?\d+)\s*\]/i);
        if (offMatch) {
          globalOffset = parseInt(offMatch[1]) / 1000;
        }
      }

      // Segunda pasada: parsear líneas
      for (const line of arr) {
        if (typeof line !== 'string') continue;
        const trimmed = line.trim();
        if (!trimmed) {
          if (hasTimed) {
            result.push({ time: -1, text: '', timed: false });
          }
          continue;
        }

        // Saltar metadata LRC pura
        if (/^\[(ar|ti|al|by|offset|length|re|ve|id):/i.test(trimmed)) continue;

        // Buscar TODOS los timestamps en la línea.
        // Soporta: [mm:ss.xx], [mm:ss], [m:ss.xx], [m:ss], [h:mm:ss.xx]
        const timestampRegex = /\[(\d+):(\d{1,2}(?:\.\d+)?)\]/g;
        const stamps = [];
        let m;
        while ((m = timestampRegex.exec(trimmed)) !== null) {
          stamps.push({
            time: parseInt(m[1]) * 60 + parseFloat(m[2]) + globalOffset,
            match: m[0]
          });
        }

        if (stamps.length > 0) {
          hasTimed = true;
          const lastStampEnd = trimmed.lastIndexOf(stamps[stamps.length - 1].match) + stamps[stamps.length - 1].match.length;
          const text = trimmed.substring(lastStampEnd).trim();
          for (const stamp of stamps) {
            result.push({
              time: Math.max(0, stamp.time),
              text: text,
              timed: true
            });
          }
        } else {
          // Línea de texto plano (sin timestamp)
          result.push({
            time: -1,
            text: trimmed,
            timed: false
          });
        }
      }

      // Si hay timestamps, ordenar por tiempo
      if (hasTimed) {
        result.sort((a, b) => {
          const ta = a.timed ? a.time : 0;
          const tb = b.timed ? b.time : 0;
          return ta - tb;
        });
      }
      result.hasTimed = hasTimed;
      return result;
    },

    /* ============================================================
     *  Render de letras con todas las mejoras
     * ============================================================ */
    renderLyrics() {
      const cont = document.getElementById('lyricsContent');
      if (!cont) return;
      cont.innerHTML = '';
      const t = this.currentTrack;

      // Aplicar tamaño de fuente guardado
      const scroll = document.getElementById('lyricsScroll');
      if (scroll) scroll.style.setProperty('--lrc-font-size', this.lrcFontSize + 'px');

      if (!t || !t.lrc || (Array.isArray(t.lrc) && t.lrc.length === 0)) {
        cont.innerHTML = '<div class="lrc-line untimed">' + this.t('lrc_no_lyrics') + '</div>';
        this.lrcLines = [];
        this.lrcHasTimed = false;
        return;
      }

      // Cache: si ya tenemos las líneas parseadas para esta pista, reutilizar
      if (t._lrcCache && t._lrcCacheKey === JSON.stringify(t.lrc)) {
        this.lrcLines = t._lrcCache;
        this.lrcHasTimed = !!t._lrcCache.hasTimed;
      } else {
        this.lrcLines = this.parseLrc(t.lrc);
        this.lrcHasTimed = !!this.lrcLines.hasTimed;
        t._lrcCache = this.lrcLines;
        t._lrcCacheKey = JSON.stringify(t.lrc);
      }

      if (this.lrcLines.length === 0) {
        cont.innerHTML = '<div class="lrc-line untimed">' + this.t('lrc_no_lyrics') + '</div>';
        return;
      }

      // Badge de estado (sincronizada / no sincronizada)
      if (!this.lrcHasTimed) {
        const badge = document.createElement('div');
        badge.className = 'lrc-status-badge';
        badge.textContent = this.t('lrc_not_synced');
        cont.appendChild(badge);
      }

      this.lrcLines.forEach((l, i) => {
        const div = document.createElement('div');
        div.className = 'lrc-line';
        if (!l.text) div.classList.add('empty');
        if (!this.lrcHasTimed) div.classList.add('untimed');
        div.textContent = l.text || '♪';
        div.dataset.idx = i;
        // Tap en una línea con timestamp → saltar a ese punto (#11)
        if (l.timed && l.time >= 0) {
          div.addEventListener('click', () => {
            this.seekTo(l.time / (this.audio.duration || 1));
            if (navigator.vibrate) navigator.vibrate(10);  // #26 vibración
          });
        }
        cont.appendChild(div);
      });

      this.activeLrcIdx = -1;
      this._lastActiveKey = '';
      this._lrcLineEls = null;  // invalidar caché de elementos DOM
      // Iniciar sincronización con RAF (#22)
      this.startLrcRafSync();
      // Detectar scroll manual del usuario (#13)
      this.wireLyricsUserScroll();
    },

    /* Sincronización precisa con requestAnimationFrame (#22) */
    startLrcRafSync() {
      if (this.lrcRafId) cancelAnimationFrame(this.lrcRafId);
      if (!this.lrcHasTimed) return;
      const tick = () => {
        // Solo actualizar si hay audio y está cargado
        if (this.audio && this.currentTrack) {
          // cur = tiempo actual - offset (offset positivo = letra adelantada)
          const cur = (this.audio.currentTime || 0) - this.lrcOffset;
          this.updateLyricsHighlight(cur);
          // Loop de sección (#19)
          if (this.lrcLoop && this.lrcLines[this.lrcLoop.endIdx]) {
            const endTime = this.lrcLines[this.lrcLoop.endIdx].time;
            if (cur >= endTime + 0.1) {
              const startTime = this.lrcLines[this.lrcLoop.startIdx].time;
              this.audio.currentTime = Math.max(0, startTime + this.lrcOffset);
            }
          }
        }
        this.lrcRafId = requestAnimationFrame(tick);
      };
      tick();
    },

    /* Detecta cuando el usuario hace scroll manual para pausar el auto-scroll (#13) */
    wireLyricsUserScroll() {
      const sc = document.getElementById('lyricsScroll');
      if (!sc || sc._userScrollWired) return;
      sc._userScrollWired = true;
      let scrollTimer = null;
      sc.addEventListener('scroll', () => {
        // Si el scroll fue provocado por JS (auto-scroll), ignorar
        if (this._autoScrolling) return;
        this.lrcUserScrolling = true;
        sc.classList.add('user-scrolling');
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          this.lrcUserScrolling = false;
          sc.classList.remove('user-scrolling');
        }, 3000);  // Reanudar auto-scroll tras 3s sin tocar
      }, { passive: true });
    },

    /* Actualiza el highlight y el scroll de las letras.
     * Usa búsqueda LINEAL (no binaria) porque el array puede tener
     * líneas timed y untimed mezcladas, lo que rompe la búsqueda binaria. */
    updateLyricsHighlight(cur) {
      if (!this.lrcLines.length || !this.lrcHasTimed) return;

      // === BÚSQUEDA LINEAL del índice activo ===
      // Encontrar la última línea timed con time <= cur.
      // Es O(n) pero para 50-100 líneas a 60fps es insignificante.
      let idx = -1;
      for (let i = 0; i < this.lrcLines.length; i++) {
        const l = this.lrcLines[i];
        if (l.timed && l.time <= cur) {
          idx = i;
        } else if (l.timed && l.time > cur) {
          break;
        }
      }

      if (idx < 0) {
        if (this.activeLrcIdx !== -1) {
          this.activeLrcIdx = -1;
          this._lastActiveKey = '';
          // Limpiar clases usando caché
          if (this._lrcLineEls) {
            for (let i = 0; i < this._lrcLineEls.length; i++) {
              const el = this._lrcLineEls[i];
              el.className = 'lrc-line' + (this.lrcLines[i] && !this.lrcLines[i].timed ? ' untimed' : '');
            }
          }
        }
        return;
      }

      // === Buscar líneas con el mismo timestamp (solo mirar alrededor de idx) ===
      const activeTime = this.lrcLines[idx].time;
      const activeIndices = [idx];
      // Buscar hacia atrás
      for (let i = idx - 1; i >= 0; i--) {
        if (this.lrcLines[i].timed && Math.abs(this.lrcLines[i].time - activeTime) < 0.01) {
          activeIndices.unshift(i);
        } else break;
      }
      // Buscar hacia adelante
      for (let i = idx + 1; i < this.lrcLines.length; i++) {
        if (this.lrcLines[i].timed && Math.abs(this.lrcLines[i].time - activeTime) < 0.01) {
          activeIndices.push(i);
        } else break;
      }

      // === Solo actualizar DOM si cambió la línea activa ===
      const key = activeIndices[0] + '';  // clave simple: primer índice
      if (key !== this._lastActiveKey) {
        this._lastActiveKey = key;
        this.activeLrcIdx = idx;

        // Usar caché de elementos DOM si existe, sino crearla
        if (!this._lrcLineEls) {
          const cont = document.getElementById('lyricsContent');
          if (cont) this._lrcLineEls = Array.from(cont.children);
        }

        if (this._lrcLineEls) {
          const firstActive = activeIndices[0];
          const lastActive = activeIndices[activeIndices.length - 1];
          for (let i = 0; i < this._lrcLineEls.length; i++) {
            const el = this._lrcLineEls[i];
            const isActive = (i >= firstActive && i <= lastActive);
            // Calcular distancia mínima al rango activo
            let minDist;
            if (i < firstActive) minDist = firstActive - i;
            else if (i > lastActive) minDist = i - lastActive;
            else minDist = 0;

            // Actualizar clases de forma eficiente (solo si cambiaron)
            const hasActive = el.classList.contains('active');
            const hasNear = el.classList.contains('near');
            const hasNear2 = el.classList.contains('near-2');

            if (isActive !== hasActive) el.classList.toggle('active', isActive);
            const shouldNear = !isActive && minDist === 1;
            if (shouldNear !== hasNear) el.classList.toggle('near', shouldNear);
            const shouldNear2 = !isActive && minDist === 2;
            if (shouldNear2 !== hasNear2) el.classList.toggle('near-2', shouldNear2);
          }
        }
      }

      // === SCROLL: interpolar hacia el objetivo en cada frame ===
      if (!this.lrcUserScrolling && activeIndices.length > 0 && this._lrcLineEls) {
        const sc = document.getElementById('lyricsScroll');
        if (sc) {
          const firstActiveEl = this._lrcLineEls[activeIndices[0]];
          if (firstActiveEl) {
            const isFullscreen = document.getElementById('viewLyrics').classList.contains('lyrics-fullscreen');
            const offsetUp = isFullscreen ? 0 : sc.clientHeight * -0.25;
            const targetTop = firstActiveEl.offsetTop - (sc.clientHeight / 2) + (firstActiveEl.clientHeight / 2) - offsetUp;
            const current = sc.scrollTop;
            const diff = targetTop - current;
            if (Math.abs(diff) > 0.5) {
              this._autoScrolling = true;
              sc.scrollTop = current + diff * 0.5;
            } else {
              this._autoScrolling = false;
            }
          }
        }
      }
    },

    /* ============================================================
     *  Cargar .lrc externo (#1)
     * ============================================================ */
    loadExternalLrc() {
      let input = document.getElementById('lrcFileInput');
      if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'lrcFileInput';
        input.accept = '.lrc,.txt';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            const text = await file.text();
            if (this.currentTrack) {
              const lines = text.split(/\r?\n/);
              this.currentTrack.lrc = lines;
              // Invalidar caché
              this.currentTrack._lrcCache = null;
              this.persistTrack(this.currentTrack);
              this.renderLyrics();
              this.toast(this.t('lrc_loaded'));
            }
          } catch (err) {
            this.toast(this.t('toast_load_error'));
          }
          e.target.value = '';
        });
      }
      input.value = '';
      input.click();
    },

    /* ============================================================
     *  Editor de letras (#2)
     * ============================================================ */
    openLrcEditor() {
      const ta = document.getElementById('lrcEditorText');
      if (!ta) return;
      // Rellenar con la letra actual (si existe)
      if (this.currentTrack && this.currentTrack.lrc) {
        const lines = Array.isArray(this.currentTrack.lrc) ? this.currentTrack.lrc : [this.currentTrack.lrc];
        ta.value = lines.join('\n');
      } else {
        ta.value = '';
      }
      this.openSheet('sheetLrcEditor');
    },

    saveLrcFromEditor() {
      const ta = document.getElementById('lrcEditorText');
      if (!ta || !this.currentTrack) return;
      const text = ta.value.trim();
      if (!text) {
        this.currentTrack.lrc = null;
      } else {
        this.currentTrack.lrc = text.split(/\r?\n/);
      }
      this.currentTrack._lrcCache = null;
      this.persistTrack(this.currentTrack);
      this.renderLyrics();
      this.closeSheet('sheetLrcEditor');
      this.toast(this.t('lrc_saved'));
    },

    /* ============================================================
     *  Ajuste de offset manual (#12)
     * ============================================================ */
    adjustLrcOffset(delta) {
      this.lrcOffset += delta;
      // Persistir por pista
      if (this.currentTrack) {
        this.currentTrack.lrcOffset = this.lrcOffset;
        this.persistTrack(this.currentTrack);
      }
      const sign = this.lrcOffset >= 0 ? '+' : '';
      this.toast(this.t('lrc_offset_toast').replace('X', sign + this.lrcOffset.toFixed(1) + 's'));
    },
    resetLrcOffset() {
      // Reset COMPLETO: deshace todos los cambios hechos en la vista de letras
      // (offset, tamaño de fuente, velocidad, loop)
      // 1. Offset
      this.lrcOffset = 0;
      if (this.currentTrack) {
        this.currentTrack.lrcOffset = 0;
        this.persistTrack(this.currentTrack);
      }
      // 2. Tamaño de fuente → valor por defecto
      this.setLrcFontSize(19);
      try { localStorage.removeItem('aurora_lrc_fontsize'); } catch (e) {}
      // 3. Velocidad → 1.0×
      this.setPlaybackRate(1.0);
      try { localStorage.removeItem('aurora_playback_rate'); } catch (e) {}
      // 4. Loop de sección
      this.clearLyricsLoop();
      // 5. Salir de pantalla completa si estaba activa
      const view = document.getElementById('viewLyrics');
      if (view && view.classList.contains('lyrics-fullscreen')) {
        view.classList.remove('lyrics-fullscreen');
      }
      // Re-renderizar para aplicar cambios visuales
      this.renderLyrics();
      this.toast(this.t('lrc_offset_reset'));
    },

    /* ============================================================
     *  Tamaño de fuente ajustable (#7)
     * ============================================================ */
    setLrcFontSize(size) {
      this.lrcFontSize = Math.max(12, Math.min(32, size));
      try { localStorage.setItem('aurora_lrc_fontsize', this.lrcFontSize); } catch (e) {}
      // Setear la variable CSS en todos los contenedores relevantes
      const scroll = document.getElementById('lyricsScroll');
      const content = document.getElementById('lyricsContent');
      const val = this.lrcFontSize + 'px';
      if (scroll) scroll.style.setProperty('--lrc-font-size', val);
      if (content) content.style.setProperty('--lrc-font-size', val);
    },

    /* ============================================================
     *  Pantalla completa / modo inmersivo (#14)
     * ============================================================ */
    toggleLyricsFullscreen() {
      const view = document.getElementById('viewLyrics');
      if (!view) return;
      view.classList.toggle('lyrics-fullscreen');
      // Asegurar wake lock (#15)
      if (view.classList.contains('lyrics-fullscreen')) {
        this.requestWakeLock();
      }
    },

    /* ============================================================
     *  Ajuste de velocidad de reproducción (#18)
     * ============================================================ */
    setPlaybackRate(rate) {
      this.playbackRate = Math.max(0.5, Math.min(2.0, Math.round(rate * 10) / 10));
      if (this.audio) this.audio.playbackRate = this.playbackRate;
      const label = document.getElementById('lrcSpeedLabel');
      if (label) label.textContent = this.playbackRate.toFixed(1) + '×';
      try { localStorage.setItem('aurora_playback_rate', this.playbackRate); } catch (e) {}
    },

    /* ============================================================
     *  Loop de sección (#19)
     * ============================================================ */
    toggleLyricsLoop() {
      if (this.lrcLoop) {
        this.clearLyricsLoop();
        return;
      }
      // Si no hay loop activo, marcar desde la línea actual hasta 10 líneas después
      if (this.activeLrcIdx < 0 || !this.lrcHasTimed) {
        this.toast(this.t('lrc_loop_section'));
        return;
      }
      const endIdx = Math.min(this.activeLrcIdx + 8, this.lrcLines.length - 1);
      // Buscar la siguiente línea con timestamp para el final
      let actualEnd = endIdx;
      for (let i = this.activeLrcIdx + 1; i <= endIdx; i++) {
        if (this.lrcLines[i] && this.lrcLines[i].timed) actualEnd = i;
      }
      this.lrcLoop = { startIdx: this.activeLrcIdx, endIdx: actualEnd };
      const indicator = document.getElementById('lyricsLoopIndicator');
      const text = document.getElementById('lyricsLoopText');
      if (indicator && text) {
        const startT = this.fmtTime(this.lrcLines[this.activeLrcIdx].time);
        const endT = this.fmtTime(this.lrcLines[actualEnd].time);
        text.textContent = this.t('lrc_loop_section') + ': ' + startT + ' → ' + endT;
        indicator.style.display = 'flex';
      }
      const btn = document.getElementById('btnLrcLoop');
      if (btn) btn.classList.add('active');
    },
    clearLyricsLoop() {
      this.lrcLoop = null;
      const indicator = document.getElementById('lyricsLoopIndicator');
      if (indicator) indicator.style.display = 'none';
      const btn = document.getElementById('btnLrcLoop');
      if (btn) btn.classList.remove('active');
    },

    /* ============================================================
     *  Restaurar offset y tamaño de fuente guardados al cargar pista
     * ============================================================ */
    restoreLyricsPrefs() {
      try {
        const fs = localStorage.getItem('aurora_lrc_fontsize');
        if (fs) this.lrcFontSize = parseInt(fs);
      } catch (e) {}
      try {
        const pr = localStorage.getItem('aurora_playback_rate');
        if (pr) {
          this.playbackRate = parseFloat(pr);
          if (this.audio) this.audio.playbackRate = this.playbackRate;
          const label = document.getElementById('lrcSpeedLabel');
          if (label) label.textContent = this.playbackRate.toFixed(1) + '×';
        }
      } catch (e) {}
      // Offset por pista
      if (this.currentTrack && this.currentTrack.lrcOffset) {
        this.lrcOffset = this.currentTrack.lrcOffset;
      } else {
        this.lrcOffset = 0;
      }
    },

    /* ============================================================
     *  Render listas UI
    },

    /* ============================================================
     *  Render listas UI
     * ============================================================ */
    drawRowCover(canvas, track) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const isImage = track.coverIsImage || (typeof track.cover === 'string' && track.cover.startsWith('data:'));

      if (isImage) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0,0,W,H);
          const r = Math.max(W/img.width, H/img.height);
          const dw = img.width*r, dh = img.height*r;
          ctx.drawImage(img, (W-dw)/2, (H-dh)/2, dw, dh);
        };
        img.src = typeof track.cover === 'string' ? track.cover : '';
        ctx.fillStyle = '#222'; ctx.fillRect(0,0,W,H);
        return;
      }

      const cover = (typeof track.cover === 'object' && track.cover.from) ? track.cover : { from: '#7C3AED', to: '#EC4899' };
      const g = ctx.createLinearGradient(0,0,W,H);
      g.addColorStop(0, cover.from); g.addColorStop(1, cover.to);
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = "700 " + Math.floor(H*0.5) + "px sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(track.title.charAt(0).toUpperCase(), W/2, H/2);
    },

    /* ============================================================
     *  Cover de playlist — collage de 8 covers al azar
     * ============================================================
     *  Devuelve:
     *    - dataURL (string) si pudo construir un collage con al menos
     *      una pista que tenga cover de imagen.
     *    - { from, to, angle } si ninguna pista tiene cover de imagen
     *      (usa el gradiente por defecto de la playlist).
     *  El resultado se cachea en pl._coverCache y se invalida cuando
     *  cambian los trackIds (comparación por longitud + hash simple). */
    getPlaylistCover(pl) {
      // Recoger todas las pistas reales de la playlist
      const tracks = (pl.trackIds || [])
        .map(id => this.tracks.find(t => t.id === id))
        .filter(Boolean);
      // Filtrar las que SÍ tienen cover de imagen (dataURL)
      const withImage = tracks.filter(t => t.coverIsImage || (typeof t.cover === 'string' && t.cover.startsWith('data:')));

      // Si no hay ninguna con imagen, devolver el gradiente por defecto
      if (withImage.length === 0) {
        return pl.cover || { from: '#7C3AED', to: '#EC4899', angle: 135 };
      }

      // Hash simple de los trackIds para invalidar caché cuando cambia la lista
      const hash = pl.trackIds.slice().sort().join('|') + '#' + withImage.length;
      if (pl._coverCache && pl._coverCacheHash === hash) {
        return pl._coverCache;
      }

      // Construir collage: tomar hasta 7 covers al azar de las que tienen imagen
      const SIZE = 256;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d');

      // Seleccionar hasta 8 imágenes (al azar, sin repetir)
      const shuffled = withImage.slice().sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(8, shuffled.length));
      const n = selected.length;

      // Dibujar las imágenes sincrónicamente si ya están cargadas.
      // Como las covers son dataURLs, precargamos todas y luego pintamos.
      const drawCollage = (images) => {
        // Fondo oscuro por si quedan huecos
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, SIZE, SIZE);

        if (n === 1) {
          // Una sola: ocupa todo
          this._drawImageCover(ctx, images[0], 0, 0, SIZE, SIZE);
        } else if (n === 2) {
          // Dos: una arriba, una abajo
          this._drawImageCover(ctx, images[0], 0, 0, SIZE, SIZE/2);
          this._drawImageCover(ctx, images[1], 0, SIZE/2, SIZE, SIZE/2);
        } else if (n === 3) {
          // Tres: una grande arriba, dos pequeñas abajo
          this._drawImageCover(ctx, images[0], 0, 0, SIZE, SIZE*0.6);
          this._drawImageCover(ctx, images[1], 0, SIZE*0.6, SIZE/2, SIZE*0.4);
          this._drawImageCover(ctx, images[2], SIZE/2, SIZE*0.6, SIZE/2, SIZE*0.4);
        } else if (n === 4) {
          // Cuatro: cuadrícula 2x2
          this._drawImageCover(ctx, images[0], 0, 0, SIZE/2, SIZE/2);
          this._drawImageCover(ctx, images[1], SIZE/2, 0, SIZE/2, SIZE/2);
          this._drawImageCover(ctx, images[2], 0, SIZE/2, SIZE/2, SIZE/2);
          this._drawImageCover(ctx, images[3], SIZE/2, SIZE/2, SIZE/2, SIZE/2);
        } else if (n === 5 || n === 6) {
          // 5-6: una grande arriba + cuadrícula abajo
          // Fila superior: una imagen ancha (toda la anchura, mitad de altura)
          this._drawImageCover(ctx, images[0], 0, 0, SIZE, SIZE/2);
          // Fila inferior: hasta 5 imágenes en cuadrícula
          const cols = n - 1; // 4 o 5
          const cellW = SIZE / cols;
          for (let i = 1; i < n; i++) {
            this._drawImageCover(ctx, images[i], (i-1) * cellW, SIZE/2, cellW, SIZE/2);
          }
        } else if (n === 7) {
          // 7: cuadrícula 4+3 (4 arriba, 3 abajo)
          const cols = 4;
          const cellW = SIZE / cols;
          this._drawImageCover(ctx, images[0], 0, 0, cellW, SIZE/2);
          this._drawImageCover(ctx, images[1], cellW, 0, cellW, SIZE/2);
          this._drawImageCover(ctx, images[2], 2*cellW, 0, cellW, SIZE/2);
          this._drawImageCover(ctx, images[3], 3*cellW, 0, cellW, SIZE/2);
          // 3 abajo, centradas
          const off = (SIZE - 3*cellW) / 2;
          this._drawImageCover(ctx, images[4], off, SIZE/2, cellW, SIZE/2);
          this._drawImageCover(ctx, images[5], off + cellW, SIZE/2, cellW, SIZE/2);
          this._drawImageCover(ctx, images[6], off + 2*cellW, SIZE/2, cellW, SIZE/2);
        } else {
          // 8 (caso por defecto): cuadrícula 4x2
          const cols = 4, rows = 2;
          const cellW = SIZE / cols;
          const cellH = SIZE / rows;
          for (let i = 0; i < n; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            this._drawImageCover(ctx, images[i], col * cellW, row * cellH, cellW, cellH);
          }
        }
        // Separadores sutiles entre celdas (líneas oscuras)
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 2;
        if (n === 2) {
          ctx.beginPath(); ctx.moveTo(0, SIZE/2); ctx.lineTo(SIZE, SIZE/2); ctx.stroke();
        } else if (n === 3) {
          ctx.beginPath(); ctx.moveTo(0, SIZE*0.6); ctx.lineTo(SIZE, SIZE*0.6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(SIZE/2, SIZE*0.6); ctx.lineTo(SIZE/2, SIZE); ctx.stroke();
        } else if (n === 4) {
          ctx.beginPath(); ctx.moveTo(SIZE/2, 0); ctx.lineTo(SIZE/2, SIZE); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, SIZE/2); ctx.lineTo(SIZE, SIZE/2); ctx.stroke();
        } else if (n === 5 || n === 6) {
          // Separador horizontal en la mitad + verticales en la fila inferior
          ctx.beginPath(); ctx.moveTo(0, SIZE/2); ctx.lineTo(SIZE, SIZE/2); ctx.stroke();
          const cols = n - 1;
          const cellW = SIZE / cols;
          for (let i = 1; i < cols; i++) {
            ctx.beginPath(); ctx.moveTo(i*cellW, SIZE/2); ctx.lineTo(i*cellW, SIZE); ctx.stroke();
          }
        } else if (n === 7) {
          ctx.beginPath(); ctx.moveTo(0, SIZE/2); ctx.lineTo(SIZE, SIZE/2); ctx.stroke();
          const cols = 4;
          const cellW = SIZE / cols;
          for (let i = 1; i < cols; i++) {
            ctx.beginPath(); ctx.moveTo(i*cellW, 0); ctx.lineTo(i*cellW, SIZE/2); ctx.stroke();
          }
        } else {
          // 8: cuadrícula 4x2 con separadores
          const cols = 4, rows = 2;
          const cellW = SIZE / cols;
          const cellH = SIZE / rows;
          for (let i = 1; i < cols; i++) {
            ctx.beginPath(); ctx.moveTo(i*cellW, 0); ctx.lineTo(i*cellW, SIZE); ctx.stroke();
          }
          ctx.beginPath(); ctx.moveTo(0, cellH); ctx.lineTo(SIZE, cellH); ctx.stroke();
        }
      };

      // Precargar todas las imágenes y luego pintar
      // Promise.all() convierte el array de promesas en una sola promesa
      // que se resuelve cuando todas han terminado.
      const promises = Promise.all(selected.map(t => {
        return new Promise(resolve => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = typeof t.cover === 'string' ? t.cover : '';
        });
      }));

      // Como getPlaylistCover es sincrónico, devolvemos el gradiente ahora
      // y disparamos la generación asíncrona que actualizará el DOM.
      promises.then(images => {
        const valid = images.filter(Boolean);
        if (valid.length === 0) return;
        drawCollage(valid);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        pl._coverCache = dataUrl;
        pl._coverCacheHash = hash;
        // Re-render para que aparezca el collage
        this.renderPlaylists();
      }).catch(() => {});

      // Mientras se genera, devolver el gradiente por defecto
      return pl.cover || { from: '#7C3AED', to: '#EC4899', angle: 135 };
    },

    /* Helper: dibuja una imagen cubriendo un rect (object-fit: cover) */
    _drawImageCover(ctx, img, x, y, w, h) {
      const r = Math.max(w / img.width, h / img.height);
      const dw = img.width * r, dh = img.height * r;
      const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    },

    renderQueue() {
      const ul = document.getElementById('queueList');
      if (!ul) return;
      ul.innerHTML = '';
      // Subtítulo con el contexto actual ("Reproduciendo desde X")
      const ctxLabel = document.getElementById('queueContextLabel');
      if (ctxLabel) {
        const cl = this.getPlayContextLabel();
        if (cl) {
          ctxLabel.textContent = this.t('playing_from') + ' · ' + cl;
          ctxLabel.style.display = '';
        } else {
          ctxLabel.textContent = '';
          ctxLabel.style.display = 'none';
        }
      }
      if (this.queue.length === 0) {
        ul.innerHTML = '<li class="track-row" style="justify-content:center;color:var(--text-3);font-size:13px;padding:24px">' + this.t('queue_empty') + '</li>';
        return;
      }
      this.queue.forEach((id, i) => {
        const t = this.tracks.find(x => x.id === id);
        if (!t) return;
        const li = document.createElement('li');
        li.className = 'queue-item' + (i === this.queueIdx ? ' current' : '');
        li.dataset.idx = i;
        li.innerHTML = `
          <button class="drag-handle" aria-label="Mover"><i class="fa-solid fa-grip-vertical"></i></button>
          <div class="row-cover"><canvas width="44" height="44"></canvas></div>
          <div class="row-text">
            <div class="row-title">${this.esc(t.title)}</div>
            <div class="row-sub">${this.esc(t.artist)}</div>
          </div>
          <div class="row-duration">${this.fmtTime(t.duration)}</div>
          <button class="row-action queue-remove" aria-label="Quitar"><i class="fa-solid fa-xmark"></i></button>
        `;
        // Click normal → reproducir
        li.addEventListener('click', (e) => {
          if (e.target.closest('.drag-handle, .queue-remove')) return;
          this.playFromQueue(i);
        });
        // Tap-and-hold (500ms) → modo reordenar
        let holdTimer = null;
        const startHold = (e) => {
          if (e.target.closest('.drag-handle, .queue-remove')) return;
          holdTimer = setTimeout(() => {
            li.classList.add('reorder-mode');
            this.toast(this.t('toast_reorder_mode'), 2000);
            if (navigator.vibrate) navigator.vibrate(30);
          }, 500);
        };
        const cancelHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
        li.addEventListener('touchstart', startHold, { passive: true });
        li.addEventListener('touchend', cancelHold);
        li.addEventListener('touchmove', cancelHold, { passive: true });
        li.addEventListener('mousedown', startHold);
        li.addEventListener('mouseup', cancelHold);
        li.addEventListener('mouseleave', cancelHold);

        // Quitar de la cola
        li.querySelector('.queue-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          const removedId = this.queue[i];
          const wasCurrent = (i === this.queueIdx) && this.currentTrack && this.currentTrack.id === removedId;
          this.queue.splice(i, 1);
          if (i < this.queueIdx) this.queueIdx--;
          else if (i === this.queueIdx) this.queueIdx = Math.min(this.queueIdx, this.queue.length - 1);
          if (this.queueIdx < 0) this.queueIdx = 0;
          // Si era la pista en reproducción, detenerla
          if (wasCurrent) {
            this.stopPlayback();
            this.toast(this.t('toast_removed_from_queue_stopped'));
          }
          this.renderQueue();
        });

        // Drag handle → reordenar (touch + mouse)
        this.wireDragHandle(li, i, ul, '.queue-item');

        ul.appendChild(li);
        const cv = li.querySelector('canvas');
        if (cv) this.drawRowCover(cv, t);
      });
    },

    /* Reordenar con drag handle (touch + mouse) */
    wireDragHandle(li, idx, ul, itemSelector) {
      const handle = li.querySelector('.drag-handle');
      if (!handle) return;
      let dragging = false;
      let startY = 0, startIdx = idx;
      let ghost = null;
      const items = () => Array.from(ul.querySelectorAll(itemSelector));

      const onStart = (e) => {
        e.stopPropagation();
        e.preventDefault();
        dragging = true;
        startY = (e.touches ? e.touches[0].clientY : e.clientY);
        startIdx = parseInt(li.dataset.idx, 10);
        li.classList.add('dragging');
        if (navigator.vibrate) navigator.vibrate(15);
      };
      const onMove = (e) => {
        if (!dragging) return;
        const y = (e.touches ? e.touches[0].clientY : e.clientY);
        const dy = y - startY;
        li.style.transform = `translateY(${dy}px)`;
        li.style.zIndex = '10';
        // Resaltar destino
        const mid = li.offsetTop + li.offsetHeight/2 + dy;
        items().forEach(it => {
          if (it === li) return;
          const t = it.offsetTop + it.offsetHeight/2;
          it.classList.toggle('drop-above', t > mid && parseInt(it.dataset.idx,10) < startIdx);
          it.classList.toggle('drop-below', t < mid && parseInt(it.dataset.idx,10) > startIdx);
        });
      };
      const onEnd = (e) => {
        if (!dragging) return;
        dragging = false;
        li.style.transform = '';
        li.style.zIndex = '';
        li.classList.remove('dragging');
        const y = (e.changedTouches ? e.changedTouches[0].clientY : e.clientY);
        // Determinar nuevo índice
        let newIdx = startIdx;
        const siblings = items();
        for (let i = 0; i < siblings.length; i++) {
          const it = siblings[i];
          if (it === li) continue;
          const t = it.offsetTop + it.offsetHeight/2;
          if (y < t) { newIdx = parseInt(it.dataset.idx, 10); break; }
          newIdx = parseInt(it.dataset.idx, 10);
        }
        items().forEach(it => it.classList.remove('drop-above','drop-below'));
        // Reordenar
        if (newIdx !== startIdx) {
          const moved = this.queue.splice(startIdx, 1)[0];
          this.queue.splice(newIdx, 0, moved);
          if (this.queueIdx === startIdx) this.queueIdx = newIdx;
          else if (startIdx < this.queueIdx && newIdx >= this.queueIdx) this.queueIdx--;
          else if (startIdx > this.queueIdx && newIdx <= this.queueIdx) this.queueIdx++;
          this.renderQueue();
        }
      };

      handle.addEventListener('touchstart', onStart, { passive: false });
      handle.addEventListener('touchmove', onMove, { passive: false });
      handle.addEventListener('touchend', onEnd);
      handle.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
    },

    renderLibrary() {
      const ul = document.getElementById('libraryTracks');
      if (!ul) return;
      ul.innerHTML = '';
      if (this.tracks.length === 0) {
        ul.innerHTML = '<li class="track-row" style="justify-content:center;color:var(--text-3);font-size:13px;padding:24px">' + this.t('no_tracks_loaded') + '</li>';
        return;
      }
      this.tracks.forEach(t => {
        const li = document.createElement('li');
        li.className = 'track-row';
        li.innerHTML = `
          <div class="row-cover"><canvas width="44" height="44"></canvas></div>
          <div class="row-text">
            <div class="row-title">${this.esc(t.title)}</div>
            <div class="row-sub">${this.esc(t.artist)}${t.album && t.album !== this.t('no_album') ? ' · ' + this.esc(t.album) : ''}</div>
          </div>
          <div class="row-duration">${this.fmtTime(t.duration)}</div>
          <button class="row-action delete-track" aria-label="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
        `;
        li.addEventListener('click', (e) => {
          if (e.target.closest('.delete-track')) return;
          this.playTrack(t.id, { type: 'all' });
          this.closeSheet('sheetLibrary');
        });
        li.querySelector('.delete-track').addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(this.t('delete_track_confirm').replace('X', t.title))) {
            this.deleteTrack(t.id);
          }
        });
        ul.appendChild(li);
        const cv = li.querySelector('canvas');
        if (cv) this.drawRowCover(cv, t);
      });
    },

    renderPlaylists() {
      const ul = document.getElementById('playlistList');
      const grid = document.getElementById('libraryPlaylists');
      const countEl = document.getElementById('playlistCount');
      // Subtítulo con conteo de listas (sólo en el sheet principal de listas)
      if (countEl) {
        const n = this.playlists.length;
        countEl.textContent = n === 0
          ? this.t('playlist_count_zero')
          : (n === 1 ? this.t('playlist_count_one') : this.t('playlist_count_many').replace('X', n));
      }
      [ul, grid].forEach(target => {
        if (!target) return;
        target.innerHTML = '';
        if (this.playlists.length === 0 && target === ul) {
          const li = document.createElement('li');
          li.className = 'empty-state';
          li.innerHTML = `
            <div class="empty-icon"><i class="fa-solid fa-list-ul"></i></div>
            <h4>${this.t('no_playlists_yet')}</h4>
            <p>${this.t('no_playlists_hint')}</p>
            <button class="primary-btn" id="btnEmptyNewPlaylist"><i class="fa-solid fa-plus"></i> ${this.t('create_new_playlist')}</button>
          `;
          const btn = li.querySelector('#btnEmptyNewPlaylist');
          if (btn) btn.addEventListener('click', () => this.openCreatePlaylistSheet());
          target.appendChild(li);
          return;
        }
        this.playlists.forEach(pl => {
          const li = document.createElement('li');
          li.className = target === grid ? 'pl-card' : 'pl-row';
          // Cover: priorizar el cover generado (collage o dataURL); si no, gradiente
          const cover = this.getPlaylistCover(pl);
          const coverBg = (typeof cover === 'string' && cover.startsWith('data:'))
            ? `background-image:url('${cover}');background-size:cover;background-position:center;`
            : `background:linear-gradient(135deg, ${cover.from}, ${cover.to});`;
          // Icono diferenciador para Mi Música y Favoritos
          const coverIcon = pl.id === this.DEFAULT_PLAYLIST_ID
            ? '<i class="fa-solid fa-music"></i>'
            : (pl.id === 'favoritos' ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-solid fa-play"></i>');
          const coverHtml = `
            <div class="pl-cover">
              <div class="pl-cover-grad" style="${coverBg}"></div>
              ${coverIcon}
            </div>
          `;
          const tracksLabel = pl.trackIds.length + ' ' + this.t('tracks_count');
          // Etiqueta "Mi Música" / "Favoritos" como badge si es especial
          const badge = pl.isDefault ? '<span class="pl-badge">' + this.esc(this.t('my_music_playlist')) + '</span>' : '';
          if (target === grid) {
            li.innerHTML = coverHtml + `<div class="pl-card-info"><h4>${this.esc(pl.name)}</h4><p>${tracksLabel}</p>${badge}</div>`;
          } else {
            li.innerHTML = coverHtml + `<div class="pl-info"><h4>${this.esc(pl.name)}</h4><p>${tracksLabel}${pl.description ? ' · ' + this.esc(pl.description) : ''}</p></div>`;
            // Botón eliminar — oculto para Mi Música (no se puede eliminar)
            if (!pl.isDefault) {
              const delBtn = document.createElement('button');
              delBtn.className = 'row-action';
              delBtn.setAttribute('aria-label', this.t('clear_btn'));
              delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
              delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePlaylist(pl.id);
              });
              li.appendChild(delBtn);
            }
          }
          li.addEventListener('click', (e) => {
            if (e.target.closest('.row-action')) return;
            // Modo "seleccionar playlist para añadir la pista actual"
            if (this._selectPlaylistForAdd) {
              this._selectPlaylistForAdd = false;
              this.closeSheet('sheetPlaylists');
              this.addCurrentTrackToPlaylist(pl.id);
              return;
            }
            // Modo normal: abrir editor de la playlist
            this.openEditPlaylist(pl.id);
          });
          target.appendChild(li);
        });
      });
    },

    /* Elimina una playlist. Rechaza la operación si es la predefinida
     * "Mi Música" (id === DEFAULT_PLAYLIST_ID o isDefault === true). */
    deletePlaylist(playlistId) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl) return;
      if (pl.isDefault || pl.id === this.DEFAULT_PLAYLIST_ID) {
        this.toast(this.t('toast_cannot_delete_default'));
        return;
      }
      if (!confirm(this.t('delete_playlist_confirm').replace('X', pl.name))) return;
      this.playlists = this.playlists.filter(p => p.id !== playlistId);
      this.deletePlaylistFromStorage(playlistId);
      this.renderPlaylists();
      this.toast(this.t('toast_track_deleted'));
    },

    renderPickTracks() {
      const ul = document.getElementById('pickTracksList');
      if (!ul) return;
      ul.innerHTML = '';
      this.tracks.forEach(t => {
        const li = document.createElement('li');
        li.className = 'pick-row';
        li.dataset.trackId = t.id;
        li.innerHTML = `
          <div class="row-check"><i class="fa-solid fa-check"></i></div>
          <div class="row-text">
            <div class="row-title">${this.esc(t.title)}</div>
            <div class="row-sub">${this.esc(t.artist)}</div>
          </div>
        `;
        li.addEventListener('click', () => li.classList.toggle('checked'));
        ul.appendChild(li);
      });
    },

    playPlaylist(playlistId) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl) return;
      const ids = pl.trackIds.map(id => id).filter(id => this.tracks.some(t => t.id === id));
      if (ids.length === 0) { this.toast(this.t('toast_playlist_empty')); return; }
      this.queue = ids;
      this.queueIdx = 0;
      // Establecer contexto de reproducción: "Reproduciendo desde <playlist>"
      this.playContext = { type: 'playlist', id: pl.id, name: pl.name };
      this.closeSheet('sheetPlaylists');
      this.closeSheet('sheetLibrary');
      this.closeSheet('sheetEditPlaylist');
      this.playFromQueue(0);
      this.renderCurrentTrack();  // refresca la barra superior con el contexto
      this.renderQueue();  // refrescar la cola con las pistas de la playlist
      this.toast(this.t('toast_now_playing') + ' ' + pl.name);
    },

    /* Reproduce la lista de favoritos como una playlist independiente */
    playFavorites() {
      const favTracks = this.tracks.filter(t => this.favorites.has(t.id));
      if (favTracks.length === 0) {
        this.toast(this.t('toast_no_favorites_yet'));
        return;
      }
      this.queue = favTracks.map(t => t.id);
      this.queueIdx = 0;
      this.playContext = { type: 'favorites' };
      this.closeSheet('sheetFavorites');
      this.playFromQueue(0);
      this.renderCurrentTrack();
      this.renderQueue();  // refrescar la cola con las pistas de favoritos
      this.toast(this.t('toast_now_playing') + ' ' + this.t('favorites_playlist_name'));
    },

    /* Devuelve una etiqueta legible del contexto de reproducción actual */
    getPlayContextLabel() {
      if (!this.playContext) return null;
      if (this.playContext.type === 'favorites') {
        return this.t('favorites_playlist_name');
      }
      if (this.playContext.type === 'playlist') {
        return this.playContext.name || this.t('your_playlists');
      }
      if (this.playContext.type === 'all') {
        return this.t('all_tracks_section');
      }
      if (this.playContext.type === 'queue') {
        return this.t('queue_title');
      }
      return null;
    },

    /* Añade la pista actual a una playlist existente (atajo desde el menú "Más") */
    addCurrentTrackToPlaylist(playlistId) {
      if (!this.currentTrack) {
        this.toast(this.t('toast_pick_at_least_one'));
        return;
      }
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl) return;
      const tid = this.currentTrack.id;
      if (pl.trackIds.includes(tid)) {
        this.toast(this.t('toast_already_in_playlist') + ' ♥ ' + pl.name);
        return;
      }
      pl.trackIds.push(tid);
      this.persistPlaylist(pl);
      this.renderPlaylists();
      this.toast('♥ ' + this.t('toast_added_to_playlist_plural') + ' ' + pl.name);
    },

    /* ============================================================
     *  Crear / editar / añadir a playlists
     * ============================================================ */

    /* Abre el sheet "Crear playlist" en modo creación (vacío).
     * Las pistas son opcionales: se puede crear una lista vacía. */
    openCreatePlaylistSheet() {
      this._addingToPlaylistId = null;
      // Reset del formulario
      const nameInput = document.getElementById('playlistName');
      const descInput = document.getElementById('playlistDesc');
      if (nameInput) nameInput.value = '';
      if (descInput) descInput.value = '';
      // Mostrar campos de nombre/descripción (en modo "add" se ocultan)
      const fields = document.getElementById('createPlaylistFields');
      if (fields) fields.style.display = '';
      // OCULTAR la sección "Selecciona pistas" — al crear una lista nueva
      // no se eligen pistas; se añaden después desde la vista de edición.
      const pickSection = document.getElementById('pickTracksSection');
      if (pickSection) pickSection.style.display = 'none';
      // Título
      const titleEl = document.getElementById('createPlaylistTitle');
      if (titleEl) titleEl.textContent = this.t('create_playlist_title');
      // Botón primario: "Guardar lista"
      const btn = document.getElementById('btnSavePlaylist');
      if (btn) btn.textContent = this.t('save_playlist');
      this.openSheet('sheetCreatePlaylist');
    },

    /* Abre el sheet "Crear playlist" en modo "añadir a existente".
     * Oculta los campos de nombre/descripción y muestra el selector de pistas. */
    openAddTracksSheet(playlistId) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl) return;
      this._addingToPlaylistId = playlistId;
      // Ocultar campos de nombre/descripción
      const fields = document.getElementById('createPlaylistFields');
      if (fields) fields.style.display = 'none';
      // MOSTRAR la sección "Selecciona pistas" en modo "add"
      const pickSection = document.getElementById('pickTracksSection');
      if (pickSection) pickSection.style.display = '';
      // Título dinámico: "Añadir a <nombre>"
      const titleEl = document.getElementById('createPlaylistTitle');
      if (titleEl) titleEl.textContent = this.t('add_tracks_btn') + ' · ' + pl.name;
      const pickTitle = document.getElementById('pickTracksTitle');
      if (pickTitle) pickTitle.textContent = this.t('pick_tracks_for_playlist');
      const pickHint = document.getElementById('pickTracksHint');
      if (pickHint) pickHint.textContent = this.t('add_tracks_btn') + ' → ' + pl.name;
      // Botón primario: "Añadir"
      const btn = document.getElementById('btnSavePlaylist');
      if (btn) btn.textContent = this.t('add_to_existing_btn');
      // Limpiar selección previa
      document.querySelectorAll('.pick-row').forEach(r => r.classList.remove('checked'));
      // Render del picker
      this.renderPickTracks();
      this.openSheet('sheetCreatePlaylist');
    },

    /* Abre el sheet "Editar playlist" con el detalle de una playlist */
    openEditPlaylist(playlistId) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl) return;
      this._editingPlaylistId = playlistId;
      this.renderEditPlaylist();
      // Mostrar/ocultar el botón "Eliminar lista" según sea predefinida
      const btnDeleteFull = document.getElementById('btnDeletePlaylistFull');
      if (btnDeleteFull) {
        btnDeleteFull.style.display = pl.isDefault ? 'none' : '';
      }
      // Cerrar otros sheets (biblioteca, listas) para evitar solapamiento
      this.closeSheet('sheetLibrary');
      this.closeSheet('sheetPlaylists');
      this.openSheet('sheetEditPlaylist');
    },

    /* Pinta el contenido del sheet "Editar playlist" */
    renderEditPlaylist() {
      const pl = this.playlists.find(p => p.id === this._editingPlaylistId);
      if (!pl) return;
      const nameEl = document.getElementById('editPlaylistName');
      const metaEl = document.getElementById('editPlaylistMeta');
      const ul = document.getElementById('editPlaylistTracks');
      const coverEl = document.getElementById('editPlaylistCover');
      if (nameEl) nameEl.textContent = pl.name;
      if (metaEl) {
        const n = pl.trackIds.length;
        metaEl.textContent = n + ' ' + this.t('tracks_count') + (pl.description ? ' · ' + pl.description : '');
      }
      // Cover del sheet de edición: usar collage o gradiente
      if (coverEl) {
        const cover = this.getPlaylistCover(pl);
        if (typeof cover === 'string' && cover.startsWith('data:')) {
          coverEl.innerHTML = '<img src="' + cover + '" alt="">';
        } else {
          const from = (cover && cover.from) || '#7C3AED';
          const to = (cover && cover.to) || '#EC4899';
          coverEl.style.background = 'linear-gradient(135deg, ' + from + ', ' + to + ')';
          const iconClass = pl.id === this.DEFAULT_PLAYLIST_ID
            ? 'fa-solid fa-music'
            : (pl.id === 'favoritos' ? 'fa-solid fa-heart' : 'fa-solid fa-list-ul');
          coverEl.innerHTML = '<i class="' + iconClass + '"></i>';
        }
      }
      if (!ul) return;
      ul.innerHTML = '';
      if (pl.trackIds.length === 0) {
        const li = document.createElement('li');
        li.className = 'track-row';
        li.style.justifyContent = 'center';
        li.style.color = 'var(--text-3)';
        li.style.fontSize = '13px';
        li.style.padding = '24px';
        li.style.textAlign = 'center';
        li.textContent = this.t('no_tracks_in_playlist');
        ul.appendChild(li);
        return;
      }
      pl.trackIds.forEach(id => {
        const t = this.tracks.find(x => x.id === id);
        if (!t) return;
        const li = document.createElement('li');
        li.className = 'track-row';
        li.innerHTML = `
          <div class="row-cover"><canvas width="44" height="44"></canvas></div>
          <div class="row-text">
            <div class="row-title">${this.esc(t.title)}</div>
            <div class="row-sub">${this.esc(t.artist)}</div>
          </div>
          <div class="row-duration">${this.fmtTime(t.duration)}</div>
          <button class="row-action remove-from-pl" aria-label="${this.esc(this.t('remove_from_playlist'))}"><i class="fa-solid fa-xmark"></i></button>
        `;
        li.addEventListener('click', (e) => {
          if (e.target.closest('.remove-from-pl')) return;
          // Reproducir esta pista dentro del contexto de la playlist.
          // playTrack se encarga de setear la cola = pistas de la playlist.
          this.playTrack(t.id, { type: 'playlist', id: pl.id, name: pl.name });
          this.renderQueue();  // refrescar la cola con las pistas de la playlist
          this.closeSheet('sheetEditPlaylist');
        });
        li.querySelector('.remove-from-pl').addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeFromPlaylist(pl.id, t.id);
        });
        ul.appendChild(li);
        const cv = li.querySelector('canvas');
        if (cv) this.drawRowCover(cv, t);
      });
    },

    /* Quita una pista de una playlist */
    removeFromPlaylist(playlistId, trackId) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl) return;
      const i = pl.trackIds.indexOf(trackId);
      if (i < 0) return;
      const wasCurrent = this.currentTrack && this.currentTrack.id === trackId;
      if (wasCurrent && this.playContext && this.playContext.type === 'playlist' && this.playContext.id === playlistId) {
        const qIdx = this.queue.indexOf(trackId);
        if (qIdx >= 0) {
          this.queue.splice(qIdx, 1);
          if (qIdx < this.queueIdx) this.queueIdx--;
          else if (qIdx === this.queueIdx) this.queueIdx = Math.min(this.queueIdx, this.queue.length - 1);
          if (this.queueIdx < 0) this.queueIdx = 0;
        }
      }
      pl.trackIds.splice(i, 1);
      pl._coverCache = null;
      pl._coverCacheHash = null;
      this.persistPlaylist(pl);
      if (wasCurrent) {
        this.stopPlayback();
        this.skipToNextOrPrevPaused();
      }
      // Actualizar solo el contador y la lista, sin parpadeo
      this._updatePlaylistMeta(pl);
      this._removeTrackFromEditView(trackId);
      this.renderQueue();
      this.toast(this.t('toast_removed_from_playlist'));
    },

    /* Actualizar solo el contador de una playlist sin re-render completo */
    _updatePlaylistMeta(pl) {
      const meta = document.getElementById('editPlaylistMeta');
      if (meta) {
        const n = pl.trackIds.length;
        meta.textContent = n + ' ' + this.t('tracks_count') + (pl.description ? ' · ' + pl.description : '');
      }
    },

    /* Eliminar una pista de la vista de edición sin re-render completo */
    _removeTrackFromEditView(trackId) {
      const items = document.querySelectorAll('#editPlaylistTracks .track-row');
      // No podemos usar data-track porque la vista de edición no lo tiene
      // Buscar por el texto del título de la pista
      const track = this.tracks.find(t => t.id === trackId);
      if (!track) return;
      items.forEach(item => {
        const title = item.querySelector('.row-title');
        if (title && title.textContent === track.title) {
          item.style.transition = 'opacity .2s, transform .2s';
          item.style.opacity = '0';
          item.style.transform = 'translateX(-20px)';
          setTimeout(() => item.remove(), 200);
        }
      });
    },

    /* Vacía una playlist (sin borrar las pistas de la biblioteca) */
    clearPlaylist(playlistId) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl) return;
      if (pl.trackIds.length === 0) {
        this.toast(this.t('toast_playlist_cleared'));
        return;
      }
      if (!confirm(this.t('confirm_clear_playlist'))) return;
      pl.trackIds = [];
      pl._coverCache = null;
      pl._coverCacheHash = null;
      this.persistPlaylist(pl);
      // Actualizar vista sin parpadeo
      const ul = document.getElementById('editPlaylistTracks');
      if (ul) {
        // Animar salida de todos los items
        ul.querySelectorAll('.track-row').forEach((item, i) => {
          setTimeout(() => {
            item.style.transition = 'opacity .2s, transform .2s';
            item.style.opacity = '0';
            item.style.transform = 'translateX(-20px)';
            setTimeout(() => item.remove(), 200);
          }, i * 20);
        });
        // Mostrar mensaje de vacío después
        setTimeout(() => {
          ul.innerHTML = '<li class="track-row" style="justify-content:center;color:var(--text-3);font-size:13px;padding:24px">' + this.t('no_tracks_in_playlist') + '</li>';
        }, 300);
      }
      this._updatePlaylistMeta(pl);
      this.toast(this.t('toast_playlist_cleared'));
    },

    createPlaylist(name, desc, trackIds) {
      const id = 'pl-' + Date.now();
      const colors = ['#7C3AED','#EC4899','#F59E0B','#10B981','#06B6D4','#1E40AF','#F97316','#DC2626','#6366F1','#3B82F6'];
      const from = colors[Math.floor(Math.random() * colors.length)];
      const to = colors[Math.floor(Math.random() * colors.length)];
      const pl = {
        id,
        name: name || this.t('create_playlist_title'),
        description: desc || '',
        trackIds: Array.isArray(trackIds) ? trackIds : [],
        cover: { from, to, angle: 135 }
      };
      this.playlists.push(pl);
      this.persistPlaylist(pl);
      this.renderPlaylists();
      return pl;
    },

    /* ============================================================
     *  Sheets
     * ============================================================ */
    openSheet(id) {
      const s = document.getElementById(id);
      if (s) s.classList.add('open');
    },
    closeSheet(id) {
      const s = document.getElementById(id);
      if (s) s.classList.remove('open');
      // Reset del flag de selección si se cierra el sheet de listas
      if (id === 'sheetPlaylists') {
        this._selectPlaylistForAdd = false;
      }
      // Si se cierra el sheet de creación, limpiar modo "add"
      if (id === 'sheetCreatePlaylist') {
        this._addingToPlaylistId = null;
      }
      // Si se cierra el sheet de edición, limpiar editing
      if (id === 'sheetEditPlaylist') {
        this._editingPlaylistId = null;
      }
    },

    /* ============================================================
     *  Cambio de vista (player ↔ lyrics)
     * ============================================================ */
    showView(name) {
      const views = document.querySelectorAll('.view');
      views.forEach(v => {
        const isActive = v.dataset.view === name;
        if (isActive) v.classList.add('active');
        else v.classList.remove('active');
      });
    },

    /* ============================================================
     *  Media Session API
     * ============================================================ */
    updateMediaSession() {
      if (!('mediaSession' in navigator) || !this.currentTrack) return;
      const t = this.currentTrack;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: t.title,
          artist: t.artist,
          album: t.album,
          artwork: [
            { src: this.canvasToUrl(t, 96),   sizes: '96x96',   type: 'image/png' },
            { src: this.canvasToUrl(t, 256),  sizes: '256x256', type: 'image/png' },
            { src: this.canvasToUrl(t, 512),  sizes: '512x512', type: 'image/png' }
          ]
        });
        navigator.mediaSession.setActionHandler('play', () => this.togglePlay(true));
        navigator.mediaSession.setActionHandler('pause', () => this.togglePlay(false));
        navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
        navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
        navigator.mediaSession.setActionHandler('seekto', (d) => {
          if (d.seekTime != null) { this.audio.currentTime = d.seekTime; this.updateProgress(); }
        });
      } catch (e) {}
    },

    canvasToUrl(track, size) {
      // Si la portada ya es una imagen (dataURL), usarla directamente
      const isImage = track.coverIsImage || (typeof track.cover === 'string' && track.cover.startsWith('data:'));
      if (isImage) {
        return typeof track.cover === 'string' ? track.cover : '';
      }
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      const cover = (typeof track.cover === 'object' && track.cover.from) ? track.cover : { from: '#7C3AED', to: '#EC4899' };
      const g = ctx.createLinearGradient(0,0,size,size);
      g.addColorStop(0, cover.from);
      g.addColorStop(1, cover.to);
      ctx.fillStyle = g; ctx.fillRect(0,0,size,size);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `900 ${size*0.45}px 'Space Grotesk', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(track.title.charAt(0).toUpperCase(), size/2, size/2);
      return c.toDataURL('image/png');
    },

    /* ============================================================
     *  Wake Lock (mantener pantalla encendida)
     * ============================================================ */
    async requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          this.wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (e) {}
    },
    async releaseWakeLock() {
      if (this.wakeLock) {
        try { await this.wakeLock.release(); this.wakeLock = null; } catch(e) {}
      }
    },

    /* ============================================================
     *  Sleep timer
     * ============================================================ */
    startSleep(minutes) {
      this.cancelSleep();
      this.sleepEndAt = Date.now() + minutes * 60 * 1000;
      this.sleepTimer = setTimeout(() => {
        this.togglePlay(false);
        this.sleepEndAt = null;
        this.toast(this.t('toast_sleep_done'));
        this.updateSleepStatus();
      }, minutes * 60 * 1000);
      this.updateSleepStatus();
      this.toast(this.t('toast_sleep_started').replace('X', minutes));
    },
    cancelSleep() {
      if (this.sleepTimer) { clearTimeout(this.sleepTimer); this.sleepTimer = null; }
      this.sleepEndAt = null;
      this.updateSleepStatus();
    },
    updateSleepStatus() {
      const el = document.getElementById('sleepStatus');
      if (!el) return;
      if (this.sleepEndAt) {
        const ms = this.sleepEndAt - Date.now();
        const m = Math.floor(ms / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        el.textContent = `${this.t('sleep_active_prefix')} ${m}:${String(s).padStart(2,'0')} ${this.t('sleep_remaining')}`;
      } else {
        el.textContent = '';
      }
    },

    /* ============================================================
     *  Toast
     * ============================================================ */
    toast(msg, ms = 2400) {
      const t = document.getElementById('toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => t.classList.remove('show'), ms);
    },

    esc(s) {
      return String(s).replace(/[&<>"']/g, m => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      }[m]));
    },

    /* ============================================================
     *  Eventos
     * ============================================================ */
    wireEvents() {
      // Helper null-safe: si el elemento no existe, devuelve un objeto con
      // addEventListener no-op para que no se rompa el wiring completo.
      const $ = (id) => {
        const el = document.getElementById(id);
        if (el) return el;
        // Devolver un proxy no-op para que .addEventListener no falle
        return { addEventListener: () => {}, style: {}, classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false }, querySelector: () => null, querySelectorAll: () => [], value: '', textContent: '' };
      };

      // Play / pause
      $('btnPlay').addEventListener('click', () => this.togglePlay());
      $('btnPlayLyrics').addEventListener('click', () => this.togglePlay());

      // Menú de 3 puntos ( Más opciones ) — cableado lo antes posible para
      // garantizar que funcione en cualquier estado de la app, incluido el
      // primer arranque. Hay un botón en la vista player y otro en la vista
      // de letras; ambos abren el mismo sheet.
      $('btnMore').addEventListener('click', () => this.openSheet('sheetMore'));
      $('btnLyricsMore').addEventListener('click', () => this.openSheet('sheetMore'));
      this._wired.play = true;

      // Prev / next
      $('btnPrev').addEventListener('click', () => this.prev());
      $('btnNext').addEventListener('click', () => this.next());
      $('btnPrevLyrics').addEventListener('click', () => this.prev());
      $('btnNextLyrics').addEventListener('click', () => this.next());

      // Shuffle / repeat
      $('btnShuffle').addEventListener('click', () => this.toggleShuffle());
      $('btnRepeat').addEventListener('click', () => this.cycleRepeat());

      // Like
      $('btnLike').addEventListener('click', () => this.toggleFavorite());
      $('btnLike2').addEventListener('click', () => this.toggleFavorite());

      // Letras
      $('btnLyrics').addEventListener('click', () => {
        this.showView('lyrics');
        this.restoreLyricsPrefs();
        this.renderLyrics();
      });
      $('btnBackFromLyrics').addEventListener('click', () => this.showView('player'));

      // === Letras LRC: barra de herramientas ===
      // Tamaño de fuente (#7)
      $('btnLrcFontDec').addEventListener('click', () => this.setLrcFontSize(this.lrcFontSize - 2));
      $('btnLrcFontInc').addEventListener('click', () => this.setLrcFontSize(this.lrcFontSize + 2));
      // Offset manual (#12)
      $('btnLrcOffsetMinus').addEventListener('click', () => this.adjustLrcOffset(-0.5));
      $('btnLrcOffsetReset').addEventListener('click', () => this.resetLrcOffset());
      $('btnLrcOffsetPlus').addEventListener('click', () => this.adjustLrcOffset(0.5));
      // Loop de sección (#19)
      $('btnLrcLoop').addEventListener('click', () => this.toggleLyricsLoop());
      $('btnLrcLoopClear').addEventListener('click', () => this.clearLyricsLoop());
      // Pantalla completa (#14)
      $('btnLrcFullscreen').addEventListener('click', () => this.toggleLyricsFullscreen());
      // Cargar .lrc externo (#1)
      $('btnLrcLoadFile').addEventListener('click', () => this.loadExternalLrc());
      // Editor de letras (#2)
      $('btnLrcEdit').addEventListener('click', () => this.openLrcEditor());
      $('btnLrcSave').addEventListener('click', () => this.saveLrcFromEditor());
      // Velocidad de reproducción (#18)
      $('btnLrcSpeedDown').addEventListener('click', () => this.setPlaybackRate(this.playbackRate - 0.1));
      $('btnLrcSpeedUp').addEventListener('click', () => this.setPlaybackRate(this.playbackRate + 0.1));
      // Salir de pantalla completa (#14)
      $('btnLrcExitFs').addEventListener('click', () => this.toggleLyricsFullscreen());

      // === #9 Búsqueda avanzada: filtros ===
      this._searchFilter = 'all';
      document.querySelectorAll('.search-filter').forEach(b => {
        b.addEventListener('click', () => {
          document.querySelectorAll('.search-filter').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          this._searchFilter = b.dataset.filter;
          const q = document.getElementById('searchInput').value;
          this.runSearch(q, this._searchFilter);
        });
      });

      // Historial (ahora en menú Opciones)
      const btnHistoryMenu = document.getElementById('menuHistory');
      if (btnHistoryMenu) btnHistoryMenu.addEventListener('click', () => {
        this.closeSheet('sheetMore');
        this.renderHistory();
        this.openSheet('sheetStats');
      });

      // === #17 Panel de ajustes ===
      const btnSettings = document.getElementById('menuSettings');
      if (btnSettings) btnSettings.addEventListener('click', () => {
        this.closeSheet('sheetMore');
        this.openSheet('sheetSettings');
      });
      // Temas desde Ajustes
      const btnThemesSettings = document.getElementById('menuThemesSettings');
      if (btnThemesSettings) btnThemesSettings.addEventListener('click', () => {
        this.closeSheet('sheetSettings');
        this.openSheet('sheetThemes');
      });
      // Idioma desde Ajustes
      const btnLanguageSettings = document.getElementById('menuLanguageSettings');
      if (btnLanguageSettings) btnLanguageSettings.addEventListener('click', () => {
        this.closeSheet('sheetSettings');
        this.buildLangList();
        this.openSheet('sheetLanguage');
      });

      // Volver / cargar música
      $('btnBack').addEventListener('click', () => this.openFilePicker());

      // Botón "Cargar música" en menú más opciones
      const btnLoadMore = document.getElementById('menuLoadMusic');
      if (btnLoadMore) btnLoadMore.addEventListener('click', () => {
        this.openFilePicker();
        this.closeSheet('sheetMore');
      });

      // Botón "Oyentes" en menú más opciones (atajo al sheet Listeners)
      const btnListenersMenu = document.getElementById('menuListeners');
      if (btnListenersMenu) btnListenersMenu.addEventListener('click', () => {
        this.closeSheet('sheetMore');
        this.renderListeners();
        this.openSheet('sheetListeners');
      });

      // Botón "Compartir" pista actual en el chat (vía webxdc.sendToChat)
      const btnShareTrack = document.getElementById('menuShareTrack');
      if (btnShareTrack) btnShareTrack.addEventListener('click', () => {
        this.shareCurrentTrackToChat();
        this.closeSheet('sheetMore');
      });

      // Cola
      $('btnQueue').addEventListener('click', () => this.openSheet('sheetQueue'));

      // Volumen
      $('btnVolume').addEventListener('click', () => this.openSheet('sheetVolume'));
      $('volumeSlider').addEventListener('input', (e) => this.setVolume(parseInt(e.target.value)/100));

      // EQ
      $('btnEqualizer').addEventListener('click', () => this.openSheet('sheetEqualizer'));
      document.querySelectorAll('.eq-preset').forEach(b => {
        b.addEventListener('click', () => this.applyEqPreset(b.dataset.preset));
      });

      // Sleep
      $('btnSleep').addEventListener('click', () => this.openSheet('sheetSleep'));
      document.querySelectorAll('.sleep-opt').forEach(b => {
        b.addEventListener('click', () => {
          document.querySelectorAll('.sleep-opt').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          this.startSleep(parseInt(b.dataset.min));
        });
      });
      $('btnCancelSleep').addEventListener('click', () => {
        document.querySelectorAll('.sleep-opt').forEach(x => x.classList.remove('active'));
        this.cancelSleep();
      });

      // Playlists
      $('btnNewPlaylist').addEventListener('click', () => this.openCreatePlaylistSheet());
      $('btnOpenNewPlaylist').addEventListener('click', () => {
        this.closeSheet('sheetLibrary');
        this.openCreatePlaylistSheet();
      });
      // Botón "Borrar todo" en biblioteca
      const btnDeleteAll = document.getElementById('btnDeleteAllTracks');
      if (btnDeleteAll) btnDeleteAll.addEventListener('click', () => this.deleteAllTracks());

      // Guardar playlist: crea una nueva (vacía o con pistas) O añade pistas a una existente
      $('btnSavePlaylist').addEventListener('click', () => {
        const ids = Array.from(document.querySelectorAll('.pick-row.checked'))
          .map(r => r.dataset.trackId);

        // Modo "añadir a playlist existente"
        if (this._addingToPlaylistId) {
          if (ids.length === 0) {
            this.toast(this.t('toast_pick_at_least_one'));
            return;
          }
          const pl = this.playlists.find(p => p.id === this._addingToPlaylistId);
          if (!pl) {
            this._addingToPlaylistId = null;
            this.closeSheet('sheetCreatePlaylist');
            return;
          }
          // Añadir solo IDs que no estén ya
          let added = 0;
          ids.forEach(id => {
            if (!pl.trackIds.includes(id)) { pl.trackIds.push(id); added++; }
          });
          this.persistPlaylist(pl);
          this.renderPlaylists();
          // Limpiar selección
          document.querySelectorAll('.pick-row').forEach(r => r.classList.remove('checked'));
          this.closeSheet('sheetCreatePlaylist');
          this._addingToPlaylistId = null;
          // Re-abrir el sheet de edición si estábamos editando esa playlist
          if (this._editingPlaylistId === pl.id) {
            this.renderEditPlaylist();
          }
          this.toast(added + ' ' + this.t('toast_tracks_added_to_playlist'));
          return;
        }

        // Modo "crear nueva playlist" (admite vacía)
        const name = $('playlistName').value.trim();
        const desc = $('playlistDesc').value.trim();
        if (!name) { this.toast(this.t('toast_name_required')); return; }
        this.createPlaylist(name, desc, ids);
        $('playlistName').value = '';
        $('playlistDesc').value = '';
        document.querySelectorAll('.pick-row').forEach(r => r.classList.remove('checked'));
        this.closeSheet('sheetCreatePlaylist');
        if (ids.length === 0) {
          this.toast(this.t('toast_playlist_empty_created') + ': ' + name);
        } else {
          this.toast(this.t('toast_playlist_created') + ' ' + name);
        }
      });

      // Botones del sheet "Editar playlist"
      const btnPlayNow = document.getElementById('btnPlayPlaylistNow');
      if (btnPlayNow) btnPlayNow.addEventListener('click', () => {
        if (this._editingPlaylistId) {
          this.playPlaylist(this._editingPlaylistId);
          this.closeSheet('sheetEditPlaylist');
        }
      });
      // Subir canciones directamente a la playlist desde el almacenamiento
      const btnUploadToPl = document.getElementById('btnUploadToPlaylist');
      if (btnUploadToPl) btnUploadToPl.addEventListener('click', () => {
        if (!this._editingPlaylistId) return;
        this.openFilePicker(false, this._editingPlaylistId);
      });
      // Borrar todas las pistas de la playlist (sin borrarlas de la biblioteca)
      const btnClearPl = document.getElementById('btnClearPlaylist');
      if (btnClearPl) btnClearPl.addEventListener('click', () => {
        if (!this._editingPlaylistId) return;
        this.clearPlaylist(this._editingPlaylistId);
      });
      // Eliminar la playlist completa (no disponible para Mi Música)
      const btnDeletePlFull = document.getElementById('btnDeletePlaylistFull');
      if (btnDeletePlFull) btnDeletePlFull.addEventListener('click', () => {
        if (!this._editingPlaylistId) return;
        const idToDelete = this._editingPlaylistId;
        this.closeSheet('sheetEditPlaylist');
        this.deletePlaylist(idToDelete);
      });

      // Library / search / favorites / home
      document.querySelectorAll('.nav-btn').forEach(b => {
        b.addEventListener('click', () => {
          document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          const nav = b.dataset.nav;
          if (nav === 'home') {
            // Cerrar todos los sheets abiertos y volver al reproductor
            this.closeAllSheets();
            this.showView('player');
          }
          if (nav === 'library') this.openSheet('sheetLibrary');
          if (nav === 'favorites') {
            this.renderFavorites();
            this.openSheet('sheetFavorites');
          }
          if (nav === 'search') {
            this.openSheet('sheetSearch');
            setTimeout(() => $('searchInput').focus(), 350);
          }
        });
      });

      // Búsqueda
      $('searchInput').addEventListener('input', (e) => this.runSearch(e.target.value, this._searchFilter));

      // Más opciones
      $('menuAddToPlaylist').addEventListener('click', () => {
        this.closeSheet('sheetMore');
        if (!this.currentTrack) {
          this.toast(this.t('toast_pick_at_least_one'));
          return;
        }
        // Activar modo "seleccionar playlist para añadir la pista actual"
        this._selectPlaylistForAdd = true;
        this.renderPlaylists();
        this.openSheet('sheetPlaylists');
      });
      $('menuGoToArtist').addEventListener('click', () => {
        this.closeSheet('sheetMore');
        if (this.currentTrack) this.toast(this.t('menu_go_to_artist') + ': ' + this.currentTrack.artist);
      });
      // Botón "Reproducir Todo" en el sheet de favoritos
      const btnPlayFav = document.getElementById('btnPlayFavoritesNow');
      if (btnPlayFav) btnPlayFav.addEventListener('click', () => {
        this.playFavorites();
      });

      // Cerrar sheets
      document.querySelectorAll('[data-close-sheet]').forEach(el => {
        el.addEventListener('click', () => this.closeSheet(el.dataset.closeSheet));
      });

      // Audio events
      this.audio.addEventListener('timeupdate', () => {
        this.updateProgress();
      });
      this.audio.addEventListener('loadedmetadata', () => {
        const dur = this.audio.duration;
        document.getElementById('timeTotal').textContent = this.fmtTime(dur);
        // Guardar duración real en el track y persistirla
        if (this.currentTrack && isFinite(dur) && (!this.currentTrack.duration || this.currentTrack.duration === 0)) {
          this.currentTrack.duration = Math.floor(dur);
          this.persistTrack(this.currentTrack);
          this.renderLibrary();
          this.renderQueue();
        }
      });
      this.audio.addEventListener('ended', () => {
        // Marcar como reproducida completamente y contar estadística
        if (this.currentTrack && !this._trackFullyPlayed) {
          this._trackFullyPlayed = true;
          this.stats.plays[this.currentTrack.id] = (this.stats.plays[this.currentTrack.id] || 0) + 1;
          this.stats.totalSeconds += Math.floor(this.audio.duration || 0);
          this.saveStats();
        }
        this.next(true);
      });
      this.audio.addEventListener('error', (e) => {
        this._lastError = { msg: 'audio error: ' + (e.message || 'unknown'), ts: Date.now() };
        // No mostrar toast si es solo CORS del análisis Web Audio
      });
      this.audio.addEventListener('waiting', () => {});
      this.audio.addEventListener('canplay', () => {});

      // Progress bar seek
      const pt = $('progressTrack');
      let dragging = false;
      const seekFromEvent = (e) => {
        const rect = pt.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const ratio = Math.max(0, Math.min(1, x / rect.width));
        this.seekTo(ratio);
      };
      pt.addEventListener('touchstart', (e) => { dragging = true; pt.classList.add('dragging'); seekFromEvent(e); e.preventDefault(); }, { passive: false });
      pt.addEventListener('touchmove',  (e) => { if (dragging) seekFromEvent(e); e.preventDefault(); }, { passive: false });
      pt.addEventListener('touchend',   () => { dragging = false; pt.classList.remove('dragging'); });
      pt.addEventListener('mousedown',  (e) => { dragging = true; pt.classList.add('dragging'); seekFromEvent(e); });
      window.addEventListener('mousemove', (e) => { if (dragging) seekFromEvent(e); });
      window.addEventListener('mouseup',   () => { dragging = false; pt.classList.remove('dragging'); });

      // Restore volume
      const savedVol = localStorage.getItem('aurora_volume');
      if (savedVol) this.setVolume(parseFloat(savedVol));
      else this.setVolume(0.8);

      // Botón estadísticas (si existe)
      const btnStats = document.getElementById('menuStats');
      if (btnStats) btnStats.addEventListener('click', () => {
        this.closeSheet('sheetMore');
        this.renderStats();
        this.openSheet('sheetStats');
      });

      // Theme buttons — usar .theme-opt (no [data-theme]) porque applyTheme()
      // setea data-theme en <html>, y [data-theme] también coincidiría con <html>,
      // añadiendo un listener de click a <html> que dispararía setTheme en cada click.
      document.querySelectorAll('.theme-opt').forEach(b => {
        b.addEventListener('click', () => {
          this.setTheme(b.dataset.theme);
          document.querySelectorAll('.theme-opt').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
        });
      });

      // Accent buttons — mismo motivo: usar .accent-opt
      document.querySelectorAll('.accent-opt').forEach(b => {
        b.addEventListener('click', () => {
          this.setAccent(b.dataset.accent);
          document.querySelectorAll('.accent-opt').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
        });
      });

      // Marcar tema/acento activos al inicio
      document.querySelectorAll('.theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === this.theme));
      document.querySelectorAll('.accent-opt').forEach(b => b.classList.toggle('active', b.dataset.accent === this.accent));

      // Atajos de teclado (desktop)
      document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch (e.key) {
          case ' ': e.preventDefault(); this.togglePlay(); break;
          case 'ArrowRight': if (e.shiftKey) this.next(); else this.seekTo(((this.audio.currentTime||0)+5) / (this.audio.duration||1)); break;
          case 'ArrowLeft': if (e.shiftKey) this.prev(); else this.seekTo(Math.max(0,((this.audio.currentTime||0)-5)) / (this.audio.duration||1)); break;
          case 'ArrowUp': e.preventDefault(); this.setVolume(Math.min(1, this.volume + 0.05)); break;
          case 'ArrowDown': e.preventDefault(); this.setVolume(Math.max(0, this.volume - 0.05)); break;
          case 'm': case 'M': this.setVolume(this.volume > 0 ? 0 : 0.8); break;
          case 'l': case 'L': this.toggleFavorite(); break;
          case 'n': case 'N': this.next(); break;
          case 'p': case 'P': this.prev(); break;
        }
      });
    },

    wireGestures() {
      const screen = document.getElementById('deviceScreen');
      let sx = 0, sy = 0, st = 0, swiping = false;
      screen.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
        st = Date.now();
        swiping = true;
      }, { passive: true });

      screen.addEventListener('touchend', (e) => {
        if (!swiping) return;
        swiping = false;
        const dx = e.changedTouches[0].clientX - sx;
        const dy = e.changedTouches[0].clientY - sy;
        const dt = Date.now() - st;
        const ax = Math.abs(dx), ay = Math.abs(dy);
        // Swipe horizontal (umbral 60px, rápido <500ms)
        if (ax > 60 && ax > ay * 1.5 && dt < 600) {
          // Solo si el toque NO comienza sobre la barra de progreso ni sobre sheets
          const target = e.target;
          if (target.closest('#progressTrack, .sheet, .bottom-nav, .controls-main, .controls-secondary')) return;
          // En la vista de letras, swipe horizontal = cambiar de pista (#25)
          if (dx < 0) this.next();
          else this.prev();
          if (navigator.vibrate) navigator.vibrate(10);
        }
        // Swipe vertical (lyrics ↔ player)
        if (ay > 80 && ay > ax * 1.5 && dt < 700) {
          const target = e.target;
          if (target.closest('.sheet, .bottom-nav')) return;
          if (dy < 0) this.showView('lyrics');
          else this.showView('player');
        }
        // Doble tap en portada → like
      });

      // Doble tap en la portada → favorito
      const cover = document.getElementById('coverArt');
      let lastTap = 0;
      cover.addEventListener('touchend', () => {
        const now = Date.now();
        if (now - lastTap < 300) {
          this.toggleFavorite();
          if (navigator.vibrate) navigator.vibrate(15);
        }
        lastTap = now;
      });

      this._wired.gestures = true;
    },

    closeAllSheets() {
      document.querySelectorAll('.sheet.open').forEach(s => s.classList.remove('open'));
    },

    /* ============================================================
     *  Render de la pantalla de Estadísticas (#13)
     * ============================================================ */
    renderStats() {
      const cont = document.getElementById('statsContent');
      if (!cont) return;
      const topTracks = this.getTopTracks(10);
      const topArtists = this.getTopArtists(5);
      const totalPlays = Object.values(this.stats.plays).reduce((a, b) => a + b, 0);
      const totalSec = this.stats.totalSeconds;

      cont.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${totalPlays}</div>
            <div class="stat-label">${this.t('stats_plays')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${this.fmtDuration(totalSec)}</div>
            <div class="stat-label">${this.t('stats_listening_time')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${this.tracks.length}</div>
            <div class="stat-label">${this.t('all_tracks_section')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${topArtists.length}</div>
            <div class="stat-label">${this.t('menu_go_to_artist')}</div>
          </div>
        </div>

        <h4 class="section-title">${this.t('stats_top_artists')}</h4>
        ${topArtists.length === 0 ? '<p class="stats-empty">' + this.t('no_results') + '</p>' : ''}
        <ul class="stats-list">
          ${topArtists.map((a, i) => `
            <li class="stats-row">
              <div class="stats-rank">${i + 1}</div>
              <div class="stats-info">
                <div class="stats-name">${this.esc(a.artist)}</div>
                <div class="stats-sub">${a.count} ${this.t('stats_plays').toLowerCase()}</div>
              </div>
            </li>
          `).join('')}
        </ul>

        <h4 class="section-title">${this.t('stats_top_tracks')}</h4>
        ${topTracks.length === 0 ? '<p class="stats-empty">' + this.t('no_results') + '</p>' : ''}
        <ul class="stats-list">
          ${topTracks.map((t, i) => `
            <li class="stats-row" data-track="${t.track.id}">
              <div class="stats-rank">${i + 1}</div>
              <div class="row-cover"><canvas width="40" height="40"></canvas></div>
              <div class="stats-info">
                <div class="stats-name">${this.esc(t.track.title)}</div>
                <div class="stats-sub">${this.esc(t.track.artist)} · ${t.count} ${this.t('stats_plays').toLowerCase()}</div>
              </div>
            </li>
          `).join('')}
        </ul>
      `;

      // Botones de reinicio
      const resetDiv = document.createElement('div');
      resetDiv.style.cssText = 'display:flex;gap:8px;margin-top:20px;justify-content:center;';
      resetDiv.innerHTML = `
        <button class="primary-btn compact ghost danger" id="btnResetStats"><i class="fa-solid fa-trash-can"></i> Reiniciar estadísticas</button>
        <button class="primary-btn compact ghost danger" id="btnResetHistory"><i class="fa-solid fa-trash-can"></i> Reiniciar historial</button>
      `;
      cont.appendChild(resetDiv);
      const btnRS = document.getElementById('btnResetStats');
      if (btnRS) btnRS.addEventListener('click', () => {
        if (confirm(this.t('stats_reset_confirm'))) this.resetStats();
      });
      const btnRH = document.getElementById('btnResetHistory');
      if (btnRH) btnRH.addEventListener('click', () => {
        if (confirm(this.t('history_reset_confirm'))) this.resetHistory();
      });

      // Dibujar covers
      cont.querySelectorAll('.stats-row').forEach((row, i) => {
        const tid = row.dataset.track;
        if (!tid) return;
        const track = this.tracks.find(t => t.id === tid);
        if (track) {
          const cv = row.querySelector('canvas');
          if (cv) this.drawRowCover(cv, track);
        }
        row.addEventListener('click', () => {
          if (tid) {
            this.playTrack(tid);
            this.closeSheet('sheetStats');
          }
        });
      });
    },

    runSearch(q, filter) {
      const ul = document.getElementById('searchResults');
      if (!ul) return;
      ul.innerHTML = '';
      if (!q || q.trim().length === 0) {
        ul.innerHTML = '<li class="track-row" style="justify-content:center;color:var(--text-3);font-size:13px">' + this.t('search_placeholder') + '</li>';
        return;
      }
      const ql = q.toLowerCase();
      const f = filter || 'all';
      const res = this.tracks.filter(t => {
        if (f === 'title') return t.title.toLowerCase().includes(ql);
        if (f === 'artist') return t.artist.toLowerCase().includes(ql);
        if (f === 'album') return t.album && t.album.toLowerCase().includes(ql);
        return t.title.toLowerCase().includes(ql) ||
               t.artist.toLowerCase().includes(ql) ||
               (t.album && t.album.toLowerCase().includes(ql));
      });
      if (res.length === 0) {
        ul.innerHTML = '<li class="track-row" style="justify-content:center;color:var(--text-3);font-size:13px">' + this.t('no_results') + '</li>';
        return;
      }
      res.forEach(t => {
        const li = document.createElement('li');
        li.className = 'track-row';
        li.innerHTML = `
          <div class="row-cover"><canvas width="44" height="44"></canvas></div>
          <div class="row-text">
            <div class="row-title">${this.esc(t.title)}</div>
            <div class="row-sub">${this.esc(t.artist)}${t.album && t.album !== this.t('no_album') ? ' · ' + this.esc(t.album) : ''}</div>
          </div>
          <div class="row-duration">${this.fmtTime(t.duration)}</div>
        `;
        li.addEventListener('click', () => {
          this.playTrack(t.id, { type: 'all' });
          this.closeSheet('sheetSearch');
        });
        ul.appendChild(li);
        const cv = li.querySelector('canvas');
        if (cv) this.drawRowCover(cv, t);
      });
    },

    /* ============================================================
     *  Render de la lista de Favoritos
     * ============================================================ */
    renderFavorites() {
      const ul = document.getElementById('favoritesList');
      if (!ul) return;
      const countEl = document.getElementById('favoritesCount');
      ul.innerHTML = '';
      const favTracks = this.tracks.filter(t => this.favorites.has(t.id));
      if (countEl) {
        const n = favTracks.length;
        countEl.textContent = n === 0
          ? this.t('favorites_count_zero')
          : (n === 1 ? this.t('favorites_count_one') : this.t('favorites_count_many').replace('X', n));
      }
      if (favTracks.length === 0) {
        ul.innerHTML = '<li class="track-row" style="justify-content:center;color:var(--text-3);font-size:13px;padding:24px">' + this.t('toast_no_favorites_yet') + '</li>';
        return;
      }
      // Para que pulsar una pista desde favoritos reproduzca TODA la lista
      // de favoritos (no solo la pista aislada), construimos el contexto.
      const favIds = favTracks.map(t => t.id);
      favTracks.forEach((t, idx) => {
        const li = document.createElement('li');
        li.className = 'track-row';
        li.innerHTML = `
          <div class="row-cover"><canvas width="44" height="44"></canvas></div>
          <div class="row-text">
            <div class="row-title">${this.esc(t.title)}</div>
            <div class="row-sub">${this.esc(t.artist)}${t.album && t.album !== this.t('no_album') ? ' · ' + this.esc(t.album) : ''}</div>
          </div>
          <div class="row-duration">${this.fmtTime(t.duration)}</div>
          <button class="row-action unfav-track" aria-label="${this.esc(this.t('toast_removed_fav'))}"><i class="fa-solid fa-heart"></i></button>
        `;
        li.addEventListener('click', (e) => {
          if (e.target.closest('.unfav-track')) return;
          // Reproducir desde favoritos: la cola = favoritos, empezar por esta pista
          this.queue = favIds.slice();
          this.queueIdx = idx;
          this.playContext = { type: 'favorites' };
          const tIdx = this.tracks.findIndex(x => x.id === t.id);
          if (tIdx >= 0) this.currentTrackIdx = tIdx;
          this.currentTrack = t;
          this.loadAndPlay();
          this.renderQueue();  // refrescar la cola con las pistas de favoritos
          this.closeSheet('sheetFavorites');
        });
        li.querySelector('.unfav-track').addEventListener('click', (e) => {
          e.stopPropagation();
          this.favorites.delete(t.id);
          this.saveFavorites();
          this.updateFavoriteUI();
          this.renderFavorites();
          this.toast(this.t('toast_removed_fav'));
        });
        ul.appendChild(li);
        const cv = li.querySelector('canvas');
        if (cv) this.drawRowCover(cv, t);
      });
    }
  };

  /* ============================================================
   *  Bootstrap
   * ============================================================ */
  window.AuroraApp = App;
  document.addEventListener('DOMContentLoaded', () => App.init());

  // Reanudar audio context al volver a la app (iOS)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && App.audioCtx && App.audioCtx.state === 'suspended' && App.isPlaying) {
      App.audioCtx.resume().catch(()=>{});
    }
  });
})();
