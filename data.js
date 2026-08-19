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

/* Listas iniciales vacías. El usuario crea las suyas. */
const DEFAULT_PLAYLISTS = [];

/* Paleta para generar portadas dinámicas cuando una pista no trae
 * artwork en sus metadatos ID3. */
const COVER_PALETTE = [
  { from: '#7C3AED', to: '#EC4899', angle: 135 },
  { from: '#F59E0B', to: '#EF4444', angle: 135 },
  { from: '#06B6D4', to: '#3B82F6', angle: 135 },
  { from: '#10B981', to: '#06B6D4', angle: 135 },
  { from: '#F97316', to: '#DC2626', angle: 135 },
  { from: '#1E40AF', to: '#6366F1', angle: 135 },
  { from: '#EC4899', to: '#8B5CF6', angle: 135 },
  { from: '#6366F1', to: '#06B6D4', angle: 135 },
  { from: '#F59E0B', to: '#EF4444', angle: 135 },
  { from: '#14B8A6', to: '#0EA5E9', angle: 135 },
  { from: '#A855F7', to: '#6366F1', angle: 135 },
  { from: '#FB7185', to: '#A855F7', angle: 135 }
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
  app_title: {
    es: 'Aurora · Reproductor Pro',
    en: 'Aurora · Player Pro',
    pt: 'Aurora · Player Pro',
    zh: 'Aurora · 专业播放器',
    ja: 'Aurora · プロプレーヤー',
    fr: 'Aurora · Player Pro',
    it: 'Aurora · Player Pro',
    ru: 'Aurora · Про-плеер'
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
  track_title_placeholder: {
    es: '—',
    en: '—',
    pt: '—',
    zh: '—',
    ja: '—',
    fr: '—',
    it: '—',
    ru: '—'
  },
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
  done_btn: {
    es: 'Listo',
    en: 'Done',
    pt: 'Concluído',
    zh: '完成',
    ja: '完了',
    fr: 'Terminé',
    it: 'Fatto',
    ru: 'Готово'
  },
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
  pick_tracks: {
    es: 'Selecciona pistas',
    en: 'Select tracks',
    pt: 'Selecionar faixas',
    zh: '选择音轨',
    ja: 'トラックを選択',
    fr: 'Sélectionner des pistes',
    it: 'Seleziona tracce',
    ru: 'Выберите треки'
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
  eq_flat: {
    es: 'Plano',
    en: 'Flat',
    pt: 'Plano',
    zh: '平直',
    ja: 'フラット',
    fr: 'Plat',
    it: 'Piatto',
    ru: 'Плоский'
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
  menu_add_to_playlist: {
    es: 'Añadir a una lista',
    en: 'Add to playlist',
    pt: 'Adicionar a uma lista',
    zh: '添加到歌单',
    ja: 'プレイリストに追加',
    fr: 'Ajouter à une liste',
    it: 'Aggiungi a lista',
    ru: 'Добавить в список'
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
  menu_share: {
    es: 'Compartir',
    en: 'Share',
    pt: 'Compartilhar',
    zh: '分享',
    ja: '共有',
    fr: 'Partager',
    it: 'Condividi',
    ru: 'Поделиться'
  },
  menu_info: {
    es: 'Información de la pista',
    en: 'Track info',
    pt: 'Informações da faixa',
    zh: '音轨信息',
    ja: 'トラック情報',
    fr: 'Infos de la piste',
    it: 'Info traccia',
    ru: 'Информация о треке'
  },
  menu_favorites: {
    es: 'Ver favoritos',
    en: 'View favorites',
    pt: 'Ver favoritos',
    zh: '查看收藏',
    ja: 'お気に入りを表示',
    fr: 'Voir les favoris',
    it: 'Vedi preferiti',
    ru: 'Посмотреть избранное'
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
  toast_playlist_created: {
    es: 'Lista creada:',
    en: 'Playlist created:',
    pt: 'Lista criada:',
    zh: '歌单已创建：',
    ja: 'プレイリストを作成:',
    fr: 'Liste créée :',
    it: 'Lista creata:',
    ru: 'Список создан:'
  },
  toast_theme: { es: 'Tema:', en: 'Theme:', pt: 'Tema:', zh: '主题：', ja: 'テーマ:', fr: 'Thème :', it: 'Tema:', ru: 'Тема:' },
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
  toast_share_unavailable: {
    es: 'Compartir no disponible',
    en: 'Share unavailable',
    pt: 'Compartilhamento indisponível',
    zh: '分享不可用',
    ja: '共有は利用できません',
    fr: 'Partage non disponible',
    it: 'Condivisione non disponibile',
    ru: 'Передача недоступна'
  },
  toast_diagnostic_done: {
    es: 'Diagnóstico completado ✓',
    en: 'Diagnostic completed ✓',
    pt: 'Diagnóstico concluído ✓',
    zh: '诊断完成 ✓',
    ja: '診断完了 ✓',
    fr: 'Diagnostic terminé ✓',
    it: 'Diagnostica completata ✓',
    ru: 'Диагностика завершена ✓'
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
  playlists_section: {
    es: 'Listas de reproducción',
    en: 'Playlists',
    pt: 'Listas de reprodução',
    zh: '歌单',
    ja: 'プレイリスト',
    fr: 'Listes de lecture',
    it: 'Liste di riproduzione',
    ru: 'Списки воспроизведения'
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
  search_placeholder: {
    es: 'Canción, artista o ál…',
    en: 'Song, artist or al…',
    pt: 'Música, artista ou al…',
    zh: '歌曲、艺术家或专辑…',
    ja: '曲、アーティスト、アルバム…',
    fr: 'Chanson, artiste ou al…',
    it: 'Brano, artista o al…',
    ru: 'Песня, исполнитель или ал…'
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
  accent_purple: { es: 'Púrpura', en: 'Purple', pt: 'Roxo', zh: '紫色', ja: 'パープル', fr: 'Violet', it: 'Viola', ru: 'Фиолетовый' },
  accent_blue: { es: 'Azul', en: 'Blue', pt: 'Azul', zh: '蓝色', ja: 'ブルー', fr: 'Bleu', it: 'Blu', ru: 'Синий' },
  accent_green: { es: 'Verde', en: 'Green', pt: 'Verde', zh: '绿色', ja: 'グリーン', fr: 'Vert', it: 'Verde', ru: 'Зелёный' },
  accent_orange: { es: 'Naranja', en: 'Orange', pt: 'Laranja', zh: '橙色', ja: 'オレンジ', fr: 'Orange', it: 'Arancione', ru: 'Оранжевый' },
  accent_pink: { es: 'Rosa', en: 'Pink', pt: 'Rosa', zh: '粉色', ja: 'ピンク', fr: 'Rose', it: 'Rosa', ru: 'Розовый' },

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
  hour_short: { es: 'h', en: 'h', pt: 'h', zh: '时', ja: '時間', fr: 'h', it: 'h', ru: 'ч' },
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
  search_results: {
    es: 'Resultados',
    en: 'Results',
    pt: 'Resultados',
    zh: '结果',
    ja: '結果',
    fr: 'Résultats',
    it: 'Risultati',
    ru: 'Результаты'
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
  toast_reorder_mode: {
    es: 'Modo reordenar: arrastra el icono',
    en: 'Reorder mode: drag the icon',
    pt: 'Modo reordenar: arraste o ícone',
    zh: '重新排序模式：拖动图标',
    ja: '並べ替えモード：アイコンをドラッグ',
    fr: 'Mode réorganiser : glisser l\'icône',
    it: 'Modalità riordino: trascina l\'icona',
    ru: 'Режим перестановки: перетащите значок'
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
  toast_pick_at_least_one: {
    es: 'Selecciona al menos una pista',
    en: 'Select at least one track',
    pt: 'Selecione ao menos uma faixa',
    zh: '至少选择一首音轨',
    ja: '少なくとも1曲選択してください',
    fr: 'Sélectionnez au moins une piste',
    it: 'Seleziona almeno una traccia',
    ru: 'Выберите хотя бы один трек'
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
  delete_all_btn: {
    es: 'Borrar todo',
    en: 'Delete all',
    pt: 'Apagar tudo',
    zh: '全部删除',
    ja: 'すべて削除',
    fr: 'Tout supprimer',
    it: 'Elimina tutto',
    ru: 'Удалить всё'
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
  add_tracks_btn: {
    es: 'Añadir pistas',
    en: 'Add tracks',
    pt: 'Adicionar faixas',
    zh: '添加音轨',
    ja: 'トラックを追加',
    fr: 'Ajouter des pistes',
    it: 'Aggiungi tracce',
    ru: 'Добавить треки'
  },
  play_playlist_btn: {
    es: 'Reproducir',
    en: 'Play',
    pt: 'Reproduzir',
    zh: '播放',
    ja: '再生',
    fr: 'Lire',
    it: 'Riproduci',
    ru: 'Играть'
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
  toast_tracks_added_to_playlist: {
    es: 'pista(s) añadida(s) a la lista',
    en: 'track(s) added to playlist',
    pt: 'faixa(s) adicionada(s) à lista',
    zh: '首音轨已添加到歌单',
    ja: '曲をプレイリストに追加しました',
    fr: 'piste(s) ajoutée(s) à la liste',
    it: 'traccia/e aggiunta/e alla lista',
    ru: 'трек(ов) добавлено в список'
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
  pick_tracks_for_playlist: {
    es: 'Selecciona pistas para añadir',
    en: 'Select tracks to add',
    pt: 'Selecione faixas para adicionar',
    zh: '选择要添加的音轨',
    ja: '追加するトラックを選択',
    fr: 'Sélectionner des pistes à ajouter',
    it: 'Seleziona tracce da aggiungere',
    ru: 'Выберите треки для добавления'
  },
  add_to_existing_btn: {
    es: 'Añadir',
    en: 'Add',
    pt: 'Adicionar',
    zh: '添加',
    ja: '追加',
    fr: 'Ajouter',
    it: 'Aggiungi',
    ru: 'Добавить'
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
  my_music_playlist: {
    es: 'Mi Música', en: 'My Music', pt: 'Minha Música', zh: '我的音乐',
    ja: 'マイミュージック', fr: 'Ma Musique', it: 'La Mia Musica', ru: 'Моя Музыка'
  },
  my_music_desc: {
    es: 'Canciones que no se añadieron a ninguna lista',
    en: 'Songs not added to any playlist',
    pt: 'Músicas não adicionadas a nenhuma lista',
    zh: '未添加到任何歌单的歌曲',
    ja: 'どのプレイリストにも追加されていない曲',
    fr: 'Chansons non ajoutées à une liste',
    it: 'Canzoni non aggiunte a nessuna lista',
    ru: 'Песни, не добавленные ни в один список'
  },
  play_all_btn: {
    es: 'Reproducir Todo', en: 'Play All', pt: 'Reproduzir Tudo', zh: '播放全部',
    ja: 'すべて再生', fr: 'Tout lire', it: 'Riproduci tutto', ru: 'Играть все'
  },
  clear_playlist_btn: {
    es: 'Borrar todo', en: 'Clear all', pt: 'Limpar tudo', zh: '清空',
    ja: 'すべて削除', fr: 'Tout vider', it: 'Svuota tutto', ru: 'Очистить всё'
  },
  upload_to_playlist_btn: {
    es: 'Subir canciones', en: 'Upload songs', pt: 'Enviar músicas', zh: '上传歌曲',
    ja: '曲をアップロード', fr: 'Importer des chansons', it: 'Carica canzoni', ru: 'Загрузить песни'
  },
  add_existing_tracks_btn: {
    es: 'Añadir de la biblioteca', en: 'Add from library', pt: 'Adicionar da biblioteca',
    zh: '从媒体库添加', ja: 'ライブラリから追加', fr: 'Ajouter depuis la bibliothèque',
    it: 'Aggiungi dalla libreria', ru: 'Добавить из библиотеки'
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
  toast_cannot_delete_default: {
    es: 'La lista "Mi Música" no se puede eliminar',
    en: 'The "My Music" playlist cannot be deleted',
    pt: 'A lista "Minha Música" não pode ser excluída',
    zh: '无法删除"我的音乐"歌单',
    ja: '「マイミュージック」プレイリストは削除できません',
    fr: 'La liste « Ma Musique » ne peut pas être supprimée',
    it: 'La lista "La Mia Musica" non può essere eliminata',
    ru: 'Список «Моя Музыка» нельзя удалить'
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
  welcome_choose_lang: {
    es: 'Elige tu idioma',
    en: 'Choose your language',
    pt: 'Escolha seu idioma',
    zh: '选择你的语言',
    ja: '言語を選択してください',
    fr: 'Choisissez votre langue',
    it: 'Scegli la tua lingua',
    ru: 'Выберите ваш язык'
  }
,
  /* ---------- Letras LRC ---------- */
  lrc_no_lyrics: {
    es: 'No hay letra disponible', en: 'No lyrics available', pt: 'Sem letra disponível',
    zh: '无可用歌词', ja: '歌詞がありません', fr: 'Aucune parole disponible',
    it: 'Nessun testo disponibile', ru: 'Текст недоступен'
  },
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
  lrc_offset: {
    es: 'Ajustar desfase', en: 'Adjust offset', pt: 'Ajustar desfio',
    zh: '调整偏移', ja: 'オフセット調整', fr: 'Ajuster le décalage',
    it: 'Regola offset', ru: 'Настроить смещение'
  },
  lrc_offset_minus: { es: '−0.5s', en: '−0.5s', pt: '−0.5s', zh: '−0.5秒', ja: '−0.5秒', fr: '−0.5s', it: '−0.5s', ru: '−0.5с' },
  lrc_offset_plus: { es: '+0.5s', en: '+0.5s', pt: '+0.5s', zh: '+0.5秒', ja: '+0.5秒', fr: '+0.5s', it: '+0.5s', ru: '+0.5с' },
  lrc_offset_reset: {
    es: 'Resetear', en: 'Reset', pt: 'Redefinir', zh: '重置', ja: 'リセット',
    fr: 'Réinitialiser', it: 'Reimposta', ru: 'Сбросить'
  },
  lrc_save: {
    es: 'Guardar', en: 'Save', pt: 'Salvar', zh: '保存', ja: '保存',
    fr: 'Enregistrer', it: 'Salva', ru: 'Сохранить'
  },
  lrc_cancel: {
    es: 'Cancelar', en: 'Cancel', pt: 'Cancelar', zh: '取消', ja: 'キャンセル',
    fr: 'Annuler', it: 'Annulla', ru: 'Отмена'
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
  lrc_loop_start: {
    es: 'Inicio del loop', en: 'Loop start', pt: 'Início do loop',
    zh: '循环起点', ja: 'ループ開始', fr: 'Début de boucle',
    it: 'Inizio loop', ru: 'Начало повтора'
  },
  lrc_loop_end: {
    es: 'Fin del loop', en: 'Loop end', pt: 'Fim do loop',
    zh: '循环终点', ja: 'ループ終了', fr: 'Fin de boucle',
    it: 'Fine loop', ru: 'Конец повтора'
  },
  lrc_loop_clear: {
    es: 'Quitar loop', en: 'Clear loop', pt: 'Limpar loop',
    zh: '清除循环', ja: 'ループ解除', fr: 'Effacer la boucle',
    it: 'Rimuovi loop', ru: 'Сбросить повтор'
  },
  lrc_tap_to_seek: {
    es: 'Toca una línea para saltar a ese punto', en: 'Tap a line to jump to that point',
    pt: 'Toque numa linha para pular para esse ponto', zh: '点击一行跳转到该时间点',
    ja: '行をタップしてその時点にジャンプ', fr: 'Touchez une ligne pour sauter à ce point',
    it: 'Tocca una riga per saltare a quel punto', ru: 'Нажмите на строку для перехода'
  }
,
  /* ---------- Mejoras de prioridad alta ---------- */
  settings_title: {
    es: 'Ajustes', en: 'Settings', pt: 'Ajustes', zh: '设置', ja: '設定',
    fr: 'Réglages', it: 'Impostazioni', ru: 'Настройки'
  },
  settings_playback: {
    es: 'Reproducción', en: 'Playback', pt: 'Reprodução', zh: '播放', ja: '再生',
    fr: 'Lecture', it: 'Riproduzione', ru: 'Воспроизведение'
  },
  settings_lyrics: {
    es: 'Letras', en: 'Lyrics', pt: 'Letras', zh: '歌词', ja: '歌詞',
    fr: 'Paroles', it: 'Testi', ru: 'Тексты'
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
  settings_eq_manual: {
    es: 'Ecualizador manual', en: 'Manual equalizer', pt: 'Equalizador manual', zh: '手动均衡器', ja: '手動イコライザー',
    fr: 'Égaliseur manuel', it: 'Equalizzatore manuale', ru: 'Ручной эквалайзер'
  },
  settings_save_eq: {
    es: 'Guardar EQ', en: 'Save EQ', pt: 'Salvar EQ', zh: '保存EQ', ja: 'EQを保存',
    fr: 'Enregistrer EQ', it: 'Salva EQ', ru: 'Сохранить EQ'
  },
  settings_reset_eq: {
    es: 'Resetear EQ', en: 'Reset EQ', pt: 'Redefinir EQ', zh: '重置EQ', ja: 'EQをリセット',
    fr: 'Réinitialiser EQ', it: 'Reimposta EQ', ru: 'Сбросить EQ'
  },
  settings_export: {
    es: 'Exportar biblioteca', en: 'Export library', pt: 'Exportar biblioteca', zh: '导出媒体库', ja: 'ライブラリをエクスポート',
    fr: 'Exporter la bibliothèque', it: 'Esporta libreria', ru: 'Экспортировать библиотеку'
  },
  settings_import: {
    es: 'Importar biblioteca', en: 'Import library', pt: 'Importar biblioteca', zh: '导入媒体库', ja: 'ライブラリをインポート',
    fr: 'Importer la bibliothèque', it: 'Importa libreria', ru: 'Импортировать библиотеку'
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
  toast_exported: {
    es: 'Biblioteca exportada', en: 'Library exported', pt: 'Biblioteca exportada', zh: '媒体库已导出', ja: 'ライブラリをエクスポートしました',
    fr: 'Bibliothèque exportée', it: 'Libreria esportata', ru: 'Библиотека экспортирована'
  },
  toast_imported: {
    es: 'Biblioteca importada', en: 'Library imported', pt: 'Biblioteca importada', zh: '媒体库已导入', ja: 'ライブラリをインポートしました',
    fr: 'Bibliothèque importée', it: 'Libreria importata', ru: 'Библиотека импортирована'
  },
  history_title: {
    es: 'Historial de reproducción', en: 'Playback history', pt: 'Histórico de reprodução', zh: '播放历史', ja: '再生履歴',
    fr: 'Historique de lecture', it: 'Cronologia riproduzione', ru: 'История воспроизведения'
  },
  history_empty: {
    es: 'Sin historial todavía', en: 'No history yet', pt: 'Sem histórico ainda', zh: '暂无历史记录', ja: '履歴はまだありません',
    fr: "Pas encore d'historique", it: 'Nessuna cronologia ancora', ru: 'Истории пока нет'
  },

  /* ============================================================
   *  Cadenas para el sistema de tiempo real (compartir música)
   * ============================================================ */
  show_listeners: {
    es: 'Mostrar oyentes', en: 'Show listeners', pt: 'Mostrar ouvintes', zh: '显示听众', ja: 'リスナーを表示',
    fr: 'Afficher les auditeurs', it: 'Mostra ascoltatori', ru: 'Показать слушателей'
  },
  listeners_title: {
    es: 'Oyentes', en: 'Listeners', pt: 'Ouvintes', zh: '听众', ja: 'リスナー',
    fr: 'Auditeurs', it: 'Ascoltatori', ru: 'Слушатели'
  },
  listeners_subtitle: {
    es: 'Conectados en tiempo real', en: 'Connected in real time', pt: 'Conectados em tempo real', zh: '实时连接', ja: 'リアルタイム接続',
    fr: 'Connectés en temps réel', it: 'Connessi in tempo reale', ru: 'Подключены в реальном времени'
  },
  listeners_you: {
    es: 'Tú', en: 'You', pt: 'Você', zh: '你', ja: 'あなた',
    fr: 'Vous', it: 'Tu', ru: 'Вы'
  },
  listeners_not_playing: {
    es: 'No reproduciendo', en: 'Not playing', pt: 'Não reproduzindo', zh: '未播放', ja: '再生していません',
    fr: 'Ne joue pas', it: 'Non in riproduzione', ru: 'Не воспроизводит'
  },
  listeners_no_peers: {
    es: 'Nadie más conectado todavía. Comparte la app en un chat de Delta Chat para escuchar música juntos.',
    en: 'No one else connected yet. Share the app in a Delta Chat group to listen together.',
    pt: 'Ninguém mais conectado ainda. Compartilhe o app em um grupo do Delta Chat para ouvir juntos.',
    zh: '还没有其他人连接。在 Delta Chat 群组中分享此应用即可一起收听。',
    ja: 'まだ誰も接続していません。Delta Chat のグループでこのアプリを共有して一緒に聴きましょう。',
    fr: "Personne d'autre connecté pour l'instant. Partagez l'application dans un groupe Delta Chat pour écouter ensemble.",
    it: 'Nessun altro connesso ancora. Condividi l\'app in un gruppo Delta Chat per ascoltare insieme.',
    ru: 'Никого больше нет на связи. Поделитесь приложением в группе Delta Chat, чтобы слушать вместе.'
  },
  toast_shared_track_received: {
    es: 'Pista compartida recibida de',
    en: 'Shared track received from',
    pt: 'Faixa compartilhada recebida de',
    zh: '收到分享的音轨，来自',
    ja: '共有トラックを受信:',
    fr: 'Piste partagée reçue de',
    it: 'Traccia condivisa ricevuta da',
    ru: 'Получена общая дорожка от'
  },
  toast_track_shared: {
    es: 'Pista compartida con el chat',
    en: 'Track shared with chat',
    pt: 'Faixa compartilhada com o chat',
    zh: '音轨已分享到聊天',
    ja: 'トラックをチャットに共有しました',
    fr: 'Piste partagée avec le chat',
    it: 'Traccia condivisa con la chat',
    ru: 'Дорожка отправлена в чат'
  },
  toast_syncing_with_peer: {
    es: 'Sincronizando con',
    en: 'Syncing with',
    pt: 'Sincronizando com',
    zh: '正在同步:',
    ja: '同期中:',
    fr: 'Synchronisation avec',
    it: 'Sincronizzazione con',
    ru: 'Синхронизация с'
  },
  toast_jam_started: {
    es: 'inició una sesión compartida en Aurora',
    en: 'started a shared jam on Aurora',
    pt: 'iniciou uma sessão compartilhada no Aurora',
    zh: '在 Aurora 开始了共享会话',
    ja: 'が Aurora で共有セッションを開始しました',
    fr: 'a démarré une session partagée sur Aurora',
    it: 'ha avviato una sessione condivisa su Aurora',
    ru: 'начал совместную сессию в Aurora'
  },

  /* ---------- Pulido i18n: textos que estaban hardcodeados en español ---------- */
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
  sendtochat_unavailable: {
    es: 'sendToChat no disponible',
    en: 'sendToChat not available',
    pt: 'sendToChat indisponível',
    zh: 'sendToChat 不可用',
    ja: 'sendToChat は利用できません',
    fr: 'sendToChat indisponible',
    it: 'sendToChat non disponibile',
    ru: 'sendToChat недоступен'
  },
  error_toast: {
    es: 'Error: X',
    en: 'Error: X',
    pt: 'Erro: X',
    zh: '错误：X',
    ja: 'エラー: X',
    fr: 'Erreur : X',
    it: 'Errore: X',
    ru: 'Ошибка: X'
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
  toast_already_in_playlist: {
    es: 'Ya está en la lista',
    en: 'Already in this playlist',
    pt: 'Já está nesta lista',
    zh: '已在歌单中',
    ja: '既にプレイリストにあります',
    fr: 'Déjà dans cette liste',
    it: 'Già in questa lista',
    ru: 'Уже в этом списке'
  },
  picker_already_in: {
    es: 'en la lista',
    en: 'in this list',
    pt: 'na lista',
    zh: '已在列表中',
    ja: 'リスト内',
    fr: 'dans la liste',
    it: 'nella lista',
    ru: 'в списке'
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
  listeners_standalone_hint: {
    es: 'Estás en modo reproductor normal. Para escuchar con amigos en tiempo real, usa Aurora dentro de un chat de Delta Chat. Consejo: abre esta página en otra pestaña para probar la sincronización.',
    en: 'You are in standalone player mode. To listen together in real time, use Aurora inside a Delta Chat. Tip: open this page in another tab to try syncing.',
    pt: 'Estás no modo de reprodutor normal. Para ouvir com amigos em tempo real, usa a Aurora dentro de um chat do Delta Chat. Dica: abre esta página noutro separador para testar a sincronização.',
    zh: '当前为普通播放器模式。要与好友实时同步收听，请在 Delta Chat 聊天中使用 Aurora。提示：在其他标签页打开本页可试用同步功能。',
    ja: '通常のプレイヤーモードです。友人とリアルタイムで一緒に聴くには、Delta Chat 内で Aurora を使ってください。ヒント: 別タブでこのページを開くと同期を試せます。',
    fr: "Vous êtes en mode lecteur normal. Pour écouter en temps réel avec des amis, utilisez Aurora dans une discussion Delta Chat. Astuce : ouvrez cette page dans un autre onglet pour tester la synchronisation.",
    it: "Sei in modalità lettore normale. Per ascoltare in tempo reale con gli amici, usa Aurora dentro una chat Delta Chat. Suggerimento: apri questa pagina in un'altra scheda per provare la sincronizzazione.",
    ru: 'Вы в режиме обычного плеера. Чтобы слушать вместе в реальном времени, откройте Aurora в чате Delta Chat. Совет: откройте эту страницу в другой вкладке, чтобы попробовать синхронизацию.'
  }
};

window.TRACKS = TRACKS;
window.DEFAULT_PLAYLISTS = DEFAULT_PLAYLISTS;
window.COVER_PALETTE = COVER_PALETTE;
window.SAMPLE_LRC = SAMPLE_LRC;
window.SUPPORTED_LANGS = SUPPORTED_LANGS;
window.I18N = I18N;
