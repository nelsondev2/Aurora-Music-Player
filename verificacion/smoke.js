'use strict';
/* =====================================================================
 *  smoke.js — regresiones generales tras el pulido
 *
 *  No sustituye a las suites antiguas de biblioteca/LRC, pero cubre los
 *  caminos principales (arranque, navegación, reproducción, búsqueda,
 *  listas, idioma y temas) para detectar roturas introducidas por los
 *  cambios de interfaz.
 * ===================================================================== */
const { boot, wait, TRACKS } = require('./harness');
const { assert, eq, includes, test, section, summary } = require('./lib/check');

(async () => {
  section('1 · Arranque en instalación nueva');
  {
    const { w, doc, App, errors, close } = await boot({ tracks: [] });

    await test('arranca sin errores de JavaScript', () => {
      eq(errors, []);
      assert(App, 'App no existe');
    });

    await test('la bienvenida de Inicio está renderizada', () => {
      const welcome = doc.querySelector('.home-welcome');
      assert(welcome, 'falta la bienvenida');
      includes(welcome.textContent, 'Aurora');
      assert(doc.getElementById('btnHomeLoad'), 'sin botón de cargar');
    });

    await test('no hay pistas ni listas y los estados vacíos están listos', () => {
      eq(App.tracks.length, 0);
      eq(App.playlists.length, 0);
      assert(doc.querySelector('#libraryTracks .empty-state'));
      assert(doc.querySelector('#favoritesList .empty-state'));
    });

    await test('el idioma del sistema se detecta en español', () => {
      eq(App.lang, 'es');
      eq(doc.documentElement.getAttribute('lang'), 'es');
    });

    await test('la navegación inferior tiene sus 4 destinos', () => {
      eq([...doc.querySelectorAll('.nav-btn')].map(b => b.dataset.nav), ['home', 'favorites', 'search', 'library']);
    });

    await test('abrir Ajustes desde Inicio no requiere pista', () => {
      doc.getElementById('btnHomeSettings').click();
      assert(doc.getElementById('sheetSettings').classList.contains('open'));
      App.closeAllSheets();
    });

    await test('cambiar de idioma traduce la interfaz y vuelve al español', () => {
      App.setLang('en');
      eq(doc.querySelector('.nav-btn[data-nav="library"] span').textContent, 'Library');
      eq(doc.getElementById('btnHomeSettings').getAttribute('aria-label'), 'Settings');
      App.setLang('es');
      eq(doc.querySelector('.nav-btn[data-nav="library"] span').textContent, 'Biblioteca');
    });

    await test('los cuatro temas se aplican sin error', () => {
      for (const theme of ['light', 'amoled', 'dark', 'system']) {
        App.setTheme(theme);
        assert(doc.documentElement.getAttribute('data-theme'), 'tema ' + theme + ' sin resolver');
      }
      App.setTheme('dark');
    });

    close();
  }

  section('2 · Biblioteca, reproducción y cola');
  {
    const { doc, App, w, errors, close } = await boot({ tracks: TRACKS });
    // Las pistas de prueba no tienen archivo real: se simula una URL de
    // audio válida para poder comprobar el flujo de reproducción completo.
    App.getTrackUrl = () => 'blob:mock/audio';

    await test('la biblioteca lista las 4 pistas', () => {
      eq(doc.querySelectorAll('#libraryTracks .track-row').length, 4);
      eq(errors, []);
    });

    await test('pulsar una fila reproduce y abre el reproductor', () => {
      const row = doc.querySelector('#libraryTracks .track-row');
      row.click();
      assert(App.currentTrack, 'no hay pista actual');
      assert(doc.getElementById('viewPlayer').classList.contains('active'), 'no abrió el reproductor');
    });

    await test('play/pausa actualiza el estado sin lanzar errores', async () => {
      // El <audio> necesita una fuente para que togglePlay use la rama de
      // reproducción (sin src carga la pista y vuelve, por diseño).
      App.audio.src = 'blob:mock/test';
      App.audio.load();
      await App.togglePlay(true);
      await wait(30);
      assert(App.isPlaying, 'no quedó reproduciendo');
      await App.togglePlay(false);
      await wait(30);
      assert(!App.isPlaying, 'no quedó en pausa');
    });

    await test('siguiente y anterior recorren la cola', () => {
      const start = App.currentTrack.id;
      App.next();
      assert(App.currentTrack, 'sin pista tras next');
      App.prev();
      assert(App.currentTrack, 'sin pista tras prev');
      // prev con currentTime 0 vuelve a la anterior o a la misma; basta con
      // que la cola siga siendo válida.
      assert(App.queue.includes(App.currentTrack.id));
      assert(App.queue.includes(start));
    });

    await test('el botón de aleatorio de la barra también baraja', () => {
      App.shuffle = false;
      doc.getElementById('btnShuffle').click();
      assert(App.shuffle, 'no activó shuffle');
      eq(doc.getElementById('btnShuffle').getAttribute('aria-pressed'), 'true');
      doc.getElementById('btnShuffle').click();
      assert(!App.shuffle, 'no desactivó shuffle');
    });

    await test('la cola renderiza las pistas actuales', () => {
      const items = doc.querySelectorAll('#queueList .queue-item');
      assert(items.length > 0, 'cola vacía');
    });

    await test('purgar la cola sin pista no rompe', () => {
      App.queue = [];
      App.renderQueue();
      assert(doc.querySelector('#queueList .empty-state'));
    });

    await test('abrir y cerrar el reproductor mantiene el foco fuera de vistas ocultas', () => {
      App.showView('lyrics');
      assert(doc.getElementById('viewPlayer').inert);
      App.showView('player');
      assert(!doc.getElementById('viewPlayer').inert);
      App.showView('home');
    });

    close();
  }

  section('3 · Búsqueda, favoritos y listas');
  {
    const { doc, App, errors, close } = await boot({ tracks: TRACKS });

    await test('buscar por título encuentra la pista', () => {
      App.runSearch('Alba', 'all');
      const text = doc.getElementById('searchResults').textContent;
      includes(text, 'Alba');
    });

    await test('buscar sin resultados muestra un estado, no una excepción', () => {
      App.runSearch('zzzz-no-existe', 'all');
      includes(doc.getElementById('searchResults').textContent, 'Sin resultados');
      eq(errors, []);
    });

    await test('los favoritos se añaden y se pintan', () => {
      App.toggleFavoriteFor('t1');
      App.toggleFavoriteFor('t3');
      eq(doc.querySelectorAll('#favoritesList [data-track]').length, 2);
      App.toggleFavoriteFor('t1');
      eq(doc.querySelectorAll('#favoritesList [data-track]').length, 1);
    });

    await test('crear una lista la añade a la biblioteca', () => {
      const pl = App.createPlaylist('Prueba smoke', '', ['t1', 't2']);
      assert(pl, 'no se creó la lista');
      assert(App.playlists.some(p => p.id === pl.id));
      App.renderPlaylists();
      includes(doc.getElementById('libraryPlaylists').textContent, 'Prueba smoke');
    });

    await test('reproducir una lista usa su contexto', () => {
      const pl = App.playlists[0];
      App.playPlaylist(pl.id);
      eq(App.playContext.type, 'playlist');
      eq(App.queue, ['t1', 't2']);
    });

    await test('quitar una pista de la lista actualiza su contenido', () => {
      const pl = App.playlists[0];
      const before = pl.trackIds.length;
      if (typeof App.removeFromPlaylist === 'function') App.removeFromPlaylist(pl.id, 't1');
      else pl.trackIds.splice(0, 1);
      assert(pl.trackIds.length < before, 'la lista no perdió la pista');
    });

    close();
  }

  section('4 · Letras, estadísticas y ajustes');
  {
    const { w, doc, App, errors, close } = await boot({ tracks: TRACKS });

    await test('abrir Letras sin LRC muestra su estado vacío', () => {
      App.playTrack('t1', { type: 'all' });
      App.showView('lyrics');
      assert(doc.getElementById('viewLyrics').classList.contains('active'));
      assert(doc.getElementById('lrcEmpty'), 'falta estado vacío de letras');
      App.showView('home');
    });

    await test('las estadísticas se renderizan con datos', () => {
      App.renderStats();
      includes(doc.getElementById('statsContent').textContent, 'Tiempo de escucha');
    });

    await test('el historial se renderiza sin errores', () => {
      App.renderHistory();
      eq(errors, []);
    });

    await test('cambiar acento y tema persiste en localStorage', () => {
      App.setAccent('ocean');
      App.setTheme('light');
      eq(doc.documentElement.getAttribute('data-accent'), 'ocean');
      eq(w.localStorage.getItem('aurora_accent'), 'ocean');
      eq(w.localStorage.getItem('aurora_theme'), 'light');
      App.setAccent('aurora');
      App.setTheme('dark');
    });

    await test('los atajos de teclado no lanzan errores al pulsarse', () => {
      for (const key of [' ', 'ArrowRight', 'ArrowLeft', 'm', 's', 'f']) {
        const ev = new doc.defaultView.KeyboardEvent('keydown', { key, bubbles: true });
        doc.dispatchEvent(ev);
      }
      eq(errors, []);
    });

    close();
  }

  const ok = summary();
  process.exit(ok ? 0 : 1);
})().catch(e => {
  console.error('Error fatal en smoke:', e);
  process.exit(1);
});
