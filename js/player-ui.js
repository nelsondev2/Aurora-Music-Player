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
        // Limpiar UI
        document.getElementById('trackTitle').textContent = '—';
        document.getElementById('trackArtist').textContent = this.t('load_track_to_start');
        const albumEmpty = document.getElementById('trackAlbum');
        if (albumEmpty) { albumEmpty.textContent = ''; albumEmpty.style.display = 'none'; }
        document.getElementById('timeTotal').textContent = '0:00';
        document.getElementById('timeCurrent').textContent = '0:00';
        document.getElementById('progressFill').style.width = '0%';
        return;
      }
      document.getElementById('trackTitle').textContent = t.title;
      document.getElementById('trackArtist').textContent = t.artist || this.t('unknown_artist');
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
});
