/* =====================================================================
 *  js/audio.js — Aurora Music Player
 *  Web Audio · ecualizador · motor de reproducción
 *
 *  Parte del refactor (C) de app.js: mismo código, módulos por funcionalidad.
 *  Este archivo se carga tras js/state.js y completa el objeto App con
 *  Object.assign (los scripts son clásicos por compatibilidad webxdc).
 * ===================================================================== */

'use strict';

Object.assign(App, {
    /* ============================================================
     *  Web Audio API · grafo de audio
     * ============================================================ */
    initAudioGraph() {
      if (this.audioCtx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.audioCtx = new AC();
        this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);

        /* Ecualizador: 5 bandas */
        const bands = [60, 230, 910, 3600, 14000];
        this.eqFilters = bands.map((freq, i) => {
          const f = this.audioCtx.createBiquadFilter();
          f.type = i === 0 ? 'lowshelf' : i === bands.length - 1 ? 'highshelf' : 'peaking';
          f.frequency.value = freq;
          f.Q.value = 1;
          f.gain.value = 0;
          return f;
        });

        /* Cadena: source → eq0 → eq1 → … → analyser → gain → destination */
        let node = this.sourceNode;
        for (const f of this.eqFilters) { node.connect(f); node = f; }

        this.analyser = this.audioCtx.createAnalyser();
        /* fftSize 2048 (1024 bins): las bandas logarítmicas del espectro
         * y la onda fluida necesitan resolución de verdad; con 256 la
         * onda solo tenía 128 muestras y salía dentada. */
        this.analyser.fftSize = 2048;
        // 0.68 (antes 0.8): con el suavizado propio de las barras
        // (_visStepBars) encima, 0.8 hacía el espectro perezoso (§68).
        this.analyser.smoothingTimeConstant = 0.68;
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
        this._visTimeData = new Uint8Array(this.analyser.fftSize);
        node.connect(this.analyser);

        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.value = 1;
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
        this.applySavedEq();
      } catch (e) {
        console.warn('[Aurora] Web Audio no disponible:', e.message);
        this.audioCtx = null;
      }
    },

    /* Asegura el grafo Web Audio (EQ). Se llama en el primer play. */
    ensureAudioGraph() {
      if (!this.audioCtx) {
        try { this.initAudioGraph(); } catch (e) {}
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        try { this.audioCtx.resume(); } catch (e) {}
      }
    },

    /* ============================================================
     *  Ecualizador
     * ============================================================ */
    getSavedEq() {
      try {
        const s = localStorage.getItem('aurora_eq');
        if (s) {
          const arr = JSON.parse(s);
          if (Array.isArray(arr) && arr.length) return arr.map(n => Number(n) || 0);
        }
      } catch (e) {}
      return [0, 0, 0, 0, 0];
    },
    applySavedEq() {
      const saved = this.getSavedEq();
      saved.forEach((g, i) => {
        if (this.eqFilters[i]) this.eqFilters[i].gain.value = g;
      });
      document.querySelectorAll('#eqBands input[type="range"]').forEach((inp, i) => {
        if (saved[i] == null) return;
        inp.value = saved[i];
        const val = inp.parentElement && inp.parentElement.querySelector('.eq-band-val');
        if (val) val.textContent = (saved[i] > 0 ? '+' : '') + saved[i] + ' dB';
      });
    },
    buildEqualizer() {
      const c = document.getElementById('eqBands');
      if (!c) return;
      c.innerHTML = '';
      const labels = ['60Hz','230Hz','910Hz','3.6k','14k'];
      const savedEq = this.getSavedEq();
      labels.forEach((lbl, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'eq-band';
        const lab = document.createElement('span');
        lab.className = 'eq-band-label';
        lab.textContent = lbl;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = -12; input.max = 12; input.value = savedEq[i] || 0; input.step = 1;
        // Sin <label> asociado axe lo marca como crítico (label). El id
        // enlaza label/for y el aria-label cubre lectores que ignoren el for.
        input.id = 'eqBand' + i;
        input.setAttribute('aria-label', this.t('eq_band_label').replace('X', lbl));
        lab.id = 'eqBandLabel' + i;
        const val = document.createElement('span');
        val.className = 'eq-band-val';
        const g = savedEq[i] || 0;
        val.textContent = (g > 0 ? '+' : '') + g + ' dB';
        input.addEventListener('input', () => {
          const n = parseFloat(input.value) || 0;
          if (this.eqFilters[i]) this.eqFilters[i].gain.value = n;
          val.textContent = (n > 0 ? '+' : '') + n + ' dB';
          this.saveEqValues();
          try { localStorage.setItem('aurora_eq_preset', 'custom'); } catch (e) {}
          document.querySelectorAll('.eq-preset').forEach(b => b.classList.remove('active'));
        });
        // <label for> real: además de axe, permite clicar la etiqueta.
        const labelEl = document.createElement('label');
        labelEl.className = 'eq-band-label';
        labelEl.htmlFor = input.id;
        labelEl.id = lab.id;
        labelEl.textContent = lbl;
        wrap.appendChild(labelEl);
        wrap.appendChild(input);
        wrap.appendChild(val);
        c.appendChild(wrap);
        if (this.eqFilters[i]) this.eqFilters[i].gain.value = savedEq[i] || 0;
      });
      try {
        let preset = localStorage.getItem('aurora_eq_preset') || 'normal';
        if (preset === 'flat') preset = 'normal';
        document.querySelectorAll('.eq-preset').forEach(b => b.classList.toggle('active', b.dataset.preset === preset));
      } catch (e) {}
    },
    /* #5 Guardar valores del EQ */
    saveEqValues() {
      const inputs = document.querySelectorAll('#eqBands input[type="range"]');
      const vals = Array.from(inputs).map(i => parseFloat(i.value));
      try { localStorage.setItem('aurora_eq', JSON.stringify(vals)); } catch (e) {}
    },
    /* #5 Resetear EQ */
    resetEqValues() {
      this.applyEqPreset('normal');
      this.toast(this.t('toast_eq_reset'));
    },

    applyEqPreset(preset) {
      if (preset === 'flat') preset = 'normal';
      const presets = {
        normal:[0, 0, 0, 0, 0],
        bass:  [6, 4, 0, -2, -3],
        vocal: [-2, 0, 4, 3, 1],
        treble:[-2, -1, 0, 4, 6],
        live:  [3, 1, 0, 2, 4]
      };
      const vals = presets[preset] || presets.normal;
      const inputs = document.querySelectorAll('#eqBands input[type="range"]');
      inputs.forEach((inp, i) => {
        inp.value = vals[i];
        if (this.eqFilters[i]) this.eqFilters[i].gain.value = vals[i];
        const val = inp.parentElement && inp.parentElement.querySelector('.eq-band-val');
        if (val) val.textContent = (vals[i] > 0 ? '+' : '') + vals[i] + ' dB';
      });
      this.saveEqValues();
      try { localStorage.setItem('aurora_eq_preset', preset); } catch (e) {}
      document.querySelectorAll('.eq-preset').forEach(b => b.classList.toggle('active', b.dataset.preset === preset));
    },

    /* ============================================================
     *  Reproducción
     * ============================================================ */
    /* Reproduce una pista concreta.
     *   context — opcional: { type: 'playlist'|'favorites'|'all'|'queue', id?, name? }
     *             Indica desde qué lista se reproduce, para mostrarlo en la UI.
     * Si el contexto es 'playlist' o 'favorites', la cola se reemplaza por
     * las pistas de esa lista (no por todas las de la biblioteca). */
    playTrack(trackId, context) {
      const idx = this.tracks.findIndex(t => t.id === trackId);
      if (idx < 0) return;
      this.currentTrackIdx = idx;
      this.currentTrack = this.tracks[idx];

      // Determinar la cola según el contexto
      if (context && context.type === 'playlist' && context.id) {
        // Cola = pistas de esa playlist (en orden), filtrando las que existen
        const pl = this.playlists.find(p => p.id === context.id);
        if (pl) {
          // La cola hereda el orden por estrellas de la lista (§64)
          this.queue = this.playlistTracksSorted(pl).map(t => t.id);
          const qIdx = this.queue.indexOf(trackId);
          // La pista puede no pertenecer ya a la lista (se quitó mientras
          // sonaba otra): insertarla para que next/prev sigan teniendo
          // sentido, en vez de dejar queueIdx apuntando a otra canción.
          if (qIdx < 0) {
            this.queue.unshift(trackId);
            this.queueIdx = 0;
          } else {
            this.queueIdx = qIdx;
          }
        } else {
          this.queue = [trackId];
          this.queueIdx = 0;
        }
      } else if (context && context.type === 'favorites') {
        // Cola = pistas favoritas
        const favIds = this.sortByRating(this.tracks.filter(t => this.favorites.has(t.id))).map(t => t.id);
        this.queue = favIds;
        const qIdx = this.queue.indexOf(trackId);
        if (qIdx < 0) { this.queue.unshift(trackId); this.queueIdx = 0; }
        else this.queueIdx = qIdx;
      } else if (context && context.type === 'album' && context.name) {
        const artist = context.artist;
        const tracks = this.tracks.filter(t => t.album === context.name && (!artist || t.artist === artist));
        this.queue = tracks.map(t => t.id);
        const qIdx = this.queue.indexOf(trackId);
        if (qIdx < 0) { this.queue.unshift(trackId); this.queueIdx = 0; }
        else this.queueIdx = qIdx;
      } else if (context && context.type === 'artist' && context.name) {
        const tracks = this.tracks.filter(t => t.artist === context.name);
        this.queue = tracks.map(t => t.id);
        const qIdx = this.queue.indexOf(trackId);
        if (qIdx < 0) { this.queue.unshift(trackId); this.queueIdx = 0; }
        else this.queueIdx = qIdx;
      } else {
        // Sin contexto específico o 'all'/'queue': cola = todas las pistas
        this.queue = this.tracks.map(t => t.id);
        this.queueIdx = idx;
      }

      // Si se pasa contexto, usarlo; si no, mantener el actual
      if (context) this.playContext = context;
      // La pista tocada debe sonar primero aunque Aleatorio esté activo; el
      // resto de la cola se baraja detrás.
      if (this.shuffle) this._applyShuffle(trackId);
      else this._originalQueue = null;
      this.loadAndPlay();
    },

    playFromQueue(idx) {
      if (idx < 0 || idx >= this.queue.length) return;
      this.queueIdx = idx;
      const trackId = this.queue[idx];
      const tIdx = this.tracks.findIndex(t => t.id === trackId);
      if (tIdx < 0) return;
      this.currentTrackIdx = tIdx;
      this.currentTrack = this.tracks[tIdx];
      this.loadAndPlay();
    },

    loadAndPlay() {
      const t = this.currentTrack;
      if (!t) return;
      this._gaplessArmed = false;
      if (!this._xfadeIncoming) this._cancelCrossfade();
      const targetGain = this._normGain || 1;
      if (this.gainNode && this.audioCtx) {
        try {
          const now = this.audioCtx.currentTime;
          this.gainNode.gain.cancelScheduledValues(now);
          if (this._xfadeIncoming && this.crossfadeEnabled && this.crossfadeDuration > 0) {
            this.gainNode.gain.setValueAtTime(0.001, now);
            this.gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.25);
          } else {
            this.gainNode.gain.setValueAtTime(targetGain, now);
          }
        } catch (e) {}
      }
      this._xfadeIncoming = false;
      const url = this.getTrackUrl(t);
      if (!url) {
        console.warn('[Aurora] Sin URL de audio para', t.id);
        // Pista sin fuente de audio utilizable (blob perdido): avisar
        // y saltar a la siguiente sin bloquear la reproducción.
        this.toast(this.t('toast_track_no_audio'));
        this._noAudioSkips = (this._noAudioSkips || 0) + 1;
        if (this._noAudioSkips > this.queue.length) {
          this._noAudioSkips = 0;
          this.stopPlayback();
          return;
        }
        // Diferido: evita recursión síncrona profunda con colas enormes.
        setTimeout(() => this.next(true), 0);
        return;
      }
      this._noAudioSkips = 0;
      this.audio.src = url;
      try { this.audio.volume = this.volume; } catch (e) {}
      if (this.clearABRepeat) this.clearABRepeat();
      if (this.preservesPitch !== undefined) {
        this.audio.preservesPitch = this.preservesPitch;
        this.audio.mozPreservesPitch = this.preservesPitch;
        this.audio.webkitPreservesPitch = this.preservesPitch;
      }
      if (this.playbackRate && this.playbackRate !== 1) {
        try { this.audio.playbackRate = this.playbackRate; } catch (e) {}
      }
      this.setBuffering(this.audio.readyState < 3);
      if (typeof this.restoreLyricsPrefs === 'function') this.restoreLyricsPrefs();
      this.addToHistory(t.id);
      this.togglePlay(true);
      this.renderCurrentTrack();
      this.renderLyrics();
      this.updateMediaSession();
      this.preloadNextTrack();
      this.applyNormalization(t);
      if (typeof this.updateChrome === 'function') this.updateChrome();
    },

    /* Carga la pista actual en el elemento <audio> pero SIN reproducir.
     * Usado al eliminar la pista en reproducción: salta a la siguiente
     * y queda en modo pausa (ready to play). */
    loadTrackPaused() {
      const t = this.currentTrack;
      if (!t) {
        // Sin pista: limpiar
        if (this.audio) {
          try { this.audio.pause(); } catch (e) {}
          this.audio.removeAttribute('src');
          try { this.audio.load(); } catch (e) {}
        }
        this.isPlaying = false;
        this.updatePlayUI();
        return;
      }
      const url = this.getTrackUrl(t);
      if (url) {
        this.audio.src = url;
        try { this.audio.volume = this.volume; } catch (e) {}
        this.audio.load();
        this.setBuffering(this.audio.readyState < 3);
      } else {
        this.setBuffering(false);
      }
      this.isPlaying = false;
      this.renderCurrentTrack();
      this.renderLyrics();
      this.updateMediaSession();
      this.updatePlayUI();
    },

    /* Política única ante un archivo que no se puede decodificar.
     * Antes se abandonaba tras 3 fallos seguidos, aunque la cuarta
     * canción de la cola fuera válida. Ahora se recorre la cola una
     * vez (tantos intentos como posiciones tenga) y solo se rinde al
     * agotarla; el contador se reinicia en cuanto algo suena. Solo se
     * avisa en el primer fallo y al rendirse: nada de un toast por
     * cada archivo roto. Devuelve true si ya actuó. */
    _handleDecodeFailure() {
      if (typeof this.setBuffering === 'function') this.setBuffering(false);
      this.isPlaying = false;
      if (typeof this.updatePlayUI === 'function') this.updatePlayUI();
      this._decodeSkipCount = (this._decodeSkipCount || 0) + 1;
      const limit = Math.max(1, Array.isArray(this.queue) && this.queue.length ? this.queue.length : 1);
      if (this._decodeSkipCount >= limit) {
        const skipped = this._decodeSkipCount;
        this._decodeSkipCount = 0;
        this.toast(this.t('toast_skipped_give_up').replace('X', String(skipped)));
        try { if (this.audio) this.audio.pause(); } catch (e) {}
        return true;
      }
      if (this._decodeSkipCount === 1) this.toast(this.t('toast_audio_error'));
      setTimeout(() => this.next(true), 0);
      return true;
    },

    setBuffering(on) {
      const el = document.getElementById('coverBuffering');
      const cover = document.getElementById('coverArt');
      const show = !!on;
      if (el) {
        if (show) el.removeAttribute('hidden');
        else el.setAttribute('hidden', '');
      }
      if (cover) cover.classList.toggle('is-buffering', show);
    },

    /* Crossfade de portada 200 ms, sin rotateY. */
    animateCoverTransition() {
      const front = document.getElementById('coverCanvas');
      const back = document.getElementById('coverCanvasBack');
      const bg = document.getElementById('bgGradient');
      if (!front || !back) return;
      try {
        const bctx = back.getContext('2d');
        bctx.clearRect(0, 0, back.width, back.height);
        bctx.drawImage(front, 0, 0);
      } catch (e) {
        return;
      }
      back.style.transition = 'none';
      back.style.opacity = '1';
      if (this._coverXfadeTimer) clearTimeout(this._coverXfadeTimer);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          back.style.transition = 'opacity 200ms ease';
          back.style.opacity = '0';
        });
      });
      this._coverXfadeTimer = setTimeout(() => {
        back.style.transition = '';
        back.style.opacity = '';
      }, 240);
      if (bg) {
        bg.style.transition = 'opacity 200ms ease';
        bg.style.opacity = '0.4';
        setTimeout(() => { bg.style.opacity = ''; }, 200);
      }
    },

    async togglePlay(forcePlay) {
      if (!this.currentTrack) return;
      // Si hay un play() pendiente, isPlaying aún es false: usar el estado
      // real del elemento evita que un segundo toque vuelva a reproducir
      // en vez de pausar.
      const actuallyPlaying = this.audio ? !this.audio.paused : this.isPlaying;
      const wantPlay = forcePlay !== undefined ? forcePlay : !actuallyPlaying;
      if (wantPlay && !this.audio.getAttribute('src')) {
        // Arranque sin sesión restaurada: hay pista elegida (tracks[0]) pero
        // el <audio> aún no tiene fuente. Sin esta guarda, play() falla con
        // NotSupportedError, se muestra «error de audio» y next() salta a la
        // pista siguiente sin que el usuario lo pida (con Aleatorio activo,
        // a una pista cualquiera). Cargar primero y reproducir después.
        this.loadAndPlay();
        return;
      }
      if (wantPlay) {
        // Inicializar Web Audio al primer play (política iOS)
        // Pero NO esperar al resume antes de play() — llamar play() inmediatamente
        // para que el audio empiece a cargar/reproducir sin retardo.
        const token = (this._playToken = (this._playToken || 0) + 1);
        const p = this.audio.play();
        if (!this.audioCtx) {
          setTimeout(() => {
            try { this.initAudioGraph(); } catch (e) {}
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
              try { this.audioCtx.resume(); } catch (e) {}
            }
          }, 0);
        } else if (this.audioCtx.state === 'suspended') {
          try { this.audioCtx.resume(); } catch (e) {}
        }
        if (p && p.then) {
          p.then(() => {
            // Si mientras cargaba se pidió pausa o se cambió de pista,
            // este then ya no debe reactivar la UI.
            if (token !== this._playToken) return;
            this.isPlaying = true;
            if (this.gainNode && this.audioCtx && !this._xfadeIncoming && !this._xfadeStarted) {
              try {
                const now = this.audioCtx.currentTime;
                this.gainNode.gain.cancelScheduledValues(now);
                this.gainNode.gain.setValueAtTime(this._normGain || 1, now);
              } catch (e) {}
            }
            this.updatePlayUI();
            this.ensureAudioGraph();
            this.requestWakeLock();
            this.trackPlayStarted();
            this.updateMediaPosition(true);
          }).catch((e) => {
            if (token !== this._playToken) return;
            const name = (e && e.name) || '';
            console.warn('[Aurora] play() rechazado:', name, e && e.message);
            this._lastError = { msg: 'play() rechazado: ' + (e && e.message), ts: Date.now() };
            this.isPlaying = false;
            this.updatePlayUI();
            // Siempre apagar el spinner: si no, la app parece congelada.
            if (typeof this.setBuffering === 'function') this.setBuffering(false);
            // AbortError = carrera benigna (toques rápidos / cambio de pista):
            // no asustar con el aviso de bloqueo.
            if (name === 'AbortError') return;
            if (name === 'NotAllowedError') {
              this.toast(this.t('toast_play_blocked'));
              return;
            }
            // NotSupportedError u otros: el archivo no se puede reproducir.
            // Misma política que el evento 'error': recorrer la cola una
            // vez antes de rendirse (ver _handleDecodeFailure).
            if (typeof this._handleDecodeFailure === 'function') this._handleDecodeFailure();
            else setTimeout(() => this.next(true), 0);
          });
        }
      } else {
        this._playToken = (this._playToken || 0) + 1;
        this._cancelCrossfade();
        this.audio.pause();
        this.isPlaying = false;
        this.updatePlayUI();
        this.releaseWakeLock();
        this.trackPlayStopped();
        this.updateMediaPosition(true);
      }
    },

    /* Detener la reproducción por completo (pausa + reset a 0) sin tocar la cola.
     * Usado cuando la pista actual se quita manualmente de la cola. */
    stopPlayback() {
      try {
        if (this.audio) {
          this.audio.pause();
          try { this.audio.currentTime = 0; } catch (e) {}
        }
      } catch (e) {}
      this.isPlaying = false;
      this.updatePlayUI();
      this.releaseWakeLock();
      this.trackPlayStopped();
      // Reset visual de la barra de progreso
      const fill = document.getElementById('progressFill');
      if (fill) fill.style.width = '0%';
      const cur = document.getElementById('timeCurrent');
      if (cur) cur.textContent = '0:00';
    },

    /* Salta a la siguiente pista disponible en la cola, o a la anterior
     * si no hay siguiente. La pista cargada queda en MODO PAUSA (lista
     * para reanudar con un toque en ▶). Si no hay ninguna pista más en
     * la cola ni en la biblioteca, el reproductor queda vacío.
     *
     * Usado al eliminar la pista que se está reproduciendo. */
    skipToNextOrPrevPaused() {
      // Caso 1: hay cola con pistas restantes
      if (this.queue.length > 0) {
        // queueIdx ya fue ajustado por deleteTrack/removeFromPlaylist.
        // Asegurar que esté en rango válido.
        if (this.queueIdx >= this.queue.length) this.queueIdx = this.queue.length - 1;
        if (this.queueIdx < 0) this.queueIdx = 0;
        const nextId = this.queue[this.queueIdx];
        const tIdx = this.tracks.findIndex(t => t.id === nextId);
        if (tIdx >= 0) {
          this.currentTrackIdx = tIdx;
          this.currentTrack = this.tracks[tIdx];
          this.loadTrackPaused();
          return;
        }
        // Si la pista no se encontró (poco probable), intentar con la anterior
        if (this.queueIdx > 0) {
          this.queueIdx--;
          const prevId = this.queue[this.queueIdx];
          const ptIdx = this.tracks.findIndex(t => t.id === prevId);
          if (ptIdx >= 0) {
            this.currentTrackIdx = ptIdx;
            this.currentTrack = this.tracks[ptIdx];
            this.loadTrackPaused();
            return;
          }
        }
      }

      // Caso 2: no hay cola, pero sí pistas en la biblioteca
      if (this.tracks.length > 0) {
        // Intentar la siguiente pista de la biblioteca, o la anterior
        let idx = Math.min(this.currentTrackIdx, this.tracks.length - 1);
        if (idx < 0) idx = 0;
        this.currentTrackIdx = idx;
        this.currentTrack = this.tracks[idx];
        // Reconstruir cola con todas las pistas restantes
        this.queue = this.tracks.map(t => t.id);
        this.queueIdx = idx;
        this.loadTrackPaused();
        return;
      }

      // Caso 3: no hay ninguna pista — reproductor vacío
      this.currentTrack = null;
      this.currentTrackIdx = 0;
      this.queueIdx = 0;
      this.queue = [];
      this.showEmptyState();
      this.renderCurrentTrack();
      if (typeof this.renderHome === 'function') this.renderHome();
      if (typeof this.updateChrome === 'function') this.updateChrome();
    },

    next(auto) {
      if (auto && this._sleepFading) return;
      // Fin natural o fundido: la pista saliente sonó entera y cuenta
      // en estadísticas (§67). Un next() manual no pasa por aquí
      // (auto=false); un archivo que falla llega con isPlaying=false
      // desde _handleDecodeFailure; y el candado por pase evita
      // contar dos veces si también lo cierra el gapless.
      if (auto && this.isPlaying && typeof this.trackPlayCompleted === 'function') {
        this.trackPlayCompleted();
      }
      if (!auto) {
        this._cancelCrossfade();
        this._gaplessArmed = false;
      }
      if (auto && this._sleepEndOfTrack) {
        this._fireSleep();
        return;
      }
      // Reconstruir cola de playlist solo si shuffle está off (si no, pisaría la cola barajada).
      // Ojo: la cola de una lista vive en orden de estrellas (§64), así
      // que la reconstrucción usa ese mismo orden, no el guardado.
      if (!this.shuffle && this.playContext && this.playContext.type === 'playlist' && this.playContext.id) {
        const pl = this.playlists.find(p => p.id === this.playContext.id);
        if (pl && pl.trackIds.length) {
          const ids = this.playlistTracksSorted(pl).map(t => t.id);
          if (ids.length && (this.queue.length !== ids.length || ids.some((id, i) => this.queue[i] !== id))) {
            const cur = this.currentTrack && this.currentTrack.id;
            this.queue = ids;
            const qIdx = ids.indexOf(cur);
            this.queueIdx = qIdx >= 0 ? qIdx : 0;
          }
        }
      }
      const xfadeOn = this.crossfadeEnabled && this.crossfadeDuration > 0;
      if (auto && !this._xfadeIncoming && !xfadeOn && this._gaplessEnabled && this.gaplessNext()) {
        return;
      }
      if (this.repeat === 'one' && auto) {
        this.audio.currentTime = 0;
        this.togglePlay(true);
        return;
      }
      const nextIdx = this._nextQueueIndex(!!auto);
      if (nextIdx == null) {
        this.togglePlay(false);
        this.seekToTime(0);
        this.isPlaying = false;
        this.updatePlayUI();
        return;
      }
      this.playFromQueue(nextIdx);
    },

    prev() {
      this._cancelCrossfade();
      this._gaplessArmed = false;
      if (this.audio.currentTime > 3) {
        this.audio.currentTime = 0;
        this.updateMediaPosition(true);
        return;
      }
      let prev = this.queueIdx - 1;
      if (prev < 0) prev = this.queue.length - 1;
      this.playFromQueue(prev);
    },

    _nextQueueIndex(auto) {
      if (!this.queue.length) return null;
      let nextIdx = this.queueIdx + 1;
      if (nextIdx >= this.queue.length) {
        if (this.repeat === 'all' || !auto) return 0;
        return null;
      }
      return nextIdx;
    },

    _fisherYates(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    },

    /* Baraja la cola dejando en cabeza la pista que debe sonar primero.
     *
     * `firstId` es opcional: si se omite se usa la pista actual (así lo hace
     * el botón Aleatorio). Los llamadores que acaban de crear una cola nueva
     * (playlist, favoritos, álbum/artista) pasan el primer id de esa cola,
     * porque en ese momento `currentTrack` todavía es la canción anterior.
     *
     * Antes se quitaba el elemento por POSICIÓN (`queueIdx`) y se volvía a
     * insertar `currentTrack` delante: si la pista actual no pertenecía a la
     * cola nueva se colaba una canción ajena como primera (y sonaba), y si no
     * había pista actual se perdía la canción que ocupaba `queueIdx`.
     * Ahora se quita por id y nunca se añaden pistas que no estén en la cola.
     */
    _applyShuffle(firstId) {
      const base = this.queue.slice();
      this._originalQueue = base.slice();
      let anchor = firstId;
      if (anchor === undefined) {
        const cur = this.currentTrack && this.currentTrack.id;
        anchor = cur || null;
      }
      // Solo se ancla si de verdad está en la cola; si no, se baraja entera.
      if (anchor === null || !base.includes(anchor)) anchor = null;
      const rest = anchor === null
        ? base
        : base.filter((id, i) => i !== base.indexOf(anchor));
      this._fisherYates(rest);
      this.queue = anchor === null ? rest : [anchor, ...rest];
      this.queueIdx = 0;
    },

    _restoreShuffle() {
      if (!this._originalQueue || !this._originalQueue.length) {
        this._originalQueue = null;
        return;
      }
      const cur = this.currentTrack && this.currentTrack.id;
      const restored = this._originalQueue.filter(id => this.trackMap().has(id));
      this._originalQueue = null;
      if (!restored.length) return;
      this.queue = restored;
      const idx = cur ? this.queue.indexOf(cur) : 0;
      this.queueIdx = idx >= 0 ? idx : 0;
    },

    _removeFromOriginalQueue(trackId) {
      if (!this._originalQueue || !trackId) return;
      const i = this._originalQueue.indexOf(trackId);
      if (i >= 0) this._originalQueue.splice(i, 1);
    },

    _setPlaybackGain(g, immediate) {
      if (!this.gainNode || !this.audioCtx) return;
      const v = (typeof g === 'number' && isFinite(g)) ? g : 1;
      try {
        const now = this.audioCtx.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        if (immediate) this.gainNode.gain.setValueAtTime(v, now);
        else {
          this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
          this.gainNode.gain.linearRampToValueAtTime(v, now + 0.12);
        }
      } catch (e) {}
    },

    async applyNormalization(track) {
      const t = track || this.currentTrack;
      if (!this._normalizeVolume) {
        this._normGain = 1;
        this._setPlaybackGain(1, true);
        return;
      }
      if (!t) return;
      const g = await this.computeTrackGain(t);
      if (this.currentTrack && t.id !== this.currentTrack.id) return;
      this._normGain = g;
      this._setPlaybackGain(g, false);
    },

    _cancelCrossfade() {
      if (this._xfadeTimer) {
        clearTimeout(this._xfadeTimer);
        this._xfadeTimer = null;
      }
      this._xfadeStarted = false;
      if (this.gainNode && this.audioCtx && !this._xfadeIncoming && !this._sleepFading) {
        this._setPlaybackGain(this._normGain || 1, true);
      }
    },

    _startCrossfadeOut(remain) {
      this._xfadeStarted = true;
      const dur = Math.max(0.05, remain);
      if (this.gainNode && this.audioCtx) {
        try {
          const now = this.audioCtx.currentTime;
          const g = this.gainNode.gain;
          g.cancelScheduledValues(now);
          g.setValueAtTime(g.value, now);
          g.linearRampToValueAtTime(0.001, now + dur);
        } catch (e) {}
      }
      const ms = Math.max(40, dur * 1000 - 50);
      this._xfadeTimer = setTimeout(() => {
        this._xfadeTimer = null;
        this._xfadeStarted = false;
        this._xfadeIncoming = true;
        this.next(true);
      }, ms);
    },

    /* timeupdate: gapless ~80 ms antes del corte, o arranque de crossfade. */
    tickPlaybackAdvance() {
      if (!this.isPlaying || !this.audio || this._sleepFading) return;
      const dur = this.audio.duration;
      const cur = this.audio.currentTime;
      if (!isFinite(dur) || dur <= 0) return;
      const remain = dur - cur;
      if (remain > 12) {
        this._gaplessArmed = false;
        if (this._xfadeStarted && remain > (this.crossfadeDuration || 0) + 0.5) {
          this._cancelCrossfade();
        }
        return;
      }
      if (this._sleepEndOfTrack && remain <= 10.05 && remain > 0) {
        this._fireSleep();
        return;
      }
      if (this.repeat === 'one') return;
      const xfade = this.crossfadeEnabled && this.crossfadeDuration > 0;
      if (xfade) {
        if (remain <= this.crossfadeDuration && remain > 0.02 && !this._xfadeStarted) {
          if (this._nextQueueIndex(true) == null) return;
          this._startCrossfadeOut(remain);
        }
        return;
      }
      if (this._gaplessEnabled && remain <= 0.08 && remain > 0 && !this._gaplessArmed) {
        this._gaplessArmed = true;
        if (!this.gaplessNext()) this._gaplessArmed = false;
      }
    },

    updateMediaPosition(force) {
      if (!('mediaSession' in navigator) || !this.audio) return;
      const now = Date.now();
      if (!force && this._lastPosState && now - this._lastPosState < 1000) return;
      this._lastPosState = now;
      try {
        const dur = this.audio.duration;
        if (!isFinite(dur) || dur <= 0) return;
        const pos = Math.max(0, Math.min(Number(this.audio.currentTime) || 0, Math.max(0, dur - 0.001)));
        navigator.mediaSession.setPositionState({
          duration: dur,
          playbackRate: this.audio.playbackRate || 1,
          position: pos
        });
        navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
      } catch (e) {}
    },

    seekToTime(sec) {
      if (!this.audio) return;
      this._gaplessArmed = false;
      if (this._xfadeStarted) this._cancelCrossfade();
      const dur = this.audio.duration;
      const n = Number(sec);
      // NaN/Infinity no deben convertirse en 0 (eso rebobinaba la pista
      // al pulsar una tecla con la duración aún desconocida).
      if (!isFinite(n)) return;
      let t = n;
      if (isFinite(dur) && dur > 0) t = Math.max(0, Math.min(dur - 0.05, t));
      else t = Math.max(0, t);
      try { this.audio.currentTime = t; } catch (e) {}
      this.updateProgress();
      this.updateMediaPosition(true);
    },
    seekTo(ratio) {
      if (!this.audio || !this.audio.duration || !isFinite(this.audio.duration)) return;
      // Sin clamp, un clic con rect.width=0 o un gesto fuera de rango
      // producía NaN/Infinity y `currentTime` lanzaba DOMException.
      const r = Number(ratio);
      if (!isFinite(r)) return;
      this._gaplessArmed = false;
      if (this._xfadeStarted) this._cancelCrossfade();
      try {
        this.audio.currentTime = Math.max(0, Math.min(1, r)) * this.audio.duration;
      } catch (e) {
        return;
      }
      this.updateProgress();
      this.updateMediaPosition(true);
    },

    setVolume(v) {
      const n = Number(v);
      if (!isFinite(n)) return; // un <input type=range> vacío da NaN
      this.volume = Math.max(0, Math.min(1, n));
      if (this.audio) {
        try { this.audio.volume = this.volume; } catch (e) {}
      }
      const pct = Math.round(this.volume * 100);
      const sv = document.getElementById('volumeSlider');
      const vv = document.getElementById('volumeValue');
      const sv2 = document.getElementById('volumeSliderNp');
      const vv2 = document.getElementById('volumeValueNp');
      if (sv) sv.value = pct;
      if (vv) vv.textContent = pct + '%';
      if (sv2) sv2.value = pct;
      if (vv2) vv2.textContent = pct + '%';
      this._updateVolumeIcon();
      try { localStorage.setItem('aurora_volume', String(this.volume)); } catch(e){}
    },

    _updateVolumeIcon() {
      const name = this.volume <= 0.001 ? 'volume-xmark'
                 : this.volume < 0.4 ? 'volume-low'
                 : 'volume-high';
      ['btnVolume', 'npVolIcon'].forEach(id => {
        const root = document.getElementById(id);
        if (root) this.setIco(root, name);
      });
    },

    showNpVolume(show) {
      const el = document.getElementById('npVolume');
      if (!el) return;
      const on = show === undefined ? el.hasAttribute('hidden') : !!show;
      if (on) {
        el.removeAttribute('hidden');
        el.classList.add('open');
        const sl = document.getElementById('volumeSliderNp');
        if (sl) sl.value = Math.round(this.volume * 100);
      } else {
        el.setAttribute('hidden', '');
        el.classList.remove('open');
      }
      clearTimeout(this._npVolHide);
      if (on) {
        this._npVolHide = setTimeout(() => this.showNpVolume(false), 4000);
      }
    },

    toggleShuffle() {
      this.shuffle = !this.shuffle;
      if (this.shuffle) this._applyShuffle();
      else this._restoreShuffle();
      this.setShuffleUI();
      this.renderQueue();
      // La «siguiente» cambia al barajar: refrescar la precarga (gapless) para
      // no dejar cacheada la pista que ya no va a sonar.
      if (typeof this.preloadNextTrack === 'function') this.preloadNextTrack();
      this.saveSession();
      this.toast(this.shuffle ? this.t('toast_shuffle_on') : this.t('toast_shuffle_off'));
    },

    cycleRepeat() {
      this.repeat = this.repeat === 'off' ? 'all' : this.repeat === 'all' ? 'one' : 'off';
      this.setRepeatUI();
      const repLabel = this.repeat === 'off' ? this.t('toast_repeat_off')
                     : this.repeat === 'all' ? this.t('toast_repeat_all')
                     : this.t('toast_repeat_one');
      this.toast(this.t('repeat') + ': ' + repLabel);
    },

    toggleFavorite() {
      if (!this.currentTrack) return;
      this.toggleFavoriteFor(this.currentTrack.id);
    },

    /* Alterna el favorito de CUALQUIER pista (no solo la que suena).
     * Lo usa el menú de pista, porque antes la única forma de marcar una
     * canción era abrirla en el reproductor y pulsar el corazón. */
    toggleFavoriteFor(trackId) {
      const t = this.tracks.find(x => x.id === trackId);
      if (!t) return;
      if (this.favorites.has(trackId)) this.favorites.delete(trackId);
      else this.favorites.add(trackId);
      this.saveFavorites();
      if (this.currentTrack && this.currentTrack.id === trackId) this.updateFavoriteUI();
      if (typeof this.renderFavorites === 'function') this.renderFavorites();
      this.toast(this.favorites.has(trackId) ? this.t('toast_added_fav') : this.t('toast_removed_fav'));
    },

    updateFavoriteUI() {
      const liked = this.currentTrack && this.favorites.has(this.currentTrack.id);
      ['btnLike'].forEach(id => {
        const b = document.getElementById(id);
        if (!b) return;
        b.classList.toggle('liked', liked);
        b.setAttribute('aria-pressed', liked ? 'true' : 'false');
        this.setIco(b, liked ? 'heart-solid' : 'heart');
      });
    },

    /* ============================================================
     *  Control de tono y velocidad (Preserves Pitch)
     * ============================================================ */
    setPreservesPitch(enabled) {
      this.preservesPitch = !!enabled;
      try {
        localStorage.setItem('aurora_preserves_pitch', this.preservesPitch ? 'true' : 'false');
      } catch (e) {}
      if (this.audio) {
        this.audio.preservesPitch = this.preservesPitch;
        this.audio.mozPreservesPitch = this.preservesPitch;
        this.audio.webkitPreservesPitch = this.preservesPitch;
      }
      const chk = document.getElementById('chkPreservePitch');
      if (chk) chk.checked = this.preservesPitch;
    },

    /* ============================================================
     *  Repetición A-B (A-B Repeat)
     * ============================================================ */
    toggleABRepeat() {
      if (!this.audio || !this.currentTrack || !this.audio.src) {
        this.toast(this.t('no_track_playing'));
        return;
      }
      if (!this.abRepeat) this.abRepeat = { active: false, a: null, b: null };
      const cur = Number(this.audio.currentTime) || 0;
      if (this.abRepeat.a === null) {
        this.abRepeat.a = cur;
        this.abRepeat.b = null;
        this.abRepeat.active = false;
        this.updateABRepeatUI();
        this.toast(this.t('ab_set_a').replace('X', this.fmtTime(cur)));
      } else if (this.abRepeat.b === null) {
        if (cur <= this.abRepeat.a + 0.3) {
          this.abRepeat.b = this.abRepeat.a + 1.0;
        } else {
          this.abRepeat.b = cur;
        }
        this.abRepeat.active = true;
        this.updateABRepeatUI();
        this.toast(this.t('ab_active')
          .replace('X', this.fmtTime(this.abRepeat.a))
          .replace('Y', this.fmtTime(this.abRepeat.b)));
        if (this.audio && (this.audio.currentTime < this.abRepeat.a || this.audio.currentTime >= this.abRepeat.b)) {
          this.seekToTime(this.abRepeat.a);
        }
      } else {
        this.clearABRepeat();
        this.toast(this.t('ab_cleared'));
      }
    },

    clearABRepeat() {
      this.abRepeat = { active: false, a: null, b: null };
      this.updateABRepeatUI();
    },

    updateABRepeatUI() {
      const btn = document.getElementById('btnABRepeat');
      const range = document.getElementById('progressAbRange');
      if (btn) {
        btn.classList.remove('setting-b', 'active');
        const badge = btn.querySelector('.ab-badge') || btn;
        if (this.abRepeat && this.abRepeat.a !== null && this.abRepeat.b === null) {
          btn.classList.add('setting-b');
          btn.setAttribute('aria-pressed', 'false');
          btn.title = this.t('ab_set_a').replace('X', this.fmtTime(this.abRepeat.a));
          badge.textContent = 'A→';
        } else if (this.abRepeat && this.abRepeat.active && this.abRepeat.b !== null) {
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
          btn.title = this.t('ab_active')
            .replace('X', this.fmtTime(this.abRepeat.a))
            .replace('Y', this.fmtTime(this.abRepeat.b));
          badge.textContent = 'A⇄B';
        } else {
          btn.setAttribute('aria-pressed', 'false');
          btn.title = this.t('ab_repeat');
          badge.textContent = 'A-B';
        }
      }
      if (range) {
        const dur = (this.audio && this.audio.duration) || (this.currentTrack && this.currentTrack.duration) || 0;
        if (this.abRepeat && this.abRepeat.a !== null && dur > 0) {
          range.removeAttribute('hidden');
          const startPct = (this.abRepeat.a / dur) * 100;
          const endPct = this.abRepeat.b !== null ? (this.abRepeat.b / dur) * 100 : Math.min(100, startPct + 0.8);
          range.style.left = startPct + '%';
          range.style.width = Math.max(0.5, endPct - startPct) + '%';
        } else {
          range.setAttribute('hidden', '');
        }
      }
    },

    /* ============================================================
     *  Visualizador de frecuencias en tiempo real (AnalyserNode)
     * ============================================================ */
    initVisualizer() {
      let saved = null;
      try {
        saved = localStorage.getItem('aurora_visualizer_mode');
      } catch (e) {}
      if (!saved) {
        // Respetar reduced-motion: desactivado por defecto si el usuario
        // prefiere movimiento reducido.
        try {
          if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) saved = 'off';
        } catch (e) {}
      }
      this.visualizerMode = saved || 'bars';
      this.updateVisualizerUI();
      if (this.isPlaying) this.startVisualizer();
    },

    setVisualizerMode(mode) {
      this.visualizerMode = mode;
      try { localStorage.setItem('aurora_visualizer_mode', mode); } catch (e) {}
      this.updateVisualizerUI();
      const labels = {
        bars: this.t('visualizer_bars'),
        wave: this.t('visualizer_wave'),
        off: this.t('visualizer_off')
      };
      this.toast(this.t('visualizer') + ': ' + (labels[mode] || mode));
      if (mode === 'off') {
        this.stopVisualizer();
      } else if (this.isPlaying) {
        this.startVisualizer();
      }
    },

    cycleVisualizerMode() {
      const next = this.visualizerMode === 'bars' ? 'wave' : (this.visualizerMode === 'wave' ? 'off' : 'bars');
      this.setVisualizerMode(next);
    },

    updateVisualizerUI() {
      const btn = document.getElementById('btnVisualizer');
      const sec = document.getElementById('visualizerSection');
      if (btn) {
        btn.classList.toggle('active', this.visualizerMode !== 'off');
        btn.setAttribute('aria-pressed', this.visualizerMode !== 'off' ? 'true' : 'false');
      }
      if (sec) {
        sec.style.display = this.visualizerMode === 'off' ? 'none' : 'block';
      }
    },

    /* Ajusta el canvas a su tamaño real (DPR máx 2) para dibujar nítido
     * sin sobredimensionar en pantallas densas. */
    _fitVisualizerCanvas(canvas) {
      try {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          this._visGrad = null;
          this._visGradKey = null;
          this._visBarsGrad = null;
          this._visBarsKey = null;
          this._visWaveFill = null;
          this._visWaveFillKey = null;
        }
      } catch (e) {}
    },

    startVisualizer() {
      if (this.visualizerMode === 'off') return;
      if (this._visRafId || this._visTimer) return;
      const canvas = document.getElementById('visualizerCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      this._fitVisualizerCanvas(canvas);

      // Pausar el dibujado cuando el canvas no está en pantalla
      // (otra vista, sheet encima): ahorra batería en móvil.
      if (!this._visObserver && 'IntersectionObserver' in window) {
        try {
          this._visVisible = true;
          this._visObserver = new IntersectionObserver((entries) => {
            this._visVisible = entries.length ? !!entries[entries.length - 1].isIntersecting : true;
          }, { threshold: 0.02 });
          this._visObserver.observe(canvas);
        } catch (e) {
          this._visObserver = null;
        }
      }

      let last = 0;
      const render = (now) => {
        if (!this.isPlaying || this.visualizerMode === 'off') {
          this._visRafId = null;
          this._visTimer = null;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          return;
        }
        if (this._visVisible === false || document.hidden) {
          // Fuera de pantalla: reintentar en 500 ms sin dibujar
          this._visRafId = null;
          this._visTimer = setTimeout(() => {
            this._visTimer = null;
            if (this.isPlaying && this.visualizerMode !== 'off' && !this._visRafId) {
              this._visRafId = requestAnimationFrame(render);
            }
          }, 500);
          return;
        }
        this._visRafId = requestAnimationFrame(render);
        if (now - last < 16) return; // ~60 fps: a 30 las barras iban a saltos (§68)
        const dt = Math.min(100, Math.max(1, now - (last || now - 33)));
        last = now;
        // Reajustar si el layout cambió (vista oculta al arrancar, rotación)
        try {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          if (canvas.clientWidth > 0 && Math.abs(canvas.width - canvas.clientWidth * dpr) > 2) {
            this._fitVisualizerCanvas(canvas);
          }
        } catch (e) {}
        this.drawVisualizerFrame(canvas, ctx, dt);
      };
      this._visRafId = requestAnimationFrame(render);
    },

    stopVisualizer() {
      if (this._visRafId) {
        cancelAnimationFrame(this._visRafId);
        this._visRafId = null;
      }
      if (this._visTimer) {
        clearTimeout(this._visTimer);
        this._visTimer = null;
      }
      const canvas = document.getElementById('visualizerCanvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    },

    /* ---------- Visualizador: utilidades de dibujo ---------- */

    /* Colores del visualizador: la paleta de la portada que suena
     * (cover.from/cover.to, las mismas --cover-from/--cover-to del
     * fondo). Antes el gradiente era violeta/rosa fijo y nunca usó la
     * paleta dinámica pese a calcularse «para el fondo y
     * visualizador». Sin portada con paleta, el clásico de siempre. */
    _visColors() {
      const cov = (this.currentTrack && typeof this.currentTrack.cover === 'object' && this.currentTrack.cover)
        ? this.currentTrack.cover : null;
      return {
        from: (cov && typeof cov.from === 'string' && cov.from) || '#7C3AED',
        to: (cov && typeof cov.to === 'string' && cov.to) || '#EC4899'
      };
    },

    /* '#RRGGBB' (o '#RGB') + alpha → 'rgba(r,g,b,a)'. Si el color no
     * es hex, se devuelve tal cual (el alpha lo pondrá el degradado
     * con dos paradas del mismo color si hace falta). */
    _hexA(hex, alpha) {
      if (typeof hex !== 'string') return hex;
      let m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
      if (!m) {
        const sh = /^#([0-9a-f]{3})$/i.exec(hex.trim());
        if (sh) m = [null, sh[1][0] + sh[1][0] + sh[1][1] + sh[1][1] + sh[1][2] + sh[1][2]];
      }
      if (!m) return hex;
      const n = parseInt(m[1], 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
    },

    /* Bandas logarítmicas 35 Hz–16 kHz: la energía musical vive
     * abajo; con el muestreo lineal anterior los graves se pegaban
     * al techo y los agudos ni se movían. Pares [binIni, binFin),
     * cacheados por (nº de barras, bins, sampleRate). */
    _visLogBands(count, binCount, sampleRate) {
      const key = count + ':' + binCount + ':' + sampleRate;
      if (this._visBandsCache && this._visBandsKey === key) return this._visBandsCache;
      const binHz = sampleRate / (binCount * 2);
      const fMin = 35;
      const fMax = Math.min(16000, (sampleRate / 2) * 0.92);
      const bands = [];
      for (let i = 0; i < count; i++) {
        const f0 = fMin * Math.pow(fMax / fMin, i / count);
        const f1 = fMin * Math.pow(fMax / fMin, (i + 1) / count);
        const b0 = Math.max(1, Math.floor(f0 / binHz));
        const b1 = Math.min(binCount - 1, Math.max(b0 + 1, Math.round(f1 / binHz)));
        bands.push([b0, b1]);
      }
      this._visBandsCache = bands;
      this._visBandsKey = key;
      return bands;
    },

    /* Nivel objetivo (0..1) por banda: máximo del rango con gamma
     * 0.78, que levanta los pasajes flojos sin pegar todo al techo. */
    _visBarTargets(bands) {
      if (!this._visTargets || this._visTargets.length !== bands.length) {
        this._visTargets = new Float32Array(bands.length);
      }
      const data = this.freqData;
      const out = this._visTargets;
      for (let i = 0; i < bands.length; i++) {
        const b0 = bands[i][0], b1 = bands[i][1];
        let m = 0;
        for (let b = b0; b < b1; b++) { if (data[b] > m) m = data[b]; }
        out[i] = Math.pow(m / 255, 0.78);
      }
      return out;
    },

    /* Suavizado ataque/caída independiente del frame-rate y picos
     * que caen despacio: convierte el parpadeo nervioso de antes en
     * un espectro con peso. Estado persistente entre frames. */
    _visStepBars(targets, dtMs) {
      const n = targets.length;
      if (!this._visBarVals || this._visBarVals.length !== n) {
        this._visBarVals = new Float32Array(n);
        this._visBarPeaks = new Float32Array(n);
      }
      const vals = this._visBarVals, peaks = this._visBarPeaks;
      const atk = 1 - Math.exp(-dtMs / 34);
      const rel = 1 - Math.exp(-dtMs / 160);
      const peakFall = dtMs * 0.00042;
      for (let i = 0; i < n; i++) {
        const t = targets[i];
        vals[i] += (t - vals[i]) * (t > vals[i] ? atk : rel);
        if (vals[i] > peaks[i]) peaks[i] = vals[i];
        else if (peaks[i] > vals[i]) peaks[i] = Math.max(vals[i], peaks[i] - peakFall);
      }
      return { vals, peaks };
    },

    /* Onda fluida: diezma el dominio temporal quedándose con la
     * muestra de mayor amplitud de cada tramo (conserva la forma sin
     * el zigzag de unir miles de puntos crudos) y suaviza el
     * resultado entre frames: la línea «respira» en vez de temblar. */
    _visWavePoints(timeData, count, dtMs) {
      if (!this._visWavePts || this._visWavePts.length !== count) {
        this._visWavePts = new Float32Array(count);
      }
      const pts = this._visWavePts;
      const k = 1 - Math.exp(-dtMs / 55);
      const bucket = timeData.length / count;
      for (let i = 0; i < count; i++) {
        const start = Math.floor(i * bucket);
        const stop = Math.min(timeData.length, Math.floor((i + 1) * bucket));
        let best = 0, bestAbs = -1;
        for (let j = start; j < stop; j++) {
          const v = (timeData[j] - 128) / 128;
          const a = v < 0 ? -v : v;
          if (a > bestAbs) { bestAbs = a; best = v; }
        }
        pts[i] += (best - pts[i]) * k;
      }
      return pts;
    },

    drawVisualizerFrame(canvas, ctx, dtMs) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (!this.analyser || !this.freqData) {
        return;
      }
      const dt = (typeof dtMs === 'number' && dtMs > 0) ? Math.min(100, dtMs) : 33;
      const cols = this._visColors();

      if (this.visualizerMode === 'wave') {
        // Buffer temporal propio (fftSize muestras; antes se reusaba
        // el de frecuencias, la mitad de largo: onda pobre y dentada).
        if (!this._visTimeData || (this.analyser.fftSize && this._visTimeData.length !== this.analyser.fftSize)) {
          this._visTimeData = new Uint8Array(this.analyser.fftSize || this.freqData.length);
        }
        this.analyser.getByteTimeDomainData(this._visTimeData);
        const cssW = canvas.clientWidth || Math.round(w / 2);
        const count = Math.max(64, Math.min(140, Math.round(cssW / 4)));
        const pts = this._visWavePoints(this._visTimeData, count, dt);
        const midY = h / 2;
        const amp = h * 0.42;

        const key = 'wave:' + w + ':' + cols.from + '>' + cols.to;
        if (!this._visGrad || this._visGradKey !== key) {
          const grad = ctx.createLinearGradient(0, 0, w, 0);
          grad.addColorStop(0, cols.from);
          grad.addColorStop(0.5, cols.to);
          grad.addColorStop(1, cols.from);
          this._visGrad = grad;
          this._visGradKey = key;
        }
        const fkey = 'wavefill:' + h + ':' + cols.from + '>' + cols.to;
        if (!this._visWaveFill || this._visWaveFillKey !== fkey) {
          const fg = ctx.createLinearGradient(0, 0, 0, h);
          fg.addColorStop(0, this._hexA(cols.to, 0.05));
          fg.addColorStop(0.5, this._hexA(cols.to, 0.22));
          fg.addColorStop(1, this._hexA(cols.to, 0.05));
          this._visWaveFill = fg;
          this._visWaveFillKey = fkey;
        }

        // Trazo suavizado con curvas cuadráticas por puntos medios
        const tracePath = () => {
          ctx.beginPath();
          let px = 0, py = midY + pts[0] * amp;
          ctx.moveTo(px, py);
          for (let i = 1; i < count; i++) {
            const x = (i / (count - 1)) * w;
            const y = midY + pts[i] * amp;
            ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
            px = x; py = y;
          }
          ctx.lineTo(px, py);
        };

        const lineW = Math.max(2, Math.min(3.2, w / 220));
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        // Halo ancho y tenue bajo el trazo: la «fluidez» visual
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = this._visGrad;
        ctx.lineWidth = lineW * 3.4;
        tracePath();
        ctx.stroke();
        ctx.restore();
        // Relleno suave entre la onda y su línea central
        tracePath();
        ctx.lineTo(w, midY);
        ctx.lineTo(0, midY);
        ctx.closePath();
        ctx.fillStyle = this._visWaveFill;
        ctx.fill();
        // Trazo principal
        ctx.strokeStyle = this._visGrad;
        ctx.lineWidth = lineW;
        tracePath();
        ctx.stroke();
      } else {
        this.analyser.getByteFrequencyData(this.freqData);
        const sampleRate = (this.analyser.context && this.analyser.context.sampleRate)
          || (this.audioCtx && this.audioCtx.sampleRate) || 48000;
        const cssW = canvas.clientWidth || Math.round(w / 2);
        // Nº de barras según el ancho real: ni columnas enanas en
        // pantallas grandes ni láminas de 1 px en las pequeñas.
        const numBars = Math.max(24, Math.min(56, Math.round(cssW / 11)));
        const bands = this._visLogBands(numBars, this.freqData.length, sampleRate);
        const state = this._visStepBars(this._visBarTargets(bands), dt);
        const vals = state.vals, peaks = state.peaks;

        const bkey = 'bars:' + h + ':' + cols.from + '>' + cols.to;
        if (!this._visBarsGrad || this._visBarsKey !== bkey) {
          const bg = ctx.createLinearGradient(0, 0, 0, h);
          bg.addColorStop(0, this._hexA(cols.to, 0.95));
          bg.addColorStop(0.62, this._hexA(cols.from, 0.85));
          bg.addColorStop(1, this._hexA(cols.from, 0.55));
          this._visBarsGrad = bg;
          this._visBarsKey = bkey;
        }
        const gap = Math.max(2, Math.round(w / 300));
        const pitch = w / numBars;
        const barWidth = Math.max(1.5, pitch - gap);
        const usable = h - Math.max(7, Math.round(h * 0.14)); // aire para el pico
        const r = Math.min(barWidth / 2, Math.max(1.5, w / 260));
        ctx.fillStyle = this._visBarsGrad;
        for (let i = 0; i < numBars; i++) {
          const barHeight = Math.max(2, vals[i] * usable);
          const x = i * pitch + gap / 2;
          const y = h - barHeight;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, barWidth, barHeight, [r, r, 0, 0]);
          } else {
            ctx.rect(x, y, barWidth, barHeight);
          }
          ctx.fill();
        }
        // Marcas de pico en una sola pasada y un solo fillStyle
        const capH = Math.max(2, Math.round(h * 0.055));
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        for (let i = 0; i < numBars; i++) {
          if (peaks[i] <= 0.02) continue;
          const x = i * pitch + gap / 2;
          const capY = Math.max(0, h - Math.max(2, peaks[i] * usable) - capH - 2);
          ctx.fillRect(x, capY, barWidth, capH);
        }
      }
    }
});
