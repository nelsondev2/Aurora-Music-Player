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
      // Segunda línea de defensa (ver init()): si el cableado ya se hizo,
      // repetirlo duplicaría cada listener y anularía los botones de tipo
      // interruptor (play/pausa, pantalla completa, aleatorio…).
      if (this._wired.events) return;
      this._wired.events = true;
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
      $('miniPlayerPlay').addEventListener('click', (e) => { e.stopPropagation(); this.togglePlay(); });
      $('miniPlayerNext').addEventListener('click', (e) => { e.stopPropagation(); this.next(); });
      const miniOpen = document.getElementById('miniOpen');
      if (miniOpen) miniOpen.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openNowPlaying();
      });
      const mini = document.getElementById('miniPlayer');
      if (mini) {
        mini.addEventListener('click', (e) => {
          if (e.target.closest('.mini-btn')) return;
          this.openNowPlaying();
        });
        mini.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.openNowPlaying();
          }
        });
      }
      const btnHomeAdd = document.getElementById('btnHomeAdd');
      if (btnHomeAdd) btnHomeAdd.addEventListener('click', () => this.openFilePicker());
      // Ajustes desde Inicio: no depende de tener una pista cargada.
      // Opciones desde Inicio (§54): mismo motivo —la copia de
      // seguridad se importa también en una instalación vacía—.
      const btnHomeMore = document.getElementById('btnHomeMore');
      if (btnHomeMore) btnHomeMore.addEventListener('click', () => this.openSheet('sheetMore'));
      const coverArt = document.getElementById('coverArt');
      if (coverArt) {
        let cvX = 0, cvY = 0, cvVol = 1, mode = null, lpTimer = null, pid = null;
        const clearLp = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
        const endGesture = (e) => {
          clearLp();
          coverArt.classList.remove('vol-adjusting');
          const x = e.clientX, y = e.clientY;
          if (mode === 'hswipe' && this.currentTrack) {
            const dx = x - cvX;
            if (Math.abs(dx) > 48) {
              this._coverSkipClick = true;
              if (dx < 0) this.next();
              else this.prev();
              if (navigator.vibrate) navigator.vibrate(10);
            }
          }
          if (mode === 'vol' || mode === 'like') this._coverSkipClick = true;
          mode = null;
          pid = null;
        };
        coverArt.addEventListener('pointerdown', (e) => {
          if (e.button && e.button !== 0) return;
          pid = e.pointerId;
          try { coverArt.setPointerCapture(e.pointerId); } catch (err) {}
          cvX = e.clientX;
          cvY = e.clientY;
          cvVol = this.volume;
          mode = null;
          this._coverSkipClick = false;
          clearLp();
          lpTimer = setTimeout(() => {
            if (!this.currentTrack) return;
            mode = 'like';
            this._coverSkipClick = true;
            this.toggleFavorite();
            coverArt.classList.add('liked-pulse');
            setTimeout(() => coverArt.classList.remove('liked-pulse'), 420);
            if (navigator.vibrate) navigator.vibrate(18);
          }, 480);
        });
        coverArt.addEventListener('pointermove', (e) => {
          if (pid == null || e.pointerId !== pid) return;
          if (mode === 'like') return;
          const dx = e.clientX - cvX;
          const dy = cvY - e.clientY;
          if (!mode) {
            if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
            clearLp();
            mode = (Math.abs(dx) > Math.abs(dy) * 1.15) ? 'hswipe' : 'vol';
          }
          if (mode === 'vol') {
            this._coverSkipClick = true;
            coverArt.classList.add('vol-adjusting');
            const h = Math.max(120, coverArt.getBoundingClientRect().height);
            this.setVolume(cvVol + dy / h);
            this.showNpVolume(true);
          }
        });
        coverArt.addEventListener('pointerup', endGesture);
        coverArt.addEventListener('pointercancel', endGesture);
        coverArt.addEventListener('contextmenu', (e) => e.preventDefault());
        coverArt.addEventListener('click', (e) => {
          if (this._coverSkipClick) {
            this._coverSkipClick = false;
            e.preventDefault();
            return;
          }
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
        this.closeAllSheets();
        this.showView('lyrics');
        this.restoreLyricsPrefs();
        this.renderLyrics();
      });
      $('btnBackFromLyrics').addEventListener('click', () => {
        this.showView('player');
        this.updateChrome();
      });

      // === Letras LRC: barra de herramientas ===
      // Tamaño de fuente (#7)
      $('btnLrcFontDec').addEventListener('click', () => this.setLrcFontSize(this.lrcFontSize - 2));
      $('btnLrcFontInc').addEventListener('click', () => this.setLrcFontSize(this.lrcFontSize + 2));
      // Offset manual (#12)
      $('btnLrcOffsetMinus').addEventListener('click', () => this.adjustLrcOffset(-0.5));
      $('btnLrcOffsetReset').addEventListener('click', () => this.resetLyricsPrefs());
      $('btnLrcOffsetPlus').addEventListener('click', () => this.adjustLrcOffset(0.5));
      // Loop de sección (#19)
      $('btnLrcLoop').addEventListener('click', () => this.toggleLyricsLoop());
      $('btnLrcLoopClear').addEventListener('click', () => this.clearLyricsLoop());
      // Pantalla completa (#14)
      $('btnLrcFullscreen').addEventListener('click', () => this.toggleLyricsFullscreen());
      // Cargar .lrc externo (#1)
      $('btnLrcLoadFile').addEventListener('click', () => this.loadExternalLrc());
      $('btnLrcEmptyLoad').addEventListener('click', () => this.loadExternalLrc());
      $('btnLrcEmptyEdit').addEventListener('click', () => this.openLrcEditor());
      // Editor de letras (#2)
      $('btnLrcEdit').addEventListener('click', () => this.openLrcEditor());
      $('btnLrcSave').addEventListener('click', () => this.saveLrcFromEditor());
      // §81: sincronizar letra tocando
      const btnTapMode = document.getElementById('btnLrcTapMode');
      if (btnTapMode) btnTapMode.addEventListener('click', () => this.toggleLrcTapMode());
      const btnTap = document.getElementById('btnLrcTap');
      if (btnTap) btnTap.addEventListener('click', () => this.tapSyncMark());
      const btnTapUndo = document.getElementById('btnLrcTapUndo');
      if (btnTapUndo) btnTapUndo.addEventListener('click', () => this.tapSyncUndo());
      const btnTapDone = document.getElementById('btnLrcTapDone');
      if (btnTapDone) btnTapDone.addEventListener('click', () => this.tapSyncDone());
      const btnLrcExp = document.getElementById('btnLrcExport');
      if (btnLrcExp) btnLrcExp.addEventListener('click', () => this.exportCurrentLyrics());
      const btnLrcSh = document.getElementById('btnLrcShare');
      if (btnLrcSh) btnLrcSh.addEventListener('click', () => this.exportCurrentLyrics());
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
        if (typeof this.updateStorageUsage === 'function') this.updateStorageUsage();
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
      const btnFree = document.getElementById('menuFreeStorage');
      if (btnFree) btnFree.addEventListener('click', () => {
        if (typeof this.offerFreeStorage === 'function') this.offerFreeStorage();
      });
      const btnCancelImport = document.getElementById('btnCancelImport');
      if (btnCancelImport) btnCancelImport.addEventListener('click', () => {
        this._importCancelled = true;
        const count = document.getElementById('importCount');
        if (count) count.textContent = this.t('import_cancel');
      });
      const toggleGapless = document.getElementById('toggleGapless');
      if (toggleGapless) toggleGapless.addEventListener('change', () => {
        this._gaplessEnabled = !!toggleGapless.checked;
        this.savePlaybackSettings();
        if (this._gaplessEnabled) this.preloadNextTrack();
      });
      const toggleNormalize = document.getElementById('toggleNormalize');
      if (toggleNormalize) toggleNormalize.addEventListener('change', () => {
        this._normalizeVolume = !!toggleNormalize.checked;
        this.savePlaybackSettings();
        this.applyNormalization(this.currentTrack);
      });
      document.querySelectorAll('.xfade-opt').forEach(b => {
        b.addEventListener('click', () => {
          const n = parseInt(b.dataset.xfade, 10) || 0;
          this.crossfadeDuration = n;
          this.crossfadeEnabled = n > 0;
          document.querySelectorAll('.xfade-opt').forEach(x => x.classList.toggle('active', x === b));
          this.savePlaybackSettings();
        });
      });
      const togglePreservePitch = document.getElementById('chkPreservePitch');
      if (togglePreservePitch) togglePreservePitch.addEventListener('change', () => {
        this.setPreservesPitch(togglePreservePitch.checked);
      });
      // Velocidad de reproducción también desde Ajustes (antes solo
      // existía en la pantalla de Letras: hallazgo A3). Es el mismo
      // ajuste; setPlaybackRate sincroniza ambas etiquetas.
      const btnSpeedDown = document.getElementById('btnSpeedDown');
      if (btnSpeedDown) btnSpeedDown.addEventListener('click', () => {
        this.setPlaybackRate(this.playbackRate - 0.1);
      });
      const btnSpeedUp = document.getElementById('btnSpeedUp');
      if (btnSpeedUp) btnSpeedUp.addEventListener('click', () => {
        this.setPlaybackRate(this.playbackRate + 0.1);
      });
      const toggleMarquee = document.getElementById('toggleMarquee');
      if (toggleMarquee) toggleMarquee.addEventListener('change', () => {
        this._marqueeEnabled = !!toggleMarquee.checked;
        this.savePlaybackSettings();
        if (typeof this._syncMarquee === 'function') {
          const title = document.getElementById('trackTitle');
          const artist = document.getElementById('trackArtist');
          if (title) this._syncMarquee(title);
          if (artist) this._syncMarquee(artist);
        }
      });
      const toggleVinyl = document.getElementById('toggleVinyl');
      if (toggleVinyl) toggleVinyl.addEventListener('change', () => {
        this._vinylEnabled = !!toggleVinyl.checked;
        this.savePlaybackSettings();
        if (typeof this.applyVinylMode === 'function') this.applyVinylMode();
      });
      const btnShortcuts = document.getElementById('menuShortcutsSettings');
      if (btnShortcuts) btnShortcuts.addEventListener('click', () => {
        this.closeSheet('sheetSettings');
        this.openSheet('sheetShortcuts');
      });
      const btnDelLib = document.getElementById('menuDeleteLibrary');
      if (btnDelLib) btnDelLib.addEventListener('click', () => {
        this.closeSheet('sheetSettings');
        this.deleteAllTracks();
      });

      // Volver / cargar música
      $('btnBack').addEventListener('click', () => this.openFilePicker());

      // Botón "Cargar música" en menú más opciones
      const btnLoadMore = document.getElementById('menuLoadMusic');
      if (btnLoadMore) btnLoadMore.addEventListener('click', () => {
        this.openFilePicker();
        this.closeSheet('sheetMore');
      });
      const btnLoadFolder = document.getElementById('menuLoadFolder');
      if (btnLoadFolder) {
        // Sin soporte de carpetas (Android, webxdc nativo): ocultar la opción
        if (typeof this.supportsFolderPicker === 'function' && !this.supportsFolderPicker()) {
          btnLoadFolder.style.display = 'none';
        } else {
          btnLoadFolder.addEventListener('click', () => {
            this.openFilePicker(true);
            this.closeSheet('sheetMore');
          });
        }
      }

      // Visualizador y Bucle A-B
      const btnVis = document.getElementById('btnVisualizer');
      if (btnVis) btnVis.addEventListener('click', () => this.cycleVisualizerMode());
      const cvVis = document.getElementById('visualizerCanvas');
      if (cvVis) cvVis.addEventListener('click', () => this.cycleVisualizerMode());
      const btnAB = document.getElementById('btnABRepeat');
      if (btnAB) btnAB.addEventListener('click', () => this.toggleABRepeat());
      const chkPitch = document.getElementById('chkPreservePitch');
      if (chkPitch) chkPitch.addEventListener('change', (e) => this.setPreservesPitch(e.target.checked));

      // Cola
      $('btnQueue').addEventListener('click', () => {
        this.renderQueue();
        this.openSheet('sheetQueue');
      });
      const btnClearQueue = document.getElementById('btnClearQueue');
      if (btnClearQueue) btnClearQueue.addEventListener('click', () => this.clearUpcomingQueue());
      const btnSaveQueue = document.getElementById('btnSaveQueueAsPlaylist');
      if (btnSaveQueue) btnSaveQueue.addEventListener('click', () => this.openSaveQueueSheet());

      // Volumen: tap / long-press abre slider compacto; el sheet queda como respaldo
      const btnVol = document.getElementById('btnVolume');
      if (btnVol) {
        let lpTimer = null, lpFired = false;
        btnVol.addEventListener('pointerdown', () => {
          lpFired = false;
          lpTimer = setTimeout(() => {
            lpFired = true;
            this.showNpVolume(true);
          }, 420);
        });
        const cancelLp = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
        btnVol.addEventListener('pointerup', cancelLp);
        btnVol.addEventListener('pointerleave', cancelLp);
        btnVol.addEventListener('pointercancel', cancelLp);
        btnVol.addEventListener('click', (e) => {
          if (lpFired) { e.preventDefault(); e.stopPropagation(); lpFired = false; return; }
          this.showNpVolume();
        });
      }
      $('volumeSlider').addEventListener('input', (e) => this.setVolume(parseInt(e.target.value, 10)/100));
      const slNp = document.getElementById('volumeSliderNp');
      if (slNp) {
        slNp.addEventListener('input', (e) => {
          this.setVolume(parseInt(e.target.value, 10)/100);
          this.showNpVolume(true);
        });
      }

      // EQ / Sleep — en el menú ··· (ya no ocupan la fila de NP)
      const menuEq = document.getElementById('menuEqualizer');
      if (menuEq) menuEq.addEventListener('click', () => {
        this.closeSheet('sheetMore');
        this.openSheet('sheetEqualizer');
      });
      const menuSleep = document.getElementById('menuSleep');
      if (menuSleep) menuSleep.addEventListener('click', () => {
        this.closeSheet('sheetMore');
        this.openSheet('sheetSleep');
      });
      // (El botón suelto de EQ desapareció: ahora se abre desde el menú ···,
      // ya cableado arriba como #menuEqualizer.)
      document.querySelectorAll('.eq-preset').forEach(b => {
        b.addEventListener('click', () => this.applyEqPreset(b.dataset.preset));
      });
      const btnResetEq = document.getElementById('btnResetEq');
      if (btnResetEq) btnResetEq.addEventListener('click', () => this.resetEqValues());

      // Sleep (el acceso es la fila #menuSleep del menú ···, cableada arriba)
      document.querySelectorAll('.sleep-opt').forEach(b => {
        b.addEventListener('click', () => {
          document.querySelectorAll('.sleep-opt').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          if (b.dataset.sleep === 'eot') this.startSleepEndOfTrack();
          else this.startSleep(parseInt(b.dataset.min, 10));
        });
      });
      $('btnCancelSleep').addEventListener('click', () => {
        document.querySelectorAll('.sleep-opt').forEach(x => x.classList.remove('active'));
        this.cancelSleep();
      });

      // Playlists
      $('btnNewPlaylist').addEventListener('click', () => this.openCreatePlaylistSheet());
      $('btnOpenNewPlaylist').addEventListener('click', () => {
        this.openCreatePlaylistSheet();
      });

      // Guardar playlist: crea una nueva (vacía; las pistas se
      // añaden luego desde la vista de edición) o guarda la cola.
      // (§93: el modo «añadir a existente» desde esta hoja y su
      // selector de pistas eran inalcanzables desde la §81.)
      $('btnSavePlaylist').addEventListener('click', () => {

        // §81 modo «guardar cola como lista»: la lista nace con la
        // cola entera en su orden exacto (sort='added').
        if (this._queueSaveMode) {
          const qName = $('playlistName').value.trim();
          const qDesc = $('playlistDesc').value.trim();
          if (!qName) { this.toast(this.t('toast_name_required')); return; }
          const qCreated = this.createPlaylist(qName, qDesc, (this.queue || []).slice());
          if (!qCreated) return; // nombre duplicado: ya avisó
          qCreated.sort = 'added';
          this.persistPlaylist(qCreated);
          this._queueSaveMode = false;
          $('playlistName').value = '';
          $('playlistDesc').value = '';
          this.closeSheet('sheetCreatePlaylist');
          this.closeSheet('sheetQueue');
          this.toast(this.t('toast_queue_saved') + ': ' + qName);
          return;
        }

        // Modo "crear nueva playlist" (admite vacía)
        const name = $('playlistName').value.trim();
        const desc = $('playlistDesc').value.trim();
        if (!name) { this.toast(this.t('toast_name_required')); return; }
        // §81: lista inteligente: nace sin pistas; la regla las elige.
        if (this._plSmartMode) {
          const kindSel = document.getElementById('smartRuleKind');
          const genreSel = document.getElementById('smartRuleGenre');
          const kind = kindSel ? kindSel.value : 'rating';
          const smart = { kind };
          if (kind === 'genre') {
            smart.genre = genreSel ? genreSel.value : '';
            if (!smart.genre) { this.toast(this.t('no_results')); return; }
          }
          const sCreated = this.createPlaylist(name, desc, []);
          if (!sCreated) return;
          sCreated.smart = smart;
          this.persistPlaylist(sCreated);
          this.renderPlaylists();
          $('playlistName').value = '';
          $('playlistDesc').value = '';
          this.closeSheet('sheetCreatePlaylist');
          this.toast(this.t('toast_smart_created') + ': ' + name);
          return;
        }
        const created = this.createPlaylist(name, desc, []);
        if (!created) return; // nombre duplicado: createPlaylist ya avisó
        $('playlistName').value = '';
        $('playlistDesc').value = '';
        this.closeSheet('sheetCreatePlaylist');
        // §93: desde esta hoja la lista siempre nace vacía (sin
        // selector de pistas); antes había un toast alternativo
        // para «creada con pistas» que ya nunca podía sonar.
        this.toast(this.t('toast_playlist_empty_created') + ': ' + name);
      });

      // Botones del sheet "Editar playlist"
      const btnPlayNow = document.getElementById('btnPlayPlaylistNow');
      if (btnPlayNow) btnPlayNow.addEventListener('click', () => {
        if (this._editingPlaylistId) {
          this.playPlaylist(this._editingPlaylistId);
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
      // Eliminar la playlist completa (todas las listas se pueden borrar)
      const btnDeletePlFull = document.getElementById('btnDeletePlaylistFull');
      if (btnDeletePlFull) btnDeletePlFull.addEventListener('click', () => {
        if (!this._editingPlaylistId) return;
        const idToDelete = this._editingPlaylistId;
        this.closeSheet('sheetEditPlaylist');
        this.deletePlaylist(idToDelete);
      });

      // Library / search / favorites / home
      document.querySelectorAll('.nav-btn').forEach(b => {
        b.addEventListener('click', () => this.goNav(b.dataset.nav));
      });

      const btnPlayBrowse = document.getElementById('btnPlayBrowse');
      if (btnPlayBrowse) btnPlayBrowse.addEventListener('click', () => this.playBrowse());

      // Favorito desde el menú de pista: funciona sin abrir el reproductor
      // y para cualquier pista, no solo la que está sonando.
      // Estrellas (§58): en el menú valoran la canción del menú; en el
      // Reproductor, la que suena. Tocar la misma estrella quita la nota.
      document.querySelectorAll('#ctxRatingStars .rate-star').forEach(b => {
        b.addEventListener('click', () => {
          const t = this.menuTrack();
          if (t) this.setTrackRating(t.id, parseInt(b.dataset.value, 10));
        });
      });
      document.querySelectorAll('#npRatingStars .rate-star').forEach(b => {
        b.addEventListener('click', () => {
          if (this.currentTrack) this.setTrackRating(this.currentTrack.id, parseInt(b.dataset.value, 10));
        });
      });
      const ctxFav = document.getElementById('ctxToggleFavorite');
      if (ctxFav) ctxFav.addEventListener('click', () => {
        const t = this.menuTrack();
        this.closeSheet('sheetTrackMenu');
        if (t) this.toggleFavoriteFor(t.id);
      });
      const ctxPlayNow = document.getElementById('ctxPlayNow');
      if (ctxPlayNow) ctxPlayNow.addEventListener('click', () => {
        const t = this.menuTrack();
        this.closeSheet('sheetTrackMenu');
        if (t) {
          // «Reproducir ahora» desde el menú de una lista no debe
          // saltar a «Todas las canciones»: manda la lista de la
          // canción, como en Buscar (§38).
          this.playTrack(t.id, typeof this.trackPlayContextFor === 'function' ? this.trackPlayContextFor(t) : { type: 'all' });
          if (typeof this.openPlayerForTrackPick === 'function') this.openPlayerForTrackPick();
        }
      });
      const ctxPlayNext = document.getElementById('ctxPlayNext');
      if (ctxPlayNext) ctxPlayNext.addEventListener('click', () => {
        const t = this.menuTrack();
        this.closeSheet('sheetTrackMenu');
        if (!t) return;
        if (!this.currentTrack) this.playTrack(t.id, typeof this.trackPlayContextFor === 'function' ? this.trackPlayContextFor(t) : { type: 'all' });
        else this.playNext(t.id);
      });
      const ctxAddQueue = document.getElementById('ctxAddQueue');
      if (ctxAddQueue) ctxAddQueue.addEventListener('click', () => {
        const t = this.menuTrack();
        this.closeSheet('sheetTrackMenu');
        if (t) this.addToQueue(t.id);
      });
      const ctxRadio = document.getElementById('ctxStartRadio');
      if (ctxRadio) ctxRadio.addEventListener('click', () => {
        const t = this.menuTrack();
        this.closeSheet('sheetTrackMenu');
        if (t) {
          this.startRadio(t.id);
          if (typeof this.openPlayerForTrackPick === 'function') this.openPlayerForTrackPick();
        }
      });
      // §81: pestañas de la biblioteca y buscador de duplicados
      document.querySelectorAll('.lib-tab').forEach(b => {
        b.addEventListener('click', () => this.setLibTab(b.dataset.libtab));
      });
      const btnDup = document.getElementById('btnFindDuplicates');
      if (btnDup) btnDup.addEventListener('click', () => this.openDuplicates());
      // §81: orden de la lista en edición
      const plSortSel = document.getElementById('plSortSelect');
      if (plSortSel) plSortSel.addEventListener('change', () => {
        const pl = this.playlists.find(p => p.id === this._editingPlaylistId);
        if (!pl) return;
        pl.sort = plSortSel.value;
        this.persistPlaylist(pl);
        this.renderEditPlaylist();
        // §83: si es la lista que está sonando, lo que queda por
        // sonar adopta el nuevo criterio al momento (si no, la
        // vista enseñaba un orden y la cola sonaba otro).
        if (this.playContext && this.playContext.type === 'playlist'
            && this.playContext.id === pl.id
            && typeof this.resortUpcomingQueue === 'function') {
          this.resortUpcomingQueue(true);
        }
        this.toast(this.t('toast_sort_saved'));
      });
      // §81: orden de la vista álbum/artista/género
      const browseSortSel = document.getElementById('browseSortSelect');
      if (browseSortSel) browseSortSel.addEventListener('change', () => {
        if (this._browse) this._browse.sort = browseSortSel.value;
        this.renderBrowseTracks();
      });
      // §81: tipo de lista al crear (normal / inteligente)
      const btnTypeN = document.getElementById('plTypeNormal');
      const btnTypeS = document.getElementById('plTypeSmart');
      const smartFieldsEl = document.getElementById('smartRuleFields');
      const setSmartMode = (on) => {
        this._plSmartMode = !!on;
        if (btnTypeN) btnTypeN.classList.toggle('active', !on);
        if (btnTypeS) btnTypeS.classList.toggle('active', !!on);
        if (smartFieldsEl) smartFieldsEl.hidden = !on;
        if (on && typeof this._fillSmartGenreSelect === 'function') this._fillSmartGenreSelect();
      };
      if (btnTypeN) btnTypeN.addEventListener('click', () => setSmartMode(false));
      if (btnTypeS) btnTypeS.addEventListener('click', () => setSmartMode(true));
      const kindSelEl = document.getElementById('smartRuleKind');
      if (kindSelEl) kindSelEl.addEventListener('change', () => {
        const gf = document.getElementById('smartGenreField');
        if (gf) gf.hidden = kindSelEl.value !== 'genre';
        if (kindSelEl.value === 'genre' && typeof this._fillSmartGenreSelect === 'function') this._fillSmartGenreSelect();
      });

      const btnRenamePl = document.getElementById('btnRenamePlaylist');
      if (btnRenamePl) btnRenamePl.addEventListener('click', () => this.startRenamePlaylist());
      const btnExpPl = document.getElementById('btnExportPlaylist');
      if (btnExpPl) btnExpPl.addEventListener('click', () => this.exportPlaylist());
      const editPlName = document.getElementById('editPlaylistName');
      if (editPlName) editPlName.addEventListener('click', () => this.startRenamePlaylist());
      const ctxGoArtist = document.getElementById('ctxGoArtist');
      if (ctxGoArtist) ctxGoArtist.addEventListener('click', () => {
        const t = this.menuTrack();
        if (t) this.goToArtist(t.artist);
      });
      const ctxGoAlbum = document.getElementById('ctxGoAlbum');
      if (ctxGoAlbum) ctxGoAlbum.addEventListener('click', () => {
        const t = this.menuTrack();
        if (t) this.goToAlbum(t.album, t.artist);
      });
      const ctxEditTags = document.getElementById('ctxEditTags');
      if (ctxEditTags) ctxEditTags.addEventListener('click', () => {
        const t = this.menuTrack();
        if (t) this.openEditTrack(t.id);
      });
      const ctxShare = document.getElementById('ctxShareTrack');
      if (ctxShare) ctxShare.addEventListener('click', () => {
        const t = this.menuTrack();
        if (t) this.shareTrack(t.id);
      });
      const ctxCover = document.getElementById('ctxChangeCover');
      if (ctxCover) ctxCover.addEventListener('click', () => {
        const t = this.menuTrack();
        this.closeSheet('sheetTrackMenu');
        if (t) this.pickCustomCover(t.id);
      });
      const ctxRmCover = document.getElementById('ctxRemoveCover');
      if (ctxRmCover) ctxRmCover.addEventListener('click', () => {
        const t = this.menuTrack();
        this.closeSheet('sheetTrackMenu');
        if (t) this.removeCustomCover(t.id);
      });
      const ctxDelete = document.getElementById('ctxDelete');
      if (ctxDelete) ctxDelete.addEventListener('click', async () => {
        const t = this.menuTrack();
        this.closeSheet('sheetTrackMenu');
        if (!t) return;
        const ok = await this.showConfirm({
          message: this.t('delete_track_confirm').replace('X', t.title),
          okLabel: this.t('confirm_delete')
        });
        if (ok) this.deleteTrack(t.id);
      });
      const btnSaveEdit = document.getElementById('btnSaveEditTrack');
      if (btnSaveEdit) btnSaveEdit.addEventListener('click', () => this.saveEditTrack());
      const btnSaveEditP = document.getElementById('btnSaveEditTrackPrimary');
      if (btnSaveEditP) btnSaveEditP.addEventListener('click', () => this.saveEditTrack());

      // Búsqueda (debounce 150 ms)
      $('searchInput').addEventListener('input', (e) => {
        const val = e.target.value;
        clearTimeout(this._searchTimer);
        if (!String(val || '').trim()) {
          this.runSearch('', this._searchFilter);
          return;
        }
        this._searchTimer = setTimeout(() => {
          this.runSearch(val, this._searchFilter);
          this.pushSearchHistory(val);
        }, 150);
      });
      $('searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(this._searchTimer);
          const val = e.target.value;
          this.runSearch(val, this._searchFilter);
          this.pushSearchHistory(val);
        }
      });

      // Más opciones
      $('menuGoToArtist').addEventListener('click', () => {
        this.closeSheet('sheetMore');
        if (!this.currentTrack || this.isPlaceholderArtist(this.currentTrack.artist)) {
          this.toast(this.t('unknown_artist'));
          return;
        }
        this.goToArtist(this.currentTrack.artist);
      });
      const menuGoAlbum = document.getElementById('menuGoToAlbum');
      if (menuGoAlbum) menuGoAlbum.addEventListener('click', () => {
        this.closeSheet('sheetMore');
        if (!this.currentTrack || this.isPlaceholderAlbum(this.currentTrack.album)) {
          this.toast(this.t('no_album'));
          return;
        }
        this.goToAlbum(this.currentTrack.album, this.currentTrack.artist);
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
      pt.addEventListener('keydown', (e) => {
        if (!this.audio || !this.audio.duration) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          this.seekToTime((this.audio.currentTime || 0) + 5);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.seekToTime((this.audio.currentTime || 0) - 5);
        } else if (e.key === 'Home') {
          e.preventDefault(); this.seekTo(0);
        } else if (e.key === 'End') {
          e.preventDefault(); this.seekTo(0.99);
        }
      });

      // §72: tocar la duración total alterna duración ⇄ restante.
      const timeTotalEl = document.getElementById('timeTotal');
      if (timeTotalEl) {
        try { this._showRemaining = localStorage.getItem('aurora_show_remaining') === '1'; } catch (e) {}
        timeTotalEl.classList.add('time-toggle');
        timeTotalEl.setAttribute('role', 'button');
        timeTotalEl.setAttribute('tabindex', '0');
        timeTotalEl.setAttribute('title', this.t('time_toggle_remaining'));
        timeTotalEl.setAttribute('aria-label', this.t('time_toggle_remaining'));
        const flipRemaining = () => {
          this._showRemaining = !this._showRemaining;
          try { localStorage.setItem('aurora_show_remaining', this._showRemaining ? '1' : '0'); } catch (e) {}
          this.updateProgress();
        };
        timeTotalEl.addEventListener('click', flipRemaining);
        timeTotalEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipRemaining(); }
        });
      }

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
      const btnShareStats = document.getElementById('btnShareStats');
      if (btnShareStats) btnShareStats.addEventListener('click', () => this.shareStats());

      // Compartir canción actual desde el menú "Más opciones"
      const btnShareCurrent = document.getElementById('menuShareCurrentTrack');
      if (btnShareCurrent) btnShareCurrent.addEventListener('click', () => {
        this.closeSheet('sheetMore');
        if (this.currentTrack) {
          this.shareTrack(this.currentTrack.id);
        } else {
          this.toast(this.t('no_track_playing') || 'Sin reproducción');
        }
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

      window.addEventListener('resize', () => {
        if (typeof this.syncDesktopLayout === 'function') this.syncDesktopLayout();
        clearTimeout(this._marqueeResize);
        this._marqueeResize = setTimeout(() => {
          if (typeof this._syncMarquee !== 'function') return;
          const title = document.getElementById('trackTitle');
          const artist = document.getElementById('trackArtist');
          if (title) this._syncMarquee(title);
          if (artist) this._syncMarquee(artist);
        }, 140);
      });

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
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        // El slider de progreso es un div[role=slider] con su propio
        // manejo de flechas (±5 s): si el evento también llega aquí, el
        // salto se duplica (hallazgo A2 de la revisión externa).
        if (e.target.closest && e.target.closest('[role="slider"]')) return;
        if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
          e.preventDefault();
          const sh = document.getElementById('sheetShortcuts');
          if (sh && sh.classList.contains('open')) this.closeSheet('sheetShortcuts');
          else this.openSheet('sheetShortcuts');
          return;
        }
        if (document.querySelector('.sheet.open')) return;
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
     * El grafo EQ queda atado a este elemento: no se intercambia. */
    bindAudioElement(el) {
      if (!el) return;
      if (!this._onAudioTimeUpdate) {
        this._onAudioTimeUpdate = () => {
          this.updateProgress();
          if (typeof this.tickPlaybackAdvance === 'function') this.tickPlaybackAdvance();
        };
        this._onAudioLoadedMeta = () => {
          const dur = this.audio && this.audio.duration;
          const totalEl = document.getElementById('timeTotal');
          if (totalEl) totalEl.textContent = this.fmtTime(dur);
          this.updateProgress();
          this.updateMediaPosition(true);
          if (this.currentTrack && isFinite(dur) && dur > 0 &&
              (!this.currentTrack.duration || this.currentTrack.duration === 0)) {
            this.currentTrack.duration = Math.floor(dur);
            this.persistTrack(this.currentTrack);
            this.renderQueue();
            if (this._editingPlaylistId) this.renderEditPlaylist();
          }
        };
        this._onAudioEnded = () => {
          if (this._ignoreEndedUntil && Date.now() < this._ignoreEndedUntil) return;
          if (this._gaplessConsumed) { this._gaplessConsumed = false; return; }
          if (this._xfadeIncoming) { this._xfadeIncoming = false; return; }
          // El crossfade programa un timer 50 ms antes del final. Si `ended`
          // llega primero, hay que cancelarlo: si no, se saltaban DOS pistas.
          if (this._xfadeStarted || this._xfadeTimer) this._cancelCrossfade();
          if (this._sleepEndOfTrack) { this._fireSleep(); return; }
          this.next(true);
        };
        this._onAudioError = (e) => {
          if (this._xfadeStarted || this._xfadeTimer) this._cancelCrossfade();
          /* Sin fuente no hay archivo corrupto: es el ruido de vaciar
           * el elemento (borrar la pista actual, limpiar al cerrar).
           * Contarlo saltaba canciones que nadie había pedido saltar. */
          if (!this.currentTrack || !this.audio || !this.audio.getAttribute('src')) {
            if (typeof this.setBuffering === 'function') this.setBuffering(false);
            return;
          }
          const msg = (e && e.message) || (this.audio.error && this.audio.error.message) || 'unknown';
          this._lastError = { msg: 'audio error: ' + msg, ts: Date.now() };
          // Política compartida con play(): recorrer la cola una vez.
          if (typeof this._handleDecodeFailure === 'function') this._handleDecodeFailure();
          else this.next(true);
        };
        this._onAudioPlaying = () => {
          this._decodeSkipCount = 0;
          this._gaplessConsumed = false;
          this.updateMediaPosition(true);
          if (typeof this.setBuffering === 'function') this.setBuffering(false);
        };
        this._onAudioWaiting = () => {
          if (typeof this.setBuffering === 'function') this.setBuffering(true);
        };
        this._onAudioCanPlay = () => {
          if (this.audio && this.audio.readyState >= 3 && typeof this.setBuffering === 'function') {
            this.setBuffering(false);
          }
        };
      }
      if (this._boundAudioEl && this._boundAudioEl !== el) {
        this._boundAudioEl.removeEventListener('timeupdate', this._onAudioTimeUpdate);
        this._boundAudioEl.removeEventListener('loadedmetadata', this._onAudioLoadedMeta);
        this._boundAudioEl.removeEventListener('ended', this._onAudioEnded);
        this._boundAudioEl.removeEventListener('error', this._onAudioError);
        this._boundAudioEl.removeEventListener('playing', this._onAudioPlaying);
        this._boundAudioEl.removeEventListener('waiting', this._onAudioWaiting);
        this._boundAudioEl.removeEventListener('stalled', this._onAudioWaiting);
        this._boundAudioEl.removeEventListener('canplay', this._onAudioCanPlay);
        this._boundAudioEl.removeEventListener('canplaythrough', this._onAudioCanPlay);
      }
      if (this._boundAudioEl === el) return;
      el.addEventListener('timeupdate', this._onAudioTimeUpdate);
      el.addEventListener('loadedmetadata', this._onAudioLoadedMeta);
      el.addEventListener('ended', this._onAudioEnded);
      el.addEventListener('error', this._onAudioError);
      el.addEventListener('playing', this._onAudioPlaying);
      el.addEventListener('waiting', this._onAudioWaiting);
      el.addEventListener('stalled', this._onAudioWaiting);
      el.addEventListener('canplay', this._onAudioCanPlay);
      el.addEventListener('canplaythrough', this._onAudioCanPlay);
      this._boundAudioEl = el;
    },

    wireGestures() {
      // Ídem que wireEvents(): los gestos tampoco se cablean dos veces.
      if (this._wired.gestures) return;
      // §86: eliminado el gesto horizontal para cambiar de canción.
      // Solo vivía en la vista de Letras y provocaba saltos de pista
      // accidentales al desplazar la letra en diagonal; quedan los
      // botones anterior/siguiente y el toque sobre una línea para
      // saltar a ese instante. El scroll vertical de la letra es
      // nativo de su contenedor, no necesita gesto propio. (Antes
      // también se gestionaba aquí que deslizar hacia abajo NO
      // cerrara Letras: ya no hay listener alguno que cerrar.)
      this._wired.gestures = true;
    },

    closeAllSheets() {
      document.querySelectorAll('.sheet.open').forEach(s => this.closeSheet(s.id));
    },
});
