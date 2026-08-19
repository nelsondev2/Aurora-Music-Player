/* =====================================================================
 *  js/playlist-edit.js — Aurora Music Player
 *  Crear / editar / añadir a playlists
 *
 *  Parte del refactor (C) de app.js: mismo código, módulos por funcionalidad.
 *  Este archivo se carga tras js/state.js y completa el objeto App con
 *  Object.assign (los scripts son clásicos por compatibilidad webxdc).
 * ===================================================================== */

'use strict';

Object.assign(App, {
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
    async clearPlaylist(playlistId) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl) return;
      if (pl.trackIds.length === 0) {
        this.toast(this.t('toast_playlist_cleared'));
        return;
      }
      const ok = await this.showConfirm({
        message: this.t('confirm_clear_playlist'),
        okLabel: this.t('confirm_delete')
      });
      if (!ok) return;
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
});
