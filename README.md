# Aurora Music Player

Reproductor de música **offline-first** pensado para **WebXDC**: se comparte como archivo `.xdc` en un chat de Delta Chat y funciona sin red, sin cuenta y sin servidor. Carga archivos locales (MP3, M4A, FLAC, WAV, OGG, Opus), lee ID3 y letras LRC.

**Versión:** 1.5.0 · licencia MIT

> **Nota:** Aurora es un proyecto **generado con inteligencia
> artificial**. Todo su código —y las traducciones de la
> interfaz— lo ha escrito un asistente de IA, con la dirección,
> las decisiones y las pruebas finales de una persona. Si algo
> suena raro en tu idioma o se comporta de forma extraña, no es
> un misterio: repórtalo en los *issues* y se corrige.

## Qué hace

- **Tu música, sin nube**: importa MP3, M4A, FLAC, WAV, OGG y Opus
  desde el dispositivo, con metadatos, portadas y duración real. Todo
  queda guardado localmente en la instancia del chat; sin red, sin
  cuenta y sin servidor.
- **Letras sincronizadas**: archivos `.lrc` o letras incrustadas, con
  desplazamiento automático y pantalla de letras a lo grande.
- **Listas para todo**: crea y edita listas, marca **Favoritos** y
  deja que la app mantenga sola «Mi Música» (lo añadido fuera de
  listas). Todas las listas —Favoritos incluida— **se ordenan solas
  por tus estrellas**: las mejores arriba, las sin nota al final, y
  la cola suena en ese mismo orden.
- **Estrellas de 1 a 5** en el menú de cada canción, en el reproductor
  y en las filas, para valorar sin salir de donde estás. En Inicio,
  el escaparate «Más valoradas» enseña tus mejores notas.
- **Reproducción seria**: cola, aleatorio de verdad, repetir, bucle
  A-B, «Reproducir desde…» con su contexto, reproducción continua
  (gapless/crossfade), ecualizador, visualizador y temporizador de
  apagado.
- **Estadísticas**: más reproducidas, artistas favoritos y tiempo de
  escucha (una reproducción solo cuenta cuando la canción suena
  entera).
- **Comparte por el chat**: envía canciones, listas (`.m3u8`) y letras
  con `sendToChat`, sin salir de Delta Chat.
- **Copia de respaldo de verdad**: Ajustes → Copia de respaldo guarda
  **toda** la biblioteca —canciones con su audio, listas, favoritos,
  estrellas y estadísticas— en un solo archivo `.aurora` que se manda al
  chat. Al restaurarlo, cada audio vuelve a su canción **con su mismo
  id**, así que las listas quedan enlazadas y la música suena: lo que no
  hacían las listas `.m3u8`, que solo llevan nombres de archivo.
  Restaurar **fusiona** (añade lo que falta, nunca borra) y reconoce la
  misma canción por su huella aunque en la otra versión tuviera otro id.
- **Ordena y explora a tu manera**: cada lista se puede ordenar por
  título, artista, álbum o duración (además del orden por estrellas),
  y Biblioteca explora tu colección por Álbumes, Artistas y Géneros.
  La cola se puede guardar como lista y hay buscador de duplicados.
- **14 idiomas** (es, en, pt, zh, ja, fr, it, ru, de, uk, pl, tr, id,
  zh-TW), temas y colores de acento.

## Empaquetar como .xdc (Delta Chat)

Requisito: Python 3 (solo biblioteca estándar, sin dependencias).

```bash
python3 build-xdc.py            # genera aurora-music-player.xdc
python3 build-xdc.py --check    # valida el .xdc generado
```

El script comprueba antes de comprimir:

- `index.html` en la raíz del ZIP
- `manifest.toml` con `name` y `source_code_url`
- `icon.png` cuadrado de 128–512 px
- todas las rutas relativas y presentes en el paquete
- ninguna carga remota (un `.xdc` no tiene red)
- que ningún `webxdc.js` viaje en el paquete (lo inyecta el cliente)
- que `App.VERSION`, el README y el CHANGELOG digan la misma versión

El resultado es un ZIP con compresión Deflate, **29 archivos y ~407 KB**, reproducible (mismo contenido → mismo SHA-256).

### Probar en Delta Chat

1. `python3 build-xdc.py`
2. Adjunta `aurora-music-player.xdc` en un chat (o en «Mensajes guardados») y envíalo.
3. Tócalo para abrirlo: la app arranca dentro del chat.
4. Pulsa **+** y elige tus archivos de audio. Los datos quedan en esa instancia del `.xdc`.

> **Cada copia del `.xdc` guarda su propia biblioteca.** Si reenvías el archivo se crea una instancia nueva y vacía: usa siempre la misma copia, porque tu música, tus listas y tus ajustes viven dentro de esa instancia.

### Qué cambia dentro de Delta Chat

- Los enlaces externos están bloqueados por el cliente: en «Acerca de» el enlace al código fuente se sustituye por la URL en texto.
- El selector de carpetas se desactiva (se eligen archivos, no carpetas).
- «Compartir» usa `sendToChat` para enviar audio, letras o listas al chat.
- La API `window.webxdc` la inyecta el cliente: `index.html` referencia `webxdc.js` (ruta exacta) y ningún `webxdc.js` viaja en el `.xdc`, como manda la spec webxdc. Si el paquete llevara uno propio (p. ej. en `js/`), el cliente no lo reemplazaría y los envíos al chat se perderían en silencio.

## Limitaciones conocidas

Dichas en voz alta, para que nadie se lleve una sorpresa:

