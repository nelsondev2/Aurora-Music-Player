/* =====================================================================
 *  js/events.js — Aurora Music Player
 *  wireEvents: cableado de todos los eventos
 *
 *  Parte del refactor (C) de app.js: mismo código, módulos por funcionalidad.
 *  Este archivo se carga tras js/state.js y completa el objeto App con
 *  Object.assign (los scripts son clásicos por compatibilidad webxdc).
 * ===================================================================== */

'use strict';

Object.assign(App, {
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
      const coverArt = document.getElementById('coverArt');
      if (coverArt) {
        coverArt.addEventListener('click', () => {
          if (this.currentTrack) this.togglePlay();
        });
        coverArt.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (this.currentTrack) this.togglePlay();
          }
        });
      }

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
        this.openSheet('sheetHistory');
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
      const btnRetag = document.getElementById('menuRetagTracks');
      if (btnRetag) btnRetag.addEventListener('click', () => {
        this.closeSheet('sheetSettings');
        this.toast(this.t('toast_retag_start'));
        this.retagExistingTracks().catch(() => {});
      });
      const btnExport = document.getElementById('menuExportLibrary');
      if (btnExport) btnExport.addEventListener('click', () => {
        this.exportLibrary();
      });
      const btnImport = document.getElementById('menuImportLibrary');
      if (btnImport) btnImport.addEventListener('click', () => {
        this.importLibrary();
      });

      // Volver / cargar música
      $('btnBack').addEventListener('click', () => this.openFilePicker());

      // Botón "Cargar música" en menú más opciones
      const btnLoadMore = document.getElementById('menuLoadMusic');
      if (btnLoadMore) btnLoadMore.addEventListener('click', () => {
        this.openFilePicker();
        this.closeSheet('sheetMore');
      });

      // Cola
      $('btnQueue').addEventListener('click', () => {
        this.renderQueue();
        this.openSheet('sheetQueue');
      });
      const btnClearQueue = document.getElementById('btnClearQueue');
      if (btnClearQueue) btnClearQueue.addEventListener('click', () => this.clearUpcomingQueue());

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
        if (!this.currentTrack || this.isPlaceholderArtist(this.currentTrack.artist)) {
          this.toast(this.t('unknown_artist'));
          return;
        }
        const artist = this.currentTrack.artist;
        this._searchFilter = 'artist';
        document.querySelectorAll('.search-filter').forEach(x => {
          x.classList.toggle('active', x.dataset.filter === 'artist');
        });
        const inp = document.getElementById('searchInput');
        if (inp) inp.value = artist;
        this.runSearch(artist, 'artist');
        this.openSheet('sheetSearch');
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

      this.bindAudioElement(this.audio);

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
      const savedN = savedVol != null ? parseFloat(savedVol) : NaN;
      // 0.8 era el default antiguo; al subirlo a 1 no pisar un volumen elegido a propósito
      if (isFinite(savedN) && savedN > 0 && Math.abs(savedN - 0.8) > 0.001) this.setVolume(savedN);
      else this.setVolume(1);

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
        if (e.key === 'Escape') {
          const open = document.querySelectorAll('.sheet.open');
          if (open.length) {
            e.preventDefault();
            this.closeSheet(open[open.length - 1].id);
          }
          return;
        }
        if (e.key === 'Tab' && document.querySelector('.sheet.open')) {
          this._trapSheetFocus(e);
          return;
        }
        if (document.querySelector('.sheet.open')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch (e.key) {
          case ' ': e.preventDefault(); this.togglePlay(); break;
          case 'ArrowRight': if (e.shiftKey) this.next(); else this.seekTo(((this.audio.currentTime||0)+5) / (this.audio.duration||1)); break;
          case 'ArrowLeft': if (e.shiftKey) this.prev(); else this.seekTo(Math.max(0,((this.audio.currentTime||0)-5)) / (this.audio.duration||1)); break;
          case 'ArrowUp': e.preventDefault(); this.setVolume(Math.min(1, this.volume + 0.05)); break;
          case 'ArrowDown': e.preventDefault(); this.setVolume(Math.max(0, this.volume - 0.05)); break;
          case 'm': case 'M':
            if (this.volume > 0) { this._volBeforeMute = this.volume; this.setVolume(0); }
            else this.setVolume(this._volBeforeMute > 0 ? this._volBeforeMute : 1);
            break;
          case 'l': case 'L': this.toggleFavorite(); break;
          case 'n': case 'N': this.next(); break;
          case 'p': case 'P': this.prev(); break;
        }
      });
    },

    /* Cablea timeupdate / ended / metadata en el <audio> activo.
     * Se vuelve a llamar tras un swap gapless (otro elemento Audio). */
    bindAudioElement(el) {
      if (!el) return;
      if (!this._onAudioTimeUpdate) {
        this._onAudioTimeUpdate = () => this.updateProgress();
        this._onAudioLoadedMeta = () => {
          const dur = this.audio && this.audio.duration;
          const totalEl = document.getElementById('timeTotal');
          if (totalEl) totalEl.textContent = this.fmtTime(dur);
          if (this.currentTrack && isFinite(dur) && dur > 0 &&
              (!this.currentTrack.duration || this.currentTrack.duration === 0)) {
            this.currentTrack.duration = Math.floor(dur);
            this.persistTrack(this.currentTrack);
            this.renderLibrary();
            this.renderQueue();
            if (this._editingPlaylistId) this.renderEditPlaylist();
          }
        };
        this._onAudioEnded = () => {
          this.next(true);
        };
        this._onAudioError = (e) => {
          const msg = (e && e.message) || (this.audio && this.audio.error && this.audio.error.message) || 'unknown';
          this._lastError = { msg: 'audio error: ' + msg, ts: Date.now() };
          this.toast(this.t('toast_audio_error'));
        };
      }
      if (this._boundAudioEl && this._boundAudioEl !== el) {
        this._boundAudioEl.removeEventListener('timeupdate', this._onAudioTimeUpdate);
        this._boundAudioEl.removeEventListener('loadedmetadata', this._onAudioLoadedMeta);
        this._boundAudioEl.removeEventListener('ended', this._onAudioEnded);
        this._boundAudioEl.removeEventListener('error', this._onAudioError);
      }
      if (this._boundAudioEl === el) return;
      el.addEventListener('timeupdate', this._onAudioTimeUpdate);
      el.addEventListener('loadedmetadata', this._onAudioLoadedMeta);
      el.addEventListener('ended', this._onAudioEnded);
      el.addEventListener('error', this._onAudioError);
      this._boundAudioEl = el;
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

      // El like está en el botón del título; la portada hace play/pausa.

      this._wired.gestures = true;
    },

    closeAllSheets() {
      document.querySelectorAll('.sheet.open').forEach(s => this.closeSheet(s.id));
    },
});
