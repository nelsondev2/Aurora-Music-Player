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
      const openSheets = Array.from(document.querySelectorAll('.sheet.open'));
      const wide = document.documentElement.classList.contains('aurora-wide');

      /* Hay un menú/modal si hay cualquier sheet abierta que no sea una pestaña persistente (Biblioteca, Buscar, Favoritos) */
      const hasModal = openSheets.some(s => !s.classList.contains('sheet-tab'));

      /* El mini reproductor:
       * - Solo en vistas de navegación general (Inicio, Biblioteca, Buscar, Favoritos)
       * - NUNCA en pantalla completa de Now Playing ni en Letras
       * - NUNCA cuando hay un menú, modal o diálogo de confirmación abierto
       * - Solo si hay una pista actual y no estamos en modo escritorio dividido */
      const showMini = !wide && !!this.currentTrack && !lyrics && !player && !hasModal;

      screen.classList.toggle('has-mini', showMini);
      screen.classList.toggle('has-overlay', !wide && hasModal);
      screen.classList.toggle('chrome-hidden', lyrics && !wide);
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
        const on = b.dataset.nav === nav;
        b.classList.toggle('active', on);
        // El lector de pantalla también debe saber dónde estás.
        if (on) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
    },

    goNav(nav) {
      /* El resaltado se aplica AL FINAL, no al principio: cerrar la
       * pestaña anterior dispara en closeSheet() el «volver a Inicio»,
       * y si la pestaña nueva ya se había marcado, ese reset la borraba
       * y el resaltado se quedaba en Inicio (reportado en dispositivo
       * al saltar entre Favoritos, Buscar y Biblioteca). */
      if (nav === 'home') {
        this.closeAllSheets();
        this.showView('home');
        this.renderHome();
      } else if (nav === 'library') {
        this.closeAllSheets();
        this.showView('home');
        this.openSheet('sheetLibrary');
        this.renderLibrarySections();
      } else if (nav === 'favorites') {
        this.closeAllSheets();
        this.showView('home');
        this.renderFavorites();
        this.openSheet('sheetFavorites');
      } else if (nav === 'search') {
        this.closeAllSheets();
        this.showView('home');
        this.openSheet('sheetSearch');
        const inp = document.getElementById('searchInput');
        this.runSearch(inp ? inp.value : '', this._searchFilter || 'all');
        setTimeout(() => {
          if (inp) inp.focus();
        }, 350);
      }
      this.setNavActive(nav);
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
        // Bienvenida de primer arranque. Sin wordmark «AURORA» bajo el
        // icono (el icono ya es la marca), con Ajustes a mano —la cabecera
        // de Inicio se oculta en este estado y dejaba la app sin ajustes
        // hasta cargar música— y perks informativos con descripción,
        // para que no parezcan botones que no hacen nada.
        root.innerHTML = `
          <div class="home-welcome">
            <div class="home-welcome-aurora" aria-hidden="true">
              <span class="hw-orb hw-orb-a"></span>
              <span class="hw-orb hw-orb-b"></span>
              <span class="hw-orb hw-orb-c"></span>
            </div>
            <button class="icon-btn home-welcome-settings" id="btnHomeWelcomeSettings" type="button" data-i18n-aria="settings_title" aria-label="${this.esc(this.t('settings_title'))}">
              <svg class="ico" aria-hidden="true"><use href="#i-gear"></use></svg>
            </button>
            <div class="home-welcome-mark">
              <img src="icon.png" alt="" width="88" height="88">
            </div>
            <h2>${this.esc(this.t('home_welcome_title'))}</h2>
            <p class="home-welcome-lead">${this.esc(this.t('home_welcome_lead'))}</p>
            <button class="primary-btn home-welcome-cta" id="btnHomeLoad" type="button">
              <svg class="ico" aria-hidden="true"><use href="#i-plus"></use></svg>
              <span>${this.esc(this.t('load_music'))}</span>
            </button>
            <ul class="home-welcome-formats" aria-label="${this.esc(this.t('empty_format_hint'))}">
              <li>MP3</li><li>FLAC</li><li>M4A</li><li>WAV</li><li>OGG</li><li>OPUS</li>
            </ul>
            <div class="home-welcome-perks">
              <div><svg class="ico" aria-hidden="true"><use href="#i-align-left"></use></svg><span class="hw-perk-text"><strong>${this.esc(this.t('home_perk_lyrics'))}</strong><small>${this.esc(this.t('home_perk_lyrics_desc'))}</small></span></div>
              <div><svg class="ico" aria-hidden="true"><use href="#i-list-ul"></use></svg><span class="hw-perk-text"><strong>${this.esc(this.t('home_perk_playlists'))}</strong><small>${this.esc(this.t('home_perk_playlists_desc'))}</small></span></div>
              <div><svg class="ico" aria-hidden="true"><use href="#i-lock"></use></svg><span class="hw-perk-text"><strong>${this.esc(this.t('home_perk_offline'))}</strong><small>${this.esc(this.t('home_perk_offline_desc'))}</small></span></div>
            </div>
          </div>`;
        const btn = document.getElementById('btnHomeLoad');
        if (btn) btn.addEventListener('click', () => this.openFilePicker());
        const btnSettings = document.getElementById('btnHomeWelcomeSettings');
        if (btnSettings) btnSettings.addEventListener('click', () => this.openSheet('sheetSettings'));
        return;
      }

      const t = this.currentTrack;
      let hero = '';
      if (t) {
        // La tarjeta «Continuar» es la misma pista que muestra el
        // mini-reproductor: para que aporte algo más que un duplicado,
        // si hay posición de reproducción enseña dónde retomar
        // («Retomar en 1:24»). Sin posición queda título y artista.
        const pos = (this.audio && this.audio.currentTime) || 0;
        const dur = (this.audio && this.audio.duration) || t.duration || 0;
        const resumeLine = (pos > 5 && (!dur || pos < dur - 2))
          ? `<span class="home-hero-resume">${this.esc(this.t('home_resume_at').replace('X', this.fmtTime(pos)))}</span>`
          : '';
        hero = `
          <button class="home-hero" id="homeHero" type="button">
            <div class="home-hero-cover"><canvas id="homeHeroCanvas" width="160" height="160"></canvas></div>
            <div class="home-hero-text">
              <span class="home-kicker">${this.esc(this.t('home_continue'))}</span>
              <strong>${this.esc(t.title)}</strong>
              <span>${this.esc(t.artist || this.t('unknown_artist'))}</span>
              ${resumeLine}
            </div>
            <svg class="ico home-hero-chevron" aria-hidden="true"><use href="#i-chevron-right"></use></svg>
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

    /* Cabecera de sección con «Ver todo»: lleva a Biblioteca, donde
     * viven la lista completa de canciones y la de listas. */
    _sectionHead(title) {
      return `<div class="home-section-head">
        <h3 class="home-section-title">${this.esc(title)}</h3>
        <button class="home-see-all" type="button" data-see-all="library">${this.esc(this.t('see_all'))}</button>
      </div>`;
    },

    _homeRail(id, title, tracks, kind) {
      if (!tracks || !tracks.length) return '';
      const curId = this.currentTrack && this.currentTrack.id;
      const items = tracks.map(t => {
        if (!t) return '';
        // La pista cargada se marca en su tarjeta: distintivo de
        // ecualizador sobre la portada (animado solo si está sonando).
        const isCur = t.id === curId;
        const nowBadge = isCur
          ? `<span class="eq-badge${this.isPlaying ? ' playing' : ''}" aria-hidden="true"><i></i><i></i><i></i></span>`
          : '';
        return `<button class="home-card${isCur ? ' is-current' : ''}" type="button" data-kind="${kind}" data-id="${this.esc(t.id)}">
          <div class="home-card-cover"><canvas width="120" height="120"></canvas>${nowBadge}</div>
          <span class="home-card-title">${this.esc(t.title)}</span>
          <span class="home-card-sub">${this.esc(t.artist || '')}</span>
        </button>`;
      }).join('');
      return `<section class="home-section">
        ${this._sectionHead(title)}
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
          <span class="home-card-sub">${this.esc(this.fmtTracksCount(n))}</span>
        </button>`;
      }).join('');
      return `<section class="home-section">
        ${this._sectionHead(this.t('home_playlists'))}
        <div class="home-rail" id="homePlaylists">${items}</div>
      </section>`;
    },

    _bindHomeRails() {
      // «Ver todo» de cada sección → Biblioteca.
      document.querySelectorAll('#homeContent [data-see-all]').forEach(btn => {
        btn.addEventListener('click', () => this.goNav(btn.dataset.seeAll));
      });
      document.querySelectorAll('#homeContent .home-card').forEach(card => {
        const kind = card.dataset.kind;
        const id = card.dataset.id;
        if (kind === 'track') {
          const t = this.tracks.find(x => x.id === id);
          const cv = card.querySelector('canvas');
          if (cv && t) this.drawRowCover(cv, t);
          card.addEventListener('click', () => {
            // Tarjeta suelta de Inicio: la lista de la canción manda
            // (mismo criterio que Buscar, §38), no «Todas» a secas.
            this.playTrack(id, typeof this.trackPlayContextFor === 'function' ? this.trackPlayContextFor(t) : { type: 'all' });
            this.updateChrome();
            if (typeof this.openPlayerForTrackPick === 'function') this.openPlayerForTrackPick();
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
     *  Biblioteca: solo listas de reproducción (§47). Antes había
     *  pestañas y después una sección «Todas las canciones» con su
     *  ordenación y su selección por lotes: todo eso se fue a
     *  petición del usuario. Álbumes y artistas siguen accesibles
     *  desde el menú de cada pista («Ir al artista» / «Ir al álbum»).
     * ============================================================ */
    renderLibrarySections() {
      this.renderPlaylists();
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

    /* ============================================================
     *  Vista Álbum / Artista
     * ============================================================ */
    openBrowse(opts) {
      this._browse = opts;
      const title = document.getElementById('browseTitle');
      const sub = document.getElementById('browseSubtitle');
      if (title) title.textContent = opts.title || '';
      if (sub) sub.textContent = opts.subtitle || this.fmtTracksCount((opts.tracks || []).length);
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
      // Igual que playPlaylist(): si shuffle está activo, barajar la cola nueva
      // anclando su primera pista (no la que sonaba antes); si no, limpiar la
      // cola original para no restaurar una lista ajena.
      if (this.shuffle) this._applyShuffle(ids[0]);
      else this._originalQueue = null;
      this.playFromQueue(0);
      this.updateChrome();
      this.renderQueue();
      if (typeof this.openPlayerForTrackPick === 'function') this.openPlayerForTrackPick();
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

    /* Duración para celdas de fila: si aún no se conocen los metadatos
     * (0/ausente) se deja la celda vacía. Mostrar «0:00» sugería que la
     * canción dura cero segundos, como se veía en las capturas. */
    fmtRowDuration(t) {
      const d = t && Number(t.duration);
      if (d > 0) return this.fmtTime(d);
      // Duración desconocida: un «—» muy tenue mantiene el ritmo de la
      // columna (dejar el hueco parecía un fallo de pintado). No se
      // inventa ninguna cifra.
      return '<span class="row-duration-na" aria-hidden="true">—</span>';
    },

    /* ============================================================
     *  Fila de pista + menú contextual
     * ============================================================ */
    makeTrackRow(t, opts) {
      opts = opts || {};
      const li = document.createElement('li');
      const isCurrent = this.currentTrack && this.currentTrack.id === t.id;
      const isPending = !!(t && t._needsRelink);
      li.className = 'track-row' + (isCurrent ? ' current' : '') + (isPending ? ' is-pending' : '');
      li.dataset.track = t.id;
      // Subtítulo sin eco: el álbum se oculta cuando coincide con el
      // título o con el artista (sencillos: «BALALAIKA» y debajo
      // «9Lana · BALALAIKA» decía lo mismo dos veces). Igual que ya
      // hace el reproductor con su línea de álbum.
      const normRow = (v) => String(v == null ? '' : v).trim().toLowerCase();
      const showAlbum = t.album && !this.isPlaceholderAlbum(t.album)
        && normRow(t.album) !== normRow(t.title)
        && normRow(t.album) !== normRow(t.artist);
      // La pista cargada se marca sobre la portada con el ecualizador
      // (animado solo si está sonando), como en las tarjetas de Inicio.
      const nowBadge = isCurrent
        ? `<span class="eq-badge eq-badge-row${this.isPlaying ? ' playing' : ''}" aria-hidden="true"><i></i><i></i><i></i></span>`
        : '';
      li.innerHTML = `
        <div class="row-cover"><canvas width="44" height="44"></canvas>${nowBadge}</div>
        <div class="row-text">
          <div class="row-title">${this.esc(t.title)}</div>
          <div class="row-sub">${this.esc(t.artist)}${showAlbum ? ' · ' + this.esc(t.album) : ''}${isPending ? ' <span class="row-pending-badge">' + this.esc(this.t('relink_badge')) + '</span>' : ''}</div>
        </div>
        <div class="row-duration">${this.fmtRowDuration(t)}</div>
        <button class="row-action track-menu-btn" type="button" aria-label="${this.esc(this.t('more_options'))}"><svg class="ico" aria-hidden="true"><use href="#i-ellipsis-vertical"></use></svg></button>`;
      const ctx = opts.playContext || { type: 'all' };
      li.addEventListener('click', (e) => {
        if (e.target.closest('.track-menu-btn')) return;
        this.playTrack(t.id, ctx);
        this.updateChrome();
        // Elegir canción en una lista abre el reproductor.
        if (typeof this.openPlayerForTrackPick === 'function') this.openPlayerForTrackPick();
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
        if (e.target && e.target.closest && e.target.closest('.track-menu-btn, .row-action, .batch-checkbox')) return;
        fired = false;
        timer = setTimeout(() => {
          timer = null;
          fired = true;
          // Pulsación larga = menú de la canción (antes entraba en
          // el modo lote de «Todas las canciones», eliminado en §47).
          this.openTrackMenu(trackId);
          if (navigator.vibrate) navigator.vibrate(25);
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
      // Misma regla sin eco que las filas: nada de «artista · álbum»
      // cuando el álbum repite el título o al propio artista.
      const normMenu = (v) => String(v == null ? '' : v).trim().toLowerCase();
      const menuAlbum = t.album && !this.isPlaceholderAlbum(t.album)
        && normMenu(t.album) !== normMenu(t.title)
        && normMenu(t.album) !== normMenu(t.artist);
      if (sub) sub.textContent = (t.artist || '') + (menuAlbum ? ' · ' + t.album : '');
      const cv = document.getElementById('trackMenuCover');
      if (cv) this.drawRowCover(cv, t);
      const goAlbum = document.getElementById('ctxGoAlbum');
      if (goAlbum) goAlbum.style.display = (t.album && !this.isPlaceholderAlbum(t.album)) ? '' : 'none';
      const goArtist = document.getElementById('ctxGoArtist');
      if (goArtist) goArtist.style.display = (t.artist && !this.isPlaceholderArtist(t.artist)) ? '' : 'none';
      // La fila de favorito refleja el estado real de esta pista (el menú
      // se reutiliza: no puede quedarse con el estado de la anterior).
      const favRow = document.getElementById('ctxToggleFavorite');
      const favLabel = document.getElementById('ctxFavoriteLabel');
      const isFav = this.favorites.has(trackId);
      if (favRow) {
        favRow.setAttribute('aria-pressed', isFav ? 'true' : 'false');
        favRow.classList.toggle('is-fav', isFav);
        const use = favRow.querySelector('use');
        if (use) use.setAttribute('href', isFav ? '#i-heart-solid' : '#i-heart');
      }
      if (favLabel) favLabel.textContent = this.t('favorite');
      // «Restablecer portada» solo tiene sentido si hay una personalizada.
      const rmCover = document.getElementById('ctxRemoveCover');
      if (rmCover) rmCover.hidden = !t.customCover;
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