- **Cada copia del `.xdc` guarda su propia biblioteca** (ya avisado
  arriba): reenviar el archivo crea una instancia nueva y vacía. No
  hay sincronización entre copias ni entre dispositivos. Para llevarte
  la biblioteca a otra versión, a otro teléfono o para recuperarla si
  se borra la instancia, está la **copia de respaldo** (Ajustes → Copia
  de respaldo → Crear copia): un `.aurora` con el audio dentro que se
  envía al chat y se restaura con «Importar copia de respaldo». Ojo: el
  `.aurora` ocupa lo que ocupe tu música, así que en bibliotecas muy
  grandes el chat tendrá que aceptar un archivo grande.
- **La música se detiene al cerrar la app.** Las WebXDC se ejecutan
  dentro del cliente y este no ofrece reproducción en segundo plano
  tras cerrar la ventana; es un límite de la plataforma, no un fallo.
- **El espacio manda el dispositivo.** La música se guarda en el
  almacenamiento web de la instancia: bibliotecas muy grandes pueden
  chocar con la cuota del sistema, que Aurora no controla.
- **Sin selector de carpetas en Delta Chat** (el cliente solo deja
  elegir archivos sueltos); en navegador sí está disponible.
- Las traducciones las mantiene el proyecto: si tu idioma suena raro,
  un aviso en los *issues* se agradece.

## Reportar un problema

En los [*issues* de GitHub](https://github.com/nelsondev2/Aurora-Music-Player/issues)
(en español o inglés). Ayuda mucho incluir:

- la versión de Aurora (Ajustes → Acerca de),
- tu dispositivo y la versión de Delta Chat,
- los pasos para reproducir el fallo, y qué esperabas que pasara.

## Ejecutar en un navegador

No hay build ni dependencias. Abre `index.html` o sirve la carpeta:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

En navegador no hay API webxdc (la referencia a `webxdc.js` no resuelve): las exportaciones se descargan como archivos y la selección de archivos usa el selector del navegador. Para simular Delta Chat, el simulador oficial `webxdc-dev` o el `webxdc.js` de Hello funcionan sin tocar el paquete.

## Pruebas

La app no tiene dependencias de ejecución; las pruebas sí (solo para desarrollo).
Requiere Node 20 o superior:

```bash
npm install     # una vez: jsdom y fake-indexeddb
npm test        # 52 pruebas
```

Los 54 iconos de la interfaz son un sprite SVG inline en `index.html` (un
`<symbol>` por icono, trazo de 1,9 sobre rejilla de 24, `currentColor`), así se
tiñen solos con el tema y el acento. `npm run icons:preview` regenera
`docs/iconos-sprite.png` con todos los símbolos y los tres temas; las reglas del
sistema están en [`docs/ICONOS.md`](docs/ICONOS.md). La portada que se dibuja
cuando una pista no trae carátula tiene su propio pintor y su vista previa:
`npm run covers:preview` → `docs/portadas.png`
([`docs/PORTADAS.md`](docs/PORTADAS.md)).

Las pruebas arrancan la app **de verdad** —`index.html` y todos los `js/` en un DOM
real, con IndexedDB, `<audio>` y Web Audio— y comprueban lo que más duele si se
rompe: cola por contexto, aleatorio, repetición, borrado con «Deshacer»,
estadísticas, sesión, caché de `objectURL`, los 14 idiomas, el escapado de
metadatos, la apertura de las 20 hojas, la coherencia de la versión y que el
`.xdc` se construya igual dos veces. Otra comprueba que la portada generada sale
siempre del mismo pintor. Otra tanda vigila el formato de guardado:
que el audio no se cuele en el registro de la pista, que abrir la app no cargue
ningún Blob, que borrar no deje huérfanos y que la migración se haga una vez. Y
otra, la detección de duplicados por huella de contenido.

Nada de esto viaja en el `.xdc`: `build-xdc.py` empaqueta solo `APP_ENTRIES`
(la app, sus estilos, el icono y el manifiesto).

## Contenido

| Ruta | Qué es |
|---|---|
| `index.html` | Markup de la app (vistas, hojas, sprite de iconos) |
| `css/styles.css` | Estilos, temas y acentos (toda la CSS vive en `css/`) |
| `js/i18n.js` | Traducciones de los 14 idiomas (solo texto: aquí se revisa un idioma) |
| `js/portadas.js` | Portada generada: un solo pintor para reproductor, filas, tarjetas y listas |
| `js/data.js` | Catálogo inicial, paleta de portadas y configuración |
| `js/storage.js` | Persistencia en IndexedDB: metadatos de las pistas, audio aparte (`blobs`), listas y ajustes |
| `js/backup.js` | Copia de respaldo `.aurora`: cabecera + manifiesto JSON + audios en crudo; restaurar fusiona |
| `js/uploader.js` | Lectura de archivos, ID3 y LRC |
| `js/` | Todo el JavaScript propio: módulos de la app (audio, UI, listas, letras, ajustes…) |
| `assets/` | Fuente Outfit, iconos y jsmediatags (`assets/js/`) |
| `build-xdc.py` | Empaquetado y validación del `.xdc` |
| `manifest.toml`, `icon.png` | Metadatos e icono del WebXDC |
| `README.md`, `LICENSE` | Documentación y licencia |
| `CHANGELOG.md` | Historial de versiones publicadas |
| `docs/` | Informes de auditoría y vista previa del sprite de iconos |
| `test/` | Pruebas de comportamiento (`npm test`) |
| `tools/` | Utilidades de desarrollo (vista previa de iconos) |
| `.github/workflows/` | CI: pruebas en cada push y publicación del `.xdc` al etiquetar |

La aplicación no tiene dependencias externas ni build: el navegador carga `index.html` y los `js/` tal cual. Las dependencias de `package.json` son **solo para las pruebas** (jsdom y fake-indexeddb) y no viajan en el `.xdc`. Antes de empaquetar, `build-xdc.py` valida el paquete contra las reglas de Delta Chat.
