# Changelog

Historial de versiones **publicadas** de Aurora Music Player.

## 1.3.0 — La biblioteca abre sin cargar el audio

- **El audio deja de viajar dentro de la pista.** Los registros de
  `tracks` guardan solo metadatos; cada archivo se va a un almacén
  `blobs` aparte (base de datos versión 2). Antes, abrir la app con la
  biblioteca llena deserializaba un Blob por canción antes de pintar
  nada; ahora el audio se lee cuando de verdad hace falta —reproducir,
  precargar para el cambio sin pausa, compartir, releer etiquetas— y se
  suelta en cuanto su `objectURL` sale de la caché, así que una sesión
  larga tampoco se queda con toda la biblioteca en memoria. Las
  bibliotecas anteriores se migran solas la primera vez, con cursor
  (sin cargar la biblioteca entera en RAM) y de forma idempotente: si
  la migración se corta, el arranque siguiente la termina.
- Borrar una pista se lleva también su audio, y «borrar la biblioteca»
  vacía el almacén de audio: el formato nuevo no debe dejar Blobs sin
  dueño ocupando espacio.
- **Las listas sin carátula se reconocen de un vistazo.** Todas llevaban el
  mismo icono de lista sobre un degradado plano: se distinguían leyendo el
  nombre. Ahora llevan su inicial y la misma luz que la portada de una pista,
  con el ángulo y el sitio del resplandor derivados del nombre de la lista
  (mismos números en Listas, en Inicio y en la hoja de edición, que pinta con
  el pintor común). Los colores guardados se acotan a hex antes de entrar en
  el `style`.
- **Una sola portada generada.** Cuando una pista no trae carátula, la app
  dibuja una: degradado de la paleta de la pista, un resplandor desplazado
  según el título, surcos tenues y la inicial. Antes había dos pintores —uno
  en el reproductor y otro en las filas— con distinto grosor de surco, otro
  cuerpo de letra y otro alfa, así que la misma canción se veía distinta
  según dónde miraras; ahora los dos llaman a `js/portadas.js`. La semilla es
  el título (misma canción, misma portada) y por debajo de 48 px se suprimen
  los adornos, que a ese tamaño solo ensucian. Vista previa en
  `docs/portadas.png` (`npm run covers:preview`), pintada con el código real.
- **Los duplicados se detectan por contenido, no por nombre.** La
  importación comparaba nombre y tamaño: dos archivos distintos que
  coincidían en ambos se daban por el mismo y uno se descartaba sin
  avisar, mientras que la misma canción renombrada entraba duplicada.
  Ahora se compara una huella (tamaño + SHA-256 de los primeros 256 KB,
  con hash propio si el WebView no tiene `crypto.subtle`); nombre y
  tamaño solo acotan los candidatos. Las pistas antiguas sin huella se
  comprueban en el momento de la colisión, y la van guardando cuando se
  reproducen o se releen sus etiquetas.
- **Las traducciones salen de `data.js`.** 4.300 de sus 4.400 líneas eran
  los 14 idiomas: ahora están en `js/i18n.js`, junto a la lista de idiomas,
  y `data.js` se queda con el catálogo y la paleta. Revisar un idioma deja
  de ser buscar texto entre el catálogo y las utilidades.
- Ocho pruebas nuevas (30 en total) para esa separación: que el Blob no
  se cuele en el registro, que reabrir no cargue audio, que reproducir lo
  traiga, que borrar no deje huérfanos y que la migración se haga una
  sola vez. Otras siete cubren la huella de duplicados: mismo contenido,
  contenido distinto con el mismo nombre, archivo renombrado y registros
  sin audio legible.
- **La versión que se ve es la versión que es.** Acerca de enseñaba
  «1.2.0» en la 1.2.5 porque `App.VERSION` se quedó atrás: ahora dice
  1.2.5, el README también, y no puede volver a pasar — `build-xdc.py`
  se niega a empaquetar si la app, el README y el CHANGELOG no
  coinciden, y el flujo de publicación rechaza una etiqueta que no
  cuadre con `App.VERSION`.
