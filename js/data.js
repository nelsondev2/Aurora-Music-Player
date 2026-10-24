/* =====================================================================
 *  data.js — Catálogo de pistas, configuración y diccionario i18n
 *  Reproductor de música profesional · mobile-first
 *
 *  El catálogo empieza vacío: el usuario carga sus propias pistas
 *  desde el almacenamiento local. Se guardan en IndexedDB
 *  (ver storage.js y uploader.js).
 * ===================================================================== */

/* Catálogo inicial vacío. Las pistas se añaden con el botón "+". */
const TRACKS = [];

/* Paleta para generar portadas dinámicas cuando una pista no trae
 * artwork en sus metadatos ID3.
 * Familia aurora (noche fría + ámbar/rosa de contraste), no catálogo
 * Tailwind. El ángulo varía para que el fondo de Now Playing no repita. */
const COVER_PALETTE = [
  { from: '#6E5CFF', to: '#FF7AB6', angle: 135 },
  { from: '#1A508C', to: '#5AD4DC', angle: 135 },
  { from: '#2846A0', to: '#B48CFF', angle: 120 },
  { from: '#14285A', to: '#508CDC', angle: 150 },
  { from: '#0C4A5E', to: '#46C8DC', angle: 120 },
  { from: '#C45C18', to: '#E8B84A', angle: 135 },
  { from: '#C8505A', to: '#FFA078', angle: 120 },
  { from: '#7A1E3C', to: '#E85A7A', angle: 150 },
  { from: '#2A6B48', to: '#A8C86A', angle: 135 },
  { from: '#4C2E9E', to: '#8B7CFF', angle: 135 },
  { from: '#96275C', to: '#E87AB0', angle: 120 },
  { from: '#2E3A5C', to: '#7C8CFF', angle: 150 }
];

/* Texto LRC de muestra para cuando una pista no trae letra.
 * Vacío = el usuario debe cargar su propio .lrc o aceptar "sin letra". */
const SAMPLE_LRC = null;

/* =====================================================================
 *  Diccionario i18n
 *  Idiomas soportados: es, en, pt, zh, ja, fr, it, ru
 *  Cada clave contiene un objeto con la traducción por idioma.
 *  Las claves se referencian desde el HTML con data-i18n="key"
 *  y desde JS con App.t('key').
 * ===================================================================== */
const SUPPORTED_LANGS = [
  { code: 'es', name: 'Español',         flag: '🇪🇸' },
  { code: 'en', name: 'English',         flag: '🇬🇧' },
  { code: 'pt', name: 'Português',       flag: '🇵🇹' },
  { code: 'zh', name: '中文',              flag: '🇨🇳' },
  { code: 'ja', name: '日本語',            flag: '🇯🇵' },
  { code: 'fr', name: 'Français',        flag: '🇫🇷' },
  { code: 'it', name: 'Italiano',        flag: '🇮🇹' },
  { code: 'ru', name: 'Русский',         flag: '🇷🇺' }
];

