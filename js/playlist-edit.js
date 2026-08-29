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
      const titleEl = document.getElementById('editPlaylistTitle');
      if (titleEl) titleEl.textContent = pl.name;
      // Mostrar/ocultar el botón "Eliminar lista" según sea predefinida
      const btnDeleteFull = document.getElementById('btnDeletePlaylistFull');
      if (btnDeleteFull) {
        btnDeleteFull.style.display = pl.isDefault ? 'none' : '';
      }
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
      if (nameEl && nameEl.tagName !== 'INPUT') {
        nameEl.textContent = pl.name;
        nameEl.title = this.t('rename_playlist_btn');
        nameEl.onclick = () => this.startRenamePlaylist();
      }
      if (metaEl) metaEl.textContent = this.playlistMetaLabel(pl);
      if (coverEl) {
        const cover = this.getPlaylistCover(pl);
        coverEl.classList.toggle('is-playing', this.isPlaylistPlaying(pl));
        if (typeof cover === 'string' && cover.startsWith('data:')) {
          coverEl.style.background = '';
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
        li.className = 'pl-empty-tracks';
        li.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i><p>' + this.esc(this.t('no_tracks_in_playlist')) + '</p>';
        ul.appendChild(li);
        return;
      }
      pl.trackIds.forEach((id, i) => {
        const t = this.tracks.find(x => x.id === id);
        if (!t) return;
        const isCurrent = this.currentTrack && this.currentTrack.id === id;
        const li = document.createElement('li');
        li.className = 'track-row' + (isCurrent ? ' current' : '');
        li.dataset.trackId = id;
        li.dataset.idx = String(i);
        li.innerHTML = `
          <button class="drag-handle" type="button" aria-label="Mover"><i class="fa-solid fa-grip-vertical"></i></button>
          <div class="row-cover"><canvas width="44" height="44"></canvas></div>
          <div class="row-text">
            <div class="row-title">${this.esc(t.title)}</div>
            <div class="row-sub">${this.esc(t.artist)}</div>
          </div>
          <div class="row-duration">${isCurrent ? '<i class="fa-solid fa-volume-high now-eq"></i> ' : ''}${this.fmtTime(t.duration)}</div>
          <button class="row-action track-menu-btn" type="button" aria-label="${this.esc(this.t('more_options'))}"><i class="fa-solid fa-ellipsis-vertical"></i></button>
          <button class="row-action remove-from-pl" aria-label="${this.esc(this.t('remove_from_playlist'))}"><i class="fa-solid fa-xmark"></i></button>
        `;
        li.addEventListener('click', (e) => {
          if (e.target.closest('.remove-from-pl, .track-menu-btn, .drag-handle')) return;
          // Reproducir esta pista dentro del contexto de la playlist.
          // playTrack se encarga de setear la cola = pistas de la playlist.
          this.playTrack(t.id, { type: 'playlist', id: pl.id, name: pl.name });
          this.renderQueue();
        });
        const menuBtn = li.querySelector('.track-menu-btn');
        if (menuBtn) menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openTrackMenu(t.id);
        });
        if (typeof this.wireTrackLongPress === 'function') this.wireTrackLongPress(li, t.id);
        li.querySelector('.remove-from-pl').addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeFromPlaylist(pl.id, t.id);
        });
        if (typeof this.wireDragHandle === 'function') {
          this.wireDragHandle(li, i, ul, '.track-row', {
            onReorder: (from, to) => this.reorderPlaylistTracks(pl.id, from, to)
          });
        }
        ul.appendChild(li);
        const cv = li.querySelector('canvas');
        if (cv) this.drawRowCover(cv, t);
      });
    },

    reorderPlaylistTracks(playlistId, from, to) {
      const pl = this.playlists.find(p => p.id === playlistId);
      if (!pl || from === to) return;
      if (from < 0 || to < 0 || from >= pl.trackIds.length || to >= pl.trackIds.length) return;
      const moved = pl.trackIds.splice(from, 1)[0];
      pl.trackIds.splice(to, 0, moved);
      this.persistPlaylist(pl);
      this.renderEditPlaylist();
    },

    startRenamePlaylist() {
      const pl = this.playlists.find(p => p.id === this._editingPlaylistId);
      if (!pl) return;
      const nameEl = document.getElementById('editPlaylistName');
      if (!nameEl || nameEl.tagName === 'INPUT') return;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'edit-pl-name-input';
      input.value = pl.name;
      input.maxLength = 80;
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      let done = false;
      const commit = () => {
        if (done) return;
        done = true;
        const v = input.value.trim();
        if (v && v !== pl.name) {
          pl.name = v;
          this.persistPlaylist(pl);
          this.renderPlaylists();
          if (typeof this.renderHome === 'function') this.renderHome();
          this.toast(this.t('toast_playlist_renamed'));
        }
        this.renderEditPlaylist();
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = pl.name; input.blur(); }
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
      // Si el editor de esta playlist está abierto:
      // - lista vacía → re-render completo (muestra el estado "sin pistas")
      // - si no → quitar solo la fila afectada
      if (this._editingPlaylistId === playlistId) {
        if (pl.trackIds.length === 0) this.renderEditPlaylist();
        else this._removeTrackFromEditView(trackId);
      }
      this.renderQueue();
      this.toast(this.t('toast_removed_from_playlist'));
    },

    /* Actualizar solo el contador de una playlist sin re-render completo */
    _updatePlaylistMeta(pl) {
      const meta = document.getElementById('editPlaylistMeta');
      if (meta) meta.textContent = this.playlistMetaLabel(pl);
    },

    /* Eliminar una pista de la vista de edición sin re-render completo */
    _removeTrackFromEditView(trackId) {
      // Match por data-track-id (robusto): antes se buscaba por el texto
      // del título, lo que eliminaba de la vista TODAS las filas de
      // canciones con el mismo nombre aunque solo se quitara una.
      const row = document.querySelector('#editPlaylistTracks .track-row[data-track-id="' + CSS.escape(trackId) + '"]');
      if (row) {
        row.style.transition = 'opacity .2s, transform .2s';
        row.style.opacity = '0';
        row.style.transform = 'translateX(-20px)';
        setTimeout(() => row.remove(), 200);
      }
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