- **Vuelven las pruebas al repositorio.** `npm test` arranca la app
  real (jsdom + IndexedDB de verdad, audio instrumentado) y comprueba
  lo que más duele si se rompe: cola por contexto, aleatorio,
  repetición, borrado con «Deshacer», estadísticas, sesión, caché de
  objectURL, i18n de los 14 idiomas, escapado de metadatos, apertura de
  las 20 hojas y coherencia de versión. 22 pruebas, cero dependencias
  en el `.xdc` (el paquete no lleva `test/` ni `node_modules/`), y un
  flujo de GitHub Actions que las pasa en cada *push* y *pull request*.
  La primera pasada encontró un fallo de verdad: un `play()` pendiente
  podía devolver el estado «reproduciendo» después de parar o borrar
  la pista en curso.
- **Ajustes → Acerca de → Diagnóstico.** En Delta Chat no hay consola:
  el último error se guarda y ahora se puede ver y copiar en un texto
  con versión, idioma, tema, plataforma, tamaño de la biblioteca, uso
  de disco y navegador, para pegarlo en un informe. Antes se anotaba
  en `_lastError` y no lo leía nadie.
- **La caché de `objectURL` tiene tope** (12): una sesión larga ya no
  se queda con una URL viva por cada canción escuchada. Nunca se
  revoca la que está sonando ni la precargada.
- **El uso de disco de Ajustes se refresca siempre**, también al abrir
  Ajustes desde Inicio (antes solo se calculaba desde el menú ⋯ y
  podía quedar en blanco).
- Comentarios corregidos: el diccionario ya no dice «8 idiomas» (son 14).
- **Sprite de iconos redibujado entero.** Los 54 iconos pasan a un sistema
  único: rejilla de 24, trazo de 1,9 con extremos y uniones redondeadas y
  `currentColor`. Antes convivían rellenos Material, trazos sueltos y algún
  trazado heredado de otra familia; ahora la navegación, el transporte, los
  menús y las listas comparten grosor y proporción, se leen a 16 px y se
  tiñen solos con los tres temas y los cinco acentos. Los sólidos quedan
  reservados a lo que marca estado (play, pausa, saltos, estrella, corazón
  lleno). Vista previa en `docs/iconos-sprite.png`; reglas en
  `docs/ICONOS.md`; se regenera con `npm run icons:preview`.

## 1.2.5 — Más ligera, en 14 idiomas

- Limpieza de cara al público: los comentarios del código
  ya no cuentan la crónica interna del desarrollo y el
  README solo trae lo que interesa a quien usa o desarrolla
  la app, incluida la nota que aclara que es un proyecto
  generado por IA.
- Restauraciones a petición del usuario: vuelve el **bucle A-B del reproductor**
  tal cual era en la 1.2.0 (botón en la fila de controles,
  rango marcado en la barra, se limpia al cambiar de
  canción) y el **menú de Letras muestra otra vez todas
  sus opciones una detrás de otra** — desfase, velocidad,
  bucle de sección y restablecer siempre visibles, sin
  botón de despliegue.
- Barra de herramientas de Letras en su sitio: todas las
  opciones vuelven a ir **en una sola fila, una detrás de
  otra** (tamaño, desfase, velocidad, bucle, acciones),
  sin grupos desperdigados ni acciones cortadas.
- Gran poda tras una auditoría completa (§100): fuera la hoja
  de Volumen (nadie la abría), el bucle A-B del reproductor
  (queda el de Letras), «sincronizar tocando» y el karaoke por
  palabras, el modo vinilo, «Iniciar radio» y compartir
  estadísticas. La transición entre canciones es ahora un solo
  control (Corte / Sin pausa / Fundido), el ajuste fino de
  Letras se pliega tras un botón, el menú ⋯ ya no mezcla
  contexto de la canción, y «Mantenimiento» explica qué hace
  y qué destruye cada opción. La valoración con estrellas
  no se ha tocado.
