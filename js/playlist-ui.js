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

    /* Geometría de encaje de una imagen en un lienzo, separada del
     * pintado para poder verificarla sin un navegador: 'cover' rellena
     * recortando lo que sobra; 'contain' enseña la imagen ENTERA
     * aunque sobren bandas. Devuelve el rectángulo destino. */
    _fitRect(iw, ih, W, H, mode) {
      if (!iw || !ih || !W || !H) return { x: 0, y: 0, w: W || 0, h: H || 0 };
      const r = mode === 'contain'
        ? Math.min(W / iw, H / ih)
        : Math.max(W / iw, H / ih);
      const w = iw * r, h = ih * r;
      return { x: (W - w) / 2, y: (H - h) / 2, w, h };
    },

    /* ============================================================
 * Paleta extraída de la portada
 * El fondo del reproductor ya hablaba este idioma (--cover-from/
 * --cover-to), pero con portada de imagen nadie producía los
 * colores: siempre caía al acento del tema. Ahora se muestrean
 * de la miniatura grande, CON BARANDILLAS: saturación mínima y
 * luminosidad encerrada en banda oscura segura, para que una
 * portada marrón, blanca o gris no ensucie la pantalla ni rompa
 * el contraste del texto. Sin portada (o sin color útil), manda
 * el acento de siempre.
 * ============================================================ */
    _hexToRgbArr(hex) {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
      if (!m) return [109, 92, 255];
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    _rgbToHex(r, g, b) {
      const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
      return '#' + c(r) + c(g) + c(b);
    },
    _mixHexArr(a, b, t) {
      return [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t);
    },
    _rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const l = (mx + mn) / 2, d = mx - mn;
      let h = 0;
      const s = d === 0 ? 0 : (l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn));
      if (d) {
        if (mx === r) h = ((g - b) / d) % 6;
        else if (mx === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60; if (h < 0) h += 360;
      }
      return [h, s, l];
    },
    _hslToHex(h, s, l) {
      h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;
      let rgb;
      if (h < 60) rgb = [c, x, 0]; else if (h < 120) rgb = [x, c, 0];
      else if (h < 180) rgb = [0, c, x]; else if (h < 240) rgb = [0, x, c];
      else if (h < 300) rgb = [x, 0, c]; else rgb = [c, 0, x];
      return this._rgbToHex((rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255);
    },

    /* De los píxeles (RGBA de un lienzo 48×48) a {from, to} seguros.
     * Puro y comprobable sin navegador. Devuelve null si la imagen
     * no tiene color aprovechable (gris, casi blanca, casi negra). */
    _paletteFromPixels(data, fallback) {
      const buckets = [];
      for (let i = 0; i < 36; i++) buckets.push({ w: 0, r: 0, g: 0, b: 0 });
      let totalW = 0;
      for (let i = 0; i + 3 < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const hsl = this._rgbToHsl(r, g, b);
        // Peso: premia lo saturado y de luz media; ignora casi
        // blancos y casi negros (fondos de portada que no dicen nada).
        const vivid = hsl[1] * (1 - Math.abs(hsl[2] - 0.45) * 1.5);
        if (vivid <= 0.03) continue;
        const bk = buckets[Math.min(35, Math.floor(hsl[0] / 10))];
        bk.w += vivid; bk.r += r * vivid; bk.g += g * vivid; bk.b += b * vivid;
        totalW += vivid;
      }
      if (totalW <= 0) return null;
      let dom = 0;
      for (let i = 1; i < 36; i++) if (buckets[i].w > buckets[dom].w) dom = i;
      const avg = (bk) => [bk.r / bk.w, bk.g / bk.w, bk.b / bk.w];
      let domRgb = avg(buckets[dom]);
      const domHsl = this._rgbToHsl(domRgb[0], domRgb[1], domRgb[2]);
      // Segundo color: el tono con más peso a ≥35° del dominante;
      // si no hay, el dominante aclarado y girado un poco.
      let secRgb = null;
      for (let i = 0; i < 36; i++) {
        if (!buckets[i].w) continue;
        const dh = Math.min(Math.abs(i - dom) * 10, 360 - Math.abs(i - dom) * 10);
        if (dh >= 35 && (!secRgb || buckets[i].w > secRgb.w)) secRgb = { w: buckets[i].w, rgb: avg(buckets[i]) };
      }
      const fbFrom = this._hexToRgbArr(fallback && fallback.from);
      // Portada acromática o lavada: teñir hacia el acento en vez de
      // pintar la pantalla de gris.
      if (domHsl[1] < 0.18) domRgb = this._mixHexArr(domRgb, fbFrom, 0.45);
      const norm = (rgb, lMin, lMax) => {
        const hsl2 = this._rgbToHsl(rgb[0], rgb[1], rgb[2]);
        const s = Math.max(0.42, Math.min(0.85, hsl2[1]));
        const l = Math.max(lMin, Math.min(lMax, hsl2[2]));
        return { hex: this._hslToHex(hsl2[0], s, l), h: hsl2[0] };
      };
      const from = norm(domRgb, 0.30, 0.46);
      let to;
      if (secRgb) {
        to = norm(secRgb.rgb, 0.38, 0.55);
      } else {
        const hsl3 = this._rgbToHsl(domRgb[0], domRgb[1], domRgb[2]);
        to = { hex: this._hslToHex(hsl3[0] + 28, Math.max(0.42, Math.min(0.85, hsl3[1])), Math.min(0.55, Math.max(0.38, hsl3[2] + 0.07))), h: hsl3[0] + 28 };
      }
      return { from: from.hex, to: to.hex, angle: 135 };
    },

    /* Paleta vigente de una pista, síncrona: la diseñada si la
     * portada es generada, la extraída si ya se calculó, y si no, el
     * acento (el fondo por defecto de siempre). */
    coverPaletteFor(track) {
      if (!track) return this.coverFallback();
      if (track.cover && typeof track.cover === 'object' && track.cover.from) return track.cover;
      if (track.coverPalette && track.coverPalette.from) return track.coverPalette;
      return this.coverFallback();
    },

    /* Aplica la paleta a las variables del fondo, adaptada al tema:
     * en claro se apastela (el velo claro manda) y en amoled se
     * oscurece más (su negro es un principio, no un accidente). */
    _applyCoverPalette(palette) {
      const root = document.documentElement;
      const theme = root.getAttribute('data-theme');
      let from = (palette && palette.from) || '#6E5CFF';
      let to = (palette && palette.to) || '#FF7AB6';
      if (theme === 'light') {
        from = this._rgbToHex(...this._mixHexArr(this._hexToRgbArr(from), [255, 255, 255], 0.45));
        to = this._rgbToHex(...this._mixHexArr(this._hexToRgbArr(to), [255, 255, 255], 0.45));
      } else if (theme === 'amoled') {
        from = this._rgbToHex(...this._mixHexArr(this._hexToRgbArr(from), [0, 0, 0], 0.35));
        to = this._rgbToHex(...this._mixHexArr(this._hexToRgbArr(to), [0, 0, 0], 0.35));
      }
      root.style.setProperty('--cover-from', from);
      root.style.setProperty('--cover-to', to);
      root.style.setProperty('--cover-angle', ((palette && palette.angle) || 135) + 'deg');
    },

    /* Extrae y guarda la paleta de la portada (perezoso, una vez por
     * pista): se invoca al sonar una pista con imagen sin paleta. Si
     * esa pista está sonando al terminar, el fondo se actualiza solo. */
    async _ensureCoverPalette(track) {
      if (!track || track.coverPalette) return false;
      // En curso: Set de sesión (nunca en el objeto pista: una
      // persistencia coincidente lo dejaría «encendido» en la base
      // de datos y la paleta no se extraería jamás).
      if (!this._paletteInFlight) this._paletteInFlight = new Set();
      if (this._paletteInFlight.has(track.id)) return false;
      if (track.cover && typeof track.cover === 'object' && track.cover.from) return false;
      const src = (track.customCover && (track.customCover.lg || track.customCover.thumb))
        || track.coverThumbLg
        || (typeof track.cover === 'string' && (track.cover.startsWith('data:') || track.cover.startsWith('blob:')) ? track.cover : null);
      if (!src) return false;
      this._paletteInFlight.add(track.id);
      try {
        const img = await new Promise(resolve => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = () => resolve(null);
          im.src = src;
        });
        if (!img || !img.width) return false;
        const c = document.createElement('canvas');
        c.width = 48; c.height = 48;
        const x = c.getContext('2d');
        if (!x) return false;
        x.drawImage(img, 0, 0, 48, 48);
        const data = x.getImageData(0, 0, 48, 48).data;
        const pal = this._paletteFromPixels(data, this.coverFallback());
        if (!pal) return false;
        track.coverPalette = pal;
        try { this.persistTrack(track); } catch (e) {}
        if (this.currentTrack && this.currentTrack.id === track.id) this._applyCoverPalette(pal);
        return true;
      } catch (e) {
        return false;
      } finally {
        this._paletteInFlight.delete(track.id);
      }
    },

    /* Pinta la portada en un canvas. Sin opciones, el clásico
 * «rellenar recortando» de filas y miniaturas. Con
 * { fit: 'ambient' } (tarjetas grandes de Inicio) se enseña
 * la obra COMPLETA: al importar, las miniaturas ya nacen
 * cuadradas y recortadas, así que este modo pinta del original
 * (track.cover) y rellena las bandas con la misma imagen
 * ampliada, difuminada y oscurecida. */
    drawRowCover(canvas, track, opts) {
      if (!canvas || !track) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const W = canvas.width, H = canvas.height;
      const ambient = !!(opts && opts.fit === 'ambient');
      const isImage = !!track.customCover || track.coverIsImage || (typeof track.cover === 'string' && (track.cover.startsWith('data:') || track.cover.startsWith('blob:')));
      const thumb = this.coverSrcForRow(track, Math.max(W, H));
      const full = (typeof track.cover === 'string' && (track.cover.startsWith('data:') || track.cover.startsWith('blob:')))
        ? track.cover : null;

      const paintImg = (src) => {
        if (!src) { this._paintLetterCover(ctx, W, H, track); return; }
        this._paintLetterCover(ctx, W, H, track);
        const img = new Image();
        img.onload = () => {
          const iw = img.naturalWidth || img.width || 0;
          const ih = img.naturalHeight || img.height || 0;
          if (iw <= 0 || ih <= 0) {
            this._paintLetterCover(ctx, W, H, track);
            return;
          }
          ctx.clearRect(0,0,W,H);
          if (ambient) {
            // Fondo: la obra en grande, desenfocada si el motor lo
            // soporta (si no, queda oscurecida sin más).
            ctx.fillStyle = '#101018';
            ctx.fillRect(0, 0, W, H);
            const bg = this._fitRect(iw, ih, W, H, 'cover');
            ctx.save();
            try { ctx.filter = 'blur(10px) brightness(0.45)'; } catch (e) { /* sin filtro: fondo oscuro */ }
            ctx.drawImage(img, bg.x - bg.w * 0.08, bg.y - bg.h * 0.08, bg.w * 1.16, bg.h * 1.16);
            ctx.restore();
            // La obra entera, centrada.
            const fg = this._fitRect(iw, ih, W, H, 'contain');
            ctx.drawImage(img, fg.x, fg.y, fg.w, fg.h);
            return;
          }
          const r = this._fitRect(iw, ih, W, H, 'cover');
          ctx.drawImage(img, r.x, r.y, r.w, r.h);
        };
        img.onerror = () => {
          this._paintLetterCover(ctx, W, H, track);
        };
        img.src = src;
      };

      if (isImage && (thumb || full)) {
        paintImg(ambient && full ? full : thumb);
        //  en superficies grandes (tarjetas), si la miniatura
        // guardada es de la generación 256px, se rehace a 384 desde el
        // original y se repinta este mismo lienzo al terminar.
        if (Math.max(W, H) >= 160) {
          this.ensureCoverThumbs(track).then((ok) => {
            if (ok && canvas.isConnected) this.drawRowCover(canvas, track, opts);
          });
        }
        return;
      }
      if (isImage && !thumb && !full) {
        this._paintLetterCover(ctx, W, H, track);
        this.ensureCoverThumbs(track).then((ok) => {
          if (ok && canvas.isConnected) this.drawRowCover(canvas, track, opts);
        });
        return;
      }

      this._paintLetterCover(ctx, W, H, track);
    },

    _paintLetterCover(ctx, W, H, track) {
      //  Un solo pintor para toda la app (js/portadas.js): antes el
      //  reproductor y las filas dibujaban la misma canción con distinto
      //  grosor de surco y distinto cuerpo de letra.
      const cover = this.coverPaletteFor
        ? this.coverPaletteFor(track)
        : (track.cover && track.cover.from) || { from: '#6E5CFF', to: '#FF7AB6' };
      if (window.AuroraCover && typeof window.AuroraCover.paint === 'function') {
        window.AuroraCover.paint(ctx, W, H, {
          from: cover.from,
          to: cover.to,
          text: track.title,
          letter: this.coverInitial(track.title)
        });
        return;
      }
      //  Sin el módulo (no debería pasar: se carga antes) no se deja el
      //  lienzo en blanco.
      ctx.fillStyle = cover.from || '#6E5CFF';
      ctx.fillRect(0, 0, W, H);
    },

    /* Genera las miniaturas si faltan y, desde, ACTUALIZA las de
 * bibliotecas antiguas: la grande nació a 256px cuando las
 * pantallas objetivo eran DPR 2; con DPR 3 las tarjetas de Inicio
 * (116px CSS = ~348 reales) estiraban esa miniatura y se veían
 * blandas. Devuelve true solo si (re)generó, para repintar. */
    async ensureCoverThumbs(track) {
      if (!track) return false;
      const src = (typeof track.cover === 'string' && (track.cover.startsWith('data:') || track.cover.startsWith('blob:'))) ? track.cover : null;
      if (!src) return false;
      if (track.coverThumb && track.coverThumbLg) {
        // Ya hay ambas: comprobar una vez por sesión el ancho real de
        // la grande (las heredadas miden 256 y hay que rehacerlas).
        if (track._thumbsHiRes) return false;
        track._thumbsHiRes = true;
        const w = await new Promise(resolve => {
          const im = new Image();
          im.onload = () => resolve(im.width || 0);
          im.onerror = () => resolve(0);
          im.src = track.coverThumbLg;
        });
        if (w >= 360) return false;
      }
      if (track._thumbing) return false;
      const U = window.AuroraUploader;
      if (!U || typeof U.resizeDataUrl !== 'function') return false;
      track._thumbing = true;
      track._thumbsHiRes = true;
      try {
        track.coverThumb = await U.resizeDataUrl(src, 144);
        track.coverThumbLg = await U.resizeDataUrl(src, 384);
        track._thumbsDirty = true;
        if (!this._thumbPersistTimer) {
          this._thumbPersistTimer = setTimeout(() => this._flushPendingCoverThumbs(), 2500);
        }
        return !!track.coverThumb;
      } catch (e) {
        return false;
      } finally {
        track._thumbing = false;
      }
    },

    _flushPendingCoverThumbs() {
      if (this._thumbPersistTimer) {
        clearTimeout(this._thumbPersistTimer);
        this._thumbPersistTimer = null;
      }
      if (!Array.isArray(this.tracks)) return;
      this.tracks.filter(tr => tr && tr._thumbsDirty).forEach(tr => {
        tr._thumbsDirty = false;
        this.persistTrack(tr);
      });
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
    async pickCustomCover(trackId) {
      // Delta Chat nativo: selector integrado antes que <input>
      const nativeFiles = await this.pickFilesWebxdc({ extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'], multiple: false });
      if (nativeFiles) {
        if (nativeFiles.length > 0) await this.setCustomCover(trackId, nativeFiles[0]);
        return;
      }
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
        const lg = await U.resizeDataUrl(dataUrl, 384);
        const thumb = await U.resizeDataUrl(dataUrl, 144);
        if (!lg && !thumb) throw new Error('imagen ilegible');
        t.customCover = { thumb: thumb || lg, lg: lg || thumb };
        delete t.coverPalette; //  la paleta era de la portada anterior
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
      delete t.coverPalette; //  vuelve la de los metadatos (o el acento)
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

    /* Color de una lista acotado a hex: lo guardado sale de la paleta de
     * la app, pero un registro manipulado no debe poder colar CSS. */
    _safeCoverColor(v, fallback) {
      return (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v)) ? v : fallback;
    },

    _playlistGradientParams(pl) {
      const base = { from: '#6E5CFF', to: '#FF7AB6' };
      const fb = (this.coverFallback && this.coverFallback()) || base;
      const pal = this._playlistCoverFallback(pl) || fb;
      const from = this._safeCoverColor(pal.from, this._safeCoverColor(fb.from, base.from));
      const to = this._safeCoverColor(pal.to, this._safeCoverColor(fb.to, base.to));
      //  La cuenta vive en js/portadas.js: la usan la app y la vista previa.
      const p = (window.AuroraCover && typeof window.AuroraCover.listParams === 'function')
        ? window.AuroraCover.listParams((pl && (pl.name || pl.id)) || '', { from, to })
        : { angle: 135, gx: 30, gy: 24, from, to };
      const layers =
        'radial-gradient(125% 125% at ' + p.gx + '% ' + p.gy + '%, rgba(255,255,255,0.26), rgba(255,255,255,0) 62%),' +
        'linear-gradient(' + p.angle + 'deg, ' + from + ', ' + to + ')';
      return { from, to, angle: p.angle, gx: p.gx, gy: p.gy, layers };
    },

    /* Fondo de la portada de una lista SIN carátula. Mismo lenguaje que
     * la portada generada de una pista (luz arriba, degradado en
     * diagonal, la semilla decide el ángulo y dónde cae la luz) para que
     * dos listas del mismo acento no se vean idénticas. Devuelve la
     * declaración `background-image` completa. */
    playlistCoverStyle(pl) {
      const p = this._playlistGradientParams(pl);
      return 'background-image:' + p.layers + ';';
    },

    /* Fondo de portada CON collage: apila la imagen sobre el degradado de
     * la lista para que, si el WebView descarta o falla al decodificar la
     * textura, se vea el degradado en lugar de un recuadro negro. */
    playlistArtStyle(pl, dataUrl) {
      if (!dataUrl || !this._safeImageDataUrl(dataUrl)) return this.playlistCoverStyle(pl);
      const p = this._playlistGradientParams(pl);
      return 'background-color:' + p.from +
        ';background-image:url(\'' + dataUrl + '\'),' + p.layers +
        ';background-size:cover;background-position:center;background-repeat:no-repeat;';
    },

    _hydratePlaylistCover(pl) {
      if (!pl) return;
      if (pl.coverArt && !this._safeImageDataUrl(pl.coverArt)) {
        pl.coverArt = null;
        pl.coverArtHash = null;
      }
      if (pl._coverCache && !this._safeImageDataUrl(pl._coverCache)) {
        pl._coverCache = null;
        pl._coverCacheHash = null;
      }
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
      this._coverPersistTimer = setTimeout(() => this._flushPendingPlaylistCovers(), 400);
    },

    _flushPendingPlaylistCovers() {
      if (this._coverPersistTimer) {
        clearTimeout(this._coverPersistTimer);
        this._coverPersistTimer = null;
      }
      const ids = this._coverPersistIds;
      if (!ids || !ids.size) return;
      this._coverPersistIds = new Set();
      ids.forEach(id => {
        const p = this.playlists.find(x => x.id === id);
        if (p) this.persistPlaylist(p);
      });
    },

    _canCheckCanvasAlpha() {
      if (typeof this._canvasAlphaReadable === 'boolean') return this._canvasAlphaReadable;
      try {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        const x = c.getContext('2d');
        if (!x || typeof x.getImageData !== 'function') {
          this._canvasAlphaReadable = false;
          return false;
        }
        x.fillStyle = '#ffffff';
        x.fillRect(0, 0, 1, 1);
        const d = x.getImageData(0, 0, 1, 1).data;
        this._canvasAlphaReadable = !!(d && d[3] === 255);
      } catch (e) {
        this._canvasAlphaReadable = false;
      }
      return this._canvasAlphaReadable;
    },

    /* Detecta un canvas 2D perdido por la GPU (isContextLost() o todos los
     * píxeles con alfa 0 tras pintar). Evita que toDataURL('image/jpeg')
     * convierta transparencia en un JPEG negro y lo persista en la lista. */
    _isCanvasLost(ctx, size) {
      if (!ctx) return true;
      try {
        if (typeof ctx.isContextLost === 'function' && ctx.isContextLost() === true) return true;
      } catch (e) {}
      if (!this._canCheckCanvasAlpha() || typeof ctx.getImageData !== 'function') return false;
      try {
        const pts = [
          [size >> 2, size >> 2],
          [size >> 1, size >> 1],
          [(size * 3) >> 2, (size * 3) >> 2],
          [(size * 3) >> 2, size >> 2],
          [size >> 2, (size * 3) >> 2]
        ];
        for (let i = 0; i < pts.length; i++) {
          const d = ctx.getImageData(pts[i][0], pts[i][1], 1, 1).data;
          if (d && d[3] > 0) return false;
        }
        return true;
      } catch (e) {
        return false;
      }
    },

    /* Carga y decodifica una imagen de portada con límite de tiempo para
     * que una imagen dañada o sin decodificar ni pinte negro ni bloquee
     * _coverPending indefinidamente. */
    _loadCollageImage(src) {
      if (!src || !this._safeImageDataUrl(src)) return Promise.resolve(null);
      return new Promise(resolve => {
        let settled = false;
        const img = new Image();
        const finish = (val) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          img.onload = img.onerror = null;
          resolve(val);
        };
        const timer = setTimeout(() => finish(null), 4000);
        const checkReady = () => {
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          finish(w > 0 && h > 0 ? img : null);
        };
        img.onload = () => {
          if (typeof img.decode === 'function') {
            img.decode().then(checkReady, checkReady);
          } else {
            checkReady();
          }
        };
        img.onerror = () => finish(null);
        img.src = src;
      });
    },

    /* ============================================================
     *  Cover de playlist — collage de hasta 8 portadas
     * ============================================================
     *  Devuelve dataURL si hay al menos una pista con arte, o el
     *  gradiente de la lista. Se cachea en RAM y se persiste en
     *  pl.coverArt para sobrevivir recargas. */
    getPlaylistCover(pl) {
      if (!pl) return this._playlistCoverFallback(null);
      const fallback = this._playlistCoverFallback(pl);
      this._hydratePlaylistCover(pl);
      // Con el índice id->pista: buscar cada id con find() sobre miles
      // de pistas hacía renderPlaylists cuadrático (medido en el estrés).
      const tracks = (pl.trackIds || []).map(id => this.getTrackById(id)).filter(Boolean);
      const withImage = tracks.filter(t => {
        const src = this._playlistTrackArtSrc(t);
        return src && this._safeImageDataUrl(src);
      });

      if (withImage.length === 0) {
        if (pl._coverCache || pl.coverArt || pl._coverPending) {
          this._invalidatePlaylistCover(pl);
          this._persistPlaylistCoverSoon(pl);
        }
        return fallback;
      }

      const hash = 'v384|' + tracks.map(t => t.id).join('|') + '#' + withImage.map(t => {
        const src = this._playlistTrackArtSrc(t) || '';
        return t.id + ':' + src.length;
      }).join(',');
      const rawCached = pl._coverCache || pl.coverArt || null;
      const cached = (rawCached && this._safeImageDataUrl(rawCached)) ? rawCached : null;
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
      const SIZE = 384;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        if (pl._coverPending === hash) pl._coverPending = null;
        return cached || fallback;
      }

      const selected = withImage.slice(0, Math.min(8, withImage.length));
      const pal = this._playlistGradientParams(pl);

      const drawCollage = (images) => {
        const n = images.length;
        if (!n) return 0;
        // Base con el degradado propio de la lista (nunca negro puro) por
        // si una carátula trae transparencia o queda un borde libre.
        try {
          const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
          grad.addColorStop(0, pal.from);
          grad.addColorStop(1, pal.to);
          ctx.fillStyle = grad;
        } catch (e) {
          ctx.fillStyle = pal.from;
        }
        ctx.fillRect(0, 0, SIZE, SIZE);

        let drawn = 0;
        const put = (img, x, y, w, h) => {
          if (this._drawImageCover(ctx, img, x, y, w, h)) drawn++;
        };

        if (n === 1) {
          put(images[0], 0, 0, SIZE, SIZE);
        } else if (n === 2) {
          put(images[0], 0, 0, SIZE, SIZE / 2);
          put(images[1], 0, SIZE / 2, SIZE, SIZE / 2);
        } else if (n === 3) {
          put(images[0], 0, 0, SIZE, SIZE * 0.6);
          put(images[1], 0, SIZE * 0.6, SIZE / 2, SIZE * 0.4);
          put(images[2], SIZE / 2, SIZE * 0.6, SIZE / 2, SIZE * 0.4);
        } else if (n === 4) {
          put(images[0], 0, 0, SIZE / 2, SIZE / 2);
          put(images[1], SIZE / 2, 0, SIZE / 2, SIZE / 2);
          put(images[2], 0, SIZE / 2, SIZE / 2, SIZE / 2);
          put(images[3], SIZE / 2, SIZE / 2, SIZE / 2, SIZE / 2);
        } else if (n === 5 || n === 6) {
          put(images[0], 0, 0, SIZE, SIZE / 2);
          const cols = n - 1;
          const cellW = SIZE / cols;
          for (let i = 1; i < n; i++) {
            put(images[i], (i - 1) * cellW, SIZE / 2, cellW, SIZE / 2);
          }
        } else if (n === 7) {
          const cols = 4;
          const cellW = SIZE / cols;
          put(images[0], 0, 0, cellW, SIZE / 2);
          put(images[1], cellW, 0, cellW, SIZE / 2);
          put(images[2], 2 * cellW, 0, cellW, SIZE / 2);
          put(images[3], 3 * cellW, 0, cellW, SIZE / 2);
          const off = (SIZE - 3 * cellW) / 2;
          put(images[4], off, SIZE / 2, cellW, SIZE / 2);
          put(images[5], off + cellW, SIZE / 2, cellW, SIZE / 2);
          put(images[6], off + 2 * cellW, SIZE / 2, cellW, SIZE / 2);
        } else {
          const cols = 4, rows = 2;
          const cellW = SIZE / cols;
          const cellH = SIZE / rows;
          for (let i = 0; i < n; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            put(images[i], col * cellW, row * cellH, cellW, cellH);
          }
        }
        if (!drawn) return 0;

        // Separadores sutiles entre celdas
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 2;
        if (n === 2) {
          ctx.beginPath(); ctx.moveTo(0, SIZE / 2); ctx.lineTo(SIZE, SIZE / 2); ctx.stroke();
        } else if (n === 3) {
          ctx.beginPath(); ctx.moveTo(0, SIZE * 0.6); ctx.lineTo(SIZE, SIZE * 0.6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(SIZE / 2, SIZE * 0.6); ctx.lineTo(SIZE / 2, SIZE); ctx.stroke();
        } else if (n === 4) {
          ctx.beginPath(); ctx.moveTo(SIZE / 2, 0); ctx.lineTo(SIZE / 2, SIZE); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, SIZE / 2); ctx.lineTo(SIZE, SIZE / 2); ctx.stroke();
        } else if (n === 5 || n === 6) {
          ctx.beginPath(); ctx.moveTo(0, SIZE / 2); ctx.lineTo(SIZE, SIZE / 2); ctx.stroke();
          const cols = n - 1;
          const cellW = SIZE / cols;
          for (let i = 1; i < cols; i++) {
            ctx.beginPath(); ctx.moveTo(i * cellW, SIZE / 2); ctx.lineTo(i * cellW, SIZE); ctx.stroke();
          }
        } else if (n === 7) {
          ctx.beginPath(); ctx.moveTo(0, SIZE / 2); ctx.lineTo(SIZE, SIZE / 2); ctx.stroke();
          const cols = 4;
          const cellW = SIZE / cols;
          for (let i = 1; i < cols; i++) {
            ctx.beginPath(); ctx.moveTo(i * cellW, 0); ctx.lineTo(i * cellW, SIZE / 2); ctx.stroke();
          }
        } else if (n >= 8) {
          const cols = 4, rows = 2;
          const cellW = SIZE / cols;
          const cellH = SIZE / rows;
          for (let i = 1; i < cols; i++) {
            ctx.beginPath(); ctx.moveTo(i * cellW, 0); ctx.lineTo(i * cellW, SIZE); ctx.stroke();
          }
          ctx.beginPath(); ctx.moveTo(0, cellH); ctx.lineTo(SIZE, cellH); ctx.stroke();
        }
        return drawn;
      };

      Promise.all(selected.map(t => this._loadCollageImage(this._playlistTrackArtSrc(t)))).then(images => {
        // Si la lista cambió mientras cargaban las imágenes, no pisar su estado nuevo.
        if (pl._coverPending !== hash) return;
        pl._coverPending = null;
        const valid = images.filter(Boolean);
        if (valid.length === 0) {
          this._applyPlaylistFallback(pl);
          return;
        }
        const drawn = drawCollage(valid);
        if (!drawn || this._isCanvasLost(ctx, SIZE)) {
          this._applyPlaylistFallback(pl);
          return;
        }
        let dataUrl = '';
        try { dataUrl = canvas.toDataURL('image/jpeg', 0.82); } catch (e) { dataUrl = ''; }
        if (!this._safeImageDataUrl(dataUrl) || dataUrl.length < 24) {
          this._applyPlaylistFallback(pl);
          return;
        }
        pl._coverCache = dataUrl;
        pl._coverCacheHash = hash;
        pl.coverArt = dataUrl;
        pl.coverArtHash = hash;
        this._applyPlaylistCover(pl, dataUrl);
        this._persistPlaylistCoverSoon(pl);
      }).catch(() => {
        if (pl._coverPending === hash) {
          pl._coverPending = null;
          this._applyPlaylistFallback(pl);
        }
      });

      return cached || fallback;
    },

    _paintPlaylistCoverElement(el, pl, dataUrl) {
      if (!el || !pl) return;
      const hasArt = !!(dataUrl && this._safeImageDataUrl(dataUrl));
      const p = this._playlistGradientParams(pl);
      const gradEl = el.querySelector('.pl-cover-grad');
      const target = gradEl || el;
      target.style.cssText = hasArt ? this.playlistArtStyle(pl, dataUrl) : this.playlistCoverStyle(pl);
      target.style.backgroundColor = p.from;
      if (gradEl) {
        el.style.backgroundColor = p.from;
      }
      el.classList.toggle('has-art', hasArt);
      const icon = el.querySelector('.pl-cover-icon');
      if (icon) icon.remove();
      let letter = el.querySelector('.pl-cover-letter');
      if (hasArt) {
        if (letter) letter.remove();
      } else if (!letter) {
        letter = document.createElement('span');
        letter.className = 'pl-cover-letter';
        letter.setAttribute('aria-hidden', 'true');
        letter.textContent = this.coverInitial(pl.name);
        if (gradEl && gradEl.nextSibling) el.insertBefore(letter, gradEl.nextSibling);
        else el.appendChild(letter);
      } else {
        letter.textContent = this.coverInitial(pl.name);
      }
    },

    /* Pinta la portada del encabezado de #sheetEditPlaylist manteniendo
     * siempre el degradado CSS debajo del <canvas>/<img>, con recuperación
     * automática si la imagen falla o la GPU vacía el canvas. */
    renderEditPlaylistCover(pl, coverEl) {
      const el = coverEl || document.getElementById('editPlaylistCover');
      if (!el || !pl) return;
      const cover = this.getPlaylistCover(pl);
      const hasArt = typeof cover === 'string' && this._safeImageDataUrl(cover);
      this._setEditPlaylistCoverContent(el, pl, hasArt ? cover : null);
    },

    _setEditPlaylistCoverContent(el, pl, dataUrl) {
      if (!el || !pl) return;
      const hasArt = !!(dataUrl && this._safeImageDataUrl(dataUrl));
      const basePal = this._playlistGradientParams(pl);
      el.style.cssText = this.playlistCoverStyle(pl);
      el.style.backgroundColor = basePal.from;
      el.classList.toggle('has-art', hasArt);
      el.innerHTML = '';

      const paintFallback = () => {
        el.style.cssText = this.playlistCoverStyle(pl);
        el.style.backgroundColor = basePal.from;
        el.classList.remove('has-art');
        el.innerHTML = '';
        let painted = false;
        if (window.AuroraCover && typeof window.AuroraCover.paint === 'function') {
          try {
            const pal = this._playlistGradientParams(pl);
            const cv = document.createElement('canvas');
            cv.width = 240; cv.height = 240;
            const ctx = cv.getContext('2d');
            if (ctx) {
              window.AuroraCover.paint(ctx, 240, 240, {
                from: pal.from,
                to: pal.to,
                text: pl.name || pl.id || '',
                letter: this.coverInitial(pl.name)
              });
              if (!this._isCanvasLost(ctx, 240)) {
                el.appendChild(cv);
                painted = true;
              }
            }
          } catch (e) {}
        }
        if (!painted) {
          const letter = document.createElement('span');
          letter.className = 'pl-cover-letter';
          letter.setAttribute('aria-hidden', 'true');
          letter.textContent = this.coverInitial(pl.name);
          el.appendChild(letter);
        }
      };

      if (hasArt) {
        const img = document.createElement('img');
        img.alt = '';
        img.onerror = () => {
          if (pl._coverCache === dataUrl || pl.coverArt === dataUrl) {
            this._invalidatePlaylistCover(pl);
            this._persistPlaylistCoverSoon(pl);
          }
          paintFallback();
          this._applyPlaylistFallback(pl);
        };
        img.src = dataUrl;
        el.appendChild(img);
      } else {
        paintFallback();
      }
    },

    _cssEsc(v) {
      const s = String(v == null ? '' : v);
      if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') {
        return CSS.escape(s);
      }
      return s.replace(/["\\]/g, '\\$&');
    },

    _applyPlaylistFallback(pl) {
      if (!pl || !pl.id) return;
      document.querySelectorAll('[data-pl-cover="' + this._cssEsc(pl.id) + '"]').forEach(el => {
        this._paintPlaylistCoverElement(el, pl, null);
      });
      if (this._editingPlaylistId === pl.id) {
        const edit = document.getElementById('editPlaylistCover');
        if (edit) this._setEditPlaylistCoverContent(edit, pl, null);
      }
    },

    _applyPlaylistCover(pl, dataUrl) {
      if (!pl || !pl.id) return;
      if (!dataUrl || !this._safeImageDataUrl(dataUrl)) {
        this._applyPlaylistFallback(pl);
        return;
      }
      document.querySelectorAll('[data-pl-cover="' + this._cssEsc(pl.id) + '"]').forEach(el => {
        this._paintPlaylistCoverElement(el, pl, dataUrl);
      });
      if (this._editingPlaylistId === pl.id) {
        const edit = document.getElementById('editPlaylistCover');
        if (edit) this._setEditPlaylistCoverContent(edit, pl, dataUrl);
      }
    },

    /* Al volver del segundo plano (Android WebView / iOS descartan texturas
     * de <canvas> y dataURL bajo presión de memoria), repinta las portadas
     * visibles que hayan quedado vacías. */
    refreshVisibleCovers() {
      try {
        if (this.currentTrack && typeof this.updateCoverArt === 'function') {
          const mainCv = document.getElementById('coverCanvas');
          if (mainCv && mainCv.width > 0) {
            const ctx = mainCv.getContext('2d');
            if (ctx && this._isCanvasLost(ctx, mainCv.width)) this.updateCoverArt(this.currentTrack);
          }
          if (typeof this.updateMiniCover === 'function') this.updateMiniCover(this.currentTrack);
        }
        if (this._editingPlaylistId) {
          const pl = this.playlists.find(p => p.id === this._editingPlaylistId);
          if (pl) this.renderEditPlaylistCover(pl);
        }
        const libSheet = document.getElementById('sheetLibrary');
        if (libSheet && libSheet.classList.contains('open')) {
          this.renderPlaylists();
        }
        if (this.currentView === 'home' && typeof this.renderHome === 'function') {
          const heroCv = document.getElementById('homeHeroCanvas');
          const needsRepaint = heroCv && heroCv.width > 0 && this._isCanvasLost(heroCv.getContext('2d'), heroCv.width);
          if (needsRepaint) {
            this.renderHome();
          } else {
            this.playlists.forEach(pl => {
              const els = document.querySelectorAll('[data-pl-cover="' + this._cssEsc(pl.id) + '"]');
              if (!els.length) return;
              const cover = this.getPlaylistCover(pl);
              const art = (typeof cover === 'string' && this._safeImageDataUrl(cover)) ? cover : null;
              els.forEach(el => this._paintPlaylistCoverElement(el, pl, art));
            });
          }
        }
      } catch (e) {}
    },

    /* Helper: dibuja una imagen cubriendo un rect (object-fit: cover) */
    _drawImageCover(ctx, img, x, y, w, h) {
      if (!ctx || !img) return false;
      const iw = img.naturalWidth || img.width || 0;
      const ih = img.naturalHeight || img.height || 0;
      if (iw <= 0 || ih <= 0 || w <= 0 || h <= 0) return false;
      try {
        const r = Math.max(w / iw, h / ih);
        const dw = iw * r, dh = ih * r;
        const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        return true;
      } catch (e) {
        return false;
      }
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
      const viewH = scroller.clientHeight || (typeof window !== 'undefined' && window.innerHeight) || 640;
      const overscan = 8;
      let start = Math.max(0, Math.floor(startPx / rowH) - overscan);
      let end = Math.min(items.length, Math.ceil((startPx + viewH) / rowH) + overscan);
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
      //  retirado el resumen «A continuación · N · duración»
      // que la (idea 10) pintaba sobre la cola; la cabecera
      // vuelve a ser solo el contexto «Reproduciendo desde X».
      const cleaned = this.queue.filter(id => this.trackMap().has(id));
      if (cleaned.length !== this.queue.length) {
        const curId = this.currentTrack && this.currentTrack.id;
        this.queue = cleaned;
        const nq = curId ? this.queue.indexOf(curId) : -1;
        this.queueIdx = nq >= 0 ? nq : Math.min(this.queueIdx, Math.max(0, this.queue.length - 1));
      }
      const isEmpty = this.queue.length === 0;
      const qActions = document.getElementById('queueActions');
      if (qActions) qActions.hidden = isEmpty;
      const clearBtn = document.getElementById('btnClearQueue');
      if (clearBtn) clearBtn.disabled = this.queue.length <= 1;
      if (ctxLabel && isEmpty) {
        ctxLabel.textContent = '';
        ctxLabel.style.display = 'none';
      }
      if (isEmpty) {
        //  desvincular la lista virtual anterior — su listener
        // de scroll seguía vivo y repintaba filas fantasma sobre
        // el estado vacío al desplazar la hoja.
        this.unbindVirtualList(ul);
        ul.innerHTML = '';
        const emptyLi = document.createElement('li');
        emptyLi.className = 'empty-state compact';
        emptyLi.innerHTML = this.emptyStateHtml({
          icon: 'list-ol',
          title: this.t('queue_empty'),
          text: this.t('queue_empty_hint')
        });
        ul.appendChild(emptyLi);
        return;
      }
      //  índice por id una sola vez — antes cada fila hacía
      // tracks.find() y pintar la cola entera era O(filas × pistas).
      const queueById = typeof this.trackMap === 'function' ? this.trackMap() : null;
      const makeQueueRow = (id, i) => {
        const t = queueById ? queueById.get(id) : this.tracks.find(x => x.id === id);
        if (!t) return null;
        const isCurrent = i === this.queueIdx;
        const nowBadge = isCurrent
          ? `<span class="eq-badge eq-badge-row${this.isPlaying ? ' playing' : ''}" aria-hidden="true"><i></i><i></i><i></i></span>`
          : '';
        const li = document.createElement('li');
        li.className = 'queue-item' + (isCurrent ? ' current' : '');
        li.dataset.idx = i;
        li.dataset.trackId = id;
        li.tabIndex = 0;
        li.innerHTML = `
          <button class="drag-handle" type="button" aria-label="${this.esc(this.t('move') + ': ' + (t.title || ''))}"><svg class="ico" aria-hidden="true"><use href="#i-grip-vertical"></use></svg></button>
          <div class="row-cover"><canvas width="144" height="144" aria-hidden="true"></canvas>${nowBadge}</div>
          <div class="row-text">
            <div class="row-title">${this.esc(t.title)}</div>
            <div class="row-sub">${this.esc(t.artist)} <span class="row-rating"${this._ratingOf(t) ? '' : ' hidden'}>${'★'.repeat(this._ratingOf(t))}</span></div>
          </div>
          <div class="row-duration">${this.fmtRowDuration(t)}</div>
          <button class="row-action queue-menu" type="button" aria-label="${this.esc(this.t('more_options'))}"><svg class="ico" aria-hidden="true"><use href="#i-ellipsis-vertical"></use></svg></button>
          <button class="row-action queue-remove" type="button" aria-label="${this.esc(this.t('remove'))}"><svg class="ico" aria-hidden="true"><use href="#i-xmark"></use></svg></button>
        `;
        const activateQueueItem = () => {
          this.playFromQueue(i);
          if (typeof this.openPlayerForTrackPick === 'function') this.openPlayerForTrackPick();
        };
        // Click normal → reproducir
        li.addEventListener('click', (e) => {
          if (e.target.closest('.drag-handle, .queue-remove, .queue-menu')) return;
          activateQueueItem();
        });
        li.addEventListener('keydown', (e) => {
          if (e.target !== li) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            activateQueueItem();
          }
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

        //  el menú «Más opciones» de la canción también vive en
        // la cola (antes solo estaba en las filas de las listas):
        // mismo menú, con su «Reproducir después de la actual» ya
        // capaz de MOVER la pista dentro de esta misma cola.
        const menuBtn = li.querySelector('.queue-menu');
        if (menuBtn) menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openTrackMenu(id);
        });
        if (typeof this.wireTrackLongPress === 'function') this.wireTrackLongPress(li, id);

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

    /*  abrir la cola DONDE suena, como en las listas.
 * La fila actual ya sale marcada (.current); esto mueve la
 * vista hasta ella. Con lista virtual (>80) la fila puede no
 * existir aún: primero se lleva el scroll a su ventana
 * (64 px por fila, dejando dos de margen arriba) y se pide
 * el repintado; después se centra la fila ya creada. Solo se
 * llama al abrir la hoja: re-pintar la cola no mueve nada. */
    scrollQueueToCurrent() {
      const ul = document.getElementById('queueList');
      if (!ul || !this.queue.length) return;
      const scroller = ul.closest('.sheet-body');
      if (ul._virt && scroller) {
        scroller.scrollTop = Math.max(0, (this.queueIdx * 64) - 128);
        if (ul._virt.onScroll) ul._virt.onScroll();
      }
      const center = () => {
        const row = ul.querySelector('.queue-item.current');
        if (row) {
          try { row.scrollIntoView({ block: 'center' }); } catch (e) {}
        }
      };
      if (ul._virt) requestAnimationFrame(center);
      else center();
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
      const applyMove = (from, to, refocus) => {
        const maxIdx = (opts && opts.maxIndex != null)
          ? opts.maxIndex
          : this.queue.length - 1;
        const clamped = Math.max(0, Math.min(maxIdx, to));
        if (clamped === from || maxIdx <= 0) return;
        const focusMoved = () => {
          if (!refocus) return;
          if (ul._virt && scroller) {
            const rowH = ul._virt.rowH || 64;
            const top = clamped * rowH;
            if (top < scroller.scrollTop) scroller.scrollTop = top;
            else if (top + rowH > scroller.scrollTop + scroller.clientHeight) {
              scroller.scrollTop = Math.max(0, top + rowH - scroller.clientHeight);
            }
            if (ul._virt.onScroll) ul._virt.onScroll();
          }
          const nextHandle = ul.querySelector(`${itemSelector}[data-idx="${clamped}"] .drag-handle`);
          if (nextHandle && typeof nextHandle.focus === 'function') {
            try { nextHandle.focus({ preventScroll: true }); } catch (err) {}
            try { nextHandle.scrollIntoView({ block: 'nearest' }); } catch (err) {}
          }
        };
        if (opts && typeof opts.onReorder === 'function') {
          opts.onReorder(from, clamped);
          focusMoved();
          return;
        }
        const moved = this.queue.splice(from, 1)[0];
        this.queue.splice(clamped, 0, moved);
        if (this.queueIdx === from) this.queueIdx = clamped;
        else if (from < this.queueIdx && clamped >= this.queueIdx) this.queueIdx--;
        else if (from > this.queueIdx && clamped <= this.queueIdx) this.queueIdx++;
        // Con aleatorio activo la cola visible es una permutación:
        // la misma mudanza se refleja en la original por id.
        if (this.shuffle && Array.isArray(this._originalQueue) && this._originalQueue.length) {
          const fromOrig = this._originalQueue.indexOf(moved);
          if (fromOrig >= 0) {
            this._originalQueue.splice(fromOrig, 1);
            this._originalQueue.splice(Math.min(clamped, this._originalQueue.length), 0, moved);
          }
        }
        if (typeof this.saveSession === 'function') this.saveSession();
        this.renderQueue();
        focusMoved();
      };
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
        applyMove(startIdx, to, false);
      };
      handle.addEventListener('pointerup', (e) => finish(e, true));
      handle.addEventListener('pointercancel', (e) => finish(e, false));
      // Reordenación equivalente con teclado (WCAG 2.2 SC 2.5.7 Dragging Movements):
      // ↑/↓ mueve una posición, Inicio/Fin lleva al principio o al final y conserva el foco.
      handle.addEventListener('keydown', (e) => {
        const curIdx = parseInt(li.dataset.idx, 10);
        const from = isNaN(curIdx) ? idx : curIdx;
        const maxIdx = (opts && opts.maxIndex != null) ? opts.maxIndex : this.queue.length - 1;
        let to = null;
        if (e.key === 'ArrowUp') to = from - 1;
        else if (e.key === 'ArrowDown') to = from + 1;
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = maxIdx;
        if (to === null) return;
        e.preventDefault();
        e.stopPropagation();
        applyMove(from, to, true);
      });
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

    playlistDuration(pl) {
      if (!pl) return 0;
      //  las inteligentes no guardan trackIds: se suman sus pistas
      // efectivas (las que la regla elige ahora mismo).
      let sum = 0;
      for (const t of this.playlistTracksSorted(pl)) {
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

    /* «1 pista» / «N pistas»: el plural a secas («1 pistas») salía en
     * tarjetas de lista, explorar y resultados de búsqueda (M1). */
    fmtTracksCount(n) {
      return n === 1 ? this.t('track_count_one') : n + ' ' + this.t('tracks_count');
    },

    playlistMetaLabel(pl) {
      const n = (pl.trackIds || []).length;
      const dur = this.fmtDurationLabel(this.playlistDuration(pl));
      let s = this.fmtTracksCount(n);
      if (dur) s += ' · ' + dur;
      if (pl.description) s += ' · ' + pl.description;
      return s;
    },

    renderPlaylists() {
      //  una sola casa para las listas — la rejilla de
      // Biblioteca. La otra superficie era la hoja #sheetPlaylists,
      // que nadie abría desde que la navegación vive aquí: pintar
      // las dos en cada render era trabajo duplicado para nadie.
      const grid = document.getElementById('libraryPlaylists');
      // Contador de la sección «Listas de reproducción» de la biblioteca.
      const libCountEl = document.getElementById('libraryPlaylistsCount');
      if (libCountEl) {
        libCountEl.textContent = String(this.playlists.length);
        libCountEl.hidden = this.playlists.length === 0;
      }
      if (typeof this.syncLibraryTools === 'function') this.syncLibraryTools();
      {
        const target = grid;
        if (!target) return;
        target.innerHTML = '';
        if (this.playlists.length === 0) {
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
          li.className = 'pl-card' + (playing ? ' is-playing' : '');
          li.tabIndex = 0;
          const cover = this.getPlaylistCover(pl);
          // Nunca interpolar una portada sin validar dentro de style="":
          // una comilla o un `)` permitiría inyectar CSS/HTML desde datos no fiables.
          const hasArt = typeof cover === 'string' && this._safeImageDataUrl(cover);
          const coverBg = hasArt ? this.playlistArtStyle(pl, cover) : this.playlistCoverStyle(pl);
          const pal = this._playlistGradientParams(pl);
          //  Favoritos vive solo en su vista; en Listas ya no
          // hay lista con trato de favorita.
          const tracksLabel = this.playlistMetaLabel(pl);
          // Ya no hay lista predefinida: ninguna lleva insignia.
          const badge = '';
          const live = playing
            ? `<span class="pl-live${this.isPlaying ? ' playing' : ''}" aria-hidden="true"><span class="pl-bars"><i></i><i></i><i></i></span></span>`
            : '';
          // En las tarjetas el play va sobre la portada como disco
          // de acento.
          const fabHtml = `<button class="pl-play-fab" type="button" aria-label="${this.esc(this.t('play_all_btn'))}">
                 <svg class="ico" aria-hidden="true"><use href="#i-play"></use></svg>
               </button>`;
          const coverHtml = `
            <div class="pl-cover${hasArt ? ' has-art' : ''}" data-pl-cover="${this.esc(pl.id)}" style="background-color:${pal.from};">
              <div class="pl-cover-grad" style="${coverBg}"></div>
              ${hasArt ? '' : `<span class="pl-cover-letter" aria-hidden="true">${this.esc(this.coverInitial(pl.name))}</span>`}
              ${live}
              ${fabHtml}
            </div>
          `;
          li.innerHTML = coverHtml + `<div class="pl-card-info"><h4>${this.esc(pl.name)}</h4><p>${this.esc(tracksLabel)}</p>${badge}</div>`;
          const fab = li.querySelector('.pl-play-fab');
          if (fab) fab.addEventListener('click', (e) => {
            e.stopPropagation();
            this.playPlaylist(pl.id);
          });
          li.addEventListener('click', (e) => {
            if (e.target.closest('.row-action, .pl-play-fab, .pl-row-play')) return;
            this.openEditPlaylist(pl.id);
          });
          li.addEventListener('keydown', (e) => {
            if (e.target !== li) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              this.openEditPlaylist(pl.id);
            }
          });
          target.appendChild(li);
        });
      }
    },

    /* Elimina una playlist. Todas se pueden borrar, también «Mi
     * Música»: borrarla deja una marca para que no resucite sola al
     * arrancar (solo vuelve al agregar canciones fuera de una lista). */
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
      // Borrar «Mi Música» es una decisión, no un accidente: se anota
      // para que el arranque no la resucite (migrateMiMusica). Volverá
      // sola cuando se agregue otra canción fuera de una lista.
      if (p.playlist.id === 'mi-musica') {
        try { localStorage.setItem('aurora_mimusica_removed', '1'); } catch (e) {}
      }
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
        // Deshacer el borrado de «Mi Música» retira la marca anti-resurrección.
        if (p.playlist.id === 'mi-musica') {
          try { localStorage.removeItem('aurora_mimusica_removed'); } catch (e) {}
        }
      }
      this.renderPlaylists();
      if (typeof this.renderHome === 'function') this.renderHome();
      this.toast(this.t('toast_restored'));
    },

    /*  renderPickTracks extirpado — pintaba el selector de
 * pistas del modo «añadir» retirado; ya nadie lo mostraba. */

    /* Orden por estrellas: de más a menos nota; las sin nota
 * (0) caen al final solas. El empate conserva el orden que traía
 * la lista (el sort de JS es estable): el orden guardado NO se
 * reescribe, solo decide el desempate. Es la única ordenación
 * automática: listas y Favoritos se ven y suenan así. */
    sortByRating(tracks) {
      return (tracks || []).slice().sort((a, b) => this._ratingOf(b) - this._ratingOf(a));
    },

    /*  ordenación elegible por el usuario. 'stars' es la de
 * siempre y sigue siendo la predeterminada; el resto son
 * alternativas manuales que se guardan en pl.sort. El sort de JS
 * es estable: los empates conservan el orden de entrada. */
    sortTracksBy(tracks, mode) {
      const arr = (tracks || []).slice();
      const loc = this.lang || undefined;
      const cmp = (a, b) => String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), loc, { sensitivity: 'base' });
      switch (mode) {
        case 'title':
          return arr.sort((a, b) => cmp(a.title, b.title));
        case 'artist':
          return arr.sort((a, b) => cmp(a.artist, b.artist) || cmp(a.title, b.title));
        case 'album':
          return arr.sort((a, b) => cmp(a.album, b.album) || cmp(a.title, b.title));
        case 'recent':
          return arr.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        case 'duration':
          return arr.sort((a, b) => (a.duration || 0) - (b.duration || 0));
        case 'added':
          return arr; // orden guardado, tal cual
        case 'stars':
        default:
          return this.sortByRating(arr);
      }
    },

    /*  géneros presentes en la biblioteca (el importador ya leía
 * el género; hasta ahora ninguna vista lo usaba). */
    getGenres() {
      const map = new Map();
      this.tracks.forEach(t => {
        const g = String((t && t.genre) || '').trim();
        const name = g || this.t('genre_unknown');
        if (!map.has(name)) map.set(name, { name, tracks: [] });
        map.get(name).tracks.push(t);
      });
      const loc = (window.getLang && window.getLang()) || undefined;
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, loc, { sensitivity: 'base' }));
    },

    /*  aquí vivía smartPlaylistTracks — el motor de las
 * listas inteligentes, retirado con ellas. */

    /* Las pistas de una lista, en el orden en que se ven y suenan. */
    playlistTracksSorted(pl) {
      if (!pl) return [];
      const byId = this.trackMap();
      const stored = ((pl && pl.trackIds) || []).map(id => byId.get(id)).filter(Boolean);
      return this.sortTracksBy(stored, (pl && pl.sort) || 'stars');
    },

    playPlaylist(playlistId) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl) return;
      const ids = this.playlistTracksSorted(pl).map(t => t.id);
      if (ids.length === 0) { this.toast(this.t('toast_playlist_empty')); return; }
      this.queue = ids;
      this.queueIdx = 0;
      this._plSyncIds = ids.slice(); //  foto base de la lista
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

    /* Las canciones con estrellas, de mejor nota a menor (a igual
 * nota, las más reproducidas primero y el título desempatando).
 * Desde solo alimenta el escaparate de Inicio: la ordenación
 * de verdad, en listas y colas, es sortByRating. */
    getTopRatedTracks() {
      const plays = (this.stats && this.stats.plays) || {};
      const loc = (window.getLang && window.getLang()) || undefined;
      return this.tracks
        .filter(t => this._ratingOf(t) > 0)
        .sort((a, b) =>
          (this._ratingOf(b) - this._ratingOf(a)) ||
          ((plays[b.id] || 0) - (plays[a.id] || 0)) ||
          String(a.title || '').localeCompare(String(b.title || ''), loc, { sensitivity: 'base' }));
    },

    /* Reproduce la lista de favoritos como una playlist independiente */
    playFavorites() {
      const favTracks = this.sortByRating(this.tracks.filter(t => this.favorites.has(t.id)));
      if (favTracks.length === 0) {
        this.toast(this.t('toast_no_favorites_yet'));
        return;
      }
      this.queue = favTracks.map(t => t.id);
      this.queueIdx = 0;
      this._plSyncIds = null; //  Favoritos no sincroniza con listas
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
        // El nombre se resuelve por id en el momento de pintar: si la
        // lista se renombra mientras suena, la etiqueta «Reproduciendo
        // desde…» no debe quedarse con el nombre del día del play.
        const pl = this.playContext.id
          ? (this.playlists || []).find(p => p && p.id === this.playContext.id)
          : null;
        return (pl && pl.name) || this.playContext.name || this.t('your_playlists');
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
        // Sustantivo, no el verbo del menú: «Reproduciendo desde Radio»,
        // no «…desde Iniciar radio».
        return this.t('radio_label');
      }
      return null;
    },

    /*  _addTrackIdToPlaylist extirpado — su comentario
 * decía «la usan el flujo individual y el lote», pero no
 * tenía ni una llamada: los flujos vivos añaden por su cuenta. */

});
