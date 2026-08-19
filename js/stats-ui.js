/* =====================================================================
 *  js/stats-ui.js — Aurora Music Player
 *  Render de estadísticas y favoritos
 *
 *  Parte del refactor (C) de app.js: mismo código, módulos por funcionalidad.
 *  Este archivo se carga tras js/state.js y completa el objeto App con
 *  Object.assign (los scripts son clásicos por compatibilidad webxdc).
 * ===================================================================== */

'use strict';

Object.assign(App, {
    /* ============================================================
     *  Render de la pantalla de Estadísticas (#13)
     * ============================================================ */
    renderStats() {
      const cont = document.getElementById('statsContent');
      if (!cont) return;
      const topTracks = this.getTopTracks(10);
      const topArtists = this.getTopArtists(5);
      const totalPlays = Object.values(this.stats.plays).reduce((a, b) => a + b, 0);
      const totalSec = this.stats.totalSeconds;

      cont.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${totalPlays}</div>
            <div class="stat-label">${this.t('stats_plays')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${this.fmtDuration(totalSec)}</div>
            <div class="stat-label">${this.t('stats_listening_time')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${this.tracks.length}</div>
            <div class="stat-label">${this.t('all_tracks_section')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${topArtists.length}</div>
            <div class="stat-label">${this.t('menu_go_to_artist')}</div>
          </div>
        </div>

        <h4 class="section-title">${this.t('stats_top_artists')}</h4>
        ${topArtists.length === 0 ? '<p class="stats-empty">' + this.t('no_results') + '</p>' : ''}
        <ul class="stats-list">
          ${topArtists.map((a, i) => `
            <li class="stats-row">
              <div class="stats-rank">${i + 1}</div>
              <div class="stats-info">
                <div class="stats-name">${this.esc(a.artist)}</div>
                <div class="stats-sub">${a.count} ${this.t('stats_plays').toLowerCase()}</div>
              </div>
            </li>
          `).join('')}
        </ul>

        <h4 class="section-title">${this.t('stats_top_tracks')}</h4>
        ${topTracks.length === 0 ? '<p class="stats-empty">' + this.t('no_results') + '</p>' : ''}
        <ul class="stats-list">
          ${topTracks.map((t, i) => `
            <li class="stats-row" data-track="${t.track.id}">
              <div class="stats-rank">${i + 1}</div>
              <div class="row-cover"><canvas width="40" height="40"></canvas></div>
              <div class="stats-info">
                <div class="stats-name">${this.esc(t.track.title)}</div>
                <div class="stats-sub">${this.esc(t.track.artist)} · ${t.count} ${this.t('stats_plays').toLowerCase()}</div>
              </div>
            </li>
          `).join('')}
        </ul>
      `;

      // Botones de reinicio
      const resetDiv = document.createElement('div');
      resetDiv.style.cssText = 'display:flex;gap:8px;margin-top:20px;justify-content:center;';
      resetDiv.innerHTML = `
        <button class="primary-btn compact ghost danger" id="btnResetStats"><i class="fa-solid fa-trash-can"></i> Reiniciar estadísticas</button>
        <button class="primary-btn compact ghost danger" id="btnResetHistory"><i class="fa-solid fa-trash-can"></i> Reiniciar historial</button>
      `;
      cont.appendChild(resetDiv);
      const btnRS = document.getElementById('btnResetStats');
        if (btnRS) btnRS.addEventListener('click', async () => {
          if (await this.showConfirm({ message: this.t('stats_reset_confirm'), danger: false })) this.resetStats();
        });
        const btnRH = document.getElementById('btnResetHistory');
        if (btnRH) btnRH.addEventListener('click', async () => {
          if (await this.showConfirm({ message: this.t('history_reset_confirm'), danger: false })) this.resetHistory();
        });

      // Dibujar covers
      cont.querySelectorAll('.stats-row').forEach((row, i) => {
        const tid = row.dataset.track;
        if (!tid) return;
        const track = this.tracks.find(t => t.id === tid);
        if (track) {
          const cv = row.querySelector('canvas');
          if (cv) this.drawRowCover(cv, track);
        }
        row.addEventListener('click', () => {
          if (tid) {
            this.playTrack(tid);
            this.closeSheet('sheetStats');
          }
        });
      });
    },

    runSearch(q, filter) {
      const ul = document.getElementById('searchResults');
      if (!ul) return;
      ul.innerHTML = '';
      if (!q || q.trim().length === 0) {
        ul.innerHTML = '<li class="track-row" style="justify-content:center;color:var(--text-3);font-size:13px">' + this.t('search_placeholder') + '</li>';
        return;
      }
      const ql = q.toLowerCase();
      const f = filter || 'all';
      const res = this.tracks.filter(t => {
        if (f === 'title') return t.title.toLowerCase().includes(ql);
        if (f === 'artist') return t.artist.toLowerCase().includes(ql);
        if (f === 'album') return t.album && t.album.toLowerCase().includes(ql);
        return t.title.toLowerCase().includes(ql) ||
               t.artist.toLowerCase().includes(ql) ||
               (t.album && t.album.toLowerCase().includes(ql));
      });
      if (res.length === 0) {
        ul.innerHTML = '<li class="track-row" style="justify-content:center;color:var(--text-3);font-size:13px">' + this.t('no_results') + '</li>';
        return;
      }
      res.forEach(t => {
        const li = document.createElement('li');
        li.className = 'track-row';
        li.innerHTML = `
          <div class="row-cover"><canvas width="44" height="44"></canvas></div>
          <div class="row-text">
            <div class="row-title">${this.esc(t.title)}</div>
            <div class="row-sub">${this.esc(t.artist)}${t.album && t.album !== this.t('no_album') ? ' · ' + this.esc(t.album) : ''}</div>
          </div>
          <div class="row-duration">${this.fmtTime(t.duration)}</div>
        `;
        li.addEventListener('click', () => {
          this.playTrack(t.id, { type: 'all' });
          this.closeSheet('sheetSearch');
        });
        ul.appendChild(li);
        const cv = li.querySelector('canvas');
        if (cv) this.drawRowCover(cv, t);
      });
    },

    /* ============================================================
     *  Render de la lista de Favoritos
     * ============================================================ */
    renderFavorites() {
      const ul = document.getElementById('favoritesList');
      if (!ul) return;
      const countEl = document.getElementById('favoritesCount');
      ul.innerHTML = '';
      const favTracks = this.tracks.filter(t => this.favorites.has(t.id));
      if (countEl) {
        const n = favTracks.length;
        countEl.textContent = n === 0
          ? this.t('favorites_count_zero')
          : (n === 1 ? this.t('favorites_count_one') : this.t('favorites_count_many').replace('X', n));
      }
      if (favTracks.length === 0) {
        ul.innerHTML = '<li class="track-row" style="justify-content:center;color:var(--text-3);font-size:13px;padding:24px">' + this.t('toast_no_favorites_yet') + '</li>';
        return;
      }
      // Para que pulsar una pista desde favoritos reproduzca TODA la lista
      // de favoritos (no solo la pista aislada), construimos el contexto.
      const favIds = favTracks.map(t => t.id);
      favTracks.forEach((t, idx) => {
        const li = document.createElement('li');
        li.className = 'track-row';
        li.innerHTML = `
          <div class="row-cover"><canvas width="44" height="44"></canvas></div>
          <div class="row-text">
            <div class="row-title">${this.esc(t.title)}</div>
            <div class="row-sub">${this.esc(t.artist)}${t.album && t.album !== this.t('no_album') ? ' · ' + this.esc(t.album) : ''}</div>
          </div>
          <div class="row-duration">${this.fmtTime(t.duration)}</div>
          <button class="row-action unfav-track" aria-label="${this.esc(this.t('toast_removed_fav'))}"><i class="fa-solid fa-heart"></i></button>
        `;
        li.addEventListener('click', (e) => {
          if (e.target.closest('.unfav-track')) return;
          // Reproducir desde favoritos: la cola = favoritos, empezar por esta pista
          this.queue = favIds.slice();
          this.queueIdx = idx;
          this.playContext = { type: 'favorites' };
          const tIdx = this.tracks.findIndex(x => x.id === t.id);
          if (tIdx >= 0) this.currentTrackIdx = tIdx;
          this.currentTrack = t;
          this.loadAndPlay();
          this.renderQueue();  // refrescar la cola con las pistas de favoritos
          this.closeSheet('sheetFavorites');
        });
        li.querySelector('.unfav-track').addEventListener('click', (e) => {
          e.stopPropagation();
          this.favorites.delete(t.id);
          this.saveFavorites();
          this.updateFavoriteUI();
          this.renderFavorites();
          this.toast(this.t('toast_removed_fav'));
        });
        ul.appendChild(li);
        const cv = li.querySelector('canvas');
        if (cv) this.drawRowCover(cv, t);
      });
    }
});