- Trabajos de fondo (§101): el ajuste del sistema «reducir
  movimiento» ahora también calma el visualizador y la
  portada flotante (antes el lienzo seguía animándose), y
  las listas con miles de canciones ya no se pintan enteras
  al abrirlas — el detalle de lista usa la misma lista
  virtual que la cola — sin perder el abrir donde suena.
  De paso, un arreglo menor: una pista sin portada ya no
  puede romper el pintado de las filas. El blindaje de
  datos se evaluó y se descartó expresamente: sin copia de
  seguridad, como estaba.
- Internacionalización (§102): seis idiomas nuevos con el
  diccionario completo (363 textos cada uno) — Alemán,
  Ucraniano, Polaco, Turco e Indonesio, más chino
  tradicional (el simplificado ya estaba), que además ya
  se detecta solo en teléfonos de Taiwán/Hong Kong. La app
  pasa de 8 a 14 idiomas. Las traducciones nuevas son
  automáticas: convendría una revisión nativa antes de
  publicarlas.
- Micro-pulido interno (§103, sin cambio visible): el
  índice que localiza canciones por identificador ahora
  también detecta si la lista entera fue sustituida por
  otra con el mismo número de canciones, para no mirar
  nunca un mapa anticuado.
- Segunda auditoría aplicada (§104): desaparece la hoja
  de Listas que nadie podía abrir (las listas viven en
  Biblioteca y ya no se pintan dos veces), Favoritos
  tiene una sola casa (su vista), se acaban las listas
  inteligentes — las ya creadas se convierten en listas
  normales con las canciones que su regla elegía — y el
  Historial como pantalla propia («Buscar duplicados»
  se queda). Estadísticas conserva lo esencial y el
  diccionario baja a 333 textos por idioma.
- Blindaje interno (§105, sin cambio visible): la
  conversión de listas heredadas al arrancar ahora trata
  cada lista por separado — si alguna diera un problema,
  queda intacta y el resto de la biblioteca carga igual.

## 1.2.0 — Primera versión pública

Primera versión compartida fuera del desarrollo. Incluye, ya
verificado función a función:

- Importación de MP3, M4A, FLAC, WAV, OGG y Opus con metadatos,
  portadas, duración real y deduplicación al reimportar.
- Carga rápida con bibliotecas grandes (§85): el arranque ya no
  relee ni reescribe la biblioteca entera — solo se re-revisan las
  canciones incompletas y quedan marcadas —, las direcciones de
  cada canción se crean al reproducirlas y los FLAC/OGG/Opus ya
  no se leen dos veces al importar.
- Biblioteca con listas editables, Favoritos y «Mi Música»
  automática. Las listas y la cola se ordenan automáticamente por
  estrellas (mejor nota primero, sin nota al final), y el escaparate
  «Más valoradas» de Inicio enseña las mejores notas.
- Valoración de 1 a 5 estrellas en el menú de canción, el reproductor
  y las filas, con insignia visible en las listas y la cola.
- Reproductor con cola, aleatorio, repetir, contexto «Reproduciendo
  desde…», gapless/crossfade, ecualizador, visualizador y temporizador
  de apagado.
- Letras sincronizadas LRC (archivo o incrustadas).
- Limpieza interna (§93): auditoría de código muerto — fuera el
  selector de pistas de la hoja de crear (inalcanzable desde
  que las pistas se añaden en la vista de edición), 10 textos
  sin uso en los 8 idiomas, 6 variables de estilo huérfanas y
  un archivo de iconos que viajaba en la app sin cargarse.
  La app pesa un poco menos y hace exactamente lo mismo.
- Ajustes a petición (§98): la portada a pantalla completa
  ya no lleva iconos de entrar/salir (se descubre tocando);
  la cola de reproducción se abre, como las listas, en la
  canción que está sonando; y desaparece la cabecera
  «A continuación · N» de la cola.
