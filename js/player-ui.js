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
        // La cabecera vuelve a su texto neutro cuando no hay pista.
        const ctxIdle = document.getElementById('nowPlayingContext');
        if (ctxIdle) {
          ctxIdle.textContent = this.t('your_library');
          ctxIdle.removeAttribute('title');
        }
        return;
      }
      this.setMarqueeText(document.getElementById('trackTitle'), t.title);
      this.setMarqueeText(document.getElementById('trackArtist'), t.artist || this.t('unknown_artist'));
      const albumEl = document.getElementById('trackAlbum');
      if (albumEl) {
        // El álbum se oculta si no aporta nada: vacío/marcador, o igual
        // al título (típico en sencillos: el mismo nombre dos veces)
        // o al artista. La comparación ignora mayúsculas y espacios.
        const normTxt = (v) => String(v == null ? '' : v).trim().toLowerCase();
        const hasAlbum = t.album && !this.isPlaceholderAlbum(t.album)
          && normTxt(t.album) !== normTxt(t.title)
          && normTxt(t.album) !== normTxt(t.artist);
        albumEl.textContent = hasAlbum ? t.album : '';
        albumEl.style.display = hasAlbum ? '' : 'none';
      }
      document.getElementById('timeTotal').textContent = this.fmtTime(t.duration);
      document.getElementById('miniTitle').textContent = t.title;
      document.getElementById('miniArtist').textContent = t.artist;
      // La cabecera de Letras ya no repite título — artista (va en la
      // mini-cabecera). Su barra inferior sí muestra la duración total.
      const lrcTotal = document.getElementById('lyricsTimeTotal');
      if (lrcTotal) lrcTotal.textContent = this.fmtTime(t.duration);
      // Cabecera en una sola frase: «Reproduciendo desde <contexto>»
      // (la lista, Favoritos, el álbum…). Sin contexto se queda el
      // texto neutro de la biblioteca. El título no va aquí: ya va en
      // grande bajo la portada; completo queda en el tooltip.
      const ctxEl = document.getElementById('nowPlayingContext');
      if (ctxEl) {
        const ctxLabel = (typeof this.getPlayContextLabel === 'function') ? this.getPlayContextLabel() : null;
        ctxEl.textContent = ctxLabel
          ? this.t('playing_from') + ' ' + ctxLabel
          : this.t('your_library');
        const fullTitle = (t.title || '') + (t.artist ? ' — ' + t.artist : '');
        if (fullTitle) ctxEl.setAttribute('title', fullTitle);
        else ctxEl.removeAttribute('title');
      }

      // Colores dinámicos (para el fondo y visualizador)
      const cover = (typeof t.cover === 'object' && t.cover.from) ? t.cover : (this.coverFallback ? this.coverFallback() : { from: '#6E5CFF', to: '#FF7AB6', angle: 135 });
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
      this.updateCoverA11y();
      if (typeof this.applyVinylMode === 'function') this.applyVinylMode();

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
        /* Las pistas restauradas de una copia pueden traer `coverIsImage`
         * sin el campo `cover` (el backup no lo exporta); antes se leía
         * `track.cover.dataURL` sin proteger y la vista del reproductor
         * reventaba. Se usa la miniatura disponible y, si no hay nada
         * dibujable, se cae al gradiente como en las filas. */
        const src = typeof track.cover === 'string' ? track.cover
          : (this.coverSrcForRow ? this.coverSrcForRow(track, Math.max(w, h)) : null)
            || (track.cover && track.cover.dataURL) || '';
        if (src) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, w, h);
            // Modo "cover"
            const ratio = Math.max(w / img.width, h / img.height);
            const dw = img.width * ratio, dh = img.height * ratio;
            ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
          };
          img.src = src;
          // Fondo provisional mientras carga
          ctx.fillStyle = '#222';
          ctx.fillRect(0, 0, w, h);
          return;
        }
      }

      // Generar gradiente dinámico
      const cover = (typeof track.cover === 'object' && track.cover.from) ? track.cover : (this.coverFallback ? this.coverFallback() : { from: '#6E5CFF', to: '#FF7AB6' });
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
      ctx.font = (mini ? '700 38px ' : '900 220px ') + "Outfit, ui-rounded, -apple-system, sans-serif";
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

    /* Nombre accesible y estado de la portada (role=button). Se usa desde
     * renderCurrentTrack() y updatePlayUI(); antes el bloque estaba
     * duplicado y podía divergir entre ambos caminos. */
    updateCoverA11y() {
      const ca = document.getElementById('coverArt');
      if (!ca) return;
      ca.classList.toggle('playing', this.isPlaying);
      const label = this.isPlaying ? this.t('pause') : this.t('play');
      const title = this.currentTrack ? ' · ' + this.currentTrack.title : '';
      ca.setAttribute('aria-label', label + title);
      ca.setAttribute('aria-pressed', this.isPlaying ? 'true' : 'false');
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
      this.updateCoverA11y();
      if (typeof this.applyVinylMode === 'function') this.applyVinylMode();

      /* Los anillos de «esta lista está sonando» (hero de la lista
       * abierta y «Reproducir Todo» de Favoritos) se pintan al
       * renderizar, pero pausar desde el mini-reproductor con la hoja
       * abierta no re-renderiza: quedaban encendidos en pausa. Aquí
       * se re-sincronizan con cada cambio de play/pausa. */
      const favBtn = document.getElementById('btnPlayFavoritesNow');
      if (favBtn) {
        favBtn.classList.toggle('is-playing',
          this.isPlaying && !!this.playContext && this.playContext.type === 'favorites');
      }
      if (this._editingPlaylistId && typeof this.isPlaylistPlaying === 'function') {
        const pl = (this.playlists || []).find(p => p && p.id === this._editingPlaylistId);
        if (pl) {
          const on = this.isPlaylistPlaying(pl);
          const hero = document.getElementById('btnPlayPlaylistNow');
          if (hero) hero.classList.toggle('is-playing', on);
          const cover = document.getElementById('editPlaylistCover');
          if (cover) cover.classList.toggle('is-playing', on);
        }
      }

      /* «Seguir escuchando» de Inicio: mientras la pista suena, la
       * tarjeta sobra (ya la estás escuchando); al pausar vuelve
       * como «retomar». Se conmuta sin repintar Inicio entero. Si
       * la pista cambió con Inicio montado, el data-track no
       * coincide y sí se repinta para no enseñar la anterior. */
      const homeHeroEl = document.getElementById('homeHero');
      if (homeHeroEl) {
        if (this.currentTrack && homeHeroEl.dataset.track && homeHeroEl.dataset.track !== this.currentTrack.id) {
          if (typeof this.renderHome === 'function') this.renderHome();
        } else {
          homeHeroEl.hidden = !!this.isPlaying;
        }
      }

      // Visualizador en tiempo real
      if (this.isPlaying) {
        if (typeof this.startVisualizer === 'function') this.startVisualizer();
      } else {
        if (typeof this.stopVisualizer === 'function') this.stopVisualizer();
      }

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

      // Repetición A-B (#22)
      if (this.abRepeat && this.abRepeat.active && this.abRepeat.b !== null && this.abRepeat.a !== null) {
        if (cur >= this.abRepeat.b) {
          this.seekToTime(this.abRepeat.a);
          return;
        }
      }

      // Repetición de sección de letras (#19): rango elegido a mano en la
      // vista de letras ({start, end} en segundos de la canción). Se aplica
      // aquí, no en el RAF de letras, para que siga activa al volver al
      // reproductor.
      if (this.lrcLoop && this.lrcLoop.end > this.lrcLoop.start) {
        const lyrCur = cur - (this.lrcOffset || 0);
        if (lyrCur >= this.lrcLoop.end) {
          this.seekToTime(this.lrcLoop.start + (this.lrcOffset || 0));
          return;
        }
      }

      const pct = dur > 0 ? (cur / dur) * 100 : 0;
      const fill = document.getElementById('progressFill');
      const curEl = document.getElementById('timeCurrent');
      if (fill) fill.style.width = pct + '%';
      // Barra de progreso de la vista de Letras (misma fuente de verdad).
      const lrcFill = document.getElementById('lyricsProgressFill');
      if (lrcFill) lrcFill.style.width = pct + '%';
      const lrcCur = document.getElementById('lyricsTimeCurrent');
      if (lrcCur) lrcCur.textContent = this.fmtTime(cur);
      const lrcTot = document.getElementById('lyricsTimeTotal');
      if (lrcTot && dur > 0) lrcTot.textContent = this.fmtTime(dur);
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
      const r = s % 60;
      const pad = (n) => (n < 10 ? '0' : '') + n;
      // A partir de una hora, «90:00» engaña: formato h:mm:ss.
      if (s >= 3600) {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return h + ':' + pad(m) + ':' + pad(r);
      }
      return Math.floor(s / 60) + ':' + pad(r);
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

    applyVinylMode() {
      const art = document.getElementById('coverArt');
      const sec = document.querySelector('.cover-section');
      const on = !!this._vinylEnabled;
      if (art) art.classList.toggle('vinyl-mode', on);
      if (sec) sec.classList.toggle('vinyl-on', on);
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
        const ws = window.getComputedStyle(el).whiteSpace;
        if (ws && ws !== 'nowrap') return;
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
