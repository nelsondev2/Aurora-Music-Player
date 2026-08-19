/* =====================================================================
 *  js/ui.js — Aurora Music Player
 *  Sheets · confirmación · vistas · Media Session · Wake Lock · Sleep · Toast
 *
 *  Parte del refactor (C) de app.js: mismo código, módulos por funcionalidad.
 *  Este archivo se carga tras js/state.js y completa el objeto App con
 *  Object.assign (los scripts son clásicos por compatibilidad webxdc).
 * ===================================================================== */

'use strict';

Object.assign(App, {
    /* ============================================================
     *  Sheets
     * ============================================================ */
    /* ============================================================
     *  Confirmación genérica (sustituye a confirm() nativo)
     *  Devuelve una Promise<boolean>: true = aceptar, false = cancelar.
     *  Si cierran el sheet por backdrop/X también resuelve false
     *  (ver hook en closeSheet).
     * ============================================================ */
    showConfirm(opts = {}) {
      return new Promise((resolve) => {
        const sheet = document.getElementById('sheetConfirm');
        if (!sheet) {
          // Fallback extremo: sin markup, usar el nativo
          resolve(window.confirm(opts.message || ''));
          return;
        }
        const msg = document.getElementById('confirmMsg');
        const icon = document.getElementById('confirmIcon');
        const okBtn = document.getElementById('btnConfirmOk');
        const cancelBtn = document.getElementById('btnConfirmCancel');
        if (msg) msg.textContent = opts.message || '';
        if (icon) icon.classList.toggle('hidden', opts.danger === false);
        if (okBtn) {
          okBtn.textContent = opts.okLabel || this.t('confirm_ok');
          okBtn.classList.toggle('danger', opts.danger !== false);
        }
        let done = false;
        this._confirmResolver = (val) => {
          if (done) return;
          done = true;
          this._confirmResolver = null;
          this.closeSheet('sheetConfirm');
          resolve(val);
        };
        if (okBtn) okBtn.onclick = () => { if (this._confirmResolver) this._confirmResolver(true); };
        if (cancelBtn) cancelBtn.onclick = () => { if (this._confirmResolver) this._confirmResolver(false); };
        this.openSheet('sheetConfirm');
      });
    },

    openSheet(id) {
      const s = document.getElementById(id);
      if (s) s.classList.add('open');
    },
    closeSheet(id) {
      const s = document.getElementById(id);
      if (s) s.classList.remove('open');
      // Si se cierra el sheet de confirmación por backdrop/X, resolver false
      if (id === 'sheetConfirm' && this._confirmResolver) {
        this._confirmResolver(false);
      }
      // Reset del flag de selección si se cierra el sheet de listas
      if (id === 'sheetPlaylists') {
        this._selectPlaylistForAdd = false;
        this._trackToAddId = null;
      }
      // Si se cierra el sheet de creación, limpiar modo "add"
      if (id === 'sheetCreatePlaylist') {
        this._addingToPlaylistId = null;
      }
      // Si se cierra el sheet de edición, limpiar editing
      if (id === 'sheetEditPlaylist') {
        this._editingPlaylistId = null;
      }
    },

    /* ============================================================
     *  Cambio de vista (player ↔ lyrics)
     * ============================================================ */
    showView(name) {
      const views = document.querySelectorAll('.view');
      views.forEach(v => {
        const isActive = v.dataset.view === name;
        if (isActive) v.classList.add('active');
        else v.classList.remove('active');
      });
    },

    /* ============================================================
     *  Media Session API
     * ============================================================ */
    updateMediaSession() {
      if (!('mediaSession' in navigator) || !this.currentTrack) return;
      const t = this.currentTrack;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: t.title,
          artist: t.artist,
          album: t.album,
          artwork: [
            { src: this.canvasToUrl(t, 96),   sizes: '96x96',   type: 'image/png' },
            { src: this.canvasToUrl(t, 256),  sizes: '256x256', type: 'image/png' },
            { src: this.canvasToUrl(t, 512),  sizes: '512x512', type: 'image/png' }
          ]
        });
        navigator.mediaSession.setActionHandler('play', () => this.togglePlay(true));
        navigator.mediaSession.setActionHandler('pause', () => this.togglePlay(false));
        navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
        navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
        navigator.mediaSession.setActionHandler('seekto', (d) => {
          if (d.seekTime != null) { this.audio.currentTime = d.seekTime; this.updateProgress(); }
        });
      } catch (e) {}
    },

    canvasToUrl(track, size) {
      // Si la portada ya es una imagen (dataURL), usarla directamente
      const isImage = track.coverIsImage || (typeof track.cover === 'string' && track.cover.startsWith('data:'));
      if (isImage) {
        return typeof track.cover === 'string' ? track.cover : '';
      }
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      const cover = (typeof track.cover === 'object' && track.cover.from) ? track.cover : { from: '#7C3AED', to: '#EC4899' };
      const g = ctx.createLinearGradient(0,0,size,size);
      g.addColorStop(0, cover.from);
      g.addColorStop(1, cover.to);
      ctx.fillStyle = g; ctx.fillRect(0,0,size,size);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `900 ${size*0.45}px 'Space Grotesk', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(track.title.charAt(0).toUpperCase(), size/2, size/2);
      return c.toDataURL('image/png');
    },

    /* ============================================================
     *  Wake Lock (mantener pantalla encendida)
     * ============================================================ */
    async requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          this.wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (e) {}
    },
    async releaseWakeLock() {
      if (this.wakeLock) {
        try { await this.wakeLock.release(); this.wakeLock = null; } catch(e) {}
      }
    },

    /* ============================================================
     *  Sleep timer
     * ============================================================ */
    startSleep(minutes) {
      this.cancelSleep();
      this.sleepEndAt = Date.now() + minutes * 60 * 1000;
      this.sleepTimer = setTimeout(() => {
        this.togglePlay(false);
        this.sleepEndAt = null;
        this.toast(this.t('toast_sleep_done'));
        this.updateSleepStatus();
      }, minutes * 60 * 1000);
      this.updateSleepStatus();
      this.toast(this.t('toast_sleep_started').replace('X', minutes));
    },
    cancelSleep() {
      if (this.sleepTimer) { clearTimeout(this.sleepTimer); this.sleepTimer = null; }
      this.sleepEndAt = null;
      this.updateSleepStatus();
    },
    updateSleepStatus() {
      const el = document.getElementById('sleepStatus');
      if (!el) return;
      if (this.sleepEndAt) {
        const ms = this.sleepEndAt - Date.now();
        const m = Math.floor(ms / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        el.textContent = `${this.t('sleep_active_prefix')} ${m}:${String(s).padStart(2,'0')} ${this.t('sleep_remaining')}`;
      } else {
        el.textContent = '';
      }
    },

    /* ============================================================
     *  Toast
     * ============================================================ */
    toast(msg, ms = 2400) {
      const t = document.getElementById('toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => t.classList.remove('show'), ms);
    },

    esc(s) {
      return String(s).replace(/[&<>"']/g, m => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      }[m]));
    },
});
