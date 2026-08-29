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
        this.analyser.fftSize = 256;       // 128 bins — mejor resolución
        this.analyser.smoothingTimeConstant = 0.82;
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
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
        const val = document.createElement('span');
        val.className = 'eq-band-val';
        const g = savedEq[i] || 0;
        val.textContent = (g > 0 ? '+' : '') + g + ' dB';
        input.addEventListener('input', () => {
          const n = parseFloat(input.value) || 0;
          if (this.eqFilters[i]) this.eqFilters[i].gain.value = n;
          val.textContent = (n > 0 ? '+' : '') + n + ' dB';
          this.saveEqValues();
        });
        wrap.appendChild(lab);
        wrap.appendChild(input);
        wrap.appendChild(val);
        c.appendChild(wrap);
        if (this.eqFilters[i]) this.eqFilters[i].gain.value = savedEq[i] || 0;
      });
      try {
        const preset = localStorage.getItem('aurora_eq_preset') || 'normal';
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
      const inputs = document.querySelectorAll('#eqBands input[type="range"]');
      inputs.forEach((inp, i) => {
        inp.value = 0;
        if (this.eqFilters[i]) this.eqFilters[i].gain.value = 0;
      });
      this.saveEqValues();
    },

    applyEqPreset(preset) {
      const presets = {
        normal:[0, 0, 0, 0, 0],
        flat:  [0, 0, 0, 0, 0],
        bass:  [6, 4, 0, -2, -3],
        vocal: [-2, 0, 4, 3, 1],
        treble:[-2, -1, 0, 4, 6],
        live:  [3, 1, 0, 2, 4]
      };
      const vals = presets[preset] || presets.flat;
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
          this.queue = pl.trackIds.filter(id => this.tracks.some(t => t.id === id));
          const qIdx = this.queue.indexOf(trackId);
          this.queueIdx = qIdx >= 0 ? qIdx : 0;
        } else {
          this.queue = [trackId];
          this.queueIdx = 0;
        }
      } else if (context && context.type === 'favorites') {
        // Cola = pistas favoritas
        const favIds = this.tracks.filter(t => this.favorites.has(t.id)).map(t => t.id);
        this.queue = favIds;
        const qIdx = this.queue.indexOf(trackId);
        this.queueIdx = qIdx >= 0 ? qIdx : 0;
      } else if (context && context.type === 'album' && context.name) {
        const artist = context.artist;
        const tracks = this.tracks.filter(t => t.album === context.name && (!artist || t.artist === artist));
        this.queue = tracks.map(t => t.id);
        const qIdx = this.queue.indexOf(trackId);
        this.queueIdx = qIdx >= 0 ? qIdx : 0;
      } else if (context && context.type === 'artist' && context.name) {
        const tracks = this.tracks.filter(t => t.artist === context.name);
        this.queue = tracks.map(t => t.id);
        const qIdx = this.queue.indexOf(trackId);
        this.queueIdx = qIdx >= 0 ? qIdx : 0;
      } else {
        // Sin contexto específico o 'all'/'queue': cola = todas las pistas
        this.queue = this.tracks.map(t => t.id);
        this.queueIdx = idx;
      }

      // Si se pasa contexto, usarlo; si no, mantener el actual
      if (context) this.playContext = context;
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
      // Asegurar que el gain está a 1 inmediatamente (sin crossfade que retrase)
      if (this.gainNode && this.audioCtx) {
        try {
          const now = this.audioCtx.currentTime;
          this.gainNode.gain.cancelScheduledValues(now);
          this.gainNode.gain.setValueAtTime(1, now);
        } catch (e) {}
      }
      // Asignar src SIEMPRE (no comparar) y reproducir inmediatamente.
      // audio.load() fuerza al navegador a empezar a cargar el nuevo src.
      const url = this.getTrackUrl(t);
      if (!url) {
        console.warn('[Aurora] Sin URL de audio para', t.id);
        return;
      }
      this.audio.src = url;
      try { this.audio.volume = this.volume; } catch (e) {}
      if (this.playbackRate && this.playbackRate !== 1) {
        try { this.audio.playbackRate = this.playbackRate; } catch (e) {}
      }
      if (typeof this.restoreLyricsPrefs === 'function') this.restoreLyricsPrefs();
      this.addToHistory(t.id);
      this.togglePlay(true);
      this.renderCurrentTrack();
      this.renderLyrics();
      this.updateMediaSession();
      this.preloadNextTrack();
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
      }
      this.isPlaying = false;
      this.renderCurrentTrack();
      this.renderLyrics();
      this.updateMediaSession();
      this.updatePlayUI();
      this.animateCoverTransition();
    },

    /* Animación de transición de portada y fondo (#12) */
    animateCoverTransition() {
      const cover = document.getElementById('coverArt');
      const bg = document.getElementById('bgGradient');
      if (!cover) return;
      cover.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      cover.style.opacity = '0';
      cover.style.transform = 'scale(0.92) rotateY(8deg)';
      setTimeout(() => {
        cover.style.opacity = '1';
        cover.style.transform = 'scale(1) rotateY(0deg)';
        setTimeout(() => {
          cover.style.transition = '';
          cover.style.transform = '';
        }, 400);
      }, 200);
      if (bg) {
        bg.style.transition = 'opacity 0.6s ease';
        bg.style.opacity = '0.2';
        setTimeout(() => { bg.style.opacity = ''; }, 50);
      }
    },

    async togglePlay(forcePlay) {
      if (!this.currentTrack) return;
      const wantPlay = forcePlay !== undefined ? forcePlay : !this.isPlaying;
      if (wantPlay) {
        // Inicializar Web Audio al primer play (política iOS)
        // Pero NO esperar al resume antes de play() — llamar play() inmediatamente
        // para que el audio empiece a cargar/reproducir sin retardo.
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
            this.isPlaying = true;
            // Setear gain a 1 inmediatamente (sin fundido de entrada que retrase)
            if (this.gainNode && this.audioCtx) {
              try {
                const now = this.audioCtx.currentTime;
                this.gainNode.gain.cancelScheduledValues(now);
                this.gainNode.gain.setValueAtTime(1, now);
              } catch (e) {}
            }
            this.updatePlayUI();
            this.ensureAudioGraph();
            this.requestWakeLock();
            this.trackPlayStarted();
          }).catch((e) => {
            console.warn('[Aurora] play() rechazado:', e.message);
            this._lastError = { msg: 'play() rechazado: ' + e.message, ts: Date.now() };
            this.isPlaying = false;
            this.updatePlayUI();
            this.toast(this.t('toast_play_blocked'));
          });
        }
      } else {
        // Fundido de salida si crossfade activo
        if (this.crossfadeEnabled && this.gainNode && this.audioCtx) {
          try {
            const now = this.audioCtx.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            this.gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
            setTimeout(() => {
              this.audio.pause();
              if (this.gainNode) this.gainNode.gain.value = 1;
            }, 300);
          } catch (e) {
            this.audio.pause();
          }
        } else {
          this.audio.pause();
        }
        this.isPlaying = false;
        this.updatePlayUI();
        this.releaseWakeLock();
        this.trackPlayStopped();
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
      // Si la cola se quedó vacía o desfasada, reconstruirla desde la lista
      if (this.playContext && this.playContext.type === 'playlist' && this.playContext.id) {
        const pl = this.playlists.find(p => p.id === this.playContext.id);
        if (pl && pl.trackIds.length) {
          const ids = pl.trackIds.filter(id => this.tracks.some(t => t.id === id));
          if (ids.length && (this.queue.length !== ids.length || ids.some((id, i) => this.queue[i] !== id))) {
            const cur = this.currentTrack && this.currentTrack.id;
            this.queue = ids;
            const qIdx = ids.indexOf(cur);
            this.queueIdx = qIdx >= 0 ? qIdx : 0;
          }
        }
      }
      // #4 Intentar gapless si es auto-advance y está habilitado
      if (auto && this._gaplessEnabled && this.gaplessNext()) {
        return;
      }
      if (this.repeat === 'one' && auto) {
        this.audio.currentTime = 0;
        this.togglePlay(true);
        return;
      }
      let nextIdx;
      if (this.shuffle) {
        if (this.queue.length > 1) {
          do { nextIdx = Math.floor(Math.random() * this.queue.length); }
          while (nextIdx === this.queueIdx);
        } else nextIdx = 0;
      } else {
        nextIdx = this.queueIdx + 1;
        if (nextIdx >= this.queue.length) {
          if (this.repeat === 'all' || !auto) {
            nextIdx = 0;
          } else {
            this.togglePlay(false);
            return;
          }
        }
      }
      this.playFromQueue(nextIdx);
    },

    prev() {
      if (this.audio.currentTime > 3) {
        this.audio.currentTime = 0;
        return;
      }
      let prev = this.queueIdx - 1;
      if (prev < 0) prev = this.queue.length - 1;
      this.playFromQueue(prev);
    },

    seekToTime(sec) {
      if (!this.audio) return;
      const dur = this.audio.duration;
      let t = Number(sec) || 0;
      if (isFinite(dur) && dur > 0) t = Math.max(0, Math.min(dur - 0.05, t));
      else t = Math.max(0, t);
      try { this.audio.currentTime = t; } catch (e) {}
      this.updateProgress();
    },
    seekTo(ratio) {
      if (!this.audio || !this.audio.duration || isNaN(this.audio.duration)) return;
      this.audio.currentTime = ratio * this.audio.duration;
      this.updateProgress();
    },

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      this.audio.volume = this.volume;
      const sv = document.getElementById('volumeSlider');
      const vv = document.getElementById('volumeValue');
      if (sv) sv.value = Math.round(this.volume * 100);
      if (vv) vv.textContent = Math.round(this.volume * 100) + '%';
      try { localStorage.setItem('aurora_volume', String(this.volume)); } catch(e){}
    },

    toggleShuffle() {
      this.shuffle = !this.shuffle;
      this.setShuffleUI();
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
      const id = this.currentTrack.id;
      if (this.favorites.has(id)) this.favorites.delete(id);
      else this.favorites.add(id);
      this.saveFavorites();
      this.updateFavoriteUI();
      this.renderFavorites();
      this.toast(this.favorites.has(id) ? this.t('toast_added_fav') : this.t('toast_removed_fav'));
    },

    updateFavoriteUI() {
      const liked = this.currentTrack && this.favorites.has(this.currentTrack.id);
      ['btnLike'].forEach(id => {
        const b = document.getElementById(id);
        if (!b) return;
        b.classList.toggle('liked', liked);
        b.setAttribute('aria-pressed', liked ? 'true' : 'false');
        // Cambiar icono FA: corazón vacío (regular) vs lleno (solid)
        const icon = b.querySelector('i');
        if (icon) {
          if (liked) {
            icon.classList.remove('fa-regular');
            icon.classList.add('fa-solid');
          } else {
            icon.classList.remove('fa-solid');
            icon.classList.add('fa-regular');
          }
        }
      });
    },
});
