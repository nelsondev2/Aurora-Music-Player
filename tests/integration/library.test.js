'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('../helpers/dom-env');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('_safeImageDataUrl acepta raster base64 y rechaza svg, comillas y tamaños', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  assert.equal(A._safeImageDataUrl(PNG), true);
  assert.equal(A._safeImageDataUrl('data:image/jpeg;base64,AAAA'), true);
  assert.equal(A._safeImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(A._safeImageDataUrl("data:image/png;base64,AAAA') ; background:url(x"), false);
  assert.equal(A._safeImageDataUrl('javascript:alert(1)'), false);
  assert.equal(A._safeImageDataUrl(null), false);
  assert.equal(A._safeImageDataUrl('data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024)), false);
});

test('importación: ids peligrosos se regeneran y no inyectan HTML', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  A._importLibraryData({
    kind: 'aurora-metadata',
    tracks: [{
      id: '"><img src=x onerror=window.__xss=1>',
      title: '<img src=x onerror=window.__xss=2>',
      artist: '<script>window.__xss=3</script>',
      fileName: 'x.mp3', fileSize: 10, duration: '12'
    }]
  });
  assert.equal(A.tracks.length, 1);
  assert.match(A.tracks[0].id, /^[A-Za-z0-9._-]+$/);
  A.renderLibrary();
  const ul = env.window.document.getElementById('libraryTracks');
  assert.equal(ul.querySelectorAll('img, script').length, 0);
  assert.equal(ul.textContent.includes('<img'), true, 'el texto se muestra escapado');
  assert.equal(env.window.__xss, undefined);
});

test('importación: portadas no válidas se descartan', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  A._importLibraryData({
    tracks: [
      { id: 'a', fileName: 'a.mp3', fileSize: 1, coverThumb: 'javascript:alert(1)' },
      { id: 'b', fileName: 'b.mp3', fileSize: 2, coverThumb: PNG }
    ],
    playlists: [{ id: 'p1', name: 'P', trackIds: ['a'], coverArt: "x'); background:url(javascript:alert(1)" }]
  });
  assert.equal(A.tracks.find(x => x.id === 'a').coverThumb, null);
  assert.equal(A.tracks.find(x => x.id === 'b').coverThumb, PNG);
  const pl = A.playlists.find(p => p.id === 'p1');
  assert.equal(pl._coverCache, null);
});

test('importación ADITIVA: conserva listas actuales y fusiona por id', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  const mine = A.playlists.find(p => p.id === A.DEFAULT_PLAYLIST_ID);
  mine.trackIds = [];
  A.createPlaylist('Mi lista', '', []);
  const currentId = A.playlists[A.playlists.length - 1].id;

  A._importLibraryData({
    tracks: [{ id: 't1', fileName: 'uno.mp3', fileSize: 1 }],
    playlists: [
      { id: currentId, name: 'Renombrada', trackIds: [] },
      { id: 'nueva', name: 'Nueva', trackIds: ['t1'] }
    ]
  });
  assert.ok(A.playlists.some(p => p.id === currentId), 'la lista existente no se borra');
  assert.equal(A.playlists.find(p => p.id === currentId).name, 'Renombrada');
  assert.ok(A.playlists.some(p => p.id === 'nueva'));
  assert.deepEqual([...A.playlists.find(p => p.id === 'nueva').trackIds], ['t1']);
});

test('importación: favoritos se unen y stats usan el máximo', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  A._importLibraryData({
    tracks: [
      { id: 'a', fileName: 'a.mp3', fileSize: 1 },
      { id: 'b', fileName: 'b.mp3', fileSize: 2 }
    ],
    favorites: ['a'],
    stats: { plays: { a: 2, b: 5 }, totalSeconds: 100 }
  });
  A.favorites.add('b');
  A.stats.plays.a = 9;

  A._importLibraryData({
    tracks: [{ id: 'a', fileName: 'a.mp3', fileSize: 1 }],
    favorites: ['a'],
    stats: { plays: { a: 3, b: 1 }, totalSeconds: 50 }
  });
  assert.deepEqual([...A.favorites].sort(), ['a', 'b']);
  assert.equal(A.stats.plays.a, 9, 'el máximo no baja');
  assert.equal(A.stats.plays.b, 5);
  assert.equal(A.stats.totalSeconds, 100);
});

