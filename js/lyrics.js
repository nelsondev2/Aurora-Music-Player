/* =====================================================================
 *  js/lyrics.js — Aurora Music Player
 *  Letras LRC: parser, render, editor, offset, loop
 *
 *  Parte del refactor (C) de app.js: mismo código, módulos por funcionalidad.
 *  Este archivo se carga tras js/state.js y completa el objeto App con
 *  Object.assign (los scripts son clásicos por compatibilidad webxdc).
 * ===================================================================== */

'use strict';

Object.assign(App, {
    /* ============================================================
     *  Letras LRC
     * ============================================================
     *  Soporta dos tipos de letras:
     *   1. LRC sincronizado: líneas con timestamps [mm:ss.xx]texto
     *   2. Texto plano: líneas sin timestamps (de USLT ID3)
     *  El parser marca cada línea como timed/untimed para que el
     *  highlight sepa si sincronizar o mostrar estático.
     * ============================================================ */
    /* ============================================================
     *  Parser LRC tolerante (#21)
     * ============================================================
     *  Soporta:
     *   - Timestamps múltiples en una línea: [00:01.00][00:15.00]Letra
     *   - Metadata LRC: [ar:], [ti:], [al:], [by:], [offset:], etc.
     *   - Compensación [offset:] aplicada a todos los timestamps
     *   - Espacios irregulares y formatos variados
     *   - Líneas de texto plano (sin timestamp)
     *   - Traducciones embebidas (formato [tr:xx] o doble línea)
     * ============================================================ */
    parseLrc(arr) {
      if (!arr || !arr.length) return [];
      // Si arr es un string (no array), dividirlo por líneas
      if (typeof arr === 'string') {
        arr = arr.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      }
      const result = [];
      let hasTimed = false;
      let globalOffset = 0;

      // Primera pasada: detectar offset global
      for (const line of arr) {
        if (typeof line !== 'string') continue;
        const offMatch = line.match(/\[offset:\s*(-?\d+)\s*\]/i);
        if (offMatch) {
          globalOffset = parseInt(offMatch[1]) / 1000;
        }
      }

      // Segunda pasada: parsear líneas
      for (const line of arr) {
        if (typeof line !== 'string') continue;
        const trimmed = line.trim();
        if (!trimmed) {
          if (hasTimed) {
            result.push({ time: -1, text: '', timed: false });
          }
          continue;
        }

        // Saltar metadata LRC pura
        if (/^\[(ar|ti|al|by|offset|length|re|ve|id):/i.test(trimmed)) continue;

        // Buscar TODOS los timestamps en la línea.
        // Soporta: [mm:ss.xx], [mm:ss], [m:ss.xx], [m:ss], [h:mm:ss.xx]
        const timestampRegex = /\[(\d+):(\d{1,2}(?:\.\d+)?)\]/g;
        const stamps = [];
        let m;
        while ((m = timestampRegex.exec(trimmed)) !== null) {
          stamps.push({
            time: parseInt(m[1]) * 60 + parseFloat(m[2]) + globalOffset,
            match: m[0]
          });
        }

        if (stamps.length > 0) {
          hasTimed = true;
          const lastStampEnd = trimmed.lastIndexOf(stamps[stamps.length - 1].match) + stamps[stamps.length - 1].match.length;
          const text = trimmed.substring(lastStampEnd).trim();
          for (const stamp of stamps) {
            result.push({
              time: Math.max(0, stamp.time),
              text: text,
              timed: true
            });
          }
        } else {
          // Línea de texto plano (sin timestamp)
          result.push({
            time: -1,
            text: trimmed,
            timed: false
          });
        }
      }

      // Si hay timestamps, ordenar por tiempo
      if (hasTimed) {
        result.sort((a, b) => {
          const ta = a.timed ? a.time : 0;
          const tb = b.timed ? b.time : 0;
          return ta - tb;
        });

        // Fusionar líneas con el MISMO timestamp: la primera es el texto
        // principal y la siguiente es su traducción (formato LRC bilingüe,
        // muy común en archivos con idioma original + traducción).
        const merged = [];
        for (const line of result) {
          const prev = merged[merged.length - 1];
          if (
            line.timed && prev && prev.timed &&
            Math.abs(prev.time - line.time) < 0.001 &&
            !prev.translation
          ) {
            if (!prev.text && line.text) {
              prev.text = line.text;   // la 1ª estaba vacía: promover su texto
            } else if (line.text) {
              prev.translation = line.text;
            }
            continue;
          }
          merged.push(line);
        }
        result.length = 0;
        result.push(...merged);
      }
      result.hasTimed = hasTimed;
      return result;
    },

    /* ============================================================
     *  Render de letras con todas las mejoras
     * ============================================================ */
    renderLyrics() {
      const cont = document.getElementById('lyricsContent');
      if (!cont) return;
      cont.innerHTML = '';
      const t = this.currentTrack;

      // Aplicar tamaño de fuente guardado
      const scroll = document.getElementById('lyricsScroll');
      if (scroll) scroll.style.setProperty('--lrc-font-size', this.lrcFontSize + 'px');

      if (!t || !t.lrc || (Array.isArray(t.lrc) && t.lrc.length === 0)) {
        cont.innerHTML = '<div class="lrc-line untimed">' + this.t('lrc_no_lyrics') + '</div>';
        this.lrcLines = [];
        this.lrcHasTimed = false;
        return;
      }

      // Cache: si ya tenemos las líneas parseadas para esta pista, reutilizar
      if (t._lrcCache && t._lrcCacheKey === JSON.stringify(t.lrc)) {
        this.lrcLines = t._lrcCache;
        this.lrcHasTimed = !!t._lrcCache.hasTimed;
      } else {
        this.lrcLines = this.parseLrc(t.lrc);
        this.lrcHasTimed = !!this.lrcLines.hasTimed;
        t._lrcCache = this.lrcLines;
        t._lrcCacheKey = JSON.stringify(t.lrc);
      }

      if (this.lrcLines.length === 0) {
        cont.innerHTML = '<div class="lrc-line untimed">' + this.t('lrc_no_lyrics') + '</div>';
        return;
      }

      // Badge de estado (sincronizada / no sincronizada)
      if (!this.lrcHasTimed) {
        const badge = document.createElement('div');
        badge.className = 'lrc-status-badge';
        badge.textContent = this.t('lrc_not_synced');
        cont.appendChild(badge);
      }

        this.lrcLines.forEach((l, i) => {
        const div = document.createElement('div');
        div.className = 'lrc-line';
        if (!l.text) div.classList.add('empty');
        if (!this.lrcHasTimed) div.classList.add('untimed');
        // Traducción (LRC bilingüe): línea secundaria bajo el texto principal
        if (l.translation) {
          div.innerHTML = '<span class="lrc-main">' + this.esc(l.text || '♪') + '</span>' +
            '<span class="lrc-translation">' + this.esc(l.translation) + '</span>';
        } else {
          div.textContent = l.text || '♪';
        }
        div.dataset.idx = i;
        // Tap en una línea con timestamp → saltar a ese punto (#11)
        if (l.timed && l.time >= 0) {
          div.addEventListener('click', () => {
            this.seekToTime(l.time + (this.lrcOffset || 0));
            if (navigator.vibrate) navigator.vibrate(10);
          });
        }
        cont.appendChild(div);
      });

      this.activeLrcIdx = -1;
      this._lastActiveKey = '';
      this._lrcLineEls = null;  // invalidar caché de elementos DOM
      // Iniciar sincronización con RAF (#22)
      this.startLrcRafSync();
      // Detectar scroll manual del usuario (#13)
      this.wireLyricsUserScroll();
    },

    /* Sincronización precisa con requestAnimationFrame (#22) */
    startLrcRafSync() {
      if (this.lrcRafId) cancelAnimationFrame(this.lrcRafId);
      if (!this.lrcHasTimed) return;
      const tick = () => {
        const lyricsView = document.getElementById('viewLyrics');
        if (!lyricsView || !lyricsView.classList.contains('active')) {
          this.lrcRafId = requestAnimationFrame(tick);
          return;
        }
        if (this.audio && this.currentTrack) {
          // cur = tiempo actual - offset (offset positivo = letra adelantada)
          const cur = (this.audio.currentTime || 0) - this.lrcOffset;
          this.updateLyricsHighlight(cur);
          // Loop de sección (#19)
          if (this.lrcLoop && this.lrcLines[this.lrcLoop.endIdx]) {
            const endTime = this.lrcLines[this.lrcLoop.endIdx].time;
            if (cur >= endTime + 0.1) {
              const startTime = this.lrcLines[this.lrcLoop.startIdx].time;
              this.audio.currentTime = Math.max(0, startTime + this.lrcOffset);
            }
          }
        }
        this.lrcRafId = requestAnimationFrame(tick);
      };
      tick();
    },

    /* Detecta cuando el usuario hace scroll manual para pausar el auto-scroll (#13) */
    wireLyricsUserScroll() {
      const sc = document.getElementById('lyricsScroll');
      if (!sc || sc._userScrollWired) return;
      sc._userScrollWired = true;
      let scrollTimer = null;
      sc.addEventListener('scroll', () => {
        // Si el scroll fue provocado por JS (auto-scroll), ignorar
        if (this._autoScrolling) return;
        this.lrcUserScrolling = true;
        sc.classList.add('user-scrolling');
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          this.lrcUserScrolling = false;
          sc.classList.remove('user-scrolling');
        }, 3000);  // Reanudar auto-scroll tras 3s sin tocar
      }, { passive: true });
    },

    /* Actualiza el highlight y el scroll de las letras.
     * Usa búsqueda LINEAL (no binaria) porque el array puede tener
     * líneas timed y untimed mezcladas, lo que rompe la búsqueda binaria. */
    updateLyricsHighlight(cur) {
      if (!this.lrcLines.length || !this.lrcHasTimed) return;

      // === BÚSQUEDA LINEAL del índice activo ===
      // Encontrar la última línea timed con time <= cur.
      // Es O(n) pero para 50-100 líneas a 60fps es insignificante.
      let idx = -1;
      for (let i = 0; i < this.lrcLines.length; i++) {
        const l = this.lrcLines[i];
        if (l.timed && l.time <= cur) {
          idx = i;
        } else if (l.timed && l.time > cur) {
          break;
        }
      }

      if (idx < 0) {
        if (this.activeLrcIdx !== -1) {
          this.activeLrcIdx = -1;
          this._lastActiveKey = '';
          // Limpiar clases usando caché
          if (this._lrcLineEls) {
            for (let i = 0; i < this._lrcLineEls.length; i++) {
              const el = this._lrcLineEls[i];
              el.className = 'lrc-line' + (this.lrcLines[i] && !this.lrcLines[i].timed ? ' untimed' : '');
            }
          }
        }
        return;
      }

      // === Buscar líneas con el mismo timestamp (solo mirar alrededor de idx) ===
      const activeTime = this.lrcLines[idx].time;
      const activeIndices = [idx];
      // Buscar hacia atrás
      for (let i = idx - 1; i >= 0; i--) {
        if (this.lrcLines[i].timed && Math.abs(this.lrcLines[i].time - activeTime) < 0.01) {
          activeIndices.unshift(i);
        } else break;
      }
      // Buscar hacia adelante
      for (let i = idx + 1; i < this.lrcLines.length; i++) {
        if (this.lrcLines[i].timed && Math.abs(this.lrcLines[i].time - activeTime) < 0.01) {
          activeIndices.push(i);
        } else break;
      }

      // === Solo actualizar DOM si cambió la línea activa ===
      const key = activeIndices[0] + '';  // clave simple: primer índice
      if (key !== this._lastActiveKey) {
        this._lastActiveKey = key;
        this.activeLrcIdx = idx;

        // Usar caché de elementos DOM si existe, sino crearla
        if (!this._lrcLineEls) {
          const cont = document.getElementById('lyricsContent');
          if (cont) this._lrcLineEls = Array.from(cont.querySelectorAll('.lrc-line'));
        }

        if (this._lrcLineEls) {
          const firstActive = activeIndices[0];
          const lastActive = activeIndices[activeIndices.length - 1];
          for (let i = 0; i < this._lrcLineEls.length; i++) {
            const el = this._lrcLineEls[i];
            const isActive = (i >= firstActive && i <= lastActive);
            // Calcular distancia mínima al rango activo
            let minDist;
            if (i < firstActive) minDist = firstActive - i;
            else if (i > lastActive) minDist = i - lastActive;
            else minDist = 0;

            // Actualizar clases de forma eficiente (solo si cambiaron)
            const hasActive = el.classList.contains('active');
            const hasNear = el.classList.contains('near');
            const hasNear2 = el.classList.contains('near-2');

            if (isActive !== hasActive) el.classList.toggle('active', isActive);
            const shouldNear = !isActive && minDist === 1;
            if (shouldNear !== hasNear) el.classList.toggle('near', shouldNear);
            const shouldNear2 = !isActive && minDist === 2;
            if (shouldNear2 !== hasNear2) el.classList.toggle('near-2', shouldNear2);
          }
        }
      }

      // === SCROLL: interpolar hacia el objetivo en cada frame ===
      if (!this.lrcUserScrolling && activeIndices.length > 0 && this._lrcLineEls) {
        const sc = document.getElementById('lyricsScroll');
        if (sc) {
          const firstActiveEl = this._lrcLineEls[activeIndices[0]];
          if (firstActiveEl) {
            const isFullscreen = document.getElementById('viewLyrics').classList.contains('lyrics-fullscreen');
            const offsetUp = isFullscreen ? 0 : sc.clientHeight * -0.25;
            const targetTop = firstActiveEl.offsetTop - (sc.clientHeight / 2) + (firstActiveEl.clientHeight / 2) - offsetUp;
            const current = sc.scrollTop;
            const diff = targetTop - current;
            if (Math.abs(diff) > 0.5) {
              this._autoScrolling = true;
              sc.scrollTop = current + diff * 0.5;
            } else {
              this._autoScrolling = false;
            }
          }
        }
      }
    },

    /* ============================================================
     *  Cargar .lrc externo (#1)
     * ============================================================ */
    loadExternalLrc() {
      let input = document.getElementById('lrcFileInput');
      if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'lrcFileInput';
        input.accept = '.lrc,.txt';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            const text = await file.text();
            if (this.currentTrack) {
              const lines = text.split(/\r?\n/);
              this.currentTrack.lrc = lines;
              // Invalidar caché
              this.currentTrack._lrcCache = null;
              this.persistTrack(this.currentTrack);
              this.renderLyrics();
              this.toast(this.t('lrc_loaded'));
            }
          } catch (err) {
            this.toast(this.t('toast_load_error'));
          }
          e.target.value = '';
        });
      }
      input.value = '';
      input.click();
    },

    /* ============================================================
     *  Editor de letras (#2)
     * ============================================================ */
    openLrcEditor() {
      const ta = document.getElementById('lrcEditorText');
      if (!ta) return;
      // Rellenar con la letra actual (si existe)
      if (this.currentTrack && this.currentTrack.lrc) {
        const lines = Array.isArray(this.currentTrack.lrc) ? this.currentTrack.lrc : [this.currentTrack.lrc];
        ta.value = lines.join('\n');
      } else {
        ta.value = '';
      }
      this.openSheet('sheetLrcEditor');
    },

    saveLrcFromEditor() {
      const ta = document.getElementById('lrcEditorText');
      if (!ta || !this.currentTrack) return;
      const text = ta.value.trim();
      if (!text) {
        this.currentTrack.lrc = null;
      } else {
        this.currentTrack.lrc = text.split(/\r?\n/);
      }
      this.currentTrack._lrcCache = null;
      this.persistTrack(this.currentTrack);
      this.renderLyrics();
      this.closeSheet('sheetLrcEditor');
      this.toast(this.t('lrc_saved'));
    },

    /* ============================================================
     *  Ajuste de offset manual (#12)
     * ============================================================ */
    adjustLrcOffset(delta) {
      this.lrcOffset += delta;
      // Persistir por pista
      if (this.currentTrack) {
        this.currentTrack.lrcOffset = this.lrcOffset;
        this.persistTrack(this.currentTrack);
      }
      const sign = this.lrcOffset >= 0 ? '+' : '';
      this.toast(this.t('lrc_offset_toast').replace('X', sign + this.lrcOffset.toFixed(1) + 's'));
    },
    resetLrcOffset() {
      // Reset COMPLETO: deshace todos los cambios hechos en la vista de letras
      // (offset, tamaño de fuente, velocidad, loop)
      // 1. Offset
      this.lrcOffset = 0;
      if (this.currentTrack) {
        this.currentTrack.lrcOffset = 0;
        this.persistTrack(this.currentTrack);
      }
      // 2. Tamaño de fuente → valor por defecto
      this.setLrcFontSize(19);
      try { localStorage.removeItem('aurora_lrc_fontsize'); } catch (e) {}
      // 3. Velocidad → 1.0×
      this.setPlaybackRate(1.0);
      try { localStorage.removeItem('aurora_playback_rate'); } catch (e) {}
      // 4. Loop de sección
      this.clearLyricsLoop();
      // 5. Salir de pantalla completa si estaba activa
      const view = document.getElementById('viewLyrics');
      if (view && view.classList.contains('lyrics-fullscreen')) {
        view.classList.remove('lyrics-fullscreen');
      }
      // Re-renderizar para aplicar cambios visuales
      this.renderLyrics();
      this.toast(this.t('lrc_offset_reset'));
    },

    /* ============================================================
     *  Tamaño de fuente ajustable (#7)
     * ============================================================ */
    setLrcFontSize(size) {
      this.lrcFontSize = Math.max(12, Math.min(32, size));
      try { localStorage.setItem('aurora_lrc_fontsize', this.lrcFontSize); } catch (e) {}
      // Setear la variable CSS en todos los contenedores relevantes
      const scroll = document.getElementById('lyricsScroll');
      const content = document.getElementById('lyricsContent');
      const val = this.lrcFontSize + 'px';
      if (scroll) scroll.style.setProperty('--lrc-font-size', val);
      if (content) content.style.setProperty('--lrc-font-size', val);
    },

    /* ============================================================
     *  Pantalla completa / modo inmersivo (#14)
     * ============================================================ */
    toggleLyricsFullscreen() {
      const view = document.getElementById('viewLyrics');
      if (!view) return;
      view.classList.toggle('lyrics-fullscreen');
      // Asegurar wake lock (#15)
      if (view.classList.contains('lyrics-fullscreen')) {
        this.requestWakeLock();
      }
    },

    /* ============================================================
     *  Ajuste de velocidad de reproducción (#18)
     * ============================================================ */
    setPlaybackRate(rate) {
      this.playbackRate = Math.max(0.5, Math.min(2.0, Math.round(rate * 10) / 10));
      if (this.audio) this.audio.playbackRate = this.playbackRate;
      const label = document.getElementById('lrcSpeedLabel');
      if (label) label.textContent = this.playbackRate.toFixed(1) + '×';
      try { localStorage.setItem('aurora_playback_rate', this.playbackRate); } catch (e) {}
    },

    /* ============================================================
     *  Loop de sección (#19)
     * ============================================================ */
    toggleLyricsLoop() {
      if (this.lrcLoop) {
        this.clearLyricsLoop();
        return;
      }
      // Si no hay loop activo, marcar desde la línea actual hasta 10 líneas después
      if (this.activeLrcIdx < 0 || !this.lrcHasTimed) {
        this.toast(this.t('lrc_loop_section'));
        return;
      }
      const endIdx = Math.min(this.activeLrcIdx + 8, this.lrcLines.length - 1);
      // Buscar la siguiente línea con timestamp para el final
      let actualEnd = endIdx;
      for (let i = this.activeLrcIdx + 1; i <= endIdx; i++) {
        if (this.lrcLines[i] && this.lrcLines[i].timed) actualEnd = i;
      }
      this.lrcLoop = { startIdx: this.activeLrcIdx, endIdx: actualEnd };
      const indicator = document.getElementById('lyricsLoopIndicator');
      const text = document.getElementById('lyricsLoopText');
      if (indicator && text) {
        const startT = this.fmtTime(this.lrcLines[this.activeLrcIdx].time);
        const endT = this.fmtTime(this.lrcLines[actualEnd].time);
        text.textContent = this.t('lrc_loop_section') + ': ' + startT + ' → ' + endT;
        indicator.style.display = 'flex';
      }
      const btn = document.getElementById('btnLrcLoop');
      if (btn) btn.classList.add('active');
    },
    clearLyricsLoop() {
      this.lrcLoop = null;
      const indicator = document.getElementById('lyricsLoopIndicator');
      if (indicator) indicator.style.display = 'none';
      const btn = document.getElementById('btnLrcLoop');
      if (btn) btn.classList.remove('active');
    },

    /* ============================================================
     *  Restaurar offset y tamaño de fuente guardados al cargar pista
     * ============================================================ */
    restoreLyricsPrefs() {
      try {
        const fs = localStorage.getItem('aurora_lrc_fontsize');
        if (fs) this.lrcFontSize = parseInt(fs);
      } catch (e) {}
      try {
        const pr = localStorage.getItem('aurora_playback_rate');
        if (pr) {
          this.playbackRate = parseFloat(pr);
          if (this.audio) this.audio.playbackRate = this.playbackRate;
          const label = document.getElementById('lrcSpeedLabel');
          if (label) label.textContent = this.playbackRate.toFixed(1) + '×';
        }
      } catch (e) {}
      // Offset por pista
      if (this.currentTrack && this.currentTrack.lrcOffset) {
        this.lrcOffset = this.currentTrack.lrcOffset;
      } else {
        this.lrcOffset = 0;
      }
    },
});
