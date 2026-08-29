/* =====================================================================
 *  js/nav.js — Aurora Music Player
 *  Mini-player · Inicio · pestañas de biblioteca · menú de pista
 * ===================================================================== */

'use strict';

Object.assign(App, {

    /* ============================================================
     *  Chrome: nav inferior + mini-player
     * ============================================================ */
    updateChrome() {
      const screen = document.getElementById('deviceScreen');
      if (!screen) return;
      const lyrics = !!(document.getElementById('viewLyrics') && document.getElementById('viewLyrics').classList.contains('active'));
      const player = !!(document.getElementById('viewPlayer') && document.getElementById('viewPlayer').classList.contains('active'));
      const sheets = Array.from(document.querySelectorAll('.sheet.open')).filter(s => s.id !== 'sheetConfirm');
      const wide = document.documentElement.classList.contains('aurora-wide');
      const showMini = !wide && !!(this.currentTrack) && !lyrics && (!player || sheets.length > 0);
      screen.classList.toggle('has-mini', showMini);
      screen.classList.toggle('chrome-hidden', lyrics);
      this.updateMiniPlayer();
    },

    updateMiniPlayer() {
      const bar = document.getElementById('miniPlayer');
      if (!bar) return;
      const t = this.currentTrack;
      if (!t) {
        bar.classList.add('is-empty');
        const title = document.getElementById('miniPlayerTitle');
        const artist = document.getElementById('miniPlayerArtist');
        if (title) title.textContent = this.t('load_track_to_start');
        if (artist) artist.textContent = '';
        return;
      }
      bar.classList.remove('is-empty');
      const title = document.getElementById('miniPlayerTitle');
      const artist = document.getElementById('miniPlayerArtist');
      if (title) title.textContent = t.title || '—';
      if (artist) artist.textContent = t.artist || this.t('unknown_artist');
      const cv = document.getElementById('miniPlayerCover');
      if (cv) this.drawRowCover(cv, t);
      const play = document.getElementById('miniPlayerPlay');
      if (play) {
        const ip = play.querySelector('.icon-play');
        const ips = play.querySelector('.icon-pause');
        if (this.isPlaying) {
          if (ip) ip.style.display = 'none';
          if (ips) ips.style.display = 'block';
          play.setAttribute('aria-label', this.t('pause'));
        } else {
          if (ip) ip.style.display = 'block';
          if (ips) ips.style.display = 'none';
          play.setAttribute('aria-label', this.t('play'));
        }
      }
      this._syncMiniMarquee();
    },

    _syncMiniMarquee() {
      const el = document.getElementById('miniPlayerTitle');
      if (!el) return;
      el.classList.toggle('marquee', el.scrollWidth > el.clientWidth + 4);
    },

    openNowPlaying() {
      this.closeAllSheets();
      this.showView('player');
      if (this.currentTrack) this.hideEmptyState();
      else this.showEmptyState();
      this.updateChrome();
    },

    setNavActive(nav) {
      document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.nav === nav);
      });
    },

    goNav(nav) {
      this.setNavActive(nav);
      if (nav === 'home') {
        this.closeAllSheets();
        this.showView('home');
        this.renderHome();
      } else if (nav === 'library') {
        this.closeAllSheets();
        this.openSheet('sheetLibrary');
        this.renderLibraryTabs();
      } else if (nav === 'favorites') {
        this.closeAllSheets();
        this.renderFavorites();
        this.openSheet('sheetFavorites');
      } else if (nav === 'search') {
        this.closeAllSheets();
        this.openSheet('sheetSearch');
        const inp = document.getElementById('searchInput');
        this.runSearch(inp ? inp.value : '', this._searchFilter || 'all');
        setTimeout(() => {
          if (inp) inp.focus();
        }, 350);
      }
      this.updateChrome();
    },

    /* ============================================================
     *  Inicio (hub)
     * ============================================================ */
    renderHome() {
      const root = document.getElementById('homeContent');
      if (!root) return;
      const homeView = document.getElementById('viewHome');
      if (homeView) homeView.classList.toggle('is-empty', !this.tracks.length);
      if (!this.tracks.length) {
        root.innerHTML = `
          <div class="home-welcome">
            <div class="home-welcome-aurora" aria-hidden="true">
              <span class="hw-orb hw-orb-a"></span>
              <span class="hw-orb hw-orb-b"></span>
              <span class="hw-orb hw-orb-c"></span>
            </div>
            <div class="home-welcome-mark">
              <img src="icon.png" alt="" width="88" height="88">
            </div>
            <p class="home-welcome-brand">Aurora</p>
            <h2>${this.esc(this.t('home_welcome_title'))}</h2>
            <p class="home-welcome-lead">${this.esc(this.t('home_welcome_lead'))}</p>
            <button class="primary-btn home-welcome-cta" id="btnHomeLoad" type="button">
              <i class="fa-solid fa-plus"></i>
              <span>${this.esc(this.t('load_music'))}</span>
            </button>
            <ul class="home-welcome-formats" aria-label="${this.esc(this.t('empty_format_hint'))}">
              <li>MP3</li><li>FLAC</li><li>M4A</li><li>WAV</li><li>OGG</li>
            </ul>
            <div class="home-welcome-perks">
              <div><i class="fa-solid fa-align-left" aria-hidden="true"></i><span>${this.esc(this.t('home_perk_lyrics'))}</span></div>
              <div><i class="fa-solid fa-list-ul" aria-hidden="true"></i><span>${this.esc(this.t('home_perk_playlists'))}</span></div>
              <div><i class="fa-solid fa-lock" aria-hidden="true"></i><span>${this.esc(this.t('home_perk_offline'))}</span></div>
            </div>
          </div>`;
        const btn = document.getElementById('btnHomeLoad');
        if (btn) btn.addEventListener('click', () => this.openFilePicker());
        return;
      }

      const t = this.currentTrack;
      let hero = '';
      if (t) {
        hero = `
          <button class="home-hero" id="homeHero" type="button">
            <div class="home-hero-cover"><canvas id="homeHeroCanvas" width="160" height="160"></canvas></div>
            <div class="home-hero-text">
              <span class="home-kicker">${this.esc(this.t('home_continue'))}</span>
              <strong>${this.esc(t.title)}</strong>
              <span>${this.esc(t.artist || this.t('unknown_artist'))}</span>
            </div>
            <i class="fa-solid fa-chevron-right home-hero-chevron"></i>
          </button>`;
      }

      const recent = this.getRecentlyAdded(12);
      const top = this.getTopTracks(8).map(x => x.track).filter(Boolean);
      const lists = this.playlists.slice(0, 8);

      root.innerHTML = hero +
        this._homeRail('homeRecent', this.t('home_recent'), recent, 'track') +
        this._homePlaylists(lists) +
        this._homeRail('homeTop', this.t('home_top'), top, 'track');

      if (t) {
        const cv = document.getElementById('homeHeroCanvas');
        if (cv) this.drawRowCover(cv, t);
        const heroEl = document.getElementById('homeHero');
        if (heroEl) heroEl.addEventListener('click', () => this.openNowPlaying());
      }
      this._bindHomeRails();
    },

    _homeRail(id, title, tracks, kind) {
      if (!tracks || !tracks.length) return '';
      const items = tracks.map(t => {
        if (!t) return '';
        return `<button class="home-card" type="button" data-kind="${kind}" data-id="${this.esc(t.id)}">
          <div class="home-card-cover"><canvas width="120" height="120"></canvas></div>
          <span class="home-card-title">${this.esc(t.title)}</span>
          <span class="home-card-sub">${this.esc(t.artist || '')}</span>
        </button>`;
      }).join('');
      return `<section class="home-section">
        <h3 class="home-section-title">${this.esc(title)}</h3>
        <div class="home-rail" id="${id}">${items}</div>
      </section>`;
    },

    _homePlaylists(lists) {
      if (!lists || !lists.length) return '';
      const items = lists.map(pl => {
        const n = (pl.trackIds || []).length;
        return `<button class="home-card" type="button" data-kind="playlist" data-id="${this.esc(pl.id)}">
          <div class="home-card-cover" data-pl="${this.esc(pl.id)}" data-pl-cover="${this.esc(pl.id)}"></div>
          <span class="home-card-title">${this.esc(pl.name)}</span>
          <span class="home-card-sub">${n} ${this.esc(this.t('tracks_count'))}</span>
        </button>`;
      }).join('');
      return `<section class="home-section">
        <h3 class="home-section-title">${this.esc(this.t('home_playlists'))}</h3>
        <div class="home-rail" id="homePlaylists">${items}</div>
      </section>`;
    },

    _bindHomeRails() {
      document.querySelectorAll('#homeContent .home-card').forEach(card => {
        const kind = card.dataset.kind;
        const id = card.dataset.id;
        if (kind === 'track') {
          const t = this.tracks.find(x => x.id === id);
          const cv = card.querySelector('canvas');
          if (cv && t) this.drawRowCover(cv, t);
          card.addEventListener('click', () => {
            this.playTrack(id, { type: 'all' });
            this.updateChrome();
          });
          this.wireTrackLongPress(card, id);
        } else if (kind === 'playlist') {
          const pl = this.playlists.find(p => p.id === id);
          const coverEl = card.querySelector('[data-pl]');
          if (coverEl && pl) {
            const cover = this.getPlaylistCover(pl);
            if (typeof cover === 'string' && cover.startsWith('data:')) {
              coverEl.style.backgroundImage = 'url(' + cover + ')';
              coverEl.style.backgroundSize = 'cover';
            } else {
              const from = (cover && cover.from) || ((this.coverFallback && this.coverFallback().from) || '#6E5CFF');
              const to = (cover && cover.to) || ((this.coverFallback && this.coverFallback().to) || '#FF7AB6');
              coverEl.style.background = 'linear-gradient(135deg,' + from + ',' + to + ')';
            }
          }
          card.addEventListener('click', () => this.openEditPlaylist(id));
        }
      });
    },

    getRecentlyAdded(n) {
      const arr = this.tracks.slice().sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      if (arr.every(t => !t.addedAt)) return this.tracks.slice().reverse().slice(0, n);
      return arr.slice(0, n);
    },

    /* ============================================================
     *  Biblioteca con pestañas
     * ============================================================ */
    renderLibraryTabs() {
      const tab = this._libraryTab || 'songs';
      document.querySelectorAll('.lib-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
      });
      const sortRow = document.getElementById('libSortRow');
      if (sortRow) sortRow.style.display = tab === 'songs' ? '' : 'none';
      const btnNew = document.getElementById('btnOpenNewPlaylist');
      const btnDel = document.getElementById('btnDeleteAllTracks');
      if (btnNew) btnNew.style.display = tab === 'playlists' ? '' : 'none';
      if (btnDel) btnDel.style.display = tab === 'songs' ? '' : 'none';
      const songs = document.getElementById('libPaneSongs');
      const albums = document.getElementById('libPaneAlbums');
      const artists = document.getElementById('libPaneArtists');
      const lists = document.getElementById('libPanePlaylists');
      [songs, albums, artists, lists].forEach(p => { if (p) p.style.display = 'none'; });
      if (tab === 'songs') {
        if (songs) songs.style.display = '';
        this.renderLibrary();
      } else if (tab === 'albums') {
        if (albums) albums.style.display = '';
        this.renderAlbumGrid();
      } else if (tab === 'artists') {
        if (artists) artists.style.display = '';
        this.renderArtistList();
      } else {
        if (lists) lists.style.display = '';
        this.renderPlaylists();
      }
    },

    setLibraryTab(tab) {
      this._libraryTab = tab;
      this.renderLibraryTabs();
    },

    setLibrarySort(sort) {
      this._librarySort = sort;
      document.querySelectorAll('.lib-sort').forEach(b => {
        b.classList.toggle('active', b.dataset.sort === sort);
      });
      this.renderLibrary();
    },

    sortedTracks() {
      const sort = this._librarySort || 'title';
      const arr = this.tracks.slice();
      const coll = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });
      if (sort === 'artist') arr.sort((a, b) => coll(a.artist, b.artist) || coll(a.title, b.title));
      else if (sort === 'recent') {
        arr.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        if (arr.every(t => !t.addedAt)) arr.reverse();
      } else if (sort === 'duration') arr.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      else arr.sort((a, b) => coll(a.title, b.title));
      return arr;
    },

    albumKey(t) {
      const album = (t.album && !this.isPlaceholderAlbum(t.album)) ? t.album : this.t('no_album');
      const artist = (t.artist && !this.isPlaceholderArtist(t.artist)) ? t.artist : '';
      return album + '\0' + artist;
    },

    getAlbums() {
      const map = new Map();
      this.tracks.forEach(t => {
        const key = this.albumKey(t);
        if (!map.has(key)) {
          map.set(key, {
            key,
            name: (t.album && !this.isPlaceholderAlbum(t.album)) ? t.album : this.t('no_album'),
            artist: (t.artist && !this.isPlaceholderArtist(t.artist)) ? t.artist : this.t('unknown_artist'),
            tracks: []
          });
        }
        map.get(key).tracks.push(t);
      });
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    },

    getArtists() {
      const map = new Map();
      this.tracks.forEach(t => {
        const name = (t.artist && !this.isPlaceholderArtist(t.artist)) ? t.artist : this.t('unknown_artist');
        if (!map.has(name)) map.set(name, { name, tracks: [] });
        map.get(name).tracks.push(t);
      });
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    },

    renderAlbumGrid() {
      const ul = document.getElementById('libraryAlbums');
      if (!ul) return;
      ul.innerHTML = '';
      const albums = this.getAlbums();
      if (!albums.length) {
        ul.innerHTML = '<li class="track-row empty-placeholder">' + this.t('albums_empty') + '</li>';
        return;
      }
      albums.forEach(al => {
        const li = document.createElement('li');
        li.className = 'pl-card';
        const coverTrack = al.tracks.find(t => t.coverIsImage) || al.tracks[0];
        li.innerHTML = `
          <div class="pl-cover"><canvas width="200" height="200"></canvas></div>
          <div class="pl-card-info">
            <h4>${this.esc(al.name)}</h4>
            <p>${this.esc(al.artist)} · ${al.tracks.length} ${this.esc(this.t('tracks_count'))}</p>
          </div>`;
        li.addEventListener('click', () => this.openBrowse({
          type: 'album',
          title: al.name,
          subtitle: al.artist,
          artist: al.artist,
          tracks: al.tracks
        }));
        ul.appendChild(li);
        const cv = li.querySelector('canvas');
        if (cv && coverTrack) this.drawRowCover(cv, coverTrack);
      });
    },

    renderArtistList() {
      const ul = document.getElementById('libraryArtists');
      if (!ul) return;
      ul.innerHTML = '';
      const artists = this.getArtists();
      if (!artists.length) {
        ul.innerHTML = '<li class="track-row empty-placeholder">' + this.t('artists_empty') + '</li>';
        return;
      }
      artists.forEach(ar => {
        const li = document.createElement('li');
        li.className = 'artist-row';
        const coverTrack = ar.tracks.find(t => t.coverIsImage) || ar.tracks[0];
        const albums = new Set(ar.tracks.map(t => t.album).filter(a => a && !this.isPlaceholderAlbum(a)));
        li.innerHTML = `
          <div class="artist-avatar"><canvas width="64" height="64"></canvas></div>
          <div class="row-text">
            <div class="row-title">${this.esc(ar.name)}</div>
            <div class="row-sub">${ar.tracks.length} ${this.esc(this.t('tracks_count'))}${albums.size ? ' · ' + albums.size : ''}</div>
          </div>
          <i class="fa-solid fa-chevron-right row-chevron"></i>`;
        li.addEventListener('click', () => this.goToArtist(ar.name));
        ul.appendChild(li);
        const cv = li.querySelector('canvas');
        if (cv && coverTrack) this.drawRowCover(cv, coverTrack);
      });
    },

    /* ============================================================
     *  Vista Álbum / Artista
     * ============================================================ */
    openBrowse(opts) {
      this._browse = opts;
      const title = document.getElementById('browseTitle');
      const sub = document.getElementById('browseSubtitle');
      if (title) title.textContent = opts.title || '';
      if (sub) sub.textContent = opts.subtitle || ((opts.tracks || []).length + ' ' + this.t('tracks_count'));
      const coverEl = document.getElementById('browseCover');
      if (coverEl) {
        coverEl.innerHTML = '<canvas width="160" height="160"></canvas>';
        const seed = (opts.tracks || []).find(t => t.coverIsImage) || (opts.tracks || [])[0];
        const cv = coverEl.querySelector('canvas');
        if (cv && seed) this.drawRowCover(cv, seed);
      }
      this.renderBrowseTracks();
      this.openSheet('sheetBrowse');
    },

    renderBrowseTracks() {
      const ul = document.getElementById('browseTracks');
      if (!ul || !this._browse) return;
      ul.innerHTML = '';
      const tracks = this._browse.tracks || [];
      const ctx = this._browse.type === 'album'
        ? { type: 'album', name: this._browse.title, artist: this._browse.artist || this._browse.subtitle }
        : { type: 'artist', name: this._browse.title };
      tracks.forEach(t => ul.appendChild(this.makeTrackRow(t, { playContext: ctx })));
    },

    playBrowse() {
      if (!this._browse || !this._browse.tracks || !this._browse.tracks.length) {
        this.toast(this.t('toast_playlist_empty'));
        return;
      }
      const ids = this._browse.tracks.map(t => t.id);
      this.queue = ids;
      this.queueIdx = 0;
      this.playContext = this._browse.type === 'album'
        ? { type: 'album', name: this._browse.title, artist: this._browse.artist || this._browse.subtitle }
        : { type: 'artist', name: this._browse.title };
      this.playFromQueue(0);
      this.updateChrome();
    },

    goToArtist(name) {
      if (!name || this.isPlaceholderArtist(name)) {
        this.toast(this.t('unknown_artist'));
        return;
      }
      const tracks = this.tracks.filter(t => t.artist === name);
      this.closeSheet('sheetMore');
      this.closeSheet('sheetTrackMenu');
      this.closeSheet('sheetSearch');
      this.openBrowse({ type: 'artist', title: name, tracks });
    },

    goToAlbum(album, artist) {
      if (!album || this.isPlaceholderAlbum(album)) {
        this.toast(this.t('no_album'));
        return;
      }
      const tracks = this.tracks.filter(t => t.album === album && (!artist || t.artist === artist));
      this.closeSheet('sheetMore');
      this.closeSheet('sheetTrackMenu');
      this.openBrowse({
        type: 'album',
        title: album,
        subtitle: artist || '',
        tracks
      });
    },

    /* ============================================================
     *  Fila de pista + menú contextual
     * ============================================================ */
    makeTrackRow(t, opts) {
      opts = opts || {};
      const li = document.createElement('li');
      const isCurrent = this.currentTrack && this.currentTrack.id === t.id;
      li.className = 'track-row' + (isCurrent ? ' current' : '');
      li.dataset.track = t.id;
      li.innerHTML = `
        <div class="row-cover"><canvas width="44" height="44"></canvas></div>
        <div class="row-text">
          <div class="row-title">${this.esc(t.title)}</div>
          <div class="row-sub">${this.esc(t.artist)}${t.album && !this.isPlaceholderAlbum(t.album) ? ' · ' + this.esc(t.album) : ''}</div>
        </div>
        <div class="row-duration">${this.fmtTime(t.duration)}</div>
        <button class="row-action track-menu-btn" type="button" aria-label="${this.esc(this.t('more_options'))}"><i class="fa-solid fa-ellipsis-vertical"></i></button>`;
      const ctx = opts.playContext || { type: 'all' };
      li.addEventListener('click', (e) => {
        if (e.target.closest('.track-menu-btn')) return;
        this.playTrack(t.id, ctx);
        this.updateChrome();
      });
      const menuBtn = li.querySelector('.track-menu-btn');
      if (menuBtn) menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openTrackMenu(t.id);
      });
      this.wireTrackLongPress(li, t.id);
      const cv = li.querySelector('canvas');
      if (cv) this.drawRowCover(cv, t);
      return li;
    },

    wireTrackLongPress(el, trackId) {
      let timer = null;
      let fired = false;
      const start = (e) => {
        if (e.target && e.target.closest && e.target.closest('.track-menu-btn, .row-action')) return;
        fired = false;
        timer = setTimeout(() => {
          timer = null;
          fired = true;
          this.openTrackMenu(trackId);
          if (navigator.vibrate) navigator.vibrate(20);
        }, 520);
      };
      const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
      el.addEventListener('touchstart', start, { passive: true });
      el.addEventListener('touchend', cancel);
      el.addEventListener('touchmove', cancel, { passive: true });
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', cancel);
      el.addEventListener('mouseleave', cancel);
      el.addEventListener('click', (e) => {
        if (!fired) return;
        fired = false;
        e.preventDefault();
        e.stopPropagation();
      }, true);
    },

    openTrackMenu(trackId) {
      const t = this.tracks.find(x => x.id === trackId);
      if (!t) return;
      this._menuTrackId = trackId;
      const title = document.getElementById('trackMenuTitle');
      const sub = document.getElementById('trackMenuSub');
      if (title) title.textContent = t.title;
      if (sub) sub.textContent = (t.artist || '') + (t.album && !this.isPlaceholderAlbum(t.album) ? ' · ' + t.album : '');
      const cv = document.getElementById('trackMenuCover');
      if (cv) this.drawRowCover(cv, t);
      const goAlbum = document.getElementById('ctxGoAlbum');
      if (goAlbum) goAlbum.style.display = (t.album && !this.isPlaceholderAlbum(t.album)) ? '' : 'none';
      const goArtist = document.getElementById('ctxGoArtist');
      if (goArtist) goArtist.style.display = (t.artist && !this.isPlaceholderArtist(t.artist)) ? '' : 'none';
      this.openSheet('sheetTrackMenu');
    },

    menuTrack() {
      return this.tracks.find(x => x.id === this._menuTrackId) || null;
    },

    /* ============================================================
     *  Editar etiquetas
     * ============================================================ */
    openEditTrack(trackId) {
      const t = this.tracks.find(x => x.id === trackId);
      if (!t) return;
      this._editTrackId = trackId;
      const title = document.getElementById('editTrackTitle');
      const artist = document.getElementById('editTrackArtist');
      const album = document.getElementById('editTrackAlbum');
      if (title) title.value = t.title || '';
      if (artist) artist.value = this.isPlaceholderArtist(t.artist) ? '' : (t.artist || '');
      if (album) album.value = this.isPlaceholderAlbum(t.album) ? '' : (t.album || '');
      this.openSheet('sheetEditTrack');
    },

    async saveEditTrack() {
      const t = this.tracks.find(x => x.id === this._editTrackId);
      if (!t) return;
      const title = (document.getElementById('editTrackTitle') || {}).value || '';
      const artist = (document.getElementById('editTrackArtist') || {}).value || '';
      const album = (document.getElementById('editTrackAlbum') || {}).value || '';
      t.title = title.trim() || t.title;
      t.artist = artist.trim() || this.t('unknown_artist');
      t.album = album.trim() || this.t('no_album');
      await this.persistTrack(t);
      this.closeSheet('sheetEditTrack');
      this.closeSheet('sheetTrackMenu');
      this.renderLibrary();
      this.renderPlaylists();
      this.renderQueue();
      this.renderFavorites();
      this.renderHome();
      if (this.currentTrack && this.currentTrack.id === t.id) this.renderCurrentTrack();
      if (this._browse) this.renderBrowseTracks();
      this.updateMiniPlayer();
      this.toast(this.t('edit_track_saved'));
    }
});