const I18N = {
  /* ---------- App general ---------- */
  /* Solo «Aurora»: no existe una versión «Pro» (ni otra que no lo sea),
   * así que el antiguo «Aurora · Reproductor Pro» prometía de más. */
  app_title: {
    es: 'Aurora',
    en: 'Aurora',
    pt: 'Aurora',
    zh: 'Aurora',
    ja: 'Aurora',
    fr: 'Aurora',
    it: 'Aurora',
    ru: 'Aurora'
  },
  now_playing_label: {
    es: 'REPRODUCIENDO AHORA',
    en: 'NOW PLAYING',
    pt: 'REPRODUZINDO AGORA',
    zh: '正在播放',
    ja: '再生中',
    fr: 'LECTURE EN COURS',
    it: 'IN RIPRODUZIONE',
    ru: 'СЕЙЧАС ИГРАЕТ'
  },
  your_library: {
    es: 'Tu biblioteca',
    en: 'Your library',
    pt: 'Sua biblioteca',
    zh: '你的媒体库',
    ja: 'ライブラリ',
    fr: 'Votre bibliothèque',
    it: 'Libreria',
    ru: 'Ваша библиотека'
  },
  more_options: {
    es: 'Más opciones',
    en: 'More options',
    pt: 'Mais opções',
    zh: '更多选项',
    ja: 'その他のオプション',
    fr: "Plus d'options",
    it: 'Altre opzioni',
    ru: 'Другие опции'
  },
  load_music: {
    es: 'Cargar música',
    en: 'Load music',
    pt: 'Carregar música',
    zh: '加载音乐',
    ja: '音楽を読み込む',
    fr: 'Charger musique',
    it: 'Carica musica',
    ru: 'Загрузить музыку'
  },
  rated_title: {
    es: 'Más valoradas', en: 'Top rated', pt: 'Mais valorizadas',
    zh: '评分最高', ja: '高評価', fr: 'Les mieux notées',
    it: 'Le più votate', ru: 'Лучшие по оценке'
  },
  rating_label: {
    es: 'Valoración', en: 'Rating', pt: 'Classificação',
    zh: '评分', ja: '評価', fr: 'Note',
    it: 'Valutazione', ru: 'Оценка'
  },
  favorite: {
    es: 'Favorito',
    en: 'Favorite',
    pt: 'Favorito',
    zh: '收藏',
    ja: 'お気に入り',
    fr: 'Favori',
    it: 'Preferito',
    ru: 'Избранное'
  },

  /* ---------- Track info / empty state ---------- */
  load_track_to_start: {
    es: 'Carga una pista para empezar',
    en: 'Load a track to start',
    pt: 'Carregue uma faixa para começar',
    zh: '加载音轨开始播放',
    ja: 'トラックを読み込んで開始',
    fr: 'Chargez une piste pour commencer',
    it: 'Carica una traccia per iniziare',
    ru: 'Загрузите трек, чтобы начать'
  },
  unknown_artist: {
    es: 'Artista desconocido',
    en: 'Unknown artist',
    pt: 'Artista desconhecido',
    zh: '未知艺术家',
    ja: '不明なアーティスト',
    fr: 'Artiste inconnu',
    it: 'Artista sconosciuto',
    ru: 'Неизвестный исполнитель'
  },
  no_album: {
    es: 'Sin álbum',
    en: 'No album',
    pt: 'Sem álbum',
    zh: '无专辑',
    ja: 'アルバムなし',
    fr: 'Aucun album',
    it: 'Nessun album',
    ru: 'Без альбома'
  },

  /* ---------- Main controls ---------- */
  shuffle: {
    es: 'Aleatorio',
    en: 'Shuffle',
    pt: 'Aleatório',
    zh: '随机',
    ja: 'シャッフル',
    fr: 'Aléatoire',
    it: 'Casuale',
    ru: 'Случайно'
  },
  previous: {
    es: 'Anterior',
    en: 'Previous',
    pt: 'Anterior',
    zh: '上一首',
    ja: '前へ',
    fr: 'Précédent',
    it: 'Precedente',
    ru: 'Предыдущий'
  },
  play: {
    es: 'Reproducir',
    en: 'Play',
    pt: 'Reproduzir',
    zh: '播放',
    ja: '再生',
    fr: 'Lire',
    it: 'Riproduci',
    ru: 'Играть'
  },
  pause: {
    es: 'Pausar',
    en: 'Pause',
    pt: 'Pausar',
    zh: '暂停',
    ja: '一時停止',
    fr: 'Pause',
    it: 'Pausa',
    ru: 'Пауза'
  },
  next: {
    es: 'Siguiente',
    en: 'Next',
    pt: 'Próxima',
    zh: '下一首',
    ja: '次へ',
    fr: 'Suivant',
    it: 'Successivo',
    ru: 'Следующий'
  },
  repeat: {
    es: 'Repetir',
    en: 'Repeat',
    pt: 'Repetir',
    zh: '循环',
    ja: 'リピート',
    fr: 'Répéter',
    it: 'Ripeti',
    ru: 'Повтор'
  },

  /* ---------- Secondary controls ---------- */
  lyrics: {
    es: 'Letras',
    en: 'Lyrics',
    pt: 'Letras',
    zh: '歌词',
    ja: '歌詞',
    fr: 'Paroles',
    it: 'Testi',
    ru: 'Текст'
  },
  queue: {
    es: 'Cola',
    en: 'Queue',
    pt: 'Fila',
    zh: '队列',
    ja: 'キュー',
    fr: 'File',
    it: 'Coda',
    ru: 'Очередь'
  },
  volume: {
    es: 'Volumen',
    en: 'Volume',
    pt: 'Volume',
    zh: '音量',
    ja: '音量',
    fr: 'Volume',
    it: 'Volume',
    ru: 'Громкость'
  },
  equalizer: {
    es: 'Ecualizador',
    en: 'Equalizer',
    pt: 'Equalizador',
    zh: '均衡器',
    ja: 'イコライザー',
    fr: 'Égaliseur',
    it: 'Equalizzatore',
    ru: 'Эквалайзер'
  },
  sleep: {
    es: 'Sleep',
    en: 'Sleep',
    pt: 'Sleep',
    zh: '睡眠',
    ja: 'スリープ',
    fr: 'Sommeil',
    it: 'Sleep',
    ru: 'Сон'
  },

  /* ---------- Bottom nav ---------- */
  nav_home: {
    es: 'Inicio',
    en: 'Home',
    pt: 'Início',
    zh: '首页',
    ja: 'ホーム',
    fr: 'Accueil',
    it: 'Home',
    ru: 'Главная'
  },
  nav_search: {
    es: 'Buscar',
    en: 'Search',
    pt: 'Buscar',
    zh: '搜索',
    ja: '検索',
    fr: 'Rechercher',
    it: 'Cerca',
    ru: 'Поиск'
  },
  nav_library: {
    es: 'Biblioteca',
    en: 'Library',
    pt: 'Biblioteca',
    zh: '媒体库',
    ja: 'ライブラリ',
    fr: 'Bibliothèque',
    it: 'Libreria',
    ru: 'Библиотека'
  },
  nav_favorites: {
    es: 'Favoritos',
    en: 'Favorites',
    pt: 'Favoritos',
    zh: '收藏',
    ja: 'お気に入り',
    fr: 'Favoris',
    it: 'Preferiti',
    ru: 'Избранное'
  },

  /* ---------- Sheets: títulos ---------- */
  synced_lyrics: {
    es: 'LETRA SINCRONIZADA',
    en: 'SYNCED LYRICS',
    pt: 'LETRA SINCRONIZADA',
    zh: '同步歌词',
    ja: '同期歌詞',
    fr: 'PAROLES SYNCHRO',
    it: 'TESTI SINCRONIZZATI',
    ru: 'СИНХР. ТЕКСТ'
  },
  queue_title: {
    es: 'Cola de reproducción',
    en: 'Playback queue',
    pt: 'Fila de reprodução',
    zh: '播放队列',
    ja: '再生キュー',
    fr: "File d'attente",
    it: 'Coda di riproduzione',
    ru: 'Очередь воспроизведения'
  },
  your_playlists: {
    es: 'Tus listas',
    en: 'Your playlists',
    pt: 'Suas listas',
    zh: '你的歌单',
    ja: 'プレイリスト',
    fr: 'Vos listes',
    it: 'Le tue liste',
    ru: 'Ваши списки'
  },
  /* Importación de listas M3U (la exportación ya existía como
   * «Compartir lista»). Placeholders: N = nombre, X/Y = encontradas/total. */
  new_playlist: {
    es: 'Nueva',
    en: 'New',
    pt: 'Nova',
    zh: '新建',
    ja: '新規',
    fr: 'Nouvelle',
    it: 'Nuova',
    ru: 'Новый'
  },
  create_playlist_title: {
    es: 'Nueva lista',
    en: 'New playlist',
    pt: 'Nova lista',
    zh: '新建歌单',
    ja: '新規プレイリスト',
    fr: 'Nouvelle liste',
    it: 'Nuova lista',
    ru: 'Новый список'
  },
  close_btn: {
    es: 'Cerrar',
    en: 'Close',
    pt: 'Fechar',
    zh: '关闭',
    ja: '閉じる',
    fr: 'Fermer',
    it: 'Chiudi',
    ru: 'Закрыть'
  },
  /* done_btn («Listo») se eliminó: cada hoja tiene ya su × de cierre y
   * el botón de texto solo lo duplicaba (ver cabeceras en index.html). */
  clear_btn: {
    es: 'Vaciar',
    en: 'Clear',
    pt: 'Limpar',
    zh: '清空',
    ja: 'クリア',
    fr: 'Vider',
    it: 'Svuota',
    ru: 'Очистить'
  },
  library_playlists_section: {
    es: 'Listas de reproducción', en: 'Playlists', pt: 'Listas de reprodução',
    zh: '播放列表', ja: 'プレイリスト', fr: 'Listes de lecture',
    it: 'Playlist', ru: 'Плейлисты'
  },
  library_title: {
    es: 'Biblioteca',
    en: 'Library',
    pt: 'Biblioteca',
    zh: '媒体库',
    ja: 'ライブラリ',
    fr: 'Bibliothèque',
    it: 'Libreria',
    ru: 'Библиотека'
  },
  search_title: {
    es: 'Buscar',
    en: 'Search',
    pt: 'Buscar',
    zh: '搜索',
    ja: '検索',
    fr: 'Rechercher',
    it: 'Cerca',
    ru: 'Поиск'
  },
  options_title: {
    es: 'Opciones',
    en: 'Options',
    pt: 'Opções',
    zh: '选项',
    ja: 'オプション',
    fr: 'Options',
    it: 'Opzioni',
    ru: 'Опции'
  },
  themes_title: {
    es: 'Temas y acentos',
    en: 'Themes & accents',
    pt: 'Temas e acentos',
    zh: '主题与强调色',
    ja: 'テーマとアクセント',
    fr: 'Thèmes et accents',
    it: 'Temi e accenti',
    ru: 'Темы и акценты'
  },
  theme_section: {
    es: 'Tema', en: 'Theme', pt: 'Tema',
    zh: '主题', ja: 'テーマ', fr: 'Thème', it: 'Tema', ru: 'Тема'
  },
  accent_section: {
    es: 'Color de acento', en: 'Accent color', pt: 'Cor de destaque',
    zh: '强调色', ja: 'アクセントカラー', fr: 'Couleur d’accent', it: 'Colore accento', ru: 'Цвет акцента'
  },
  settings_speed: {
    es: 'Velocidad de reproducción', en: 'Playback speed', pt: 'Velocidade de reprodução',
    zh: '播放速度', ja: '再生速度', fr: 'Vitesse de lecture', it: 'Velocità di riproduzione', ru: 'Скорость воспроизведения'
  },
  stats_title: {
    es: 'Estadísticas',
    en: 'Statistics',
    pt: 'Estatísticas',
    zh: '统计',
    ja: '統計',
    fr: 'Statistiques',
    it: 'Statistiche',
    ru: 'Статистика'
  },
  favorites_title: {
    es: 'Favoritos',
    en: 'Favorites',
    pt: 'Favoritos',
    zh: '收藏',
    ja: 'お気に入り',
    fr: 'Favoris',
    it: 'Preferiti',
    ru: 'Избранное'
  },
  language_title: {
    es: 'Idioma',
    en: 'Language',
    pt: 'Idioma',
    zh: '语言',
    ja: '言語',
    fr: 'Langue',
    it: 'Lingua',
    ru: 'Язык'
  },

  /* ---------- Form / playlist ---------- */
  name_label: {
    es: 'Nombre',
    en: 'Name',
    pt: 'Nome',
    zh: '名称',
    ja: '名前',
    fr: 'Nom',
    it: 'Nome',
    ru: 'Название'
  },
  description_label: {
    es: 'Descripción',
    en: 'Description',
    pt: 'Descrição',
    zh: '描述',
    ja: '説明',
    fr: 'Description',
    it: 'Descrizione',
    ru: 'Описание'
  },
  optional: {
    es: 'Opcional',
    en: 'Optional',
    pt: 'Opcional',
    zh: '可选',
    ja: '任意',
    fr: 'Facultatif',
    it: 'Opzionale',
    ru: 'Необязательно'
  },
  my_new_playlist: {
    es: 'Mi nueva lista',
    en: 'My new playlist',
    pt: 'Minha nova lista',
    zh: '我的新歌单',
    ja: '新しいプレイリスト',
    fr: 'Ma nouvelle liste',
    it: 'La mia nuova lista',
    ru: 'Мой новый список'
  },
  save_playlist: {
    es: 'Guardar lista',
    en: 'Save playlist',
    pt: 'Salvar lista',
    zh: '保存歌单',
    ja: 'リストを保存',
    fr: 'Enregistrer la liste',
    it: 'Salva lista',
    ru: 'Сохранить список'
  },

  /* ---------- EQ presets ---------- */
  eq_normal: {
    es: 'Normal',
    en: 'Normal',
    pt: 'Normal',
    zh: '正常',
    ja: 'ノーマル',
    fr: 'Normal',
    it: 'Normale',
    ru: 'Обычный'
  },
  eq_bass: {
    es: 'Graves',
    en: 'Bass',
    pt: 'Graves',
    zh: '低音',
    ja: 'ベース',
    fr: 'Graves',
    it: 'Bassi',
    ru: 'Басы'
  },
  eq_vocal: {
    es: 'Voces',
    en: 'Vocal',
    pt: 'Vocais',
    zh: '人声',
    ja: 'ボーカル',
    fr: 'Voix',
    it: 'Voci',
    ru: 'Вокал'
  },
  eq_treble: {
    es: 'Agudos',
    en: 'Treble',
    pt: 'Agudos',
    zh: '高音',
    ja: '高音',
    fr: 'Aigus',
    it: 'Alti',
    ru: 'Высокие'
  },
  eq_live: {
    es: 'En vivo',
    en: 'Live',
    pt: 'Ao vivo',
    zh: '现场',
    ja: 'ライブ',
    fr: 'Live',
    it: 'Live',
    ru: 'Лайв'
  },

  /* ---------- Sleep timer ---------- */
  sleep_hint: {
    es: 'La reproducción se detendrá automáticamente.',
    en: 'Playback will stop automatically.',
    pt: 'A reprodução parará automaticamente.',
    zh: '播放将自动停止。',
    ja: '再生は自動的に停止します。',
    fr: 'La lecture s\'arrêtera automatiquement.',
    it: 'La riproduzione si fermerà automaticamente.',
    ru: 'Воспроизведение остановится автоматически.'
  },
  cancel_timer: {
    es: 'Cancelar temporizador',
    en: 'Cancel timer',
    pt: 'Cancelar temporizador',
    zh: '取消定时器',
    ja: 'タイマーをキャンセル',
    fr: 'Annuler la minuterie',
    it: 'Annulla timer',
    ru: 'Отменить таймер'
  },
  sleep_end_of_track: {
    es: 'Fin de la canción',
    en: 'End of track',
    pt: 'Fim da faixa',
    zh: '本曲结束',
    ja: '曲の終わり',
    fr: 'Fin du morceau',
    it: 'Fine brano',
    ru: 'Конец трека'
  },
  sleep_eot_status: {
    es: 'Activo · al final de la canción',
    en: 'Active · end of track',
    pt: 'Ativo · fim da faixa',
    zh: '进行中 · 本曲结束',
    ja: '実行中 · 曲の終わり',
    fr: 'Actif · fin du morceau',
    it: 'Attivo · fine brano',
    ru: 'Активен · конец трека'
  },
  toast_sleep_eot: {
    es: 'Sleep al final de la canción',
    en: 'Sleep at end of track',
    pt: 'Sleep no fim da faixa',
    zh: '本曲结束后休眠',
    ja: '曲の終わりにスリープ',
    fr: 'Sommeil à la fin du morceau',
    it: 'Sleep a fine brano',
    ru: 'Сон в конце трека'
  },

  /* ---------- More options menu ---------- */
  menu_load_music: {
    es: 'Cargar música del dispositivo',
    en: 'Load music from device',
    pt: 'Carregar música do dispositivo',
    zh: '从设备加载音乐',
    ja: 'デバイスから音楽を読み込む',
    fr: 'Charger musique depuis l\'appareil',
    it: 'Carica musica dal dispositivo',
    ru: 'Загрузить музыку с устройства'
  },
  menu_load_folder: {
    es: 'Cargar carpeta completa',
    en: 'Load entire folder',
    pt: 'Carregar pasta inteira',
    zh: '加载整个文件夹',
    ja: 'フォルダ全体を読み込む',
    fr: 'Charger un dossier complet',
    it: 'Carica intera cartella',
    ru: 'Загрузить всю папку'
  },
  menu_go_to_artist: {
    es: 'Ir al artista',
    en: 'Go to artist',
    pt: 'Ir para artista',
    zh: '查看艺术家',
    ja: 'アーティストへ',
    fr: "Aller à l'artiste",
    it: 'Vai all\'artista',
    ru: 'К исполнителю'
  },
  menu_stats: {
    es: 'Estadísticas de reproducción',
    en: 'Playback statistics',
    pt: 'Estatísticas de reprodução',
    zh: '播放统计',
    ja: '再生統計',
    fr: 'Statistiques de lecture',
    it: 'Statistiche di riproduzione',
    ru: 'Статистика воспроизведения'
  },
  menu_themes: {
    es: 'Temas y acentos',
    en: 'Themes & accents',
    pt: 'Temas e acentos',
    zh: '主题与强调色',
    ja: 'テーマとアクセント',
    fr: 'Thèmes et accents',
    it: 'Temi e accenti',
    ru: 'Темы и акценты'
  },
  menu_language: {
    es: 'Idioma de la aplicación',
    en: 'Application language',
    pt: 'Idioma do aplicativo',
    zh: '应用语言',
    ja: 'アプリ言語',
    fr: 'Langue de l\'application',
    it: 'Lingua app',
    ru: 'Язык приложения'
  },

  /* ---------- Toast messages ---------- */
  toast_added_fav: {
    es: 'Añadido a favoritos ♥',
    en: 'Added to favorites ♥',
    pt: 'Adicionado aos favoritos ♥',
    zh: '已添加到收藏 ♥',
    ja: 'お気に入りに追加 ♥',
    fr: 'Ajouté aux favoris ♥',
    it: 'Aggiunto ai preferiti ♥',
    ru: 'Добавлено в избранное ♥'
  },
  toast_removed_fav: {
    es: 'Quitado de favoritos',
    en: 'Removed from favorites',
    pt: 'Removido dos favoritos',
    zh: '已从收藏移除',
    ja: 'お気に入りから削除',
    fr: 'Retiré des favoris',
    it: 'Rimosso dai preferiti',
    ru: 'Убрано из избранного'
  },
  toast_repeat_off: { es: 'off', en: 'off', pt: 'off', zh: '关闭', ja: 'オフ', fr: 'off', it: 'off', ru: 'выкл' },
  toast_repeat_all: { es: 'todo', en: 'all', pt: 'tudo', zh: '全部', ja: '全て', fr: 'tout', it: 'tutto', ru: 'всё' },
  toast_repeat_one: { es: 'uno', en: 'one', pt: 'um', zh: '单曲', ja: '1曲', fr: 'un', it: 'uno', ru: 'один' },
  toast_track_deleted: {
    es: 'Pista eliminada',
    en: 'Track deleted',
    pt: 'Faixa excluída',
    zh: '音轨已删除',
    ja: 'トラックを削除しました',
    fr: 'Piste supprimée',
    it: 'Traccia eliminata',
    ru: 'Трек удалён'
  },
  toast_accent: { es: 'Acento:', en: 'Accent:', pt: 'Acento:', zh: '强调色：', ja: 'アクセント:', fr: 'Accent :', it: 'Accento:', ru: 'Акцент:' },
  toast_lang_applied: {
    es: 'Idioma aplicado',
    en: 'Language applied',
    pt: 'Idioma aplicado',
    zh: '语言已应用',
    ja: '言語を適用しました',
    fr: 'Langue appliquée',
    it: 'Lingua applicata',
    ru: 'Язык применён'
  },
  toast_no_favorites_yet: {
    es: 'Aún no tienes favoritos',
    en: 'No favorites yet',
    pt: 'Ainda não há favoritos',
    zh: '还没有收藏',
    ja: 'お気に入りはまだありません',
    fr: 'Aucun favori pour l\'instant',
    it: 'Nessun preferito ancora',
    ru: 'Пока нет избранного'
  },

  /* ---------- Library / playlist lists ---------- */
  no_tracks_loaded: {
    es: 'Aún no has cargado pistas',
    en: 'No tracks loaded yet',
    pt: 'Nenhuma faixa carregada',
    zh: '尚未加载音轨',
    ja: 'トラックがまだ読み込まれていません',
    fr: 'Aucune piste chargée',
    it: 'Nessuna traccia caricata',
    ru: 'Треки ещё не загружены'
  },
  all_tracks_section: {
    es: 'Todas las pistas',
    en: 'All tracks',
    pt: 'Todas as faixas',
    zh: '全部音轨',
    ja: '全トラック',
    fr: 'Toutes les pistes',
    it: 'Tutte le tracce',
    ru: 'Все треки'
  },
  /* Placeholder completo: antes venía truncado con «…» en el propio
   * diccionario («Canción, artista o ál…») y se cortaba en pantalla. */
  search_placeholder: {
    es: 'Canción, artista o álbum',
    en: 'Song, artist or album',
    pt: 'Música, artista ou álbum',
    zh: '歌曲、艺术家或专辑',
    ja: '曲、アーティスト、アルバム',
    fr: 'Chanson, artiste ou album',
    it: 'Brano, artista o album',
    ru: 'Песня, исполнитель или альбом'
  },
  no_playlists_yet: {
    es: 'Sin listas todavía',
    en: 'No playlists yet',
    pt: 'Sem listas ainda',
    zh: '暂无歌单',
    ja: 'プレイリストはまだありません',
    fr: 'Aucune liste pour l\'instant',
    it: 'Nessuna lista ancora',
    ru: 'Списков пока нет'
  },
  no_playlists_hint: {
    es: 'Crea una lista para organizar tus pistas por estado de ánimo, artista o cualquier criterio.',
    en: 'Create a playlist to organize your tracks by mood, artist or any criteria.',
    pt: 'Crie uma lista para organizar suas faixas por humor, artista ou qualquer critério.',
    zh: '创建歌单，按心情、艺术家或任意标准整理你的音轨。',
    ja: '気分、アーティスト、その他の基準でトラックを整理するプレイリストを作成しましょう。',
    fr: 'Créez une liste pour organiser vos pistes par humeur, artiste ou tout autre critère.',
    it: 'Crea una lista per organizzare le tracce per umore, artista o qualsiasi criterio.',
    ru: 'Создайте список, чтобы упорядочить треки по настроению, исполнителю или любому критерию.'
  },
  create_new_playlist: {
    es: 'Crear nueva lista',
    en: 'Create new playlist',
    pt: 'Criar nova lista',
    zh: '创建新歌单',
    ja: '新しいプレイリストを作成',
    fr: 'Créer une nouvelle liste',
    it: 'Crea nuova lista',
    ru: 'Создать новый список'
  },

  /* ---------- Stats ---------- */
  stats_plays: {
    es: 'Reproducciones',
    en: 'Plays',
    pt: 'Reproduções',
    zh: '播放次数',
    ja: '再生回数',
    fr: 'Lectures',
    it: 'Riproduzioni',
    ru: 'Воспроизведений'
  },
  stats_top_tracks: {
    es: 'Canciones más reproducidas',
    en: 'Top played tracks',
    pt: 'Faixas mais reproduzidas',
    zh: '最常播放的歌曲',
    ja: '最も再生されたトラック',
    fr: 'Pistes les plus écoutées',
    it: 'Tracce più riprodotte',
    ru: 'Самые проигрываемые треки'
  },
  stats_top_artists: {
    es: 'Artistas más escuchados',
    en: 'Top listened artists',
    pt: 'Artistas mais ouvidos',
    zh: '最常收听的艺术家',
    ja: '最も聴いたアーティスト',
    fr: 'Artistes les plus écoutés',
    it: 'Artisti più ascoltati',
    ru: 'Самые слушаемые исполнители'
  },
  stats_listening_time: {
    es: 'Tiempo de escucha',
    en: 'Listening time',
    pt: 'Tempo de escuta',
    zh: '收听时长',
    ja: '再生時間',
    fr: 'Temps d\'écoute',
    it: 'Tempo di ascolto',
    ru: 'Время прослушивания'
  },

  /* ---------- Theme labels ---------- */
  theme_dark: { es: 'Oscuro', en: 'Dark', pt: 'Escuro', zh: '深色', ja: 'ダーク', fr: 'Sombre', it: 'Scuro', ru: 'Тёмная' },
  theme_light: { es: 'Claro', en: 'Light', pt: 'Claro', zh: '浅色', ja: 'ライト', fr: 'Clair', it: 'Chiaro', ru: 'Светлая' },
  theme_amoled: { es: 'AMOLED', en: 'AMOLED', pt: 'AMOLED', zh: 'AMOLED', ja: 'AMOLED', fr: 'AMOLED', it: 'AMOLED', ru: 'AMOLED' },
  // Tema que sigue la preferencia del sistema (claro/oscuro). Se resuelve
  // en applyTheme() y se escucha el cambio con matchMedia.
  theme_system: { es: 'Sistema', en: 'System', pt: 'Sistema', zh: '跟随系统', ja: 'システム', fr: 'Système', it: 'Sistema', ru: 'Системная' },
  // Acción de deshacer en el toast (borrados con posibilidad de recuperar).
  undo: { es: 'Deshacer', en: 'Undo', pt: 'Desfazer', zh: '撤销', ja: '元に戻す', fr: 'Annuler', it: 'Annulla', ru: 'Отменить' },
  toast_restored: { es: 'Restaurado', en: 'Restored', pt: 'Restaurado', zh: '已恢复', ja: '復元しました', fr: 'Restauré', it: 'Ripristinato', ru: 'Восстановлено' },
  // Etiquetas que estaban fijas en español en el marcado (aria-label).
  back_btn: { es: 'Volver', en: 'Back', pt: 'Voltar', zh: '返回', ja: '戻る', fr: 'Retour', it: 'Indietro', ru: 'Назад' },
  view_player: { es: 'Reproductor', en: 'Player', pt: 'Reprodutor', zh: '播放器', ja: 'プレーヤー', fr: 'Lecteur', it: 'Lettore', ru: 'Плеер' },
  exit_fs: { es: 'Salir de pantalla completa', en: 'Exit full screen', pt: 'Sair da tela cheia', zh: '退出全屏', ja: '全画面表示を終了', fr: 'Quitter le plein écran', it: 'Esci da schermo intero', ru: 'Выйти из полноэкранного режима' },
  remove: { es: 'Quitar', en: 'Remove', pt: 'Remover', zh: '移除', ja: '削除', fr: 'Retirer', it: 'Rimuovi', ru: 'Убрать' },
  favorites_empty_title: { es: 'Aún no hay favoritos', en: 'No favorites yet', pt: 'Ainda não há favoritos', zh: '还没有收藏', ja: 'お気に入りはまだありません', fr: 'Pas encore de favoris', it: 'Ancora nessun preferito', ru: 'Пока нет избранного' },
  accent_aurora: { es: 'Aurora', en: 'Aurora', pt: 'Aurora', zh: '极光', ja: 'オーロラ', fr: 'Aurore', it: 'Aurora', ru: 'Сияние' },
  accent_ocean: { es: 'Océano', en: 'Ocean', pt: 'Oceano', zh: '海洋', ja: 'オーシャン', fr: 'Océan', it: 'Oceano', ru: 'Океан' },
  accent_moss: { es: 'Musgo', en: 'Moss', pt: 'Musgo', zh: '苔绿', ja: 'モス', fr: 'Mousse', it: 'Muschio', ru: 'Мох' },
  accent_amber: { es: 'Ámbar', en: 'Amber', pt: 'Âmbar', zh: '琥珀', ja: 'アンバー', fr: 'Ambre', it: 'Ambra', ru: 'Янтарь' },
  accent_cherry: { es: 'Cereza', en: 'Cherry', pt: 'Cereja', zh: '樱桃', ja: 'チェリー', fr: 'Cerise', it: 'Ciliegia', ru: 'Вишня' },

  /* ---------- Misc ---------- */
  theme_hint: {
    es: 'El tema se aplica al instante y se guarda en el dispositivo.',
    en: 'The theme applies instantly and is saved on the device.',
    pt: 'O tema é aplicado instantaneamente e salvo no dispositivo.',
    zh: '主题会即时应用并保存在设备上。',
    ja: 'テーマは即座に適用され、デバイスに保存されます。',
    fr: 'Le thème s\'applique instantanément et est enregistré sur l\'appareil.',
    it: 'Il tema viene applicato all\'istante e salvato sul dispositivo.',
    ru: 'Тема применяется мгновенно и сохраняется на устройстве.'
  },
  accent_fuchsia: {
    es: 'Fucsia', en: 'Fuchsia', pt: 'Fúcsia',
    zh: '紫红', ja: 'フクシア', fr: 'Fuchsia',
    it: 'Fucsia', ru: 'Фуксия'
  },
  lang_hint: {
    es: 'El idioma se aplica al instante y se guarda en el dispositivo.',
    en: 'The language applies instantly and is saved on the device.',
    pt: 'O idioma é aplicado instantaneamente e salvo no dispositivo.',
    zh: '语言会即时应用并保存在设备上。',
    ja: '言語は即座に適用され、デバイスに保存されます。',
    fr: 'La langue s\'applique instantanément et est enregistrée sur l\'appareil.',
    it: 'La lingua viene applicata all\'istante e salvata sul dispositivo.',
    ru: 'Язык применяется мгновенно и сохраняется на устройстве.'
  },
  delete_track_confirm: {
    es: '¿Eliminar "X" de tu biblioteca?',
    en: 'Remove "X" from your library?',
    pt: 'Remover "X" da sua biblioteca?',
    zh: '从媒体库中删除 "X" 吗？',
    ja: 'ライブラリから「X」を削除しますか？',
    fr: 'Supprimer « X » de votre bibliothèque ?',
    it: 'Rimuovere "X" dalla libreria?',
    ru: 'Удалить «X» из библиотеки?'
  },
  delete_playlist_confirm: {
    es: '¿Eliminar la lista "X"?',
    en: 'Delete playlist "X"?',
    pt: 'Excluir lista "X"?',
    zh: '删除歌单 "X" 吗？',
    ja: 'プレイリスト「X」を削除しますか？',
    fr: 'Supprimer la liste « X » ?',
    it: 'Eliminare la lista "X"?',
    ru: 'Удалить список «X»?'
  },

  /* ---------- Empty state ---------- */
  empty_library_title: {
    es: 'Tu biblioteca está vacía',
    en: 'Your library is empty',
    pt: 'Sua biblioteca está vazia',
    zh: '你的媒体库为空',
    ja: 'ライブラリが空です',
    fr: 'Votre bibliothèque est vide',
    it: 'La tua libreria è vuota',
    ru: 'Ваша библиотека пуста'
  },
  empty_library_hint: {
    es: 'Carga tus canciones desde el almacenamiento local para empezar a disfrutar.',
    en: 'Load your songs from local storage to start enjoying.',
    pt: 'Carregue suas músicas do armazenamento local para começar a aproveitar.',
    zh: '从本地存储加载歌曲，开始享受音乐。',
    ja: 'ローカルストレージから曲を読み込んで楽しもう。',
    fr: 'Chargez vos chansons depuis le stockage local pour commencer à profiter.',
    it: 'Carica le tue canzoni dalla memoria locale per iniziare a godertele.',
    ru: 'Загрузите песни из локального хранилища, чтобы наслаждаться.'
  },
  empty_format_hint: {
    es: 'Soporta MP3, M4A, FLAC, WAV, OGG · opcional .lrc',
    en: 'Supports MP3, M4A, FLAC, WAV, OGG · optional .lrc',
    pt: 'Suporta MP3, M4A, FLAC, WAV, OGG · opcional .lrc',
    zh: '支持 MP3、M4A、FLAC、WAV、OGG · 可选 .lrc',
    ja: 'MP3、M4A、FLAC、WAV、OGG 対応 · .lrc 任意',
    fr: 'Prend en charge MP3, M4A, FLAC, WAV, OGG · .lrc en option',
    it: 'Supporta MP3, M4A, FLAC, WAV, OGG · .lrc opzionale',
    ru: 'Поддерживает MP3, M4A, FLAC, WAV, OGG · опционально .lrc'
  },
  min_short: { es: 'min', en: 'min', pt: 'min', zh: '分钟', ja: '分', fr: 'min', it: 'min', ru: 'мин' },
  track_count_one: {
    es: '1 pista', en: '1 track', pt: '1 faixa',
    zh: '1 首音轨', ja: '1 トラック', fr: '1 piste', it: '1 brano', ru: '1 трек'
  },
  tracks_count: {
    es: 'pistas',
    en: 'tracks',
    pt: 'faixas',
    zh: '首音轨',
    ja: 'トラック',
    fr: 'pistes',
    it: 'tracce',
    ru: 'треков'
  },
  playlist_count_zero: {
    es: 'Aún no tienes listas. Crea la primera con "+ Nueva".',
    en: 'No playlists yet. Create your first one with "+ New".',
    pt: 'Ainda não há listas. Crie a primeira com "+ Nova".',
    zh: '还没有歌单。点击 "+ 新建" 创建第一个。',
    ja: 'プレイリストはまだありません。「+ 新規」で作成しましょう。',
    fr: 'Aucune liste pour l\'instant. Créez la première avec « + Nouvelle ».',
    it: 'Nessuna lista ancora. Crea la prima con "+ Nuova".',
    ru: 'Списков пока нет. Создайте первый кнопкой "+ Новый".'
  },
  playlist_count_one: {
    es: '1 lista guardada',
    en: '1 playlist saved',
    pt: '1 lista salva',
    zh: '1 个歌单已保存',
    ja: 'プレイリスト1件保存済み',
    fr: '1 liste enregistrée',
    it: '1 lista salvata',
    ru: '1 список сохранён'
  },
  playlist_count_many: {
    es: 'X listas guardadas',
    en: 'X playlists saved',
    pt: 'X listas salvas',
    zh: 'X 个歌单已保存',
    ja: 'プレイリストX件保存済み',
    fr: 'X listes enregistrées',
    it: 'X liste salvate',
    ru: 'X списков сохранено'
  },
  favorites_count_zero: {
    es: 'Aún no tienes canciones favoritas. Toca el corazón en cualquier pista para añadirla.',
    en: 'No favorite songs yet. Tap the heart on any track to add it.',
    pt: 'Ainda não há favoritos. Toque no coração em qualquer faixa para adicionar.',
    zh: '还没有收藏的歌曲。点击任意音轨上的心形即可添加。',
    ja: 'お気に入りはまだありません。任意のトラックのハートをタップして追加してください。',
    fr: 'Aucun favori pour l\'instant. Touchez le cœur sur une piste pour l\'ajouter.',
    it: 'Nessun preferito ancora. Tocca il cuore su qualsiasi traccia per aggiungerla.',
    ru: 'Избранных треков пока нет. Нажмите сердце на любом треке, чтобы добавить.'
  },
  favorites_count_one: {
    es: '1 canción favorita',
    en: '1 favorite song',
    pt: '1 música favorita',
    zh: '1 首收藏歌曲',
    ja: 'お気に入り1曲',
    fr: '1 chanson favorite',
    it: '1 canzone preferita',
    ru: '1 избранная песня'
  },
  favorites_count_many: {
    es: 'X canciones favoritas',
    en: 'X favorite songs',
    pt: 'X músicas favoritas',
    zh: 'X 首收藏歌曲',
    ja: 'お気に入りX曲',
    fr: 'X chansons favorites',
    it: 'X canzoni preferite',
    ru: 'X избранных песен'
  },
  no_results: {
    es: 'Sin resultados',
    en: 'No results',
    pt: 'Sem resultados',
    zh: '无结果',
    ja: '結果なし',
    fr: 'Aucun résultat',
    it: 'Nessun risultato',
    ru: 'Нет результатов'
  },
  sleep_active_prefix: {
    es: 'Activo ·',
    en: 'Active ·',
    pt: 'Ativo ·',
    zh: '进行中 ·',
    ja: '実行中 ·',
    fr: 'Actif ·',
    it: 'Attivo ·',
    ru: 'Активен ·'
  },
  sleep_remaining: {
    es: 'restante',
    en: 'remaining',
    pt: 'restante',
    zh: '剩余',
    ja: '残り',
    fr: 'restant',
    it: 'rimanente',
    ru: 'осталось'
  },

  /* ---------- Toasts varios ---------- */
  toast_theme_applied: { es: 'Tema:', en: 'Theme:', pt: 'Tema:', zh: '主题：', ja: 'テーマ:', fr: 'Thème :', it: 'Tema:', ru: 'Тема:' },
  toast_load_module_missing: {
    es: 'Error: módulo de carga no disponible. Recarga la página.',
    en: 'Error: upload module unavailable. Reload the page.',
    pt: 'Erro: módulo de carregamento indisponível. Recarregue a página.',
    zh: '错误：上传模块不可用。请刷新页面。',
    ja: 'エラー：読み込みモジュールが利用できません。ページを再読み込みしてください。',
    fr: 'Erreur : module de chargement indisponible. Rechargez la page.',
    it: 'Errore: modulo di caricamento non disponibile. Ricarica la pagina.',
    ru: 'Ошибка: модуль загрузки недоступен. Обновите страницу.'
  },
  toast_processing_files: {
    es: 'Procesando X archivo(s)…',
    en: 'Processing X file(s)…',
    pt: 'Processando X arquivo(s)…',
    zh: '正在处理 X 个文件…',
    ja: 'X 個のファイルを処理中…',
    fr: 'Traitement de X fichier(s)…',
    it: 'Elaborazione di X file…',
    ru: 'Обработка X файл(ов)…'
  },
  toast_load_failed: {
    es: 'No se pudieron cargar las pistas',
    en: 'Could not load tracks',
    pt: 'Não foi possível carregar as faixas',
    zh: '无法加载音轨',
    ja: 'トラックを読み込めませんでした',
    fr: 'Impossible de charger les pistes',
    it: 'Impossibile caricare le tracce',
    ru: 'Не удалось загрузить треки'
  },
  toast_load_error: {
    es: 'Error al cargar archivos',
    en: 'Error loading files',
    pt: 'Erro ao carregar arquivos',
    zh: '加载文件时出错',
    ja: 'ファイルの読み込みエラー',
    fr: 'Erreur lors du chargement des fichiers',
    it: 'Errore durante il caricamento dei file',
    ru: 'Ошибка загрузки файлов'
  },
  toast_added_to_queue: {
    es: 'Añadida a la cola',
    en: 'Added to queue',
    pt: 'Adicionada à fila',
    zh: '已加入队列',
    ja: 'キューに追加しました',
    fr: 'Ajoutée à la file',
    it: 'Aggiunta alla coda',
    ru: 'Добавлено в очередь'
  },
  toast_play_next: {
    es: 'Se reproducirá a continuación',
    en: 'Will play next',
    pt: 'Reproduzirá a seguir',
    zh: '即将播放',
    ja: '次に再生します',
    fr: 'Lecture ensuite',
    it: 'Riprodurrà dopo',
    ru: 'Воспроизведётся далее'
  },
  toast_radio_based: {
    es: 'Radio basada en:',
    en: 'Radio based on:',
    pt: 'Rádio baseada em:',
    zh: '电台基于：',
    ja: 'ラジオのベース：',
    fr: 'Radio basée sur :',
    it: 'Radio basata su:',
    ru: 'Радио на основе:'
  },
  toast_playlist_empty: {
    es: 'Lista vacía',
    en: 'Empty playlist',
    pt: 'Lista vazia',
    zh: '歌单为空',
    ja: 'プレイリストが空です',
    fr: 'Liste vide',
    it: 'Lista vuota',
    ru: 'Список пуст'
  },
  toast_now_playing: {
    es: 'Reproduciendo:',
    en: 'Playing:',
    pt: 'Reproduzindo:',
    zh: '正在播放：',
    ja: '再生中：',
    fr: 'Lecture :',
    it: 'Riproduzione:',
    ru: 'Воспроизведение:'
  },
  toast_sleep_done: {
    es: 'Temporizador de sueño: fin',
    en: 'Sleep timer: ended',
    pt: 'Temporizador de sono: fim',
    zh: '睡眠定时器：结束',
    ja: 'スリープタイマー：終了',
    fr: 'Minuterie : fin',
    it: 'Timer sleep: fine',
    ru: 'Таймер сна: завершён'
  },
  toast_sleep_started: {
    es: 'Sleep en X min',
    en: 'Sleep in X min',
    pt: 'Sleep em X min',
    zh: 'X 分钟后休眠',
    ja: 'X 分後にスリープ',
    fr: 'Sommeil dans X min',
    it: 'Sleep tra X min',
    ru: 'Сон через X мин'
  },
  toast_queue_cleared: {
    es: 'Cola vaciada (manteniendo pista actual)',
    en: 'Queue cleared (kept current track)',
    pt: 'Fila limpa (faixa atual mantida)',
    zh: '队列已清空（保留当前音轨）',
    ja: 'キューをクリア（現在のトラックは維持）',
    fr: 'File vidée (piste actuelle conservée)',
    it: 'Coda svuotata (traccia attuale mantenuta)',
    ru: 'Очередь очищена (текущий трек сохранён)'
  },
  toast_name_required: {
    es: 'Pon un nombre',
    en: 'Enter a name',
    pt: 'Coloque um nome',
    zh: '请输入名称',
    ja: '名前を入力してください',
    fr: 'Saisissez un nom',
    it: 'Inserisci un nome',
    ru: 'Введите название'
  },
  toast_shuffle_on: {
    es: 'Aleatorio activado',
    en: 'Shuffle on',
    pt: 'Aleatório ativado',
    zh: '随机已开启',
    ja: 'シャッフルオン',
    fr: 'Aléatoire activé',
    it: 'Casuale attivato',
    ru: 'Случайный порядок вкл.'
  },
  toast_shuffle_off: {
    es: 'Aleatorio desactivado',
    en: 'Shuffle off',
    pt: 'Aleatório desativado',
    zh: '随机已关闭',
    ja: 'シャッフルオフ',
    fr: 'Aléatoire désactivé',
    it: 'Casuale disattivato',
    ru: 'Случайный порядок выкл.'
  },
  delete_all_confirm: {
    es: '¿Borrar TODAS las pistas de tu biblioteca? Esta acción no se puede deshacer.',
    en: 'Delete ALL tracks from your library? This action cannot be undone.',
    pt: 'Apagar TODAS as faixas da sua biblioteca? Esta ação não pode ser desfeita.',
    zh: '确定删除媒体库中的所有音轨吗？此操作无法撤销。',
    ja: 'ライブラリの全トラックを削除しますか？この操作は元に戻せません。',
    fr: 'Supprimer TOUTES les pistes de votre bibliothèque ? Action irréversible.',
    it: 'Eliminare TUTTE le tracce dalla libreria? Operazione irreversibile.',
    ru: 'Удалить ВСЕ треки из библиотеки? Действие необратимо.'
  },
  toast_all_deleted: {
    es: 'Biblioteca vaciada',
    en: 'Library cleared',
    pt: 'Biblioteca esvaziada',
    zh: '媒体库已清空',
    ja: 'ライブラリを空にしました',
    fr: 'Bibliothèque vidée',
    it: 'Libreria svuotata',
    ru: 'Библиотека очищена'
  },
  toast_removed_from_queue_stopped: {
    es: 'Pista quitada · reproducción detenida',
    en: 'Track removed · playback stopped',
    pt: 'Faixa removida · reprodução parada',
    zh: '已移除音轨 · 播放已停止',
    ja: 'トラックを削除 · 再生を停止しました',
    fr: 'Piste retirée · lecture arrêtée',
    it: 'Traccia rimossa · riproduzione fermata',
    ru: 'Трек убран · воспроизведение остановлено'
  },
  edit_playlist_title: {
    es: 'Editar lista',
    en: 'Edit playlist',
    pt: 'Editar lista',
    zh: '编辑歌单',
    ja: 'プレイリストを編集',
    fr: 'Modifier la liste',
    it: 'Modifica lista',
    ru: 'Изменить список'
  },
  no_tracks_in_playlist: {
    es: 'Esta lista está vacía. Pulsa "Subir canciones" para agregar canciones.',
    en: 'This playlist is empty. Tap "Upload songs" to add songs.',
    pt: 'Esta lista está vazia. Toque em "Adicionar faixas" para adicionar músicas.',
    zh: '此歌单为空。点击"添加音轨"添加歌曲。',
    ja: 'このプレイリストは空です。「トラックを追加」をタップして曲を追加してください。',
    fr: 'Cette liste est vide. Touchez « Ajouter des pistes » pour ajouter des chansons.',
    it: 'Questa lista è vuota. Tocca "Aggiungi tracce" per aggiungere canzoni.',
    ru: 'Этот список пуст. Нажмите «Добавить треки», чтобы добавить песни.'
  },
  remove_from_playlist: {
    es: 'Quitar de la lista',
    en: 'Remove from playlist',
    pt: 'Remover da lista',
    zh: '从歌单移除',
    ja: 'プレイリストから削除',
    fr: 'Retirer de la liste',
    it: 'Rimuovi dalla lista',
    ru: 'Убрать из списка'
  },
  toast_removed_from_playlist: {
    es: 'Pista quitada de la lista',
    en: 'Track removed from playlist',
    pt: 'Faixa removida da lista',
    zh: '已从歌单移除音轨',
    ja: 'トラックをプレイリストから削除しました',
    fr: 'Piste retirée de la liste',
    it: 'Traccia rimossa dalla lista',
    ru: 'Трек убран из списка'
  },
  toast_playlist_empty_created: {
    es: 'Lista vacía creada',
    en: 'Empty playlist created',
    pt: 'Lista vazia criada',
    zh: '已创建空歌单',
    ja: '空のプレイリストを作成しました',
    fr: 'Liste vide créée',
    it: 'Lista vuota creata',
    ru: 'Создан пустой список'
  }
,
  play_all_btn: {
    es: 'Reproducir Todo', en: 'Play All', pt: 'Reproduzir Tudo', zh: '播放全部',
    ja: 'すべて再生', fr: 'Tout lire', it: 'Riproduci tutto', ru: 'Играть все'
  },
  upload_to_playlist_btn: {
    es: 'Subir canciones', en: 'Upload songs', pt: 'Enviar músicas', zh: '上传歌曲',
    ja: '曲をアップロード', fr: 'Importer des chansons', it: 'Carica canzoni', ru: 'Загрузить песни'
  },
  confirm_clear_playlist: {
    es: '¿Vaciar esta lista? Las canciones no se borrarán de la biblioteca.',
    en: 'Clear this playlist? Songs will not be deleted from the library.',
    pt: 'Esvaziar esta lista? As músicas não serão excluídas da biblioteca.',
    zh: '清空此歌单？歌曲不会从媒体库中删除。',
    ja: 'このプレイリストを空にしますか？曲はライブラリから削除されません。',
    fr: 'Vider cette liste ? Les chansons ne seront pas supprimées de la bibliothèque.',
    it: 'Svuotare questa lista? Le canzoni non verranno eliminate dalla libreria.',
    ru: 'Очистить этот список? Песни не будут удалены из библиотеки.'
  },
  toast_playlist_cleared: {
    es: 'Lista vaciada', en: 'Playlist cleared', pt: 'Lista esvaziada', zh: '歌单已清空',
    ja: 'プレイリストを空にしました', fr: 'Liste vidée', it: 'Lista svuotata', ru: 'Список очищен'
  },
  toast_added_to_library: {
    es: 'pista(s) añadida(s) a la biblioteca',
    en: 'track(s) added to the library',
    pt: 'faixa(s) adicionada(s) à biblioteca',
    zh: '首音轨已添加到媒体库',
    ja: '曲をライブラリに追加しました',
    fr: 'piste(s) ajoutée(s) à la bibliothèque',
    it: 'traccia/e aggiunta/e alla libreria',
    ru: 'трек(ов) добавлено в медиатеку'
  },
  folder_tag: {
    es: '(carpeta)', en: '(folder)', pt: '(pasta)', zh: '（文件夹）',
    ja: '（フォルダー）', fr: '(dossier)', it: '(cartella)', ru: '(папка)'
  },
  toast_added_to_playlist_plural: {
    es: 'pista(s) añadida(s) a', en: 'track(s) added to', pt: 'faixa(s) adicionada(s) a',
    zh: '首音轨已添加到', ja: '曲を追加しました:', fr: 'piste(s) ajoutée(s) à',
    it: 'traccia/e aggiunta/e a', ru: 'трек(ов) добавлено в'
  },
  playing_from: {
    es: 'Reproduciendo desde', en: 'Playing from', pt: 'Reproduzindo de', zh: '播放来源',
    ja: '再生元:', fr: 'Lecture depuis', it: 'Riproduzione da', ru: 'Воспроизведение из'
  },
  favorites_playlist_name: {
    es: 'Favoritos', en: 'Favorites', pt: 'Favoritos', zh: '收藏',
    ja: 'お気に入り', fr: 'Favoris', it: 'Preferiti', ru: 'Избранное'
  }
,
  delete_playlist_btn: {
    es: 'Eliminar lista', en: 'Delete playlist', pt: 'Excluir lista', zh: '删除歌单',
    ja: 'プレイリストを削除', fr: 'Supprimer la liste', it: 'Elimina lista', ru: 'Удалить список'
  }
,
  /* ---------- Letras LRC ---------- */
  lrc_not_synced: {
    es: 'Letra no sincronizada', en: 'Lyrics not synced', pt: 'Letra não sincronizada',
    zh: '歌词未同步', ja: '歌詞は同期されていません', fr: 'Paroles non synchronisées',
    it: 'Testo non sincronizzato', ru: 'Текст не синхронизирован'
  },
  lrc_load_file: {
    es: 'Cargar archivo .lrc', en: 'Load .lrc file', pt: 'Carregar arquivo .lrc',
    zh: '加载 .lrc 文件', ja: '.lrc ファイルを読み込む', fr: 'Charger un fichier .lrc',
    it: 'Carica file .lrc', ru: 'Загрузить файл .lrc'
  },
  lrc_edit: {
    es: 'Editar letra', en: 'Edit lyrics', pt: 'Editar letra',
    zh: '编辑歌词', ja: '歌詞を編集', fr: 'Modifier les paroles',
    it: 'Modifica testo', ru: 'Редактировать текст'
  },
  lrc_font_size: {
    es: 'Tamaño de fuente', en: 'Font size', pt: 'Tamanho da fonte',
    zh: '字体大小', ja: 'フォントサイズ', fr: 'Taille de police',
    it: 'Dimensione testo', ru: 'Размер шрифта'
  },
  lrc_fullscreen: {
    es: 'Pantalla completa', en: 'Fullscreen', pt: 'Tela cheia',
    zh: '全屏', ja: 'フルスクリーン', fr: 'Plein écran',
    it: 'Schermo intero', ru: 'Полный экран'
  },
  lrc_font_dec: {
    es: 'Reducir letra', en: 'Smaller lyrics', pt: 'Diminuir letra',
    zh: '缩小歌词', ja: '歌詞を小さく', fr: 'Réduire les paroles',
    it: 'Riduci testo', ru: 'Уменьшить текст'
  },
  lrc_font_inc: {
    es: 'Aumentar letra', en: 'Larger lyrics', pt: 'Aumentar letra',
    zh: '放大歌词', ja: '歌詞を大きく', fr: 'Agrandir les paroles',
    it: 'Ingrandisci testo', ru: 'Увеличить текст'
  },
  lrc_offset_group: {
    es: 'Desfase de la letra', en: 'Lyrics offset', pt: 'Desvio da letra',
    zh: '歌词偏移', ja: '歌詞のずれ', fr: 'Décalage des paroles',
    it: 'Scostamento testo', ru: 'Смещение текста'
  },
  lrc_offset_short: {
    es: 'Desfase', en: 'Offset', pt: 'Desvio',
    zh: '偏移', ja: 'ずれ', fr: 'Décalage',
    it: 'Offset', ru: 'Смещение'
  },
  lrc_offset_minus_aria: {
    es: 'Retrasar la letra 0.5 s', en: 'Delay lyrics by 0.5 s', pt: 'Atrasar a letra 0,5 s',
    zh: '歌词延后 0.5 秒', ja: '歌詞を0.5秒遅らせる', fr: 'Retarder les paroles de 0,5 s',
    it: 'Ritarda il testo di 0,5 s', ru: 'Задержать текст на 0,5 с'
  },
  lrc_offset_plus_aria: {
    es: 'Adelantar la letra 0.5 s', en: 'Advance lyrics by 0.5 s', pt: 'Adiantar a letra 0,5 s',
    zh: '歌词提前 0.5 秒', ja: '歌詞を0.5秒進める', fr: 'Avancer les paroles de 0,5 s',
    it: 'Anticipa il testo di 0,5 s', ru: 'Ускорить текст на 0,5 с'
  },
  lrc_reset_all: {
    es: 'Restablecer letra (desfase, tamaño y velocidad)', en: 'Reset lyrics (offset, size and speed)',
    pt: 'Redefinir letra (desvio, tamanho e velocidade)', zh: '重置歌词（偏移、字号和速度）',
    ja: '歌詞をリセット（ずれ・サイズ・速度）', fr: 'Réinitialiser les paroles (décalage, taille et vitesse)',
    it: 'Ripristina testo (scostamento, dimensione e velocità)', ru: 'Сбросить текст (смещение, размер и скорость)'
  },
  lrc_reset_done: {
    es: 'Letra restablecida', en: 'Lyrics reset', pt: 'Letra redefinida',
    zh: '歌词已重置', ja: '歌詞をリセットしました', fr: 'Paroles réinitialisées',
    it: 'Testo ripristinato', ru: 'Текст сброшен'
  },
  lrc_save: {
    es: 'Guardar', en: 'Save', pt: 'Salvar', zh: '保存', ja: '保存',
    fr: 'Enregistrer', it: 'Salva', ru: 'Сохранить'
  },
  lrc_edit_hint: {
    es: 'Pega o edita la letra aquí. Usa [mm:ss.xx] para timestamps.',
    en: 'Paste or edit lyrics here. Use [mm:ss.xx] for timestamps.',
    pt: 'Cole ou edite a letra aqui. Use [mm:ss.xx] para timestamps.',
    zh: '在此粘贴或编辑歌词。使用 [mm:ss.xx] 作为时间戳。',
    ja: 'ここに歌詞を貼り付けまたは編集。タイムスタンプは [mm:ss.xx] を使用。',
    fr: 'Collez ou modifiez les paroles ici. Utilisez [mm:ss.xx] pour les timestamps.',
    it: 'Incolla o modifica il testo qui. Usa [mm:ss.xx] per i timestamp.',
    ru: 'Вставьте или отредактируйте текст здесь. Используйте [mm:ss.xx] для меток времени.'
  },
  lrc_loaded: {
    es: 'Letra cargada', en: 'Lyrics loaded', pt: 'Letra carregada',
    zh: '歌词已加载', ja: '歌詞を読み込みました', fr: 'Paroles chargées',
    it: 'Testo caricato', ru: 'Текст загружен'
  },
  lrc_saved: {
    es: 'Letra guardada', en: 'Lyrics saved', pt: 'Letra salva',
    zh: '歌词已保存', ja: '歌詞を保存しました', fr: 'Paroles enregistrées',
    it: 'Testo salvato', ru: 'Текст сохранён'
  },
  lrc_speed: {
    es: 'Velocidad', en: 'Speed', pt: 'Velocidade', zh: '速度', ja: '速度',
    fr: 'Vitesse', it: 'Velocità', ru: 'Скорость'
  },
  lrc_loop_section: {
    es: 'Repetir sección', en: 'Loop section', pt: 'Repetir seção',
    zh: '循环段落', ja: '区間リピート', fr: 'Boucler la section',
    it: 'Ripeti sezione', ru: 'Повторить отрывок'
  },
  lrc_loop_clear: {
    es: 'Quitar loop', en: 'Clear loop', pt: 'Limpar loop',
    zh: '清除循环', ja: 'ループ解除', fr: 'Effacer la boucle',
    it: 'Rimuovi loop', ru: 'Сбросить повтор'
  },
  lrc_loop_a_set: {
    es: 'Inicio A fijado en X', en: 'Start A set at X', pt: 'Início A fixado em X',
    zh: '起点 A 已设在 X', ja: '開始 A を X に設定', fr: 'Début A défini à X',
    it: 'Inizio A impostato a X', ru: 'Начало A установлено на X'
  },
  lrc_loop_tap_b: {
    es: 'toca para fijar el final B', en: 'tap to set end B', pt: 'toque para fixar o fim B',
    zh: '点击设置终点 B', ja: 'タップして終点 B を設定', fr: 'touchez pour définir la fin B',
    it: 'tocca per impostare la fine B', ru: 'нажмите, чтобы задать конец B'
  },
  lrc_loop_ab_active: {
    es: 'Repetir sección X → Y', en: 'Loop section X → Y', pt: 'Repetir seção X → Y',
    zh: '循环区间 X → Y', ja: '区間 X → Y をリピート', fr: 'Boucle X → Y',
    it: 'Ripeti sezione X → Y', ru: 'Повтор фрагмента X → Y'
  },
  lrc_loop_cleared: {
    es: 'Repetición de sección desactivada', en: 'Section loop cleared', pt: 'Repetição de seção desativada',
    zh: '区间循环已关闭', ja: '区間リピートを解除しました', fr: 'Boucle de section désactivée',
    it: 'Ripetizione di sezione disattivata', ru: 'Повтор фрагмента выключен'
  },
  /* ---------- Mejoras de prioridad alta ---------- */
  settings_title: {
    es: 'Ajustes', en: 'Settings', pt: 'Ajustes', zh: '设置', ja: '設定',
    fr: 'Réglages', it: 'Impostazioni', ru: 'Настройки'
  },
  settings_playback: {
    es: 'Reproducción', en: 'Playback', pt: 'Reprodução', zh: '播放', ja: '再生',
    fr: 'Lecture', it: 'Riproduzione', ru: 'Воспроизведение'
  },
  settings_interface: {
    es: 'Interfaz', en: 'Interface', pt: 'Interface', zh: '界面', ja: 'インターフェース',
    fr: 'Interface', it: 'Interfaccia', ru: 'Интерфейс'
  },
  settings_storage: {
    es: 'Almacenamiento', en: 'Storage', pt: 'Armazenamento', zh: '存储', ja: 'ストレージ',
    fr: 'Stockage', it: 'Memoria', ru: 'Хранилище'
  },
  settings_gapless: {
    es: 'Reproducción sin pausa', en: 'Gapless playback', pt: 'Reprodução sem pausas', zh: '无缝播放', ja: 'ギャップレス再生',
    fr: 'Lecture sans pause', it: 'Riproduzione senza pause', ru: 'Воспроизведение без пауз'
  },
  settings_norm_volume: {
    es: 'Normalizar volumen', en: 'Normalize volume', pt: 'Normalizar volume', zh: '音量标准化', ja: '音量の正規化',
    fr: 'Normaliser le volume', it: 'Normalizza volume', ru: 'Нормализация громкости'
  },
  settings_reset_eq: {
    es: 'Resetear EQ', en: 'Reset EQ', pt: 'Redefinir EQ', zh: '重置EQ', ja: 'EQをリセット',
    fr: 'Réinitialiser EQ', it: 'Reimposta EQ', ru: 'Сбросить EQ'
  },
  settings_retag: {
    es: 'Releer metadatos', en: 'Reread metadata', pt: 'Relê metadados', zh: '重新读取元数据', ja: 'メタデータを再読込',
    fr: 'Relire les métadonnées', it: 'Rileggi metadati', ru: 'Перечитать метаданные'
  },
  toast_retag_start: {
    es: 'Releyendo metadatos…', en: 'Rereading metadata…', pt: 'Relendo metadados…', zh: '正在重新读取元数据…', ja: 'メタデータを読み直し中…',
    fr: 'Relecture des métadonnées…', it: 'Rilettura metadati…', ru: 'Перечитывание метаданных…'
  },
  toast_retag_done: {
    es: 'X pista(s) actualizada(s)', en: 'X track(s) updated', pt: 'X faixa(s) atualizada(s)', zh: '已更新 X 首', ja: 'X 曲を更新しました',
    fr: 'X piste(s) mise(s) à jour', it: 'X traccia/e aggiornata/e', ru: 'Обновлено треков: X'
  },
  toast_retag_none: {
    es: 'No había metadatos nuevos', en: 'No new metadata found', pt: 'Sem metadados novos', zh: '没有新的元数据', ja: '新しいメタデータはありません',
    fr: 'Aucune nouvelle métadonnée', it: 'Nessun metadato nuovo', ru: 'Новых метаданных нет'
  },
  settings_history: {
    es: 'Historial', en: 'History', pt: 'Histórico', zh: '历史记录', ja: '履歴',
    fr: 'Historique', it: 'Cronologia', ru: 'История'
  },
  search_filter_all: {
    es: 'Todo', en: 'All', pt: 'Tudo', zh: '全部', ja: 'すべて',
    fr: 'Tout', it: 'Tutto', ru: 'Всё'
  },
  search_filter_title: {
    es: 'Título', en: 'Title', pt: 'Título', zh: '标题', ja: 'タイトル',
    fr: 'Titre', it: 'Titolo', ru: 'Название'
  },
  search_filter_artist: {
    es: 'Artista', en: 'Artist', pt: 'Artista', zh: '艺术家', ja: 'アーティスト',
    fr: 'Artiste', it: 'Artista', ru: 'Исполнитель'
  },
  search_filter_album: {
    es: 'Álbum', en: 'Album', pt: 'Álbum', zh: '专辑', ja: 'アルバム',
    fr: 'Album', it: 'Album', ru: 'Альбом'
  },
  toast_duplicate_found: {
    es: 'pista(s) duplicada(s) omitida(s)', en: 'duplicate track(s) skipped', pt: 'faixa(s) duplicada(s) ignorada(s)',
    zh: '首重复音轨已跳过', ja: '重複トラックをスキップしました', fr: 'piste(s) en double ignorée(s)',
    it: 'traccia(e) duplicata/e saltata/e', ru: 'дубликат(ов) пропущено'
  },
  history_title: {
    es: 'Historial de reproducción', en: 'Playback history', pt: 'Histórico de reprodução', zh: '播放历史', ja: '再生履歴',
    fr: 'Historique de lecture', it: 'Cronologia riproduzione', ru: 'История воспроизведения'
  },
  history_empty: {
    es: 'Sin historial todavía', en: 'No history yet', pt: 'Sem histórico ainda', zh: '暂无历史记录', ja: '履歴はまだありません',
    fr: "Pas encore d'historique", it: 'Nessuna cronologia ancora', ru: 'Истории пока нет'
  },

  /* ---------- Pulido i18n ---------- */
  queue_empty: {
    es: 'La cola está vacía',
    en: 'Queue is empty',
    pt: 'A fila está vazia',
    zh: '队列为空',
    ja: 'キューは空です',
    fr: 'La file est vide',
    it: 'La coda è vuota',
    ru: 'Очередь пуста'
  },
  stats_reset_toast: {
    es: 'Estadísticas reiniciadas',
    en: 'Statistics reset',
    pt: 'Estatísticas reiniciadas',
    zh: '统计已重置',
    ja: '統計をリセットしました',
    fr: 'Statistiques réinitialisées',
    it: 'Statistiche azzerate',
    ru: 'Статистика сброшена'
  },
  history_reset_toast: {
    es: 'Historial reiniciado',
    en: 'History cleared',
    pt: 'Histórico reiniciado',
    zh: '历史已重置',
    ja: '履歴をリセットしました',
    fr: 'Historique réinitialisé',
    it: 'Cronologia azzerata',
    ru: 'История сброшена'
  },
  stats_reset_confirm: {
    es: '¿Reiniciar estadísticas?',
    en: 'Reset statistics?',
    pt: 'Reiniciar estatísticas?',
    zh: '重置统计？',
    ja: '統計をリセットしますか？',
    fr: 'Réinitialiser les statistiques ?',
    it: 'Azzerare le statistiche?',
    ru: 'Сбросить статистику?'
  },
  history_reset_confirm: {
    es: '¿Reiniciar historial?',
    en: 'Clear history?',
    pt: 'Reiniciar histórico?',
    zh: '重置历史？',
    ja: '履歴をリセットしますか？',
    fr: "Réinitialiser l'historique ?",
    it: 'Azzerare la cronologia?',
    ru: 'Сбросить историю?'
  },

  lrc_offset_toast: {
    es: 'Desfase: X',
    en: 'Offset: X',
    pt: 'Desvio: X',
    zh: '偏移：X',
    ja: 'オフセット: X',
    fr: 'Décalage : X',
    it: 'Scostamento: X',
    ru: 'Смещение: X'
  },
  cancel: {
    es: 'Cancelar',
    en: 'Cancel',
    pt: 'Cancelar',
    zh: '取消',
    ja: 'キャンセル',
    fr: 'Annuler',
    it: 'Annulla',
    ru: 'Отмена'
  },
  confirm_delete: {
    es: 'Eliminar',
    en: 'Delete',
    pt: 'Excluir',
    zh: '删除',
    ja: '削除',
    fr: 'Supprimer',
    it: 'Elimina',
    ru: 'Удалить'
  },

  stats_reset_btn: {
    es: 'Reiniciar estadísticas',
    en: 'Reset statistics',
    pt: 'Reiniciar estatísticas',
    zh: '重置统计',
    ja: '统计をリセット',
    fr: 'Réinitialiser les statistiques',
    it: 'Azzera statistiche',
    ru: 'Сбросить статистику'
  },
  history_reset_btn: {
    es: 'Reiniciar historial',
    en: 'Clear history',
    pt: 'Reiniciar histórico',
    zh: '重置历史',
    ja: '履歴をリセット',
    fr: "Réinitialiser l'historique",
    it: 'Azzera cronologia',
    ru: 'Сбросить историю'
  },
  toast_audio_error: {
    es: 'No se pudo reproducir esta pista',
    en: 'Could not play this track',
    pt: 'Não foi possível reproduzir esta faixa',
    zh: '无法播放此音轨',
    ja: 'このトラックを再生できませんでした',
    fr: 'Impossible de lire cette piste',
    it: 'Impossibile riprodurre questa traccia',
    ru: 'Не удалось воспроизвести этот трек'
  },
  toast_storage_full: {
    es: 'Almacenamiento lleno. Libera espacio o borra pistas.',
    en: 'Storage is full. Free up space or delete tracks.',
    pt: 'Armazenamento cheio. Liberte espaço ou apague faixas.',
    zh: '存储已满。请释放空间或删除音轨。',
    ja: 'ストレージがいっぱいです。容量を空けるか曲を削除してください。',
    fr: 'Stockage plein. Libérez de l\'espace ou supprimez des pistes.',
    it: 'Memoria piena. Libera spazio o elimina tracce.',
    ru: 'Память заполнена. Освободите место или удалите треки.'
  },
  toast_play_blocked: {
    es: 'El navegador bloqueó la reproducción. Toca ▶ para empezar.',
    en: 'The browser blocked playback. Tap ▶ to start.',
    pt: 'O navegador bloqueou a reprodução. Toque em ▶ para começar.',
    zh: '浏览器阻止了播放。点按 ▶ 开始。',
    ja: 'ブラウザが再生をブロックしました。▶ をタップして開始。',
    fr: 'Le navigateur a bloqué la lecture. Touchez ▶ pour commencer.',
    it: 'Il browser ha bloccato la riproduzione. Tocca ▶ per iniziare.',
    ru: 'Браузер заблокировал воспроизведение. Нажмите ▶, чтобы начать.'
  },
  confirm_ok: {
    es: 'Aceptar',
    en: 'OK',
    pt: 'Aceitar',
    zh: '确定',
    ja: 'OK',
    fr: 'OK',
    it: 'OK',
    ru: 'ОК'
  },

  /* ---------- Fase 1: navegación ---------- */
  home_continue: {
    es: 'Continuar escuchando', en: 'Continue listening', pt: 'Continuar ouvindo',
    zh: '继续收听', ja: '再生を続ける', fr: 'Continuer l\'écoute',
    it: 'Continua ad ascoltare', ru: 'Продолжить прослушивание'
  },
  home_recent: {
    es: 'Recién añadidas', en: 'Recently added', pt: 'Adicionadas recentemente',
    zh: '最近添加', ja: '最近追加した曲', fr: 'Ajoutées récemment',
    it: 'Aggiunte di recente', ru: 'Недавно добавленные'
  },
  home_playlists: {
    es: 'Listas', en: 'Playlists', pt: 'Listas',
    zh: '歌单', ja: 'プレイリスト', fr: 'Listes',
    it: 'Liste', ru: 'Плейлисты'
  },
  home_top: {
    es: 'Más escuchadas', en: 'Most played', pt: 'Mais ouvidas',
    zh: '最常播放', ja: 'よく聴く曲', fr: 'Les plus écoutées',
    it: 'Più ascoltate', ru: 'Самые слушаемые'
  },
  home_resume_at: {
    es: 'Retomar en X', en: 'Resume at X', pt: 'Retomar em X',
    zh: '从 X 继续', ja: 'X から再開', fr: 'Reprendre à X',
    it: 'Riprendi da X', ru: 'Продолжить с X'
  },
  see_all: {
    es: 'Ver todo', en: 'See all', pt: 'Ver tudo',
    zh: '查看全部', ja: 'すべて見る', fr: 'Tout voir',
    it: 'Vedi tutto', ru: 'Показать все'
  },
  ctx_play_now: {
    es: 'Reproducir ahora', en: 'Play now', pt: 'Reproduzir agora',
    zh: '立即播放', ja: '今すぐ再生', fr: 'Lire maintenant',
    it: 'Riproduci ora', ru: 'Играть сейчас'
  },
  ctx_play_next: {
    es: 'Reproducir después de la canción actual', en: 'Play after current song', pt: 'Tocar depois da música atual',
    zh: '在当前歌曲之后播放', ja: '現在の曲の後に再生', fr: 'Lire après le titre en cours',
    it: 'Riproduci dopo il brano attuale', ru: 'Играть после текущей песни'
  },
  ctx_add_queue: {
    es: 'Añadir a la cola', en: 'Add to queue', pt: 'Adicionar à fila',
    zh: '加入队列', ja: 'キューに追加', fr: 'Ajouter à la file',
    it: 'Aggiungi in coda', ru: 'Добавить в очередь'
  },
  ctx_edit_tags: {
    es: 'Editar etiquetas', en: 'Edit tags', pt: 'Editar tags',
    zh: '编辑标签', ja: 'タグを編集', fr: 'Modifier les tags',
    it: 'Modifica tag', ru: 'Править теги'
  },
  ctx_change_cover: {
    es: 'Cambiar portada', en: 'Change cover art', pt: 'Mudar capa',
    zh: '更换封面', ja: 'ジャケットを変更', fr: 'Changer la pochette',
    it: 'Cambia copertina', ru: 'Сменить обложку'
  },
  ctx_remove_cover: {
    es: 'Restablecer portada', en: 'Restore original cover', pt: 'Repor capa original',
    zh: '恢复原始封面', ja: '元のジャケットに戻す', fr: 'Rétablir la pochette',
    it: 'Ripristina copertina', ru: 'Вернуть исходную обложку'
  },
  toast_cover_updated: {
    es: 'Portada actualizada', en: 'Cover updated', pt: 'Capa atualizada',
    zh: '封面已更新', ja: 'ジャケットを更新しました', fr: 'Pochette mise à jour',
    it: 'Copertina aggiornata', ru: 'Обложка обновлена'
  },
  toast_cover_removed: {
    es: 'Portada restablecida', en: 'Original cover restored', pt: 'Capa original reposta',
    zh: '已恢复原始封面', ja: '元のジャケットに戻しました', fr: 'Pochette d’origine rétablie',
    it: 'Copertina originale ripristinata', ru: 'Исходная обложка возвращена'
  },
  toast_cover_error: {
    es: 'No se pudo usar esa imagen', en: 'That image could not be used', pt: 'Não foi possível usar essa imagem',
    zh: '无法使用该图片', ja: 'その画像は使えませんでした', fr: 'Impossible d’utiliser cette image',
    it: 'Impossibile usare quell’immagine', ru: 'Не удалось использовать изображение'
  },
  edit_track_title: {
    es: 'Editar pista', en: 'Edit track', pt: 'Editar faixa',
    zh: '编辑音轨', ja: 'トラックを編集', fr: 'Modifier la piste',
    it: 'Modifica traccia', ru: 'Изменить трек'
  },
  edit_track_saved: {
    es: 'Etiquetas guardadas', en: 'Tags saved', pt: 'Tags salvas',
    zh: '标签已保存', ja: 'タグを保存しました', fr: 'Tags enregistrés',
    it: 'Tag salvati', ru: 'Теги сохранены'
  },
  field_title: {
    es: 'Título', en: 'Title', pt: 'Título',
    zh: '标题', ja: 'タイトル', fr: 'Titre',
    it: 'Titolo', ru: 'Название'
  },
  field_artist: {
    es: 'Artista', en: 'Artist', pt: 'Artista',
    zh: '艺术家', ja: 'アーティスト', fr: 'Artiste',
    it: 'Artista', ru: 'Исполнитель'
  },
  field_album: {
    es: 'Álbum', en: 'Album', pt: 'Álbum',
    zh: '专辑', ja: 'アルバム', fr: 'Album',
    it: 'Album', ru: 'Альбом'
  },
  menu_go_to_album: {
    es: 'Ir al álbum', en: 'Go to album', pt: 'Ir para o álbum',
    zh: '查看专辑', ja: 'アルバムへ', fr: 'Aller à l\'album',
    it: 'Vai all\'album', ru: 'К альбому'
  },

  /* ---------- Fase 2: motor de audio ---------- */
  settings_crossfade: {
    es: 'Fundido cruzado', en: 'Crossfade', pt: 'Crossfade',
    zh: '交叉淡化', ja: 'クロスフェード', fr: 'Fondu enchaîné',
    it: 'Dissolvenza', ru: 'Кроссфейд'
  },
  settings_crossfade_off: {
    es: 'Off', en: 'Off', pt: 'Off',
    zh: '关', ja: 'オフ', fr: 'Off',
    it: 'Off', ru: 'Выкл'
  },
  toast_skipped_give_up: {
    es: 'X pistas omitidas. Reproducción pausada.',
    en: 'X tracks skipped. Playback paused.',
    pt: 'X faixas omitidas. Reprodução pausada.',
    zh: '已跳过 X 首。播放已暂停。',
    ja: 'X 曲をスキップしました。再生を一時停止。',
    fr: 'X pistes ignorées. Lecture en pause.',
    it: 'X tracce saltate. Riproduzione in pausa.',
    ru: 'Пропущено треков: X. Воспроизведение на паузе.'
  },
  toast_eq_reset: {
    es: 'EQ restablecido', en: 'EQ reset', pt: 'EQ redefinido',
    zh: '均衡器已重置', ja: 'EQをリセットしました', fr: 'Égaliseur réinitialisé',
    it: 'EQ reimpostato', ru: 'Эквалайзер сброшен'
  },

  /* ---------- Fase 3: biblioteca sólida ---------- */
  import_title: {
    es: 'Importando música', en: 'Importing music', pt: 'A importar música',
    zh: '正在导入音乐', ja: '音楽を読み込み中', fr: 'Import de la musique',
    it: 'Importazione in corso', ru: 'Импорт музыки'
  },
  import_cancel: {
    es: 'Cancelar', en: 'Cancel', pt: 'Cancelar',
    zh: '取消', ja: 'キャンセル', fr: 'Annuler',
    it: 'Annulla', ru: 'Отмена'
  },
  toast_import_cancelled: {
    es: 'Importación cancelada. Se añadieron X pistas.',
    en: 'Import cancelled. X tracks added.',
    pt: 'Importação cancelada. X faixas adicionadas.',
    zh: '导入已取消。已添加 X 首。',
    ja: '読み込みを中止。X 曲を追加しました。',
    fr: 'Import annulé. X pistes ajoutées.',
    it: 'Importazione annullata. X brani aggiunti.',
    ru: 'Импорт отменён. Добавлено треков: X.'
  },
  ctx_start_radio: {
    es: 'Iniciar radio', en: 'Start radio', pt: 'Iniciar rádio',
    zh: '开始电台', ja: 'ラジオを開始', fr: 'Lancer la radio',
    it: 'Avvia radio', ru: 'Запустить радио'
  },
  radio_label: {
    es: 'Radio', en: 'Radio', pt: 'Rádio',
    zh: '电台', ja: 'ラジオ', fr: 'Radio',
    it: 'Radio', ru: 'Радио'
  },
  rename_playlist_btn: {
    es: 'Renombrar', en: 'Rename', pt: 'Mudar nome',
    zh: '重命名', ja: '名前を変更', fr: 'Renommer',
    it: 'Rinomina', ru: 'Переименовать'
  },
  toast_playlist_renamed: {
    es: 'Lista renombrada', en: 'Playlist renamed', pt: 'Lista mudada de nome',
    zh: '播放列表已重命名', ja: 'プレイリスト名を変更しました', fr: 'Liste renommée',
    it: 'Playlist rinominata', ru: 'Плейлист переименован'
  },
  search_recent: {
    es: 'Búsquedas recientes', en: 'Recent searches', pt: 'Pesquisas recentes',
    zh: '最近搜索', ja: '最近的搜索', fr: 'Recherches récentes',
    it: 'Ricerche recenti', ru: 'Недавние запросы'
  },
  search_empty_title: {
    es: 'Sin búsquedas recientes', en: 'No recent searches', pt: 'Sem pesquisas recentes',
    zh: '暂无最近搜索', ja: '最近の検索はありません', fr: 'Aucune recherche récente',
    it: 'Nessuna ricerca recente', ru: 'Нет недавних запросов'
  },
  search_empty_hint: {
    es: 'Escribe arriba para buscar por canción, artista o álbum en tu biblioteca.',
    en: 'Type above to search your library by song, artist or album.',
    pt: 'Escreve acima para pesquisar por música, artista ou álbum na tua biblioteca.',
    zh: '在上方输入，按歌曲、艺人或专辑搜索你的曲库。',
    ja: '上で入力すると、曲名・アーティスト・アルバムでライブラリを検索できます。',
    fr: 'Saisis ci-dessus pour chercher par titre, artiste ou album dans ta bibliothèque.',
    it: 'Scrivi sopra per cercare per brano, artista o album nella tua libreria.',
    ru: 'Введите выше, чтобы искать по треку, исполнителю или альбому в библиотеке.'
  },
  search_section_songs: {
    es: 'Canciones', en: 'Songs', pt: 'Músicas',
    zh: '歌曲', ja: '曲', fr: 'Titres',
    it: 'Brani', ru: 'Треки'
  },
  search_section_albums: {
    es: 'Álbumes', en: 'Albums', pt: 'Álbuns',
    zh: '专辑', ja: 'アルバム', fr: 'Albums',
    it: 'Album', ru: 'Альбомы'
  },
  search_section_artists: {
    es: 'Artistas', en: 'Artists', pt: 'Artistas',
    zh: '艺人', ja: 'アーティスト', fr: 'Artistes',
    it: 'Artisti', ru: 'Исполнители'
  },
  search_clear_history: {
    es: 'Borrar historial', en: 'Clear history', pt: 'Limpar histórico',
    zh: '清除记录', ja: '履歴を消去', fr: 'Effacer l\'historique',
    it: 'Cancella cronologia', ru: 'Очистить историю'
  },
  toast_lrc_attached: {
    es: 'X letra(s) enlazada(s)',
    en: 'X lyric file(s) linked',
    pt: 'X letra(s) associada(s)',
    zh: '已关联 X 个歌词文件',
    ja: '歌詞ファイル X 件を関連付けました',
    fr: 'X fichier(s) de paroles associé(s)',
    it: 'X file di testi collegati',
    ru: 'Связано текстов: X'
  },
  toast_lrc_none: {
    es: 'Ninguna letra coincidió con tus canciones',
    en: 'No lyrics matched your songs',
    pt: 'Nenhuma letra coincidiu com as tuas músicas',
    zh: '没有歌词与你的歌曲匹配',
    ja: '一致する歌詞はありませんでした',
    fr: 'Aucune parole n’a correspondu à vos titres',
    it: 'Nessun testo corrisponde ai tuoi brani',
    ru: 'Ни один текст не подошёл к вашим песням'
  },
  toast_track_no_audio: {
    es: 'Pista sin audio: vuelve a importarla para escucharla',
    en: 'Track has no audio: import it again to play it',
    pt: 'Faixa sem áudio: importa-a de novo para ouvir',
    zh: '歌曲无音频：请重新导入后播放',
    ja: '音声がありません：再度インポートしてください',
    fr: 'Morceau sans audio : réimportez-le pour l\'écouter',
    it: 'Brano senza audio: importalo di nuovo per ascoltarlo',
    ru: 'Нет аудио: импортируйте трек заново'
  },
  bg_notice_text: {
    es: 'Consejo: usa el botón inicio para salir sin detener la música. El botón atrás cierra Aurora y detiene la reproducción.',
    en: 'Tip: use the home button to leave without stopping the music. The back button closes Aurora and stops playback.',
    pt: 'Dica: use o botão de início para sair sem parar a música. O botão de voltar fecha o Aurora e para a reprodução.',
    zh: '提示：按主屏幕键离开可继续播放音乐。按返回键将关闭 Aurora 并停止播放。',
    ja: 'ヒント：ホームボタンで離れれば音楽は流れ続けます。戻るボタンでは Aurora が閉じて停止します。',
    fr: 'Astuce : utilisez le bouton d\'accueil pour partir sans couper la musique. Le bouton retour ferme Aurora et arrête la lecture.',
    it: 'Suggerimento: usa il tasto home per uscire senza fermare la musica. Il tasto indietro chiude Aurora e interrompe la riproduzione.',
    ru: 'Совет: кнопка «Домой» сворачивает без остановки музыки. Кнопка «Назад» закрывает Aurora и останавливает воспроизведение.'
  },
  bg_notice_ok: {
    es: 'Entendido',
    en: 'Got it',
    pt: 'Entendi',
    zh: '知道了',
    ja: '了解',
    fr: 'Compris',
    it: 'Capito',
    ru: 'Понятно'
  },
  settings_free_storage: {
    es: 'Liberar espacio', en: 'Free up space', pt: 'Libertar espaço',
    zh: '释放空间', ja: '容量を空ける', fr: 'Libérer de l\'espace',
    it: 'Libera spazio', ru: 'Освободить место'
  },
  storage_usage: {
    es: 'X pistas · Y', en: 'X tracks · Y', pt: 'X faixas · Y',
    zh: 'X 首 · Y', ja: 'X 曲 · Y', fr: 'X pistes · Y',
    it: 'X brani · Y', ru: 'X треков · Y'
  },

  /* ---------- Fase 4: Now Playing y letras ---------- */
  np_loading: {
    es: 'Cargando…', en: 'Loading…', pt: 'A carregar…',
    zh: '加载中…', ja: '読み込み中…', fr: 'Chargement…',
    it: 'Caricamento…', ru: 'Загрузка…'
  },
  lrc_empty_title: {
    es: 'Sin letra', en: 'No lyrics', pt: 'Sem letra',
    zh: '没有歌词', ja: '歌詞なし', fr: 'Pas de paroles',
    it: 'Niente testo', ru: 'Нет текста'
  },
  lrc_empty_hint: {
    es: 'Carga un archivo .lrc o pega la letra para sincronizarla.',
    en: 'Load a .lrc file or paste lyrics to sync them.',
    pt: 'Carregue um ficheiro .lrc ou cole a letra para sincronizar.',
    zh: '加载 .lrc 文件或粘贴歌词以同步。',
    ja: '.lrc を読み込むか、歌詞を貼り付けて同期できます。',
    fr: 'Chargez un fichier .lrc ou collez les paroles pour les synchroniser.',
    it: 'Carica un file .lrc o incolla il testo per sincronizzarlo.',
    ru: 'Загрузите .lrc или вставьте текст, чтобы синхронизировать.'
  },
  lrc_load_cta: {
    es: 'Cargar .lrc', en: 'Load .lrc', pt: 'Carregar .lrc',
    zh: '加载 .lrc', ja: '.lrc を読み込む', fr: 'Charger .lrc',
    it: 'Carica .lrc', ru: 'Загрузить .lrc'
  },
  lrc_paste_cta: {
    es: 'Pegar o editar', en: 'Paste or edit', pt: 'Colar ou editar',
    zh: '粘贴或编辑', ja: '貼り付け / 編集', fr: 'Coller ou modifier',
    it: 'Incolla o modifica', ru: 'Вставить или править'
  },

  home_welcome_title: {
    es: 'Tu música, aquí',
    en: 'Your music, right here',
    pt: 'A tua música, aqui',
    zh: '你的音乐，就在这里',
    ja: 'あなたの音楽を、ここに',
    fr: 'Votre musique, ici',
    it: 'La tua musica, qui',
    ru: 'Твоя музыка здесь'
  },
  home_welcome_lead: {
    /* Neutro de plataforma: la app también se usa en Delta Chat de
     * escritorio, así que nada de «del teléfono»: «tu dispositivo». */
    es: 'Carga canciones desde tu dispositivo. Sin cuenta, sin nube, sin anuncios.',
    en: 'Load songs from your device. No account, no cloud, no ads.',
    pt: 'Carregue músicas do seu dispositivo. Sem conta, sem nuvem, sem anúncios.',
    zh: '从你的设备加载歌曲。无需账号、云端或广告。',
    ja: 'デバイスから曲を読み込む。アカウントもクラウドも広告もなし。',
    fr: 'Chargez des titres depuis votre appareil. Sans compte, sans cloud, sans pubs.',
    it: 'Carica brani dal tuo dispositivo. Niente account, cloud o pubblicità.',
    ru: 'Загрузите песни со своего устройства. Без аккаунта, облака и рекламы.'
  },
  home_perk_lyrics: {
    es: 'Letras sincronizadas', en: 'Synced lyrics', pt: 'Letra sincronizada',
    zh: '同步歌词', ja: '同期歌詞', fr: 'Paroles synchronisées',
    it: 'Testi sincronizzati', ru: 'Синхронный текст'
  },
  home_perk_playlists: {
    es: 'Listas y favoritos', en: 'Playlists and favorites', pt: 'Listas e favoritos',
    zh: '歌单和收藏', ja: 'リストとお気に入り', fr: 'Listes et favoris',
    it: 'Liste e preferiti', ru: 'Плейлисты и избранное'
  },
  home_perk_offline: {
    es: 'Local y privado', en: 'Local and private', pt: 'Local e privado',
    zh: '本地且私密', ja: 'ローカルでプライベート', fr: 'Local et privé',
    it: 'Locale e privato', ru: 'Локально и приватно'
  },
  /* Descripciones de una línea bajo cada ventaja de la bienvenida: la
   * ventaja sola parecía un botón; con descripción se lee como lo que
   * es, información. */
  home_perk_lyrics_desc: {
    es: 'Con tus archivos .lrc, línea a línea', en: 'With your .lrc files, line by line', pt: 'Com seus arquivos .lrc, linha a linha',
    zh: '使用 .lrc 文件逐行同步', ja: '.lrcファイルで一行ずつ同期', fr: 'Avec vos fichiers .lrc, ligne par ligne',
    it: 'Con i tuoi file .lrc, riga per riga', ru: 'С файлами .lrc — строка за строкой'
  },
  home_perk_playlists_desc: {
    es: 'Crea listas y marca favoritos', en: 'Build playlists and save favorites', pt: 'Crie listas e salve favoritos',
    zh: '创建歌单并收藏喜欢的歌曲', ja: 'プレイリスト作成とお気に入り登録', fr: 'Créez des listes et des favoris',
    it: 'Crea liste e salva i preferiti', ru: 'Создавайте плейлисты и отмечайте избранное'
  },
  home_perk_offline_desc: {
    /* También neutro: en PC «tu teléfono» no tiene sentido. */
    es: 'Todo queda en tu dispositivo', en: 'Everything stays on your device', pt: 'Tudo fica no seu dispositivo',
    zh: '一切都只保存在你的设备中', ja: 'データはすべて端末の中だけ', fr: 'Tout reste sur votre appareil',
    it: 'Tutto resta sul tuo dispositivo', ru: 'Всё хранится только на вашем устройстве'
  },

  shortcuts_title: {
    es: 'Atajos de teclado', en: 'Keyboard shortcuts', pt: 'Atalhos de teclado',
    zh: '键盘快捷键', ja: 'キーボードショートカット', fr: 'Raccourcis clavier',
    it: 'Scorciatoie da tastiera', ru: 'Клавиатурные сокращения'
  },
  shortcuts_hint: {
    es: 'Pulsa ? para abrir esta hoja.',
    en: 'Press ? to open this sheet.',
    pt: 'Prima ? para abrir esta folha.',
    zh: '按 ? 打开此面板。',
    ja: '? でこのシートを開きます。',
    fr: 'Appuyez sur ? pour ouvrir cette feuille.',
    it: 'Premi ? per aprire questo foglio.',
    ru: 'Нажмите ?, чтобы открыть эту панель.'
  },
  shortcut_play: {
    es: 'Reproducir / pausa', en: 'Play / pause', pt: 'Reproduzir / pausa',
    zh: '播放 / 暂停', ja: '再生 / 一時停止', fr: 'Lecture / pause',
    it: 'Play / pausa', ru: 'Играть / пауза'
  },
  shortcut_seek: {
    es: 'Avanzar / rebobinar 5 s', en: 'Seek ±5 s', pt: 'Avançar / recuar 5 s',
    zh: '快进 / 快退 5 秒', ja: '5秒送り / 戻し', fr: 'Avancer / reculer de 5 s',
    it: 'Avanti / indietro 5 s', ru: 'Перемотка ±5 с'
  },
  shortcut_skip: {
    es: 'Siguiente / anterior (o Shift + flecha)',
    en: 'Next / previous (or Shift + arrow)',
    pt: 'Seguinte / anterior (ou Shift + seta)',
    zh: '下一首 / 上一首（或 Shift + 方向键）',
    ja: '次 / 前（または Shift + 矢印）',
    fr: 'Suivant / précédent (ou Maj + flèche)',
    it: 'Successivo / precedente (o Shift + freccia)',
    ru: 'Следующий / предыдущий (или Shift + стрелка)'
  },
  shortcut_volume: {
    es: 'Subir / bajar volumen', en: 'Volume up / down', pt: 'Volume cima / baixo',
    zh: '音量升高 / 降低', ja: '音量アップ / ダウン', fr: 'Volume plus / moins',
    it: 'Volume su / giù', ru: 'Громче / тише'
  },
  shortcut_mute: {
    es: 'Silencio', en: 'Mute', pt: 'Silenciar',
    zh: '静音', ja: 'ミュート', fr: 'Muet',
    it: 'Muto', ru: 'Без звука'
  },
  shortcut_like: {
    es: 'Favorito', en: 'Favorite', pt: 'Favorito',
    zh: '收藏', ja: 'お気に入り', fr: 'Favori',
    it: 'Preferito', ru: 'В избранное'
  },
  shortcut_esc: {
    es: 'Cerrar panel', en: 'Close sheet', pt: 'Fechar painel',
    zh: '关闭面板', ja: 'シートを閉じる', fr: 'Fermer le panneau',
    it: 'Chiudi pannello', ru: 'Закрыть панель'
  },
  shortcut_help: {
    es: 'Esta ayuda', en: 'This help', pt: 'Esta ajuda',
    zh: '本帮助', ja: 'このヘルプ', fr: 'Cette aide',
    it: 'Questo aiuto', ru: 'Эта справка'
  },
  settings_about: {
    es: 'Acerca de', en: 'About', pt: 'Acerca de',
    zh: '关于', ja: '情報', fr: 'À propos',
    it: 'Informazioni', ru: 'О программе'
  },
  settings_version: {
    es: 'Versión', en: 'Version', pt: 'Versão',
    zh: '版本', ja: 'バージョン', fr: 'Version',
    it: 'Versione', ru: 'Версия'
  },
  settings_license: {
    es: 'Licencia MIT', en: 'MIT License', pt: 'Licença MIT',
    zh: 'MIT 许可证', ja: 'MIT ライセンス', fr: 'Licence MIT',
    it: 'Licenza MIT', ru: 'Лицензия MIT'
  },
  settings_source: {
    es: 'Código fuente', en: 'Source code', pt: 'Código-fonte',
    zh: '源代码', ja: 'ソースコード', fr: 'Code source',
    it: 'Codice sorgente', ru: 'Исходный код'
  },
  settings_marquee: {
    es: 'Marquee en títulos largos', en: 'Marquee for long titles', pt: 'Marquee em títulos longos',
    zh: '长标题滚动', ja: '長いタイトルをスクロール', fr: 'Marquee des titres longs',
    it: 'Marquee per titoli lunghi', ru: 'Бегущая строка длинных названий'
  },
  settings_vinyl: {
    es: 'Vinilo en la portada', en: 'Vinyl on artwork', pt: 'Vinil na capa',
    zh: '封面黑胶效果', ja: 'ジャケットにレコード', fr: 'Vinyle sur la pochette',
    it: 'Vinile sulla copertina', ru: 'Винил на обложке'
  },
  settings_sleep_fade: {
    es: 'El temporizador sleep hace un fade-out de 10 s al apagar.',
    en: 'The sleep timer fades out over 10 s before stopping.',
    pt: 'O temporizador sleep faz fade-out de 10 s ao parar.',
    zh: '睡眠定时器在停止前会淡出 10 秒。',
    ja: 'スリープタイマーは停止前に10秒フェードアウトします。',
    fr: 'Le minuteur sleep fait un fade-out de 10 s à l’arrêt.',
    it: 'Il timer sleep fa un fade-out di 10 s all’arresto.',
    ru: 'Таймер сна делает затухание 10 с перед остановкой.'
  },
  settings_delete_library: {
    es: 'Borrar toda la biblioteca', en: 'Delete entire library', pt: 'Apagar toda a biblioteca',
    zh: '删除整个曲库', ja: 'ライブラリを全削除', fr: 'Effacer toute la bibliothèque',
    it: 'Elimina tutta la libreria', ru: 'Удалить всю библиотеку'
  },
  settings_shortcuts: {
    es: 'Atajos de teclado', en: 'Keyboard shortcuts', pt: 'Atalhos de teclado',
    zh: '键盘快捷键', ja: 'キーボードショートカット', fr: 'Raccourcis clavier',
    it: 'Scorciatoie da tastiera', ru: 'Клавиатурные сокращения'
  },
  share_playlist_btn: {
    es: 'Compartir lista', en: 'Share playlist', pt: 'Compartilhar lista',
    zh: '分享歌单', ja: 'プレイリストを共有', fr: 'Partager la liste',
    it: 'Condividi playlist', ru: 'Поделиться плейлистом'
  },
  ctx_share_track: {
    es: 'Compartir en chat / Exportar', en: 'Share to chat / Export', pt: 'Compartilhar no chat / Exportar',
    zh: '分享到聊天 / 导出', ja: 'チャットに共有 / 書き出し', fr: 'Partager dans le chat / Exporter',
    it: 'Condividi in chat / Esporta', ru: 'Поделиться в чате / Экспорт'
  },
  menu_share_track: {
    es: 'Compartir canción en chat', en: 'Share song to chat', pt: 'Compartilhar música no chat',
    zh: '在聊天中分享歌曲', ja: '曲をチャットに共有', fr: 'Partager le morceau dans le chat',
    it: 'Condividi brano in chat', ru: 'Поделиться треком в чате'
  },
  lrc_export_btn: {
    es: 'Compartir', en: 'Share', pt: 'Compartilhar',
    zh: '分享', ja: '共有', fr: 'Partager',
    it: 'Condividi', ru: 'Поделиться'
  },
  lrc_share_tooltip: {
    es: 'Compartir letra', en: 'Share lyrics', pt: 'Compartilhar letra',
    zh: '分享歌词', ja: '歌詞を共有', fr: 'Partager les paroles',
    it: 'Condividi testo', ru: 'Поделиться текстом'
  },
  stats_share_btn: {
    es: 'Compartir resumen', en: 'Share summary', pt: 'Compartilhar resumo',
    zh: '分享概览', ja: '概要を共有', fr: 'Partager le résumé',
    it: 'Condividi riepilogo', ru: 'Поделиться сводкой'
  },
  toast_preparing_share: {
    es: 'Preparando archivo para compartir...', en: 'Preparing file to share...', pt: 'Preparando arquivo para compartilhar...',
    zh: '正在准备分享文件...', ja: '共有ファイルを準備中...', fr: 'Préparation du fichier à partager...',
    it: 'Preparazione file da condividere...', ru: 'Подготовка файла для отправки...'
  },
  stats_artists: {
    es: 'Artistas', en: 'Artists', pt: 'Artistas',
    zh: '艺术家', ja: 'アーティスト', fr: 'Artistes',
    it: 'Artisti', ru: 'Исполнители'
  },
  toast_downloaded: {
    es: 'Descargado', en: 'Downloaded', pt: 'Baixado',
    zh: '已下载', ja: 'ダウンロードしました', fr: 'Téléchargé',
    it: 'Scaricato', ru: 'Скачано'
  },
  time_toggle_remaining: {
    es: 'Duración / tiempo restante', en: 'Duration / time remaining', pt: 'Duração / tempo restante',
    zh: '时长 / 剩余时间', ja: '長さ / 残り時間', fr: 'Durée / temps restant',
    it: 'Durata / tempo rimanente', ru: 'Длительность / осталось'
  },
  toast_shared_chat: {
    es: 'Enviado a Delta Chat', en: 'Sent to Delta Chat', pt: 'Enviado ao Delta Chat',
    zh: '已发送至 Delta Chat', ja: 'Delta Chat に送信しました', fr: 'Envoyé à Delta Chat',
    it: 'Inviato a Delta Chat', ru: 'Отправлено в Delta Chat'
  },
  toast_share_error: {
    es: 'No se pudo compartir el archivo', en: 'Could not share the file', pt: 'Não foi possível compartilhar o arquivo',
    zh: '无法分享文件', ja: 'ファイルを共有できませんでした', fr: 'Impossible de partager le fichier',
    it: 'Impossibile condividere il file', ru: 'Не удалось отправить файл'
  },
  toast_playlist_shared: {
    es: 'Lista compartida', en: 'Playlist shared', pt: 'Lista compartilhada',
    zh: '歌单已分享', ja: 'プレイリストを共有しました', fr: 'Liste partagée',
    it: 'Playlist condivisa', ru: 'Плейлист отправлен'
  },
  toast_lrc_exported: {
    es: 'Letra exportada', en: 'Lyrics exported', pt: 'Letra exportada',
    zh: '歌词已导出', ja: '歌詞を書き出しました', fr: 'Paroles exportées',
    it: 'Testo esportato', ru: 'Текст экспортирован'
  },
  stats_summary_title: {
    es: 'Mi resumen en Aurora Music Player', en: 'My summary on Aurora Music Player', pt: 'Meu resumo no Aurora Music Player',
    zh: '我在 Aurora Music Player 的收听概览', ja: 'Aurora Music Player の再生サマリー', fr: 'Mon résumé sur Aurora Music Player',
    it: 'Il mio riepilogo su Aurora Music Player', ru: 'Моя сводка в Aurora Music Player'
  },
  visualizer: {
    es: 'Visualizador', en: 'Visualizer', pt: 'Visualizador',
    zh: '频谱可视化', ja: 'ビジュアライザー', fr: 'Visualiseur',
    it: 'Visualizzatore', ru: 'Визуализатор'
  },
  visualizer_wave: {
    es: 'Onda fluida', en: 'Fluid wave', pt: 'Onda fluida',
    zh: '流动声波', ja: '波形ウェーブ', fr: 'Onde fluide',
    it: 'Onda fluida', ru: 'Плавная волна'
  },
  visualizer_off: {
    es: 'Desactivado', en: 'Disabled', pt: 'Desativado',
    zh: '已关闭', ja: '無効', fr: 'Désactivé',
    it: 'Disattivato', ru: 'Отключено'
  },
  ab_repeat: {
    es: 'Bucle A-B', en: 'A-B Loop', pt: 'Loop A-B',
    zh: 'A-B 循环', ja: 'A-B ループ', fr: 'Boucle A-B',
    it: 'Loop A-B', ru: 'Петля A-B'
  },
  /* Etiqueta corta bajo el botón A-B: junto al distintivo «A-B» se lee
   * «Bucle A-B» sin ocupar el ancho completo de la fila secundaria. */
  ab_label: {
    es: 'Bucle', en: 'Loop', pt: 'Loop',
    zh: '循环', ja: 'ループ', fr: 'Boucle',
    it: 'Loop', ru: 'Петля'
  },
  ab_set_a: {
    es: 'Punto A fijado en X. Pulsa para fijar B', en: 'Point A set at X. Tap to set B', pt: 'Ponto A fixado em X. Toque para fixar B',
    zh: 'A 点已设置在 X。再次点击设置 B 点', ja: 'A 地点を X に設定しました。タップして B を設定', fr: 'Point A défini à X. Touchez pour définir B',
    it: 'Punto A impostato su X. Tocca per impostare B', ru: 'Точка A установлена на X. Нажмите для B'
  },
  ab_active: {
    es: 'Bucle A-B activo (X ⇄ Y)', en: 'A-B Loop active (X ⇄ Y)', pt: 'Loop A-B ativo (X ⇄ Y)',
    zh: 'A-B 循环开启 (X ⇄ Y)', ja: 'A-B ループ有効 (X ⇄ Y)', fr: 'Boucle A-B active (X ⇄ Y)',
    it: 'Loop A-B attivo (X ⇄ Y)', ru: 'Петля A-B активна (X ⇄ Y)'
  },
  ab_cleared: {
    es: 'Bucle A-B desactivado', en: 'A-B Loop cleared', pt: 'Loop A-B desativado',
    zh: 'A-B 循环已清除', ja: 'A-B ループを解除しました', fr: 'Boucle A-B désactivée',
    it: 'Loop A-B disattivato', ru: 'Петля A-B отключена'
  },
  settings_preserves_pitch: {
    es: 'Preservar tono al cambiar velocidad', en: 'Preserve pitch on speed change', pt: 'Preservar tom ao mudar velocidade',
    zh: '变速时保持音调', ja: '速度変更時にピッチを維持', fr: 'Préserver la hauteur à vitesse variable',
    it: 'Preserva tonalità al cambio velocità', ru: 'Сохранять тональность при изменении скорости'
  },
  settings_preserves_pitch_hint: {
    es: 'Mantiene el tono natural de la voz sin distorsionar el pitch.', en: 'Keeps natural voice pitch without chipmunk effect.', pt: 'Mantém o tom natural da voz sem distorcer o pitch.',
    zh: '保持自然声音音调，避免变声效果。', ja: '声の高さを変えずに自然なトーンを維持します。', fr: 'Maintient la voix naturelle sans effet accéléré.',
    it: 'Mantiene il timbro vocale naturale senza alterare l’intonazione.', ru: 'Сохраняет естественную тональность голоса без искажения.'
  },
  sleep_invalid: {
    es: 'Introduce un número de minutos válido (1–1440).', en: 'Enter a valid number of minutes (1–1440).',
    pt: 'Introduza um número de minutos válido (1–1440).', zh: '请输入有效的分钟数（1–1440）。',
    ja: '有効な分数を入力してください（1–1440）。', fr: 'Saisissez un nombre de minutes valide (1–1440).',
    it: 'Inserisci un numero di minuti valido (1–1440).', ru: 'Введите корректное число минут (1–1440).'
  },
  toast_file_too_large: {
    es: 'El archivo es demasiado grande (máximo 25 MB).', en: 'File is too large (25 MB max).',
    pt: 'O ficheiro é demasiado grande (máximo 25 MB).', zh: '文件过大（最大 25 MB）。',
    ja: 'ファイルが大きすぎます（最大 25 MB）。', fr: 'Fichier trop volumineux (25 Mo max).',
    it: 'File troppo grande (massimo 25 MB).', ru: 'Файл слишком большой (максимум 25 МБ).'
  },
  playlist_name_exists: {
    es: 'Ya existe una lista con ese nombre.', en: 'A playlist with that name already exists.',
    pt: 'Já existe uma lista com esse nome.', zh: '已存在同名播放列表。',
    ja: '同じ名前のプレイリストが既にあります。', fr: 'Une liste portant ce nom existe déjà.',
    it: 'Esiste già una playlist con questo nome.', ru: 'Плейлист с таким названием уже существует.'
  },
  eq_band_label: {
    es: 'Banda de ecualización X', en: 'Equalizer band X', pt: 'Banda de equalizador X',
    zh: 'X 均衡器频段', ja: 'イコライザーバンド X', fr: 'Bande d’égalisation X',
    it: 'Banda di equalizzazione X', ru: 'Полоса эквалайзера X'
  },
  lrc_speed_down: {
    es: 'Bajar velocidad', en: 'Decrease speed', pt: 'Diminuir velocidade',
    zh: '降低速度', ja: '速度を下げる', fr: 'Réduire la vitesse',
    it: 'Riduci velocità', ru: 'Уменьшить скорость'
  },
  lrc_speed_up: {
    es: 'Subir velocidad', en: 'Increase speed', pt: 'Aumentar velocidade',
    zh: '提高速度', ja: '速度を上げる', fr: 'Augmenter la vitesse',
    it: 'Aumenta velocità', ru: 'Увеличить скорость'
  },
  cover_art_aria: {
    es: 'Portada de X', en: 'Cover art for X', pt: 'Capa de X',
    zh: 'X 的封面', ja: 'X のカバー', fr: 'Pochette de X', it: 'Copertina di X', ru: 'Обложка X'
  },

  /* Claves que faltaban y se mostraban como texto crudo en la UI
   * (auditoría 2026-10). Todas con los 8 idiomas. */
  unknown_track: {
    es: 'Pista desconocida', en: 'Unknown track', pt: 'Faixa desconhecida',
    zh: '未知曲目', ja: '不明な曲', fr: 'Morceau inconnu', it: 'Brano sconosciuto', ru: 'Неизвестный трек'
  },
  no_track_playing: {
    es: 'Sin reproducción', en: 'Nothing playing', pt: 'Nada em reprodução',
    zh: '没有正在播放的歌曲', ja: '再生中の曲はありません', fr: 'Aucune lecture en cours',
    it: 'Nessuna riproduzione', ru: 'Ничего не воспроизводится'
  },
  progress: {
    es: 'Progreso', en: 'Progress', pt: 'Progresso',
    zh: '播放进度', ja: '再生位置', fr: 'Progression', it: 'Avanzamento', ru: 'Прогресс'
  },
  back: {
    es: 'Volver', en: 'Back', pt: 'Voltar',
    zh: '返回', ja: '戻る', fr: 'Retour', it: 'Indietro', ru: 'Назад'
  },
  move: {
    es: 'Mover', en: 'Move', pt: 'Mover',
    zh: '移动', ja: '移動', fr: 'Déplacer', it: 'Sposta', ru: 'Переместить'
  },
  toast_playlist_deleted: {
    es: 'Lista eliminada', en: 'Playlist deleted', pt: 'Lista excluída',
    zh: '歌单已删除', ja: 'プレイリストを削除しました', fr: 'Liste supprimée', it: 'Playlist eliminata', ru: 'Плейлист удалён'
  },

  /* ---------- §81: ordenar, catálogo, inteligentes, editor ---------- */
  sort_label: {
    es: 'Orden', en: 'Sort', pt: 'Ordem',
    zh: '排序', ja: '並び替え', fr: 'Trier',
    it: 'Ordina', ru: 'Сортировка'
  },
  sort_stars: {
    es: 'Estrellas', en: 'Stars', pt: 'Estrelas',
    zh: '星级', ja: '星', fr: 'Étoiles',
    it: 'Stelle', ru: 'Звёзды'
  },
  sort_title: {
    es: 'Título A–Z', en: 'Title A–Z', pt: 'Título A–Z',
    zh: '标题 A–Z', ja: 'タイトル順', fr: 'Titre A–Z',
    it: 'Titolo A–Z', ru: 'Название А–Я'
  },
  sort_artist: {
    es: 'Artista', en: 'Artist', pt: 'Artista',
    zh: '艺术家', ja: 'アーティスト', fr: 'Artiste',
    it: 'Artista', ru: 'Исполнитель'
  },
  sort_album: {
    es: 'Álbum', en: 'Album', pt: 'Álbum',
    zh: '专辑', ja: 'アルバム', fr: 'Album',
    it: 'Album', ru: 'Альбом'
  },
  sort_list_order: {
    es: 'Orden de la lista', en: 'List order', pt: 'Ordem da lista',
    zh: '列表顺序', ja: 'リスト順', fr: 'Ordre de la liste',
    it: 'Ordine della lista', ru: 'Порядок списка'
  },
  sort_recent: {
    es: 'Añadidas hace poco', en: 'Recently added', pt: 'Adicionadas recentemente',
    zh: '最近添加', ja: '最近追加', fr: 'Ajouts récents',
    it: 'Aggiunte di recente', ru: 'Недавно добавленные'
  },
  sort_duration: {
    es: 'Duración', en: 'Duration', pt: 'Duração',
    zh: '时长', ja: '長さ', fr: 'Durée',
    it: 'Durata', ru: 'Длительность'
  },
  tab_albums: {
    es: 'Álbumes', en: 'Albums', pt: 'Álbuns',
    zh: '专辑', ja: 'アルバム', fr: 'Albums',
    it: 'Album', ru: 'Альбомы'
  },
  tab_artists: {
    es: 'Artistas', en: 'Artists', pt: 'Artistas',
    zh: '艺术家', ja: 'アーティスト', fr: 'Artistes',
    it: 'Artisti', ru: 'Исполнители'
  },
  tab_genres: {
    es: 'Géneros', en: 'Genres', pt: 'Gêneros',
    zh: '流派', ja: 'ジャンル', fr: 'Genres',
    it: 'Generi', ru: 'Жанры'
  },
  genre_unknown: {
    es: 'Sin género', en: 'No genre', pt: 'Sem gênero',
    zh: '无流派', ja: 'ジャンルなし', fr: 'Sans genre',
    it: 'Senza genere', ru: 'Без жанра'
  },
  smart_badge: {
    es: 'Inteligente', en: 'Smart', pt: 'Inteligente',
    zh: '智能', ja: 'スマート', fr: 'Intelligente',
    it: 'Smart', ru: 'Умный'
  },
  pl_type_label: {
    es: 'Tipo de lista', en: 'Playlist type', pt: 'Tipo de lista',
    zh: '歌单类型', ja: 'リストの種類', fr: 'Type de liste',
    it: 'Tipo di playlist', ru: 'Тип плейлиста'
  },
  pl_type_normal: {
    es: 'Normal', en: 'Normal', pt: 'Normal',
    zh: '普通', ja: '通常', fr: 'Normale',
    it: 'Normale', ru: 'Обычный'
  },
  pl_type_smart: {
    es: 'Inteligente', en: 'Smart', pt: 'Inteligente',
    zh: '智能', ja: 'スマート', fr: 'Intelligente',
    it: 'Smart', ru: 'Умный'
  },
  smart_rule_label: {
    es: 'Regla', en: 'Rule', pt: 'Regra',
    zh: '规则', ja: 'ルール', fr: 'Règle',
    it: 'Regola', ru: 'Правило'
  },
  smart_rule_rating: {
    es: '4 estrellas o más', en: '4 stars or more', pt: '4 estrelas ou mais',
    zh: '4 星及以上', ja: '星4つ以上', fr: '4 étoiles ou plus',
    it: '4 stelle o più', ru: '4 звезды и выше'
  },
  smart_rule_genre: {
    es: 'Un género', en: 'One genre', pt: 'Um gênero',
    zh: '某个流派', ja: 'ジャンル', fr: 'Un genre',
    it: 'Un genere', ru: 'Один жанр'
  },
  smart_rule_never: {
    es: 'Nunca reproducidas', en: 'Never played', pt: 'Nunca tocadas',
    zh: '从未播放', ja: '未再生', fr: 'Jamais écoutées',
    it: 'Mai riprodotte', ru: 'Никогда не играли'
  },
  smart_rule_recent: {
    es: 'Añadidas en 30 días', en: 'Added in 30 days', pt: 'Adicionadas em 30 dias',
    zh: '30 天内添加', ja: '30日以内に追加', fr: 'Ajoutées sous 30 jours',
    it: 'Aggiunte in 30 giorni', ru: 'Добавлены за 30 дней'
  },
  smart_rule_forgotten: {
    es: 'Olvidadas (+90 días)', en: 'Forgotten (90+ days)', pt: 'Esquecidas (+90 dias)',
    zh: '被遗忘（90 天以上）', ja: '忘れられた曲（90日以上）', fr: 'Oubliées (+90 jours)',
    it: 'Dimenticate (+90 giorni)', ru: 'Забытые (90+ дней)'
  },
  smart_rule_top: {
    es: 'Más reproducidas', en: 'Most played', pt: 'Mais tocadas',
    zh: '播放最多', ja: 'よく聴く曲', fr: 'Les plus écoutées',
    it: 'Più ascoltate', ru: 'Самые популярные'
  },
  toast_smart_created: {
    es: 'Lista inteligente creada', en: 'Smart playlist created', pt: 'Lista inteligente criada',
    zh: '智能歌单已创建', ja: 'スマートリストを作成', fr: 'Liste intelligente créée',
    it: 'Playlist smart creata', ru: 'Умный плейлист создан'
  },
  smart_playlist_hint: {
    es: 'Esta lista se rellena sola según su regla; las canciones no se añaden ni se quitan a mano.', en: 'This playlist fills itself by its rule; tracks cannot be added or removed by hand.', pt: 'Esta lista se preenche sozinha conforme a regra; não dá para adicionar ou remover faixas manualmente.',
    zh: '此歌单按规则自动填充，无法手动添加或移除歌曲。', ja: 'このリストはルールで自動的に埋まります。手動で追加・削除はできません。', fr: 'Cette liste se remplit seule selon sa règle ; impossible d’ajouter ou de retirer des titres à la main.',
    it: 'Questa playlist si riempie da sola secondo la regola; non puoi aggiungere o rimuovere brani a mano.', ru: 'Этот плейлист заполняется сам по правилу; вручную треки не добавить и не убрать.'
  },
  save_queue_btn: {
    es: 'Guardar cola como lista', en: 'Save queue as playlist', pt: 'Salvar fila como lista',
    zh: '将队列存为歌单', ja: 'キューをリストに保存', fr: 'Enregistrer la file comme liste',
    it: 'Salva coda come playlist', ru: 'Сохранить очередь как плейлист'
  },
  toast_queue_saved: {
    es: 'Cola guardada como lista', en: 'Queue saved as playlist', pt: 'Fila salva como lista',
    zh: '队列已存为歌单', ja: 'キューをリストに保存しました', fr: 'File enregistrée comme liste',
    it: 'Coda salvata come playlist', ru: 'Очередь сохранена как плейлист'
  },
  lrc_tap_mode: {
    es: 'Sincronizar tocando', en: 'Tap to sync', pt: 'Sincronizar tocando',
    zh: '点按同步', ja: 'タップで同期', fr: 'Synchroniser en touchant',
    it: 'Sincronizza toccando', ru: 'Синхронизация касаниями'
  },
  lrc_tap_hint: {
    es: 'Reproduce la canción y toca el botón grande al empezar cada línea. Al terminar, las marcas se escriben en el editor.', en: 'Play the song and tap the big button as each line starts. When done, the marks are written into the editor.', pt: 'Toque a música e toque no botão grande no início de cada linha. Ao terminar, as marcas vão para o editor.',
    zh: '播放歌曲，在每行开始时点大按钮。完成后时间标记会写入编辑器。', ja: '曲を再生し、各行の頭で大きなボタンをタップ。終わると編集欄に時刻が入ります。', fr: 'Lancez le titre et touchez le gros bouton au début de chaque ligne. À la fin, les repères sont écrits dans l’éditeur.',
    it: 'Riproduci il brano e tocca il pulsante grande all’inizio di ogni riga. Alla fine i segni finiscono nell’editor.', ru: 'Включите трек и нажимайте большую кнопку в начале каждой строки. В конце метки попадут в редактор.'
  },
  lrc_tap_button: {
    es: 'Marcar línea', en: 'Mark line', pt: 'Marcar linha',
    zh: '标记此行', ja: '行をマーク', fr: 'Marquer la ligne',
    it: 'Segna riga', ru: 'Отметить строку'
  },
  lrc_tap_undo: {
    es: 'Deshacer marca', en: 'Undo mark', pt: 'Desfazer marca',
    zh: '撤销标记', ja: 'マークを取り消す', fr: 'Annuler le repère',
    it: 'Annulla segno', ru: 'Отменить метку'
  },
  lrc_tap_done: {
    es: 'Terminar y escribir marcas', en: 'Finish and write marks', pt: 'Terminar e escrever marcas',
    zh: '完成并写入', ja: '終了して書き込む', fr: 'Terminer et écrire',
    it: 'Finisci e scrivi', ru: 'Готово, записать метки'
  },
  lrc_tap_no_lines: {
    es: 'Escribe primero las líneas de la letra (sin tiempos).', en: 'Write the lyric lines first (without timestamps).', pt: 'Escreva primeiro as linhas da letra (sem tempos).',
    zh: '请先写下歌词行（不带时间）。', ja: 'まず歌詞の行を書いてください（時刻なし）。', fr: 'Écrivez d’abord les lignes des paroles (sans horodatage).',
    it: 'Scrivi prima le righe del testo (senza tempi).', ru: 'Сначала впишите строки текста (без меток).'
  },
  stats_most_skipped: {
    es: 'Más saltadas', en: 'Most skipped', pt: 'Mais puladas',
    zh: '跳过最多', ja: 'よくスキップ', fr: 'Les plus passées',
    it: 'Più saltate', ru: 'Чаще пропускают'
  },
  stats_skips_label: {
    es: 'saltos', en: 'skips', pt: 'pulos',
    zh: '次跳过', ja: 'スキップ', fr: 'sauts',
    it: 'salti', ru: 'пропусков'
  },
  stats_forgotten: {
    es: 'Olvidadas', en: 'Forgotten', pt: 'Esquecidas',
    zh: '被遗忘', ja: '忘れられた曲', fr: 'Oubliées',
    it: 'Dimenticate', ru: 'Забытые'
  },
  stats_days_ago: {
    es: 'hace X días', en: 'X days ago', pt: 'há X dias',
    zh: 'X 天前', ja: 'X日前', fr: 'il y a X jours',
    it: 'X giorni fa', ru: 'X дн. назад'
  },
  find_duplicates: {
    es: 'Buscar duplicados', en: 'Find duplicates', pt: 'Buscar duplicadas',
    zh: '查找重复', ja: '重複を探す', fr: 'Chercher les doublons',
    it: 'Cerca duplicati', ru: 'Найти дубли'
  },
  duplicates_title: {
    es: 'Canciones duplicadas', en: 'Duplicate songs', pt: 'Músicas duplicadas',
    zh: '重复歌曲', ja: '重複した曲', fr: 'Titres en double',
    it: 'Brani duplicati', ru: 'Дубли треков'
  },
  duplicates_none: {
    es: 'No hay canciones duplicadas.', en: 'No duplicate songs.', pt: 'Nenhuma música duplicada.',
    zh: '没有重复歌曲。', ja: '重複はありません。', fr: 'Aucun doublon.',
    it: 'Nessun duplicato.', ru: 'Дублей нет.'
  },
  duplicates_keep: {
    es: 'Se conserva', en: 'Kept', pt: 'Mantida',
    zh: '保留', ja: '保持', fr: 'Conservé',
    it: 'Conservata', ru: 'Остаётся'
  },
  duplicates_keep_this: {
    es: 'Conservar esta', en: 'Keep this one', pt: 'Manter esta',
    zh: '保留这一份', ja: 'これを保持', fr: 'Garder celle-ci',
    it: 'Tieni questa', ru: 'Оставить эту'
  },
  duplicates_delete_others: {
    es: 'Borrar las demás', en: 'Delete the others', pt: 'Excluir as outras',
    zh: '删除其余', ja: '他を削除', fr: 'Supprimer les autres',
    it: 'Elimina le altre', ru: 'Удалить остальные'
  },
  duplicates_confirm: {
    es: 'Se borrarán X copia(s) duplicada(s) y se conservará la elegida. ¿Seguir?',
    en: 'X duplicate copy(ies) will be deleted and the chosen one kept. Continue?',
    pt: 'X cópia(s) duplicada(s) serão excluídas e a escolhida será mantida. Continuar?',
    zh: '将删除 X 个重复副本，只保留所选的一个。继续吗？',
    ja: '重複コピーX件を削除し、選んだ1件を残します。続けますか？',
    fr: 'X copie(s) en double seront supprimées et celle choisie sera gardée. Continuer ?',
    it: 'Verranno eliminate X copie duplicate e verrà tenuta quella scelta. Continuare?',
    ru: 'Будет удалено X дублирующихся копий, выбранная останется. Продолжить?'
  },
  toast_sort_saved: {
    es: 'Orden guardado', en: 'Sort order saved', pt: 'Ordem salva',
    zh: '排序已保存', ja: '並び順を保存', fr: 'Ordre enregistré',
    it: 'Ordine salvato', ru: 'Порядок сохранён'
  },
  rename_confirm: {
    es: 'Confirmar', en: 'Confirm', pt: 'Confirmar',
    zh: '确认', ja: '確認', fr: 'Confirmer',
    it: 'Conferma', ru: 'Подтвердить'
  },


};

window.TRACKS = TRACKS;
window.COVER_PALETTE = COVER_PALETTE;
window.SAMPLE_LRC = SAMPLE_LRC;
window.SUPPORTED_LANGS = SUPPORTED_LANGS;
window.I18N = I18N;