- Cinco detalles que se notan (§97): en la portada a pantalla
  completa, el título flota unos segundos y se desvanece; la
  onda del visualizador ya no «despierta» de cero en cada
  canción; la fila Sleep del menú muestra la cuenta atrás;
  al abrir una lista, la vista va directa a la canción que
  suena; y la portada siguiente se prepara en silencio para
  que cambiar de canción no parpadee.
- Tocar la portada ya no pausa (§95): la abre a pantalla
  completa con el visualizador, y tocarla de nuevo vuelve al
  reproductor (también se sale con Escape o cambiando de
  vista). La pausa se queda en el botón de play. Deslizar
  sobre la portada sigue cambiando de canción y la pulsación
  larga sigue marcando favorito. Los iconos de entrar/salir
  son ahora una insignia pequeña en la esquina, sin velar la
  carátula (§96).
- Ronda de correcciones (§94) tras un informe de bugs externo,
  verificado punto a punto: Espacio ya no secuestra los botones
  enfocados y Escape cierra la ventana que abriste la última;
  un archivo corrupto salta una vez, no dos; cancelar el
  temporizador de sueño ya no pausa la música; las líneas de
  crédito de las letras ya no saltan al principio y se aceptan
  sellos con horas y coma decimal; al borrar una pista el
  historial y las estadísticas quedan limpios, y deshacer la
  devuelve a la cola en el mismo sitio; editar una canción a
  mano ya no lo deshace el re-etiquetado automático.
- Micro-detalles (§92): las insignias (estrellas, «Inteligente»,
  «Se conserva») dejan los 10 px y entran en la escala
  tipográfica; los títulos largos de las hojas se recortan con
  elipsis en vez de empujar el botón de cerrar; y las pestañas
  de Biblioteca (Listas/Álbumes/Artistas/Géneros) ya anuncian
  su estado a los lectores de pantalla.
- Estados vacíos (§91): el icono deja de ser un mosaico morado
  sólido con halo — ahora es un cristal suave tintado con el
  color de acento (y con los colores de la portada en Letras),
  a juego con el resto de la interfaz.
- Visualizador (§90): solo queda la onda fluida sobre la
  portada; el modo de barras de espectro desaparece (tapaba
  demasiado el cover). El botón alterna onda/apagado y quien
  tuviera «barras» guardado pasa a onda automáticamente.
- Biblioteca (§89): la barra de pestañas (Listas, Álbumes,
  Artistas, Géneros) queda fija bajo la cabecera al desplazar
  la lista, sin perderse nunca de vista.
- Duplicados a tu elección (§88): en «Canciones duplicadas» ya
  no manda siempre la copia más antigua — marcas «Conservar
  esta» en la copia que prefieras (cada fila enseña nombre,
  duración y tamaño para decidir por calidad) y puedes borrar
  las demás una a una o todas de una vez.
- Corrección grave (§87): al cerrar y reabrir la app, el
  reproductor ya no salta de canción en canción diciendo que no
  se puede reproducir — las direcciones temporales de cada
  archivo ya no se guardan y se recrean al momento de sonar —,
  y «Mi Música» ya no aparece de sorpresa al arrancar cuando ya
  tienes tus listas: nace al importar canciones sin lista.
- Letras con foco (§86): en la vista de letras solo se lee con
  claridad la línea que está sonando y el resto queda difuminado
  (al desplazar a mano la letra se aclara para buscar un verso);
  sin letra la vista ya no muestra mini reproductor — solo la
  tarjeta para cargar la letra — y el gesto de deslizar para
  cambiar de canción dentro de Letras desaparece.
- Estadísticas (recientes, más reproducidas, historial; solo cuentan las canciones escuchadas enteras) y compartir
  canciones, listas `.m3u8` y letras por `sendToChat`.
- Interfaz en 8 idiomas, temas y colores de acento.
- Pasada visual (§69): portadas renderizadas a la resolución real de
  pantalla (filas ×2, tarjetas y héroe incluidos), pestañas inferiores
  legibles también en oscuro y agarre táctil de la barra de progreso
  ampliado.
