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
            <li class="stats-row" data-artist="${this.esc(a.artist)}">
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

      const resetDiv = document.createElement('div');
      resetDiv.className = 'stats-reset-wrap';
      resetDiv.innerHTML = `
        <button class="primary-btn compact ghost danger" id="btnResetStats"><svg class="ico" aria-hidden="true"><use href="#i-trash-can"></use></svg> ${this.esc(this.t('stats_reset_btn'))}</button>
      `;
      cont.appendChild(resetDiv);
      const btnRS = document.getElementById('btnResetStats');
      if (btnRS) btnRS.addEventListener('click', async () => {
        if (await this.showConfirm({ message: this.t('stats_reset_confirm'), danger: false })) this.resetStats();
      });

      // Dibujar covers
      cont.querySelectorAll('.stats-row').forEach((row, i) => {
        const artist = row.dataset.artist;
        if (artist) {
          row.addEventListener('click', () => {
            if (typeof this.goToArtist === 'function') this.goToArtist(artist);
          });
          return;
        }
        const tid = row.dataset.track;
        if (!tid) return;
        const track = this.tracks.find(t => t.id === tid);
        if (track) {
          const cv = row.querySelector('canvas');
          if (cv) this.drawRowCover(cv, track);
        }
        row.addEventListener('click', () => {
          if (tid) this.playTrack(tid);
        });
      });
    },

    runSearch(q, filter) {
      const ul = document.getElementById('searchResults');
      if (!ul) return;
      if (typeof this.unbindVirtualList === 'function') this.unbindVirtualList(ul);
      ul.innerHTML = '';
      if (!q || q.trim().length === 0) {
        this.renderSearchHistory(ul);
        return;
      }
      const ql = q.toLowerCase();
      const f = filter || 'all';
      const matchTrack = (t) => {
        if (f === 'title') return (t.title || '').toLowerCase().includes(ql);
        if (f === 'artist') return (t.artist || '').toLowerCase().includes(ql);
        if (f === 'album') return t.album && t.album.toLowerCase().includes(ql);
        return (t.title || '').toLowerCase().includes(ql) ||
               (t.artist || '').toLowerCase().includes(ql) ||
               (t.album && t.album.toLowerCase().includes(ql));
      };
      if (f === 'all') {
        const artists = (typeof this.getArtists === 'function' ? this.getArtists() : [])
          .filter(a => a.name.toLowerCase().includes(ql)).slice(0, 8);
        const albums = (typeof this.getAlbums === 'function' ? this.getAlbums() : [])
          .filter(a => a.name.toLowerCase().includes(ql) || (a.artist || '').toLowerCase().includes(ql)).slice(0, 8);
        const songs = this.tracks.filter(matchTrack);
        if (!artists.length && !albums.length && !songs.length) {
          ul.innerHTML = '<li class="track-row empty-placeholder">' + this.t('no_results') + '</li>';
          return;
        }
        const addTitle = (key) => {
          const li = document.createElement('li');
          li.className = 'search-section-title';
          li.textContent = this.t(key);
          ul.appendChild(li);
        };
        if (artists.length) {
          addTitle('search_section_artists');
          artists.forEach(ar => {
            const li = document.createElement('li');
            li.className = 'artist-row';
            li.innerHTML = `<div class="row-text"><div class="row-title">${this.esc(ar.name)}</div><div class="row-sub">${ar.tracks.length} ${this.esc(this.t('tracks_count'))}</div></div><svg class="ico row-chevron" aria-hidden="true"><use href="#i-chevron-right"></use></svg>`;
            li.addEventListener('click', () => this.goToArtist(ar.name));
            ul.appendChild(li);
          });
        }
        if (albums.length) {
          addTitle('search_section_albums');
          albums.forEach(al => {
            const li = document.createElement('li');
            li.className = 'artist-row';
            li.innerHTML = `<div class="row-text"><div class="row-title">${this.esc(al.name)}</div><div class="row-sub">${this.esc(al.artist)} · ${al.tracks.length} ${this.esc(this.t('tracks_count'))}</div></div><svg class="ico row-chevron" aria-hidden="true"><use href="#i-chevron-right"></use></svg>`;
            li.addEventListener('click', () => this.goToAlbum(al.name, al.artist));
            ul.appendChild(li);
          });
        }
        if (songs.length) {
          addTitle('search_section_songs');
          if (songs.length > 80 && typeof this.fillVirtualList === 'function') {
            const rest = document.createElement('ul');
            rest.className = 'track-list';
            rest.id = 'searchResultsSongs';
            const wrap = document.createElement('li');
            wrap.style.listStyle = 'none';
            wrap.appendChild(rest);
            ul.appendChild(wrap);
            this.fillVirtualList(rest, songs, (tr) => this.makeTrackRow(tr, { playContext: { type: 'all' } }), {
              scroller: ul.closest('.sheet-body'),
              rowHeight: 64
            });
          } else {
            songs.forEach(tr => ul.appendChild(this.makeTrackRow(tr, { playContext: { type: 'all' } })));
          }
        }
        return;
      }
      const res = this.tracks.filter(matchTrack);
      if (res.length === 0) {
        ul.innerHTML = '<li class="track-row empty-placeholder">' + this.t('no_results') + '</li>';
        return;
      }
      if (typeof this.fillVirtualList === 'function') {
        this.fillVirtualList(ul, res, (tr) => this.makeTrackRow(tr, { playContext: { type: 'all' } }), {
          scroller: ul.closest('.sheet-body'),
          rowHeight: 64
        });
      } else {
        res.forEach(tr => ul.appendChild(this.makeTrackRow(tr, { playContext: { type: 'all' } })));
      }
    },

    renderSearchHistory(ul) {
      const hist = Array.isArray(this._searchHistory) ? this._searchHistory : [];
      if (!hist.length) {
        ul.innerHTML = '<li class="track-row empty-placeholder">' + this.t('search_placeholder') + '</li>';
        return;
      }
      const title = document.createElement('li');
      title.className = 'search-section-title';
      title.textContent = this.t('search_recent');
      ul.appendChild(title);
      hist.forEach(q => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'search-history-row';
        btn.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-clock-rotate-left"></use></svg><span>' + this.esc(q) + '</span>';
        btn.addEventListener('click', () => {
          const inp = document.getElementById('searchInput');
          if (inp) inp.value = q;
          this.runSearch(q, this._searchFilter || 'all');
        });
        li.appendChild(btn);
        ul.appendChild(li);
      });
      const clear = document.createElement('li');
      const cbtn = document.createElement('button');
      cbtn.type = 'button';
      cbtn.className = 'search-history-row';
      cbtn.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-xmark"></use></svg><span>' + this.esc(this.t('search_clear_history')) + '</span>';
      cbtn.addEventListener('click', () => {
        this.clearSearchHistory();
        this.runSearch('', this._searchFilter || 'all');
      });
      clear.appendChild(cbtn);
      ul.appendChild(clear);
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
      favTracks.forEach((t) => {
        if (typeof this.makeTrackRow === 'function') {
          ul.appendChild(this.makeTrackRow(t, { playContext: { type: 'favorites' } }));
        }
      });
    }
});
