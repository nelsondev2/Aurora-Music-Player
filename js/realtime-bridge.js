/* =====================================================================
 *  js/realtime-bridge.js — Aurora Music Player
 *  Puente con AuroraRealtime (P2P, compartir música)
 *
 *  Parte del refactor (C) de app.js: mismo código, módulos por funcionalidad.
 *  Este archivo se carga tras js/state.js y completa el objeto App con
 *  Object.assign (los scripts son clásicos por compatibilidad webxdc).
 * ===================================================================== */

'use strict';

Object.assign(App, {
    /* ============================================================
     *  Sistema de tiempo real (compartir música)
     *  ----------------------------------------------------------
     *  Conecta con el canal realtime de webxdc, anuncia las pistas
     *  locales a los peers, recibe pistas compartidas y sincroniza
     *  la reproducción (play/pause/skip/seek) entre todos los
     *  oyentes del chat.
     * ============================================================ */

    /* Inicializa el sistema de tiempo real tras cargar la app. */
    initRealtime() {
      if (!window.AuroraRealtime) {
        console.warn('[Aurora] AuroraRealtime no disponible — tiempo real deshabilitado');
        return;
      }
      const RT = window.AuroraRealtime;

      // Suscripciones
      RT.onPeersChanged(() => this._rtOnPeersChanged());
      RT.onSharedTrackReady((track) => this._rtOnSharedTrackReady(track));
      RT.onPlaybackSync((action) => this._rtOnPlaybackSync(action));
      RT.onTrackListChanged(() => this._rtOnTrackListChanged());

      // Conectar (de forma segura; si no hay canal realtime, no hace nada)
      try {
        RT.connect();
      } catch (e) {
        console.warn('[Aurora] Error conectando al canal realtime:', e);
      }

      // Anunciar todas las pistas locales que ya tenemos cargadas
      this._rtAnnounceAllTracks();

      // Wiring del botón "Listeners" en la barra superior
      const btnSync = document.getElementById('btnSync');
      if (btnSync) {
        btnSync.addEventListener('click', () => {
          this.renderListeners();
          this.openSheet('sheetListeners');
        });
      }

      // Actualizar badge inicial
      this._rtUpdatePeerCountBadge();
    },

    /* Anuncia TODAS las pistas locales al sistema realtime.
     * Se llama al iniciar y tras cargas/eliminaciones masivas. */
    _rtAnnounceAllTracks() {
      if (!window.AuroraRealtime) return;
      try {
        window.AuroraRealtime.refreshKnownFiles(this.tracks);
        const pend = window.AuroraRealtime._pendingPlayback;
        if (pend) window.AuroraRealtime._applyPlaybackAction(pend);
      } catch (e) {
        console.warn('[Aurora] Error anunciando pistas al realtime:', e);
      }
    },

    /* Anuncia UNA pista nueva al sistema realtime. */
    _rtAnnounceTrack(track) {
      if (!window.AuroraRealtime || !track) return;
      try {
        window.AuroraRealtime.announceTrack(track);
      } catch (e) {}
    },

    /* Quita una pista del sistema realtime. */
    _rtUnannounceTrack(trackId) {
      if (!window.AuroraRealtime) return;
      try {
        window.AuroraRealtime.unannounceTrack(trackId);
      } catch (e) {}
    },

    /* Difunde una acción de reproducción al canal realtime. */
    _rtBroadcastAction(alert) {
      if (!window.AuroraRealtime || !this.currentTrack) return;
      try {
        window.AuroraRealtime.broadcastLastAction({
          trackId: this.currentTrack.id,
          isPlaying: this.isPlaying,
          currentTime: this.audio?.currentTime || 0,
          alert: alert || null
        });
      } catch (e) {}
    },

    /* Callback: cambió la lista de peers. Actualiza badge y sheet. */
    _rtOnPeersChanged() {
      this._rtUpdatePeerCountBadge();
      // Si el sheet de listeners está abierto, refrescarlo
      const sheet = document.getElementById('sheetListeners');
      if (sheet && sheet.classList.contains('open')) {
        this.renderListeners();
      }
    },

    /* Callback: llegó una pista compartida completa desde un peer. */
    async _rtOnSharedTrackReady(track) {
      // Evitar duplicados
      if (this.tracks.some(t => t.id === track.id)) {
        // Ya la teníamos; ignorar
        return;
      }
      // Añadirla a la biblioteca
      this.tracks.push(track);
      // Persistirla como cualquier otra pista
      await this.persistTrack(track);
      // Añadirla a la playlist "Mi Música" si existe
      const destPl = this.playlists.find(p => p.id === this.DEFAULT_PLAYLIST_ID);
      if (destPl && !destPl.trackIds.includes(track.id)) {
        destPl.trackIds.push(track.id);
        this.persistPlaylist(destPl);
      }
      // Re-anunciar (por si queremos que otros peers la descarguen de nosotros)
      this._rtAnnounceTrack(track);
      // Refrescar UI
      this.renderLibrary();
      this.renderPlaylists();
      this.renderQueue();
      this.renderFavorites();
      this.hideEmptyState();
      // Toast informativo
      const who = track.uploadedBy || 'Unknown';
      this.toast(this.t('toast_shared_track_received') + ' ' + who, 3500);
    },

    /* Callback: un peer hizo una acción de reproducción y debo sincronizar. */
    async _rtOnPlaybackSync(action) {
      if (!action || !action.trackId) return;
      // ¿Tenemos la pista?
      const idx = this.tracks.findIndex(t => t.id === action.trackId);
      if (idx < 0) return;
      // ¿Es la pista actualmente cargada?
      const isCurrent = this.currentTrack && this.currentTrack.id === action.trackId;
      // Evitar re-broadcast: este evento vino de un peer, no debemos
      // reenviarlo al canal realtime (evita bucle infinito).
      this._rtSuppressBroadcast = true;
      try {
        if (!isCurrent) {
          // Cambiar a esa pista sin contexto de playlist
          this.currentTrackIdx = idx;
          this.currentTrack = this.tracks[idx];
          // Cargar el audio sin autoplay todavía
          const url = this.getTrackUrl(this.currentTrack);
          if (url) {
            this.audio.src = url;
            try { this.audio.volume = this.volume; } catch (e2) {}
          }
          this.renderCurrentTrack();
          this.renderLyrics();
          this.updateMediaSession();
        }
        // Calcular posición objetivo (compensar el tiempo transcurrido desde actionTime)
        const elapsed = action.isPlaying ? (Date.now() - action.actionTime) / 1000 : 0;
        const targetTime = (action.currentTime || 0) + elapsed;
        // Esperar a que el audio tenga metadata para hacer seek
        const trySeek = () => {
          if (isFinite(this.audio.duration) && this.audio.duration > 0) {
            let t = targetTime;
            // Si pasó del final, saltar a la siguiente pista (lo maneja 'ended')
            if (t >= this.audio.duration) {
              t = this.audio.duration - 0.1;
            }
            try { this.audio.currentTime = Math.max(0, t); } catch (e) {}
            if (action.isPlaying) {
              this.togglePlay(true);
            } else {
              this.togglePlay(false);
            }
            this.updateProgress();
          } else {
            // Aún no cargó la metadata; reintentar
            setTimeout(trySeek, 100);
          }
        };
        // Si ya está cargada, intentar de inmediato; si no, esperar metadata
        if (isCurrent && isFinite(this.audio.duration) && this.audio.duration > 0) {
          trySeek();
        } else {
          const onMeta = () => {
            this.audio.removeEventListener('loadedmetadata', onMeta);
            trySeek();
          };
          this.audio.addEventListener('loadedmetadata', onMeta);
          // Fallback por si metadata ya cargó
          setTimeout(() => {
            this.audio.removeEventListener('loadedmetadata', onMeta);
            if (isFinite(this.audio.duration) && this.audio.duration > 0) trySeek();
          }, 500);
        }
        // Mostrar toast si hay alerta
        if (action.alert) {
          this.toast(action.alert, 2000);
        }
      } finally {
        // Liberar el flag tras un breve delay (para que el togglePlay que
        // acabamos de llamar no rebrote el broadcast).
        setTimeout(() => { this._rtSuppressBroadcast = false; }, 600);
      }
    },

    /* Callback: la lista de pistas conocidas (incluidas las de peers)
     * cambió. Refresca el badge de peer count. */
    _rtOnTrackListChanged() {
      // Nada por ahora; las pistas nuevas se entregan vía _rtOnSharedTrackReady
    },

    /* Actualiza el badge del botón Listeners en la barra superior. */
    _rtUpdatePeerCountBadge() {
      const btn = document.getElementById('btnSync');
      const badge = document.getElementById('syncPeerCount');
      if (!btn || !badge) return;
      const peers = window.AuroraRealtime ? window.AuroraRealtime.getPeers() : [];
      const total = peers.length + 1; // +1 = yo
      badge.textContent = String(total);
      /* Modo reproductor normal (navegador, sin Delta Chat): el botón de
       * oyentes solo tiene sentido si hay alguien con quien sincronizar
       * (p. ej. otra pestaña). Sin peers se oculta para no confundir. */
      btn.style.display = (this.standalone && total <= 1) ? 'none' : '';
      // Pulso animado si subió el número
      const prev = parseInt(btn.dataset.peers || '0', 10);
      if (total > prev) {
        btn.classList.add('pulse');
        setTimeout(() => btn.classList.remove('pulse'), 400);
      }
      btn.dataset.peers = String(total);
    },

    /* Renderiza la lista de oyentes dentro del sheet "Listeners". */
    renderListeners() {
      const list = document.getElementById('listenersList');
      if (!list) return;
      list.innerHTML = '';
      // En modo reproductor normal (navegador), explicar cómo probar la escucha compartida
      const hint = document.getElementById('listenersStandaloneHint');
      if (hint) hint.style.display = this.standalone ? '' : 'none';
      const RT = window.AuroraRealtime;
      const peers = RT ? RT.getPeers() : [];
      const myState = RT ? RT.getState() : null;
      const myLast = myState && myState.lastAction;

      // Fila "yo"
      const myRow = document.createElement('div');
      myRow.className = 'listener-row';
      const myName = (window.webxdc && window.webxdc.selfName) || 'Tú';
      const myInitial = (myName || '?').charAt(0).toUpperCase();
      const myTrackLabel = this._rtFormatTrackLabel(this.currentTrack, this.isPlaying);
      myRow.innerHTML = `
        <div class="listener-avatar">${this.esc(myInitial)}</div>
        <div class="listener-info">
          <div class="listener-name">${this.esc(myName)} <span style="color:var(--text-3);font-weight:400">(${this.esc(this.t('listeners_you'))})</span></div>
          <div class="listener-track ${this.isPlaying ? 'playing' : (this.currentTrack ? 'paused' : '')}">${this.esc(myTrackLabel)}</div>
        </div>
        <div class="listener-status-dot"></div>
      `;
      list.appendChild(myRow);

      // Filas de peers
      if (peers.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'listeners-empty';
        empty.innerHTML = `<i class="fa-solid fa-headphones"></i>${this.esc(this.t('listeners_no_peers'))}`;
        list.appendChild(empty);
        return;
      }
      for (const peer of peers) {
        const row = document.createElement('div');
        row.className = 'listener-row';
        const name = (peer.state && peer.state.selfName) || 'Unknown';
        const sameAsMe = name === myName;
        const label = sameAsMe ? (name + ' · 2') : name;
        const initial = (name || '?').charAt(0).toUpperCase();
        const last = peer.state && peer.state.lastAction;
        let trackLabel = this.t('listeners_not_playing');
        let trackClass = '';
        if (last) {
          const t = this.tracks.find(x => x.id === last.trackId)
            || (myState && (myState.files || []).find(f => f.id === last.trackId));
          const label = t ? (t.title || t.name || 'Unknown') : (last.trackId || 'Unknown');
          trackLabel = label;
          trackClass = last.isPlaying ? 'playing' : 'paused';
        }
        row.innerHTML = `
          <div class="listener-avatar">${this.esc(initial)}</div>
          <div class="listener-info">
            <div class="listener-name">${this.esc(peerLabel)}</div>
            <div class="listener-track ${trackClass}">${this.esc(trackLabel)}</div>
          </div>
          <div class="listener-status-dot"></div>
        `;
        list.appendChild(row);
      }
    },

    /* Formatea el texto de pista para la lista de oyentes. */
    _rtFormatTrackLabel(track, isPlaying) {
      if (!track) return this.t('listeners_not_playing');
      const name = track.title || track.fileName || 'Unknown';
      return name;
    },

    /* Comparte la pista actual al chat de Delta Chat (vía webxdc.sendToChat).
     * Genera un Blob con el audio y lo envía como archivo adjunto. */
    async shareCurrentTrackToChat() {
      if (!this.currentTrack) {
        this.toast(this.t('no_tracks_loaded'));
        return;
      }
      if (!window.webxdc || typeof window.webxdc.sendToChat !== 'function') {
        this.toast(this.t('sendtochat_unavailable'));
        return;
      }
      try {
        const t = this.currentTrack;
        let blob = t._file || t.fileBlob;
        if (!blob) {
          // Intentar descargarlo del objectURL
          const resp = await fetch(t.src);
          blob = await resp.blob();
        }
        const name = t.fileName || (t.title || 'track') + '.mp3';
        window.webxdc.sendToChat({ file: { name, blob } });
        this.toast(this.t('toast_track_shared'));
      } catch (e) {
        console.warn('[Aurora] Error compartiendo pista al chat:', e);
        this.toast(this.t('error_toast').replace('X', e.message || ''));
      }
    },

    /* ============================================================
     *  FIN del bloque de tiempo real
     * ============================================================ */
});
