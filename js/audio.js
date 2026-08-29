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
          try { localStorage.setItem('aurora_eq_preset', 'custom'); } catch (e) {}
          document.querySelectorAll('.eq-preset').forEach(b => b.classList.remove('active'));
        });
        wrap.appendChild(lab);
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
      if (this.shuffle) this._applyShuffle();
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
        return;
      }
      this.audio.src = url;
      try { this.audio.volume = this.volume; } catch (e) {}
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
            console.warn('[Aurora] play() rechazado:', e.message);
            this._lastError = { msg: 'play() rechazado: ' + e.message, ts: Date.now() };
            this.isPlaying = false;
            this.updatePlayUI();
            this.toast(this.t('toast_play_blocked'));
          });
        }
      } else {
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
      if (!auto) {
        this._cancelCrossfade();
        this._gaplessArmed = false;
      }
      if (auto && this._sleepEndOfTrack) {
        this._fireSleep();
        return;
      }
      // Reconstruir cola de playlist solo si shuffle está off (si no, pisaría la cola barajada)
      if (!this.shuffle && this.playContext && this.playContext.type === 'playlist' && this.playContext.id) {
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

    _applyShuffle() {
      const cur = this.currentTrack && this.currentTrack.id;
      this._originalQueue = this.queue.slice();
      const rest = [];
      this.queue.forEach((id, i) => {
        if (i !== this.queueIdx) rest.push(id);
      });
      this._fisherYates(rest);
      this.queue = cur ? [cur, ...rest] : rest;
      this.queueIdx = 0;
    },

    _restoreShuffle() {
      if (!this._originalQueue || !this._originalQueue.length) {
        this._originalQueue = null;
        return;
      }
      const cur = this.currentTrack && this.currentTrack.id;
      const restored = this._originalQueue.filter(id => this.tracks.some(t => t.id === id));
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
        const pos = Math.max(0, Math.min(this.audio.currentTime || 0, dur));
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
      let t = Number(sec) || 0;
      if (isFinite(dur) && dur > 0) t = Math.max(0, Math.min(dur - 0.05, t));
      else t = Math.max(0, t);
      try { this.audio.currentTime = t; } catch (e) {}
      this.updateProgress();
      this.updateMediaPosition(true);
    },
    seekTo(ratio) {
      if (!this.audio || !this.audio.duration || isNaN(this.audio.duration)) return;
      this._gaplessArmed = false;
      if (this._xfadeStarted) this._cancelCrossfade();
      this.audio.currentTime = ratio * this.audio.duration;
      this.updateProgress();
      this.updateMediaPosition(true);
    },

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.audio) this.audio.volume = this.volume;
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
      const cls = this.volume <= 0.001 ? 'fa-volume-xmark'
                : this.volume < 0.4 ? 'fa-volume-low'
                : 'fa-volume-high';
      ['btnVolume', 'npVolIcon'].forEach(id => {
        const root = document.getElementById(id);
        const icon = root && (root.tagName === 'I' ? root : root.querySelector('i'));
        if (!icon) return;
        icon.classList.remove('fa-volume-xmark', 'fa-volume-low', 'fa-volume-high');
        icon.classList.add('fa-solid', cls);
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
