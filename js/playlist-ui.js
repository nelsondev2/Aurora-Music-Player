/* =====================================================================
 *  js/playlist-ui.js — Aurora Music Player
 *  Render de colas, biblioteca y playlists · portadas
 *
 *  Parte del refactor (C) de app.js: mismo código, módulos por funcionalidad.
 *  Este archivo se carga tras js/state.js y completa el objeto App con
 *  Object.assign (los scripts son clásicos por compatibilidad webxdc).
 * ===================================================================== */

'use strict';

Object.assign(App, {
    /* ============================================================
     *  Portadas de fila y render de listas
     * ============================================================ */
    coverSrcForRow(track, size) {
      if (!track) return null;
      // La portada personalizada manda sobre la de los metadatos.
      if (track.customCover) {
        return size >= 160
          ? (track.customCover.lg || track.customCover.thumb)
          : (track.customCover.thumb || track.customCover.lg);
      }
      if (size >= 160 && track.coverThumbLg) return track.coverThumbLg;
      if (track.coverThumb) return track.coverThumb;
      if (size >= 160 && track.coverThumb) return track.coverThumb;
      return null;
    },

    drawRowCover(canvas, track) {
      if (!canvas || !track) return;
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const isImage = !!track.customCover || track.coverIsImage || (typeof track.cover === 'string' && (track.cover.startsWith('data:') || track.cover.startsWith('blob:')));
      const thumb = this.coverSrcForRow(track, Math.max(W, H));

      const paintImg = (src) => {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0,0,W,H);
          const r = Math.max(W/img.width, H/img.height);
          const dw = img.width*r, dh = img.height*r;
          ctx.drawImage(img, (W-dw)/2, (H-dh)/2, dw, dh);
        };
        img.src = src;
        ctx.fillStyle = '#222'; ctx.fillRect(0,0,W,H);
      };

      if (isImage && thumb) {
        paintImg(thumb);
        return;
      }
      if (isImage && !thumb) {
        this._paintLetterCover(ctx, W, H, track);
        this.ensureCoverThumbs(track).then((ok) => {
          if (ok && canvas.isConnected) this.drawRowCover(canvas, track);
        });
        return;
      }

      this._paintLetterCover(ctx, W, H, track);
    },

    _paintLetterCover(ctx, W, H, track) {
      const cover = (typeof track.cover === 'object' && track.cover.from) ? track.cover : (this.coverFallback ? this.coverFallback() : { from: '#6E5CFF', to: '#FF7AB6' });
      const g = ctx.createLinearGradient(0,0,W,H);
      g.addColorStop(0, cover.from); g.addColorStop(1, cover.to);
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
      // Surcos concéntricos sutiles (misma familia que la portada grande)
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      const cx = W / 2, cy = H / 2;
      const step = Math.max(6, Math.min(W, H) / 7);
      for (let r = step; r < Math.max(W, H); r += step) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = "700 " + Math.floor(H*0.48) + "px Outfit, ui-rounded, sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((track.title || '?').charAt(0).toUpperCase(), W/2, H/2 + Math.floor(H*0.02));
    },

    async ensureCoverThumbs(track) {
      if (!track || track.coverThumb) return !!track.coverThumb;
      if (track._thumbing) return false;
      const src = (typeof track.cover === 'string' && (track.cover.startsWith('data:') || track.cover.startsWith('blob:'))) ? track.cover : null;
      if (!src) return false;
      const U = window.AuroraUploader;
      if (!U || typeof U.resizeDataUrl !== 'function') return false;
      track._thumbing = true;
      try {
        track.coverThumb = await U.resizeDataUrl(src, 96);
        track.coverThumbLg = await U.resizeDataUrl(src, 256);
        track._thumbsDirty = true;
        if (!this._thumbPersistTimer) {
          this._thumbPersistTimer = setTimeout(() => {
            this._thumbPersistTimer = null;
            this.tracks.filter(tr => tr._thumbsDirty).forEach(tr => {
              tr._thumbsDirty = false;
              this.persistTrack(tr);
            });
          }, 2500);
        }
        return !!track.coverThumb;
      } catch (e) {
        return false;
      } finally {
        track._thumbing = false;
      }
    },

    /* ============================================================
     *  Portada personalizada por pista
     *  La imagen que elige el usuario pasa a ser LA portada de la
     *  pista en todas partes (filas, reproductor, mosaicos de listas,
     *  sesión). Se guarda en track.customCover como dos miniaturas
     *  JPEG (96 y 256 px, recorte cuadrado centrado con el mismo
     *  resizeDataUrl del importador) y tiene prioridad sobre la
     *  portada de los metadatos en todos los resolvedores: ni un
     *  re-etiquetado puede pisarla, y quitarla devuelve la original,
     *  que nunca se modifica.
     * ============================================================ */
    pickCustomCover(trackId) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      const cleanup = () => { try { input.remove(); } catch (e) {} };
      let settled = false;
      input.addEventListener('change', async (e) => {
        settled = true;
        const file = e.target.files && e.target.files[0];
        cleanup();
        if (file) await this.setCustomCover(trackId, file);
      });
      // Si el usuario cancela, algunos navegadores no disparan change:
      // al recuperar el foco se retira el input (sin nodos huérfanos).
      window.addEventListener('focus', () => {
        setTimeout(() => { if (!settled) cleanup(); }, 300);
      }, { once: true });
      input.click();
    },

    async setCustomCover(trackId, file) {
      const t = this.tracks.find(x => x.id === trackId);
      if (!t || !file) return false;
      const looksImage = (file.type && file.type.indexOf('image/') === 0) ||
        /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name || '');
      if (!looksImage) { this.toast(this.t('toast_cover_error')); return false; }
      if (file.size > 15 * 1024 * 1024) { this.toast(this.t('toast_file_too_large')); return false; }
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = () => reject(r.error || new Error('lectura'));
          r.readAsDataURL(file);
        });
        const U = window.AuroraUploader;
        if (!U || typeof U.resizeDataUrl !== 'function') throw new Error('sin resizeDataUrl');
        const lg = await U.resizeDataUrl(dataUrl, 256);
        const thumb = await U.resizeDataUrl(dataUrl, 96);
        if (!lg && !thumb) throw new Error('imagen ilegible');
        t.customCover = { thumb: thumb || lg, lg: lg || thumb };
        await this.persistTrack(t);
        this._refreshCoverSurfaces(t);
        this.toast(this.t('toast_cover_updated'));
        return true;
      } catch (e) {
        this.toast(this.t('toast_cover_error'));
        return false;
      }
    },

    async removeCustomCover(trackId) {
      const t = this.tracks.find(x => x.id === trackId);
      if (!t || !t.customCover) return;
      delete t.customCover;
      await this.persistTrack(t);
      this._refreshCoverSurfaces(t);
      this.toast(this.t('toast_cover_removed'));
    },

    /* Tras cambiar/quitar la portada: la caché de artwork del
     * reproductor (Media Session incluida) y los mosaicos de las
     * listas que contienen la pista quedan obsoletos; se invalidan y
     * se repintan las superficies visibles. */
    _refreshCoverSurfaces(t) {
      if (!t) return;
      if (typeof this._invalidateArtwork === 'function') this._invalidateArtwork(t.id);
      this.playlists.forEach(pl => {
        if ((pl.trackIds || []).includes(t.id)) this._invalidatePlaylistCover(pl);
      });
      this.renderLibrary();
      this.renderPlaylists();
      this.renderQueue();
      this.renderFavorites();
      if (typeof this.renderHome === 'function') this.renderHome();
      if (this.currentTrack && this.currentTrack.id === t.id) {
        this.renderCurrentTrack();
        if (typeof this.updateMiniPlayer === 'function') this.updateMiniPlayer();
      }
      // La cabecera del menú de pista también pinta la portada.
      const menuCv = document.getElementById('trackMenuCover');
      if (menuCv && this._menuTrackId === t.id) this.drawRowCover(menuCv, t);
    },

    _playlistTrackArtSrc(t) {
      if (!t) return null;
      if (t.customCover) return t.customCover.lg || t.customCover.thumb;
      if (t.coverThumbLg) return t.coverThumbLg;
      if (t.coverThumb) return t.coverThumb;
      if (typeof t.cover === 'string' && (t.cover.startsWith('data:') || t.cover.startsWith('blob:'))) return t.cover;
      return null;
    },

    _playlistCoverFallback(pl) {
      return pl && pl.cover
        ? pl.cover
        : (this.coverFallback ? this.coverFallback() : { from: '#6E5CFF', to: '#FF7AB6', angle: 135 });
    },

    _hydratePlaylistCover(pl) {
      if (!pl) return;
      if (pl.coverArt && !pl._coverCache) {
        pl._coverCache = pl.coverArt;
        pl._coverCacheHash = pl.coverArtHash || null;
      }
    },

    _invalidatePlaylistCover(pl) {
      if (!pl) return;
      pl._coverCache = null;
      pl._coverCacheHash = null;
      pl._coverPending = null;
      pl.coverArt = null;
      pl.coverArtHash = null;
    },

    _persistPlaylistCoverSoon(pl) {
      if (!pl || !pl.id) return;
      if (!this._coverPersistIds) this._coverPersistIds = new Set();
      this._coverPersistIds.add(pl.id);
      if (this._coverPersistTimer) return;
      this._coverPersistTimer = setTimeout(() => {
        this._coverPersistTimer = null;
        const ids = this._coverPersistIds;
        this._coverPersistIds = new Set();
        ids.forEach(id => {
          const p = this.playlists.find(x => x.id === id);
          if (p) this.persistPlaylist(p);
        });
      }, 400);
    },

    /* ============================================================
     *  Cover de playlist — collage de hasta 8 portadas
     * ============================================================
     *  Devuelve dataURL si hay al menos una pista con arte, o el
     *  gradiente de la lista. Se cachea en RAM y se persiste en
     *  pl.coverArt para sobrevivir recargas. */
    getPlaylistCover(pl) {
      const fallback = this._playlistCoverFallback(pl);
      this._hydratePlaylistCover(pl);
      // Con el índice id->pista: buscar cada id con find() sobre miles
      // de pistas hacía renderPlaylists cuadrático (medido en el estrés).
      const tracks = (pl.trackIds || [])
        .map(id => this.getTrackById(id))
        .filter(Boolean);
      const withImage = tracks.filter(t => this._playlistTrackArtSrc(t));

      if (withImage.length === 0) {
        const stored = pl._coverCache || pl.coverArt || null;
        if (stored && (pl.trackIds || []).length) return stored;
        if (stored) {
          this._invalidatePlaylistCover(pl);
          this._persistPlaylistCoverSoon(pl);
        }
        return fallback;
      }

      const hash = (pl.trackIds || []).join('|') + '#' + withImage.map(t => {
        const src = this._playlistTrackArtSrc(t) || '';
        return t.id + ':' + src.length;
      }).join(',');
      const cached = pl._coverCache || pl.coverArt || null;
      const cachedHash = pl._coverCacheHash || pl.coverArtHash || null;
      if (cached && cachedHash === hash) {
        pl._coverCache = cached;
        pl._coverCacheHash = hash;
        return cached;
      }
      if (pl._coverPending === hash) {
        return cached || fallback;
      }
      pl._coverPending = hash;

      // Construir collage: primeras 8 portadas (orden estable, sin random)
      const SIZE = 256;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d');

      const selected = withImage.slice(0, Math.min(8, withImage.length));
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
          img.src = this._playlistTrackArtSrc(t) || '';
        });
      }));

      promises.then(images => {
        const valid = images.filter(Boolean);
        if (pl._coverPending === hash) pl._coverPending = null;
        if (valid.length === 0) return;
        drawCollage(valid);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        pl._coverCache = dataUrl;
        pl._coverCacheHash = hash;
        pl.coverArt = dataUrl;
        pl.coverArtHash = hash;
        this._applyPlaylistCover(pl, dataUrl);
        this._persistPlaylistCoverSoon(pl);
      }).catch(() => { if (pl._coverPending === hash) pl._coverPending = null; });

      return cached || fallback;
    },

    _applyPlaylistCover(pl, dataUrl) {
      if (!pl || !dataUrl) return;
      document.querySelectorAll('[data-pl-cover="' + CSS.escape(pl.id) + '"]').forEach(el => {
        el.style.backgroundImage = 'url(' + dataUrl + ')';
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.classList.add('has-art');
        const icon = el.querySelector('.pl-cover-icon');
        if (icon) icon.remove();
      });
      if (this._editingPlaylistId === pl.id) {
        const edit = document.getElementById('editPlaylistCover');
        if (edit) {
          edit.style.background = '';
          edit.innerHTML = '<img src="' + dataUrl + '" alt="">';
        }
      }
    },

    /* Helper: dibuja una imagen cubriendo un rect (object-fit: cover) */
    _drawImageCover(ctx, img, x, y, w, h) {
      const r = Math.max(w / img.width, h / img.height);
      const dw = img.width * r, dh = img.height * r;
      const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    },

    unbindVirtualList(ul) {
      if (!ul || !ul._virt) return;
      const st = ul._virt;
      if (st.scroller && st.onScroll) st.scroller.removeEventListener('scroll', st.onScroll);
      if (st._raf) cancelAnimationFrame(st._raf);
      ul._virt = null;
      ul.classList.remove('virt');
    },

    fillVirtualList(ul, items, makeRow, opts) {
      opts = opts || {};
      const threshold = opts.threshold || 80;
      const rowH = opts.rowHeight || 64;
      this.unbindVirtualList(ul);
      ul.innerHTML = '';
      if (!items.length) return;
      if (items.length <= threshold) {
        items.forEach((it, i) => {
          const row = makeRow(it, i);
          if (row) ul.appendChild(row);
        });
        return;
      }
      const scroller = opts.scroller || ul.closest('.sheet-body') || ul;
      ul.classList.add('virt');
      const spacer = document.createElement('li');
      spacer.className = 'virt-spacer';
      spacer.style.height = (items.length * rowH) + 'px';
      ul.appendChild(spacer);
      const state = { ul, items, makeRow, rowH, scroller, spacer };
      const paint = () => this._paintVirtual(state);
      state.onScroll = () => {
        if (state._raf) return;
        state._raf = requestAnimationFrame(() => { state._raf = 0; paint(); });
      };
      scroller.addEventListener('scroll', state.onScroll, { passive: true });
      ul._virt = state;
      paint();
    },

    _paintVirtual(state) {
      const { ul, items, makeRow, rowH, scroller, spacer } = state;
      if (!ul.isConnected) return;
      const ulRect = ul.getBoundingClientRect();
      const scRect = scroller.getBoundingClientRect();
      const startPx = Math.max(0, scRect.top - ulRect.top);
      const overscan = 8;
      let start = Math.max(0, Math.floor(startPx / rowH) - overscan);
      let end = Math.min(items.length, Math.ceil((startPx + scroller.clientHeight) / rowH) + overscan);
      const keep = new Set();
      Array.from(ul.children).forEach(ch => {
        if (ch === spacer) return;
        const idx = parseInt(ch.dataset.virtIdx, 10);
        // La fila que se está arrastrando no se retira aunque salga de
        // la ventana al hacer autoscroll: desaparecería a mitad de gesto.
        if (state.dragIdx != null && idx === state.dragIdx) { keep.add(idx); return; }
        if (idx < start || idx >= end) ch.remove();
        else keep.add(idx);
      });
      for (let i = start; i < end; i++) {
        if (keep.has(i)) continue;
        const row = makeRow(items[i], i);
        if (!row) continue;
        row.dataset.virtIdx = String(i);
        row.style.position = 'absolute';
        row.style.left = '0';
        row.style.right = '0';
        row.style.top = (i * rowH) + 'px';
        row.style.height = rowH + 'px';
        ul.appendChild(row);
      }
    },

    renderQueue() {
      const ul = document.getElementById('queueList');
      if (!ul) return;
      ul.innerHTML = '';
      // Subtítulo con el contexto actual ("Reproduciendo desde X"),
      // la misma frase que usa la cabecera del reproductor.
      const ctxLabel = document.getElementById('queueContextLabel');
      if (ctxLabel) {
        const cl = this.getPlayContextLabel();
        if (cl) {
          ctxLabel.textContent = this.t('playing_from') + ' ' + cl;
          ctxLabel.style.display = '';
        } else {
          ctxLabel.textContent = '';
          ctxLabel.style.display = 'none';
        }
      }
      const cleaned = this.queue.filter(id => this.trackMap().has(id));
      if (cleaned.length !== this.queue.length) {
        const curId = this.currentTrack && this.currentTrack.id;
        this.queue = cleaned;
        const nq = curId ? this.queue.indexOf(curId) : -1;
        this.queueIdx = nq >= 0 ? nq : Math.min(this.queueIdx, Math.max(0, this.queue.length - 1));
      }
      if (this.queue.length === 0) {
        ul.innerHTML = '';
        const emptyLi = document.createElement('li');
        emptyLi.className = 'empty-state compact';
        emptyLi.innerHTML = this.emptyStateHtml({
          icon: 'list-ol',
          title: this.t('queue_empty')
        });
        ul.appendChild(emptyLi);
        return;
      }
      const makeQueueRow = (id, i) => {
        const t = this.tracks.find(x => x.id === id);
        if (!t) return null;
        const li = document.createElement('li');
        li.className = 'queue-item' + (i === this.queueIdx ? ' current' : '');
        li.dataset.idx = i;
        li.innerHTML = `
          <button class="drag-handle" aria-label="${this.esc(this.t('move'))}"><svg class="ico" aria-hidden="true"><use href="#i-grip-vertical"></use></svg></button>
          <div class="row-cover"><canvas width="44" height="44"></canvas></div>
          <div class="row-text">
            <div class="row-title">${this.esc(t.title)}</div>
            <div class="row-sub">${this.esc(t.artist)}</div>
          </div>
          <div class="row-duration">${this.fmtRowDuration(t)}</div>
          <button class="row-action queue-remove" aria-label="${this.esc(this.t('remove'))}"><svg class="ico" aria-hidden="true"><use href="#i-xmark"></use></svg></button>
        `;
        // Click normal → reproducir
        li.addEventListener('click', (e) => {
          if (e.target.closest('.drag-handle, .queue-remove')) return;
          this.playFromQueue(i);
          if (typeof this.openPlayerForTrackPick === 'function') this.openPlayerForTrackPick();
        });
        // Quitar de la cola
        li.querySelector('.queue-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          const removedId = this.queue[i];
          const wasCurrent = (i === this.queueIdx) && this.currentTrack && this.currentTrack.id === removedId;
          this.queue.splice(i, 1);
          if (typeof this._removeFromOriginalQueue === 'function') this._removeFromOriginalQueue(removedId);
          if (i < this.queueIdx) this.queueIdx--;
          else if (i === this.queueIdx) this.queueIdx = Math.min(this.queueIdx, this.queue.length - 1);
          if (this.queueIdx < 0) this.queueIdx = 0;
          // Si era la pista en reproducción, detenerla
          if (wasCurrent) {
            if (this.queue.length) {
              this.playFromQueue(this.queueIdx);
              this.toast(this.t('toast_removed_from_playlist'));
            } else {
              this.stopPlayback();
              this.toast(this.t('toast_removed_from_queue_stopped'));
            }
          }
          this.renderQueue();
        });

        // Drag handle → reordenar (touch + mouse)
        this.wireDragHandle(li, i, ul, '.queue-item');

        const cv = li.querySelector('canvas');
        if (cv) this.drawRowCover(cv, t);
        return li;
      };
      this.fillVirtualList(ul, this.queue, makeQueueRow, {
        scroller: ul.closest('.sheet-body'),
        rowHeight: 64
      });
    },

    /* Reordenar arrastrando el asa (Pointer Events: un solo camino
     * para dedo y ratón, con captura del puntero para no perder el
     * gesto al salir de la fila).
     * - La fila sigue al dedo con transform; una línea de acento marca
     *   el hueco destino (una sola fila cada vez).
     * - Cerca del borde superior/inferior la lista se desplaza sola
     *   (autoscroll) para poder llevar una pista lejos incluso en
     *   colas largas; con lista virtualizada (>80) la fila arrastrada
     *   se marca en el estado (dragIdx) para que el repintado al
     *   desplazar no la elimine del DOM a mitad de gesto.
     * - Al soltar se calcula el índice final con el modelo de
     *   inserción (el hueco antes/después de cada fila) y se aplica:
     *   en la cola, también a _originalQueue si el aleatorio está
     *   activo (para que al desactivarlo no se pierda el orden nuevo)
     *   y se guarda la sesión al momento. */
    wireDragHandle(li, idx, ul, itemSelector, opts) {
      const handle = li.querySelector('.drag-handle');
      if (!handle) return;
      const scroller = ul.closest('.sheet-body') || ul.parentElement;
      let dragging = false;
      let startY = 0;
      let startIdx = idx;
      let startScroll = 0;
      let lastY = 0;
      let scrollTimer = null;

      const items = () => Array.from(ul.querySelectorAll(itemSelector));
      const targetIndexFor = (clientY) => {
        const rows = items().filter(it => it !== li);
        if (!rows.length) return startIdx;
        let placed = null;
        for (const it of rows) {
          const r = it.getBoundingClientRect();
          if (clientY < r.top + r.height / 2) {
            placed = parseInt(it.dataset.idx, 10);
            break;
          }
        }
        if (placed === null) placed = parseInt(rows[rows.length - 1].dataset.idx, 10) + 1;
        if (isNaN(placed)) return startIdx;
        // «placed» es el hueco de inserción sin la fila arrastrada:
        // se convierte a índice final tras extraerla de startIdx.
        let to = placed > startIdx ? placed - 1 : placed;
        const maxIdx = (opts && opts.maxIndex != null)
          ? opts.maxIndex
          : this.queue.length - 1;
        return Math.max(0, Math.min(maxIdx, to));
      };
      const markTarget = (clientY) => {
        const to = targetIndexFor(clientY);
        items().forEach(it => {
          if (it === li) return;
          const i = parseInt(it.dataset.idx, 10);
          // El hueco destino es antes de la fila «to» (o después de la
          // última si se suelta al final): se marca solo esa fila.
          it.classList.toggle('drop-above', i === to && to <= startIdx);
          it.classList.toggle('drop-below', i === to && to > startIdx);
        });
        return to;
      };
      const clearMarks = () => items().forEach(it => it.classList.remove('drop-above', 'drop-below'));
      const stopAutoScroll = () => {
        if (scrollTimer) { clearInterval(scrollTimer); scrollTimer = null; }
      };
      // Sin compensación, al desplazarse la lista la fila se despegaría
      // del dedo: el transform suma lo que el contenido haya bajado.
      const paintDrag = () => {
        const scrolled = scroller ? scroller.scrollTop - startScroll : 0;
        li.style.transform = `translateY(${lastY - startY + scrolled}px)`;
      };
      const autoScroll = (clientY) => {
        if (!scroller || scroller === ul) return;
        const r = scroller.getBoundingClientRect();
        const EDGE = 56;
        const STEP = 14;
        let dy = 0;
        if (clientY < r.top + EDGE) dy = -STEP;
        else if (clientY > r.bottom - EDGE) dy = STEP;
        if (!dy) { stopAutoScroll(); return; }
        if (scrollTimer) return;
        // Aunque el dedo no se mueva, cada tick recoloca la fila y
        // recalcula el destino con las filas recién pintadas.
        scrollTimer = setInterval(() => {
          scroller.scrollTop += dy;
          paintDrag();
          markTarget(lastY);
        }, 16);
      };

      handle.addEventListener('pointerdown', (e) => {
        if (dragging) return;
        e.preventDefault();
        e.stopPropagation();
        dragging = true;
        startY = e.clientY;
        lastY = e.clientY;
        startScroll = scroller ? scroller.scrollTop : 0;
        startIdx = parseInt(li.dataset.idx, 10);
        if (isNaN(startIdx)) startIdx = idx;
        try { handle.setPointerCapture(e.pointerId); } catch (err) {}
        li.classList.add('dragging');
        li.style.zIndex = '10';
        if (ul._virt) ul._virt.dragIdx = startIdx;
        if (navigator.vibrate) navigator.vibrate(15);
      });
      handle.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        e.preventDefault();
        lastY = e.clientY;
        paintDrag();
        autoScroll(e.clientY);
        markTarget(e.clientY);
      });
      const finish = (e, commit) => {
        if (!dragging) return;
        dragging = false;
        stopAutoScroll();
        const to = commit ? markTarget(e.clientY) : startIdx;
        clearMarks();
        li.classList.remove('dragging');
        li.style.transform = '';
        li.style.zIndex = '';
        if (ul._virt && ul._virt.dragIdx === startIdx) ul._virt.dragIdx = null;
        if (!commit || to === startIdx) return;
        if (opts && typeof opts.onReorder === 'function') {
          opts.onReorder(startIdx, to);
          return;
        }
        const moved = this.queue.splice(startIdx, 1)[0];
        this.queue.splice(to, 0, moved);
        if (this.queueIdx === startIdx) this.queueIdx = to;
        else if (startIdx < this.queueIdx && to >= this.queueIdx) this.queueIdx--;
        else if (startIdx > this.queueIdx && to <= this.queueIdx) this.queueIdx++;
        // Con aleatorio activo la cola visible es una permutación:
        // la misma mudanza se refleja en la original por id (si un id
        // estuviera repetido se mueve la primera aparición; la cola
        // no suele tener duplicados).
        if (this.shuffle && Array.isArray(this._originalQueue) && this._originalQueue.length) {
          const fromOrig = this._originalQueue.indexOf(moved);
          if (fromOrig >= 0) {
            this._originalQueue.splice(fromOrig, 1);
            this._originalQueue.splice(Math.min(to, this._originalQueue.length), 0, moved);
          }
        }
        if (typeof this.saveSession === 'function') this.saveSession();
        this.renderQueue();
      };
      handle.addEventListener('pointerup', (e) => finish(e, true));
      handle.addEventListener('pointercancel', (e) => finish(e, false));
    },

    clearUpcomingQueue() {
      if (!this.queue.length) return;
      const keep = this.queue[this.queueIdx];
      if (keep == null) {
        this.queue = [];
        this.queueIdx = 0;
        this._originalQueue = null;
      } else {
        this.queue = [keep];
        this.queueIdx = 0;
        if (this._originalQueue) this._originalQueue = [keep];
      }
      this.renderQueue();
      this.toast(this.t('toast_queue_cleared'));
    },

    renderLibrary() {
      const ul = document.getElementById('libraryTracks');
      const hasTracks = this.tracks.length > 0;
      // Contador de la sección: con 0 no se muestra (un «0» junto al
      // estado vacío era ruido). La cabecera se adapta al contenido.
      const countEl = document.getElementById('librarySongsCount');
      if (countEl) {
        countEl.textContent = String(this.tracks.length);
        countEl.hidden = !hasTracks;
      }
      const actions = document.getElementById('libSongActions');
      if (actions) actions.hidden = !hasTracks;
      const deleteAll = document.getElementById('btnDeleteAllTracks');
      if (deleteAll) deleteAll.hidden = !hasTracks;
      const sortRow = document.getElementById('libSortRow');
      if (sortRow) sortRow.hidden = !hasTracks;
      if (!ul) return;
      if (!hasTracks) {
        this.unbindVirtualList(ul);
        ul.innerHTML = '';
        const li = document.createElement('li');
        li.className = 'empty-state lib-empty-cta';
        // Mismo lenguaje que la bienvenida de Inicio, con la acción
        // imprescindible: importar música sin salir de la biblioteca.
        li.innerHTML = this.emptyStateHtml({
          icon: 'music',
          title: this.t('empty_library_title'),
          text: this.t('empty_library_hint'),
          cta: { id: 'btnEmptyLibraryLoad', label: this.t('load_music'), icon: 'cloud-arrow-up' }
        });
        const btn = li.querySelector('#btnEmptyLibraryLoad');
        if (btn) btn.addEventListener('click', () => this.openFilePicker());
        ul.appendChild(li);
        return;
      }
      const list = (typeof this.sortedTracks === 'function') ? this.sortedTracks() : this.tracks.slice();
      this.fillVirtualList(ul, list, (tr) => this.makeTrackRow(tr, { playContext: { type: 'all' } }), {
        scroller: ul.closest('.sheet-body'),
        rowHeight: 64
      });
    },

    /* «Reproducir todo» / «Aleatorio» de la sección Todas las canciones.
     * Usa el orden visible (sortedTracks) y, al barajar, activa de verdad
     * el modo aleatorio de la cola (no solo cambia el icono). */
    playLibraryTracks(shouldShuffle) {
      if (!this.tracks.length) return;
      const list = (typeof this.sortedTracks === 'function') ? this.sortedTracks() : this.tracks.slice();
      const ids = list.map(t => t.id).filter(Boolean);
      if (!ids.length) return;
      this.shuffle = !!shouldShuffle;
      this._originalQueue = ids.slice();
      this.queue = ids.slice();
      this.queueIdx = 0;
      this.playContext = { type: 'all' };
      if (this.shuffle) this._applyShuffle(null);
      if (typeof this.setShuffleUI === 'function') this.setShuffleUI();
      this.playFromQueue(0);
      if (typeof this.renderQueue === 'function') this.renderQueue();
      if (typeof this.updateChrome === 'function') this.updateChrome();
      if (typeof this.saveSession === 'function') this.saveSession();
    },

    playlistDuration(pl) {
      if (!pl || !pl.trackIds) return 0;
      let sum = 0;
      for (const id of pl.trackIds) {
        const t = this.getTrackById ? this.getTrackById(id) : this.tracks.find(x => x.id === id);
        if (t && t.duration) sum += t.duration;
      }
      return sum;
    },

    fmtDurationLabel(sec) {
      sec = Math.floor(sec || 0);
      if (sec <= 0) return '';
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      if (h > 0) return h + ' h ' + m + ' ' + this.t('min_short');
      if (m > 0) return m + ' ' + this.t('min_short');
      return this.fmtTime(sec);
    },

    isPlaylistPlaying(pl) {
      return !!(this.playContext && this.playContext.type === 'playlist' && this.playContext.id === pl.id);
    },

    playlistMetaLabel(pl) {
      const n = (pl.trackIds || []).length;
      const dur = this.fmtDurationLabel(this.playlistDuration(pl));
      let s = n + ' ' + this.t('tracks_count');
      if (dur) s += ' · ' + dur;
      if (pl.description) s += ' · ' + pl.description;
      return s;
    },

    renderPlaylists() {
      const ul = document.getElementById('playlistList');
      const grid = document.getElementById('libraryPlaylists');
      const countEl = document.getElementById('playlistCount');
      if (countEl) {
        const n = this.playlists.length;
        countEl.textContent = n === 0
          ? this.t('playlist_count_zero')
          : (n === 1 ? this.t('playlist_count_one') : this.t('playlist_count_many').replace('X', n));
        // Con el estado vacío visible, «0 listas» es redundante.
        countEl.hidden = n === 0;
      }
      // Contador de la sección «Listas de reproducción» de la biblioteca.
      const libCountEl = document.getElementById('libraryPlaylistsCount');
      if (libCountEl) {
        libCountEl.textContent = String(this.playlists.length);
        libCountEl.hidden = this.playlists.length === 0;
      }
      [ul, grid].forEach(target => {
        if (!target) return;
        target.innerHTML = '';
        if (this.playlists.length === 0 && target === ul) {
          const li = document.createElement('li');
          li.className = 'empty-state pl-empty';
          li.innerHTML = `
            <div class="empty-icon"><svg class="ico" aria-hidden="true"><use href="#i-compact-disc"></use></svg></div>
            <h4>${this.t('no_playlists_yet')}</h4>
            <p>${this.t('no_playlists_hint')}</p>
            <button class="primary-btn" id="btnEmptyNewPlaylist"><svg class="ico" aria-hidden="true"><use href="#i-plus"></use></svg> ${this.t('create_new_playlist')}</button>
          `;
          const btn = li.querySelector('#btnEmptyNewPlaylist');
          if (btn) btn.addEventListener('click', () => this.openCreatePlaylistSheet());
          target.appendChild(li);
          return;
        }
        if (this.playlists.length === 0 && target === grid) {
          // Rejilla de la biblioteca sin listas: mensaje breve. El botón
          // «Nueva» ya está en la cabecera de la misma sección.
          const li = document.createElement('li');
          li.className = 'lib-empty empty-state compact';
          li.innerHTML = this.emptyStateHtml({
            icon: 'compact-disc',
            title: this.t('no_playlists_yet'),
            text: this.t('no_playlists_hint')
          });
          target.appendChild(li);
          return;
        }
        this.playlists.forEach(pl => {
          const li = document.createElement('li');
          const playing = this.isPlaylistPlaying(pl);
          li.className = (target === grid ? 'pl-card' : 'pl-row') + (playing ? ' is-playing' : '');
          const cover = this.getPlaylistCover(pl);
          // Nunca interpolar una portada sin validar dentro de style="":
          // una comilla o un `)` permitiría inyectar CSS/HTML desde un backup.
          const hasArt = typeof cover === 'string' && this._safeImageDataUrl(cover);
          const coverBg = hasArt
            ? `background-image:url('${cover}');background-size:cover;background-position:center;`
            : `background:linear-gradient(135deg, ${cover.from || '#6E5CFF'}, ${cover.to || '#FF7AB6'});`;
          const fallbackIcon = pl.id === 'favoritos' ? 'heart-solid' : 'list-ul';
          const tracksLabel = this.playlistMetaLabel(pl);
          // Ya no hay lista predefinida: ninguna lleva insignia.
          const badge = '';
          const live = playing
            ? '<span class="pl-live"><span class="pl-bars"><i></i><i></i><i></i></span></span>'
            : '';
          // En las tarjetas (carril de la biblioteca) el play va sobre la
          // portada como disco de acento. En las filas de «Tus listas» la
          // miniatura es pequeña y el disco la tapaba: el play pasa a una
          // columna de acciones propia, junto al borrado.
          const fabHtml = target === grid
            ? `<button class="pl-play-fab" type="button" aria-label="${this.esc(this.t('play_all_btn'))}">
                 <svg class="ico" aria-hidden="true"><use href="#i-play"></use></svg>
               </button>`
            : '';
          const coverHtml = `
            <div class="pl-cover${hasArt ? ' has-art' : ''}" data-pl-cover="${this.esc(pl.id)}">
              <div class="pl-cover-grad" style="${coverBg}" data-pl-cover="${this.esc(pl.id)}"></div>
              ${hasArt ? '' : this.ico(fallbackIcon, 'pl-cover-icon')}
              ${live}
              ${fabHtml}
            </div>
          `;
          if (target === grid) {
            li.innerHTML = coverHtml + `<div class="pl-card-info"><h4>${this.esc(pl.name)}</h4><p>${this.esc(tracksLabel)}</p>${badge}</div>`;
          } else {
            li.innerHTML = coverHtml + `<div class="pl-info"><h4>${this.esc(pl.name)}</h4><p>${this.esc(tracksLabel)}</p></div>`;
            const actions = document.createElement('div');
            actions.className = 'pl-row-actions';
            const playBtn = document.createElement('button');
            playBtn.type = 'button';
            playBtn.className = 'pl-row-play';
            playBtn.setAttribute('aria-label', this.t('play_all_btn'));
            playBtn.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-play"></use></svg>';
            playBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.playPlaylist(pl.id);
            });
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'row-action pl-row-delete';
            delBtn.setAttribute('aria-label', this.t('delete_playlist_btn'));
            delBtn.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-trash-can"></use></svg>';
            delBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.deletePlaylist(pl.id);
            });
            actions.append(playBtn, delBtn);
            li.appendChild(actions);
          }
          const fab = li.querySelector('.pl-play-fab');
          if (fab) fab.addEventListener('click', (e) => {
            e.stopPropagation();
            this.playPlaylist(pl.id);
          });
          li.addEventListener('click', (e) => {
            if (e.target.closest('.row-action, .pl-play-fab, .pl-row-play')) return;
            if (this._selectPlaylistForAdd) {
              this._selectPlaylistForAdd = false;
              const batchIds = this._batchAddIds;
              this._batchAddIds = null;
              const tid = this._trackToAddId || (this.currentTrack && this.currentTrack.id) || null;
              this._trackToAddId = null;
              this.closeSheet('sheetPlaylists');
              if (Array.isArray(batchIds) && batchIds.length) {
                let added = 0;
                batchIds.forEach(id => { if (this._addTrackIdToPlaylist(id, pl.id)) added++; });
                if (added > 0) {
                  if (typeof this._invalidatePlaylistCover === 'function') this._invalidatePlaylistCover(pl);
                  this.persistPlaylist(pl);
                  this.renderPlaylists();
                  this.toast(added + ' ' + this.t('toast_added_to_playlist_plural') + ' ' + pl.name);
                } else {
                  this.toast(this.t('picker_already_in'));
                }
              } else if (tid) {
                this.addTrackToPlaylist(tid, pl.id);
              }
              if (this._batchMode) this.toggleBatchMode(false);
              return;
            }
            this.openEditPlaylist(pl.id);
          });
          target.appendChild(li);
        });
      });
    },

    /* Elimina una playlist. Todas se pueden borrar: ya no existe la lista
     * predefinida «Mi Música» (se migra fuera al arrancar). */
    async deletePlaylist(playlistId) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl) return;
      const ok = await this.showConfirm({
        message: this.t('delete_playlist_confirm').replace('X', pl.name),
        okLabel: this.t('confirm_delete')
      });
      if (!ok) return;
      // Igual que con las pistas: el borrado se puede deshacer durante
      // 8 s y el borrado real de IndexedDB se aplaza hasta entonces.
      if (typeof this._commitPendingPlaylistDelete === 'function') this._commitPendingPlaylistDelete();
      const idx = this.playlists.findIndex(p => p.id === playlistId);
      this._pendingPlaylistDelete = { playlist: pl, idx, timer: null };
      this.playlists = this.playlists.filter(p => p.id !== playlistId);
      // Si la lista eliminada era el contexto actual, dejarlo en «biblioteca»
      // para que la barra superior no muestre una lista que ya no existe.
      if (this.playContext && this.playContext.type === 'playlist' && this.playContext.id === playlistId) {
        this.playContext = { type: 'all' };
        if (typeof this.renderCurrentTrack === 'function') this.renderCurrentTrack();
      }
      if (this._editingPlaylistId === playlistId) this.closeSheet('sheetEditPlaylist');
      this.renderPlaylists();
      const pending = this._pendingPlaylistDelete;
      pending.timer = setTimeout(() => this._commitPendingPlaylistDelete(pending), 8000);
      this.toast(this.t('toast_playlist_deleted'), {
        danger: true,
        ms: 8000,
        action: { label: this.t('undo'), onClick: () => this._undoDeletePlaylist(pending) }
      });
    },

    _commitPendingPlaylistDelete(pending) {
      const p = pending || this._pendingPlaylistDelete;
      if (!p || p.committed) return;
      p.committed = true;
      clearTimeout(p.timer);
      if (this._pendingPlaylistDelete === p) this._pendingPlaylistDelete = null;
      this.deletePlaylistFromStorage(p.playlist.id);
    },

    _undoDeletePlaylist(pending) {
      const p = pending || this._pendingPlaylistDelete;
      if (!p || !p.playlist || p.committed) return;
      if (this._pendingPlaylistDelete && this._pendingPlaylistDelete !== p) return;
      clearTimeout(p.timer);
      if (this._pendingPlaylistDelete === p) this._pendingPlaylistDelete = null;
      if (!this.playlists.some(x => x.id === p.playlist.id)) {
        const at = Math.max(0, Math.min(p.idx, this.playlists.length));
        this.playlists.splice(at, 0, p.playlist);
        this.persistPlaylist(p.playlist);
      }
      this.renderPlaylists();
      if (typeof this.renderHome === 'function') this.renderHome();
      this.toast(this.t('toast_restored'));
    },

    renderPickTracks() {
      const ul = document.getElementById('pickTracksList');
      if (!ul) return;
      ul.innerHTML = '';
      // En modo "añadir a playlist existente" sabemos qué pistas ya están dentro
      const targetPl = this._addingToPlaylistId
        ? this.playlists.find(p => p.id === this._addingToPlaylistId)
        : null;
      this.tracks.forEach(t => {
        const inPl = !!(targetPl && targetPl.trackIds.includes(t.id));
        const li = document.createElement('li');
        li.className = 'pick-row' + (inPl ? ' in-pl' : '');
        li.dataset.trackId = t.id;
        if (inPl) li.setAttribute('aria-disabled', 'true');
        li.innerHTML = `
          <div class="row-check"><svg class="ico" aria-hidden="true"><use href="#i-check"></use></svg></div>
          <div class="row-text">
            <div class="row-title">${this.esc(t.title)}</div>
            <div class="row-sub">${this.esc(t.artist)}${inPl ? ' · <span class="in-pl-tag">' + this.esc(this.t('picker_already_in')) + '</span>' : ''}</div>
          </div>
        `;
        li.addEventListener('click', () => {
          if (li.classList.contains('in-pl')) return; // ya está en la lista
          li.classList.toggle('checked');
        });
        ul.appendChild(li);
      });
    },

    playPlaylist(playlistId) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl) return;
      const ids = pl.trackIds.map(id => id).filter(id => this.trackMap().has(id));
      if (ids.length === 0) { this.toast(this.t('toast_playlist_empty')); return; }
      this.queue = ids;
      this.queueIdx = 0;
      // Establecer contexto de reproducción: "Reproduciendo desde <playlist>"
      this.playContext = { type: 'playlist', id: pl.id, name: pl.name };
      // Con Aleatorio activo la cola es nueva: hay que anclar su primera pista
      // y no la canción que estuviera sonando (era de otra lista).
      if (this.shuffle) this._applyShuffle(ids[0]);
      else this._originalQueue = null;
      this.playFromQueue(this.queueIdx);
      this.renderCurrentTrack();  // refresca la barra superior con el contexto
      this.renderQueue();  // refrescar la cola con las pistas de la playlist
      if (typeof this.openPlayerForTrackPick === 'function') this.openPlayerForTrackPick();
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
      // Igual que playPlaylist(): anclar la primera favorita, no la pista previa.
      if (this.shuffle) this._applyShuffle(this.queue[0]);
      else this._originalQueue = null;
      this.playFromQueue(0);
      this.renderCurrentTrack();
      this.renderQueue();  // refrescar la cola con las pistas de favoritos
      if (typeof this.openPlayerForTrackPick === 'function') this.openPlayerForTrackPick();
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
      if (this.playContext.type === 'album' || this.playContext.type === 'artist') {
        return this.playContext.name || null;
      }
      if (this.playContext.type === 'radio') {
        return this.t('ctx_start_radio');
      }
      return null;
    },

    /* Añade la pista actual a una playlist existente (atajo desde el menú "Más") */
    /* Añade una pista concreta a una playlist (generalización de
     * addCurrentTrackToPlaylist: permite añadir cualquier pista de la
     * biblioteca, no solo la que está sonando). */
    /* Primitiva sin toasts: añade si no está. Devuelve true si cambió.
     * La usan tanto el flujo individual como la selección por lote. */
    _addTrackIdToPlaylist(trackId, playlistId) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl || !Array.isArray(pl.trackIds)) return false;
      const t = this.getTrackById ? this.getTrackById(trackId) : this.tracks.find(x => x.id === trackId);
      if (!t) return false;
      if (pl.trackIds.includes(trackId)) return false;
      pl.trackIds.push(trackId);
      if (typeof this._invalidatePlaylistCover === 'function') this._invalidatePlaylistCover(pl);
      return true;
    },

    addTrackToPlaylist(trackId, playlistId) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl) return;
      const t = this.getTrackById ? this.getTrackById(trackId) : this.tracks.find(x => x.id === trackId);
      if (!t) {
        this.toast(this.t('toast_pick_at_least_one'));
        return;
      }
      if (pl.trackIds.includes(trackId)) {
        this.toast(this.t('toast_already_in_playlist') + ' ♥ ' + pl.name);
        return;
      }
      this._addTrackIdToPlaylist(trackId, playlistId);
      this.persistPlaylist(pl);
      this.renderPlaylists();
      // Si el sheet de edición de esa playlist está abierto (debajo),
      // refrescarlo para que la pista reaparezca al instante
      if (this._editingPlaylistId === pl.id) this.renderEditPlaylist();
      this.toast('♥ ' + this.t('toast_added_to_playlist_plural') + ' ' + pl.name);
    },

    /* Atajo: añade la pista que está sonando */
    addCurrentTrackToPlaylist(playlistId) {
      if (!this.currentTrack) {
        this.toast(this.t('toast_pick_at_least_one'));
        return;
      }
      this.addTrackToPlaylist(this.currentTrack.id, playlistId);
    },
});
