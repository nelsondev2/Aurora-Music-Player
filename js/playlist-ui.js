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
          <button class="row-action add-to-pl" aria-label="${this.esc(this.t('menu_add_to_playlist'))}"><i class="fa-solid fa-list-plus"></i></button>
          <button class="row-action delete-track" aria-label="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
        `;
        li.addEventListener('click', (e) => {
          if (e.target.closest('.delete-track, .add-to-pl')) return;
          this.playTrack(t.id, { type: 'all' });
          this.closeSheet('sheetLibrary');
        });
        li.querySelector('.add-to-pl').addEventListener('click', (e) => {
          e.stopPropagation();
          // Añadir ESTA pista (no la que está sonando) a una playlist
          this._trackToAddId = t.id;
          this._selectPlaylistForAdd = true;
          this.openSheet('sheetPlaylists');
        });
        li.querySelector('.delete-track').addEventListener('click', async (e) => {
          e.stopPropagation();
          const ok = await this.showConfirm({
            message: this.t('delete_track_confirm').replace('X', t.title),
            okLabel: this.t('confirm_delete')
          });
          if (ok) {
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
            // Modo "seleccionar playlist para añadir una pista"
            if (this._selectPlaylistForAdd) {
              this._selectPlaylistForAdd = false;
              // Prioridad: pista concreta elegida desde una fila de la
              // biblioteca; si no, la pista que está sonando
              const tid = this._trackToAddId || (this.currentTrack && this.currentTrack.id) || null;
              this._trackToAddId = null;
              this.closeSheet('sheetPlaylists');
              if (tid) this.addTrackToPlaylist(tid, pl.id);
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
    async deletePlaylist(playlistId) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl) return;
      if (pl.isDefault || pl.id === this.DEFAULT_PLAYLIST_ID) {
        this.toast(this.t('toast_cannot_delete_default'));
        return;
      }
      const ok = await this.showConfirm({
        message: this.t('delete_playlist_confirm').replace('X', pl.name),
        okLabel: this.t('confirm_delete')
      });
      if (!ok) return;
      this.playlists = this.playlists.filter(p => p.id !== playlistId);
      this.deletePlaylistFromStorage(playlistId);
      this.renderPlaylists();
      this.toast(this.t('toast_track_deleted'));
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
          <div class="row-check"><i class="fa-solid fa-check"></i></div>
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
    /* Añade una pista concreta a una playlist (generalización de
     * addCurrentTrackToPlaylist: permite añadir cualquier pista de la
     * biblioteca, no solo la que está sonando). */
    addTrackToPlaylist(trackId, playlistId) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl) return;
      const t = this.tracks.find(x => x.id === trackId);
      if (!t) {
        this.toast(this.t('toast_pick_at_least_one'));
        return;
      }
      if (pl.trackIds.includes(trackId)) {
        this.toast(this.t('toast_already_in_playlist') + ' ♥ ' + pl.name);
        return;
      }
      pl.trackIds.push(trackId);
      pl._coverCache = null;
      pl._coverCacheHash = null;
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
