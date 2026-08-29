/* =====================================================================
 *  js/player-ui.js — Aurora Music Player
 *  Render de la pista actual
 *
 *  Parte del refactor (C) de app.js: mismo código, módulos por funcionalidad.
 *  Este archivo se carga tras js/state.js y completa el objeto App con
 *  Object.assign (los scripts son clásicos por compatibilidad webxdc).
 * ===================================================================== */

'use strict';

Object.assign(App, {
    /* ============================================================
     *  UI: render pista actual
     * ============================================================ */
    renderCurrentTrack() {
      const t = this.currentTrack;
      if (!t) {
        this._shownCoverTrackId = null;
        if (typeof this.setBuffering === 'function') this.setBuffering(false);
        // Limpiar UI
        this.setMarqueeText(document.getElementById('trackTitle'), '—');
        this.setMarqueeText(document.getElementById('trackArtist'), this.t('load_track_to_start'));
        const albumEmpty = document.getElementById('trackAlbum');
        if (albumEmpty) { albumEmpty.textContent = ''; albumEmpty.style.display = 'none'; }
        document.getElementById('timeTotal').textContent = '0:00';
        document.getElementById('timeCurrent').textContent = '0:00';
        document.getElementById('progressFill').style.width = '0%';
        return;
      }
      this.setMarqueeText(document.getElementById('trackTitle'), t.title);
      this.setMarqueeText(document.getElementById('trackArtist'), t.artist || this.t('unknown_artist'));
      const albumEl = document.getElementById('trackAlbum');
      if (albumEl) {
        const hasAlbum = t.album && !this.isPlaceholderAlbum(t.album);
        albumEl.textContent = hasAlbum ? t.album : '';
        albumEl.style.display = hasAlbum ? '' : 'none';
      }
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
      if (this._shownCoverTrackId && this._shownCoverTrackId !== t.id) {
        if (typeof this.animateCoverTransition === 'function') this.animateCoverTransition();
      }
      this._shownCoverTrackId = t.id;
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
      ctx.font = (mini ? '700 38px ' : '900 220px ') + "ui-rounded, -apple-system, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(track.title.charAt(0).toUpperCase(), cx, cy);
      ctx.globalAlpha = 1;
    },

    setShuffleUI() {
      const btn = document.getElementById('btnShuffle');
      if (!btn) return;
      btn.classList.toggle('active', !!this.shuffle);
      btn.setAttribute('aria-pressed', this.shuffle ? 'true' : 'false');
    },

    setRepeatUI() {
      const btn = document.getElementById('btnRepeat');
      if (!btn) return;
      const mode = this.repeat || 'off';
      btn.classList.toggle('active', mode !== 'off');
      btn.dataset.mode = mode;
      btn.style.position = 'relative';
      btn.setAttribute('aria-pressed', mode !== 'off' ? 'true' : 'false');
      let badge = btn.querySelector('.repeat-badge');
      if (mode === 'one') {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'repeat-badge';
          badge.textContent = '1';
          btn.appendChild(badge);
        }
      } else if (badge) {
        badge.remove();
      }
    },

    updatePlayUI() {
      const play = document.getElementById('btnPlay');
      const playLyrics = document.getElementById('btnPlayLyrics');
      [play, playLyrics, document.getElementById('miniPlayerPlay')].forEach(b => {
        if (!b) return;
        const ip = b.querySelector('.icon-play');
        const ips = b.querySelector('.icon-pause');
        if (this.isPlaying) {
          if (ip) ip.style.display = 'none';
          if (ips) ips.style.display = 'block';
          b.setAttribute('aria-label', this.t('pause'));
        } else {
          if (ip) ip.style.display = 'block';
          if (ips) ips.style.display = 'none';
          b.setAttribute('aria-label', this.t('play'));
        }
      });
      const ca = document.getElementById('coverArt');
      if (ca) ca.classList.toggle('playing', this.isPlaying);

      // Visibilidad de las acciones del menú "Más opciones" según haya pista
      // actual. Si no hay pista (estado vacío), las acciones contextuales
      // (ir al artista, añadir a lista) no tienen sentido y se ocultan.
      const hasTrack = !!(this.currentTrack);
      const contextualMenuIds = ['menuAddToPlaylist', 'menuGoToArtist', 'menuGoToAlbum'];
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
      const mini = document.getElementById('miniProgress');
      if (mini) mini.style.width = pct + '%';
      if (curEl) curEl.textContent = this.fmtTime(cur);
      const track = document.getElementById('progressTrack');
      if (track) {
        track.setAttribute('aria-valuenow', String(Math.round(pct)));
        track.setAttribute('aria-valuetext', this.fmtTime(cur) + ' / ' + this.fmtTime(dur));
      }

      // Buffer
      const buf = document.getElementById('progressBuffer');
      if (buf && a.buffered && a.buffered.length > 0) {
        try {
          const end = a.buffered.end(a.buffered.length - 1);
          buf.style.width = ((end / dur) * 100) + '%';
        } catch (e) {}
      }

      if (typeof this.updateMediaPosition === 'function') this.updateMediaPosition();
    },

    fmtTime(s) {
      if (!s || isNaN(s)) return '0:00';
      s = Math.floor(s);
      const m = Math.floor(s / 60);
      const r = s % 60;
      return m + ':' + (r < 10 ? '0' : '') + r;
    },

    setMarqueeText(el, text) {
      if (!el) return;
      let inner = el.querySelector('.marquee-inner');
      if (!inner) {
        inner = document.createElement('span');
        inner.className = 'marquee-inner';
        el.textContent = '';
        el.appendChild(inner);
      }
      inner.textContent = text == null ? '' : String(text);
      this._syncMarquee(el);
    },

    _syncMarquee(el) {
      if (!el) return;
      const inner = el.querySelector('.marquee-inner');
      if (!inner) return;
      el.classList.remove('is-marquee');
      if (typeof inner.getAnimations === 'function') {
        inner.getAnimations().forEach(a => a.cancel());
      }
      inner.style.transform = '';
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => {
        const overflow = inner.scrollWidth - el.clientWidth;
        if (reduce || this._marqueeEnabled === false || overflow <= 8) return;
        el.classList.add('is-marquee');
        const slide = Math.max(2.4, overflow / 42);
        const pause = 1.5;
        const reset = 0.7;
        const total = pause + slide + pause + reset;
        if (typeof inner.animate !== 'function') return;
        inner.animate([
          { transform: 'translateX(0)', offset: 0 },
          { transform: 'translateX(0)', offset: pause / total },
          { transform: 'translateX(' + (-overflow) + 'px)', offset: (pause + slide) / total },
          { transform: 'translateX(' + (-overflow) + 'px)', offset: (pause + slide + pause) / total },
          { transform: 'translateX(0)', offset: 1 }
        ], { duration: total * 1000, iterations: Infinity, easing: 'ease-in-out' });
      });
    },
});
