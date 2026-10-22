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
