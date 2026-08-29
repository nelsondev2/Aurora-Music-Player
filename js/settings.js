/* =====================================================================
 *  js/settings.js — Aurora Music Player
 *  Sesión · estadísticas núcleo · temas · i18n
 *
 *  Parte del refactor (C) de app.js: mismo código, módulos por funcionalidad.
 *  Este archivo se carga tras js/state.js y completa el objeto App con
 *  Object.assign (los scripts son clásicos por compatibilidad webxdc).
 * ===================================================================== */

'use strict';

Object.assign(App, {
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
          originalQueue: this._originalQueue,
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
        if (this.shuffle && Array.isArray(session.originalQueue) && session.originalQueue.length) {
          this._originalQueue = session.originalQueue.filter(id => this.tracks.some(t => t.id === id));
        } else {
          this._originalQueue = null;
        }
        if (session.playContext && typeof session.playContext === 'object') {
          this.playContext = session.playContext;
        }

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
          this._langAlreadyChosen = true;
          return;
        }
        const nav = (navigator.language || navigator.userLanguage || 'es').slice(0, 2).toLowerCase();
        this.lang = this._isValidLang(nav) ? nav : 'es';
        this._langAlreadyChosen = true;
        try { localStorage.setItem('aurora_lang', this.lang); } catch (e2) {}
      } catch (e) {
        this.lang = 'es';
        this._langAlreadyChosen = true;
      }
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
      // title: data-i18n-title="key"
      document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const e = dict[key];
        if (e) el.setAttribute('title', e[this.lang] || e.es || key);
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
        if (this.currentTrack) this.renderCurrentTrack();
        if (typeof this.renderHome === 'function') this.renderHome();
        if (typeof this.updateChrome === 'function') this.updateChrome();
        const statsEl = document.getElementById('statsContent');
        if (statsEl && statsEl.innerHTML) this.renderStats();
        const histEl = document.getElementById('historyContent');
        if (histEl && histEl.innerHTML) this.renderHistory();
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

    loadPlaybackSettings() {
      try {
        const raw = localStorage.getItem('aurora_playback');
        if (raw) {
          const s = JSON.parse(raw);
          if (typeof s.gapless === 'boolean') this._gaplessEnabled = s.gapless;
          if (typeof s.normalize === 'boolean') this._normalizeVolume = s.normalize;
          if (typeof s.crossfade === 'number') {
            this.crossfadeDuration = s.crossfade;
            this.crossfadeEnabled = s.crossfade > 0;
          }
          if (typeof s.marquee === 'boolean') this._marqueeEnabled = s.marquee;
        }
      } catch (e) {}
    },
    savePlaybackSettings() {
      try {
        localStorage.setItem('aurora_playback', JSON.stringify({
          gapless: !!this._gaplessEnabled,
          normalize: !!this._normalizeVolume,
          crossfade: this.crossfadeDuration || 0,
          marquee: this._marqueeEnabled !== false
        }));
      } catch (e) {}
    },
    syncPlaybackSettingsUI() {
      const g = document.getElementById('toggleGapless');
      if (g) g.checked = !!this._gaplessEnabled;
      const n = document.getElementById('toggleNormalize');
      if (n) n.checked = !!this._normalizeVolume;
      const m = document.getElementById('toggleMarquee');
      if (m) m.checked = this._marqueeEnabled !== false;
      const xf = this.crossfadeDuration || 0;
      document.querySelectorAll('.xfade-opt').forEach(b => {
        b.classList.toggle('active', Number(b.dataset.xfade) === xf);
      });
      const ver = document.getElementById('aboutVersion');
      if (ver) ver.textContent = this.VERSION || '1.0.0';
    },

    syncDesktopLayout() {
      const wide = !!(window.matchMedia && window.matchMedia('(min-width: 900px)').matches) && !window.webxdc;
      document.documentElement.classList.toggle('aurora-wide', wide);
      const screen = document.getElementById('deviceScreen');
      if (screen) screen.classList.toggle('aurora-wide', wide);
      if (typeof this.updateChrome === 'function') this.updateChrome();
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
});