test('importación: deduplica por nombre+tamaño sin duplicar pistas', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  A._importLibraryData({ tracks: [{ id: 'x1', fileName: 'same.mp3', fileSize: 5 }] });
  A._importLibraryData({ tracks: [{ id: 'x2', fileName: 'SAME.mp3', fileSize: 5 }] });
  assert.equal(A.tracks.filter(x => x.fileName.toLowerCase() === 'same.mp3').length, 1);
});

test('importación: JSON sin kind o con tracks no-array no explota', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  assert.doesNotThrow(() => A._importLibraryData({ tracks: 'no', playlists: 42, favorites: {}, stats: [] }));
  assert.equal(A.tracks.length, 0);
});

test('handleFileInput ignora llamadas concurrentes', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  let called = 0;
  env.window.AuroraUploader.processFiles = async () => { called++; return []; };
  A._importing = true;
  await A.handleFileInput([{ name: 'a.mp3' }]);
  assert.equal(called, 0);
  A._importing = false;
});

test('deleteTrack limpia cola, listas, favoritos y URL cache', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  const track = { id: 't-del', title: 'X', artist: 'A', duration: 10, src: 'blob:mock/99' };
  A.tracks = [track, { id: 'otro', title: 'O', artist: 'B', duration: 5 }];
  A.invalidateTrackIndex();
  A.queue = ['t-del', 'otro'];
  A.queueIdx = 0;
  A.favorites.add('t-del');
  const pl = A.playlists[0];
  pl.trackIds = ['t-del'];
  A._urlCache.set('t-del', 'blob:mock/99');
  await A.deleteTrack('t-del');
  assert.equal(A.tracks.length, 1);
  assert.deepEqual(A.tracks.map(x => x.id), ['otro']);
  assert.deepEqual([...A.queue], ['otro']);
  assert.equal(A.favorites.has('t-del'), false);
  assert.deepEqual([...pl.trackIds], []);
  assert.equal(A._urlCache.has('t-del'), false);
});

test('deleteAllTracks deja el estado vacío y limpia IndexedDB', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  A.tracks = [
    { id: 'a', title: 'A', artist: 'X', duration: 1 },
    { id: 'b', title: 'B', artist: 'Y', duration: 1 }
  ];
  A.invalidateTrackIndex();
  await A.persistTrack(A.tracks[0]);
  A.currentTrack = A.tracks[0];
  A.queue = ['a', 'b'];
  A.showConfirm = async () => true;
  await A.deleteAllTracks();
  assert.equal(A.tracks.length, 0);
  assert.equal(A.currentTrack, null);
  assert.deepEqual([...A.queue], []);
  assert.equal((await env.window.AuroraStorage.getAllTracks()).length, 0);
});

test('exportLibrary produce JSON válido con versión y sin blobs', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  A.tracks = [{ id: 'a', title: 'A', artist: 'B', duration: 3, coverThumb: PNG }];
  let captured = null;
  A.exportFile = async (o) => { captured = o; return true; };
  await A.exportLibrary();
  assert.ok(captured);
  const data = JSON.parse(captured.content);
  assert.equal(data.version, 1);
  assert.equal(data.kind, 'aurora-metadata');
  assert.equal(data.tracks[0].id, 'a');
  assert.ok(!JSON.stringify(data).includes('blob:'));
});

test('createPlaylist valida nombre duplicado y longitud', async (t) => {
  const env = await boot();
  t.after(env.close);
  const A = env.App;
  const p1 = A.createPlaylist('Repetida', '', []);
  assert.ok(p1);
  assert.equal(A.createPlaylist('repetida', '', []), null);
  const p2 = A.createPlaylist('x'.repeat(300), '', []);
  assert.equal(p2.name.length, 80);
});
