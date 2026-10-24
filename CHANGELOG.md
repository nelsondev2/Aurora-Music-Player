# Changelog

Historial de versiones **publicadas** de Aurora Music Player. El
diario detallado de desarrollo y verificación de cada cambio está en
`docs/INFORME-PULIDO-UI.md` (§§1–61).

## 1.2.0 — Primera versión pública

Primera versión compartida fuera del desarrollo. Incluye, ya
verificado función a función:

- Importación de MP3, M4A, FLAC, WAV, OGG y Opus con metadatos,
  portadas, duración real y deduplicación al reimportar.
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
- Estadísticas (recientes, más reproducidas, historial; solo cuentan las canciones escuchadas enteras) y compartir
  canciones, listas `.m3u8` y letras por `sendToChat`.
- Interfaz en 8 idiomas, temas y colores de acento.
- Pasada visual (§69): portadas renderizadas a la resolución real de
  pantalla (filas ×2, tarjetas y héroe incluidos), pestañas inferiores
  legibles también en oscuro y agarre táctil de la barra de progreso
  ampliado.
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