- Arreglo (§84): con el visualizador activo la portada ya
  no encoge. El visualizador se dibuja ahora sobre la
  parte baja de la propia carátula y no le quita espacio:
  la portada se ve igual de grande con él encendido o
  apagado.
- Auditoría de la cola por valoradas (§83): «Reproducir
  siguiente» ahora se llama «Reproducir después de la
  canción actual» y MUEVE la canción en vez de duplicarla
  (antes sonaba dos veces); valorar canciones reordena al
  momento lo que queda por sonar; las canciones nuevas de
  la lista entran en la cola por su nota, no al final; el
  avance sin pausa también respeta los cambios de la
  lista; y cada canción de la cola tiene por fin su menú
  «Más opciones» (⋯).
- Arreglo (§82): quitar una canción de la cola ya no la trae
  de vuelta al pasar a la siguiente. La cola manda: solo
  entran las canciones nuevas de la lista (al final) y
  salen las que se borren de la lista.
- Lo que le faltaba a un reproductor normal (§81): ordenación
  manual de listas (título, artista, álbum, duración…, además
  del orden por estrellas), catálogo navegable de Álbumes,
  Artistas y Géneros en Biblioteca, listas inteligentes que
  se rellenan solas (4+ estrellas, un género, nunca
  reproducidas, olvidadas…), guardar la cola como lista,
  sincronizar la letra tocando al ritmo de la canción,
  estadísticas de canciones saltadas y olvidadas, buscador
  de duplicados y fundido suave al pausar/reanudar. Y el
  renombre de listas ahora se puede confirmar (✓/✗, Enter
  o Escape), como debe ser.
- Auditoría general (§80): poda verificada de código muerto
  (37 claves de idioma sin uso en los 8 idiomas, 11 clases CSS
  y 1 enlace JS), con regresión completa de las funciones
  recientes en verde. Sin cambios visibles.
- Fondo del reproductor según la portada (§75): los colores se
  extraen de la carátula (con normalización para no ensuciar ni
  romper el contraste) y tiñen fondo, resplandor y visualizador;
  sin portada o sin color aprovechable, el fondo de acento de
  siempre. Adaptado a tema claro y AMOLED.
- Letras (§74): la línea resaltada va ahora centrada en pantalla
  también en modo normal (antes quedaba alta, al 25 %).
- Letras sin letra (§73): la vista entra en modo limpio (la barra de
  herramientas inútil se oculta y manda la tarjeta de acciones), con
  variante propia cuando no hay ninguna pista cargada.
- Reproductor (§72): barra de progreso con avance continuo, duración
  total que alterna a tiempo restante al tocarla, botón de Letras que
  anuncia si la canción trae letra, nombre accesible del modo de
  repetición y portadas guardadas a 800 px para el lienzo de 720.
- Portadas de Inicio nítidas en pantallas de alta densidad (§71):
  miniaturas y lienzos dimensionados para DPR 3 (384/144 px), con
  actualización automática de las miniaturas guardadas por versiones
  anteriores la primera vez que cada portada se ve en grande.
- Respuesta a auditoría externa con navegador (§70): etiqueta de
  artistas en estadísticas, toast honesto al compartir (enviado vs.
  descargado), foco de teclado contenido en las hojas, objetivos
  táctiles y contraste reforzados, contenido de escritorio acotado y
  visualizador con estado de reposo en pausa.

### Limitaciones de esta versión

- Cada copia del `.xdc` guarda su propia biblioteca: sin
  sincronización entre copias/dispositivos ni copia de seguridad
  integrada. Usa siempre la misma copia.
- La reproducción se detiene al cerrar la app (límite de la
  plataforma WebXDC, sin segundo plano tras cerrar la ventana).
- Verificada en un Delta Chat real por el mantenedor (lista de
  pruebas del INFORME §61, puntos 1–13, todos en verde; §62): se
  publica como versión funcional completa; los fallos se recogen en
  los *issues* de GitHub.
