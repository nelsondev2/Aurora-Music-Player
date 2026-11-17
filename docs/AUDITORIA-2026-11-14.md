# Auditoría técnica — Aurora Music Player

**Fecha:** 14 de noviembre de 2026
**Base auditada:** `b211591` (etiqueta `v1.2.5`, rama `main`)
**Alcance:** código completo (18 archivos JS, 16 483 líneas), HTML, CSS, empaquetado `.xdc`, i18n y accesibilidad.
**Método:** lectura del código + pruebas de comportamiento ejecutadas sobre la app real (DOM simulado con `jsdom`, `fake-indexeddb` y audio/Web Audio instrumentados) + reconstrucción y validación del `.xdc`.

---

## 1. Veredicto

**Es un proyecto por encima de la media para su categoría.** El código está pensado, no solo escrito: hay decisiones defensivas documentadas (cuota llena, blob huérfano, doble arranque en WebXDC, hoja cerrada con `inert`, deduplicación de escrituras en IndexedDB). La app arranca sin un solo error de JavaScript, el escapado de HTML es consistente y el paquete `.xdc` es reproducible byte a byte.

Los puntos débiles **no están en la lógica de reproducción** (que resistió todas las pruebas de cola, aleatorio, repetición, borrado con deshacer y restauración de sesión que le hice), sino en tres frentes: **verificabilidad** (no hay pruebas en el repo), **supervivencia de los datos** (no hay copia de seguridad) y **detalles de mantenimiento** (versión desincronizada, comentarios obsoletos, estado muerto).

| Área | Nota | Comentario |
|---|---|---|
| Arquitectura y organización | 8,5/10 | 18 módulos por responsabilidad, estado centralizado, orden de carga explícito |
| Reproductor (cola/shuffle/repeat/gapless) | 9/10 | Sin fallos en las pruebas; casos límite bien resueltos |
| Persistencia y tolerancia a fallos | 8,5/10 | IndexedDB + espejo en `localStorage`, reintento ante conexión muerta |
| Seguridad (XSS) | 9,5/10 | Todas las interpolaciones pasan por `esc()`; verificado con inyección real |
| i18n | 9/10 | 337 claves × 14 idiomas, **0 huecos**; comentarios desactualizados |
| Accesibilidad | 8/10 | `inert`, trampa de foco, nombres accesibles, `prefers-reduced-motion`; nits de encabezados |
| Rendimiento | 7/10 | Bien en el día a día; arranque y memoria no escalan a bibliotecas enormes |
| Pruebas / CI | 3/10 | No hay suite ni lint; el CI solo empaqueta |
| Datos del usuario | 4/10 | Sin copia de seguridad ni importación de respaldo |
| Documentación | 7/10 | Muy buena, pero con cifras y comentarios que ya no cuadran |

---

## 2. Lo que está bien (con evidencia)

1. **La lógica de reproducción es sólida.** Ejecuté 25 comprobaciones sobre la app real. Pasaron todas las de cola y reproducción:
   - cola correcta por contexto (`all`, playlist, favoritos), con índice apuntando a la pista elegida;
   - `repeat: all` vuelve al principio y `repeat: one` reinicia la misma (comprobado `currentTime = 0`);
   - aleatorio: la pista pulsada suena primero, sin duplicados, y al desactivarlo se recupera el orden original;
   - la cola de una lista respeta el orden por estrellas;
   - borrar la canción que suena salta a otra y deja la reproducción en pausa; «Deshacer» la devuelve a la biblioteca **y a su posición en la cola**;
   - la sesión se guarda y se restaura (`restoreSession() → true`).
2. **Seguridad frente a inyección.** Importé una pista llamada `Canción <b>uno</b>` y el HTML renderizado salió escapado. `App.esc()` (`js/ui.js:585`) cubre `& < > " '` y se usa de forma consistente en atributos y texto; no encontré ni una interpolación sin escapar en las 53 llamadas a `innerHTML`.
3. **Persistencia pensada para el mundo real.** `js/storage.js` resuelve problemas que casi nadie resuelve: promesa única de apertura, `onblocked`/`onversionchange`, reintento ante `InvalidStateError`, mensajes de error accionables. `saveSession()` deduplica escrituras y mantiene un espejo síncrono en `localStorage` para cuando la WebView se cierra a media transacción (`js/settings.js:16-57`).
4. **i18n completa de verdad.** Comprobé las 337 claves contra los 14 idiomas: **cero traducciones ausentes**. Además hay detección de `zh-TW` frente a `zh` y `data-i18n`, `-aria`, `-ph`, `-title` cubiertos; el `<html lang>` se actualiza.
5. **Accesibilidad por encima de lo habitual.** Las vistas ocultas salen del foco y del árbol con `inert` + `aria-hidden` y el foco se recoloca (`js/ui.js:229-268`); las 20 hojas reciben `role="dialog"`, `aria-modal` y nombre accesible al abrirse, con trampa de Tab (`js/ui.js:78-140`); hay 8 bloques `prefers-reduced-motion`. Comprobado estáticamente: **0 IDs duplicados, 0 botones sin nombre accesible, 0 `img` sin `alt`, 0 `input` sin etiqueta**.
6. **El paquete es correcto y reproducible.** `python3 build-xdc.py` → 26 archivos, 380,9 KB, y dos construcciones seguidas dan el **mismo SHA-256** (`0a83a1a0…`). El validador comprueba rutas, ausencia de red, icono 512×512 y que no viaje un `webxdc.js` propio. El ZIP no incluye `docs/` ni `README.md`: solo lo necesario.
7. **Detalles de UX que se agradecen:** 40 px de objetivo táctil, 0 tamaños de fuente en `px`, `100dvh` con reserva para notch, aviso a primer arranque sobre el botón atrás de Delta Chat, aviso si la biblioteca «desaparece» comparando con el marcador `aurora_lib_count`, y «Deshacer» de 8 s en todos los borrados.

---

## 3. Lo que está mal (ordenado por impacto)

### 3.1 La versión que se muestra está desincronizada — **fallo confirmado, alto**

La etiqueta publicada es `v1.2.5` y el CHANGELOG abre con `## 1.2.5`, pero:

| Sitio | Valor | Línea |
|---|---|---|
| `js/state.js` → `App.VERSION` | `'1.2.0'` | 162 |
| `README.md` | `**Versión:** 1.2.0` | 5 |
| `CHANGELOG.md` | `## 1.2.5` | 9 |
| etiqueta git | `v1.2.5` | — |

`App.VERSION` es lo que pinta Ajustes → Acerca de (`js/init.js:118`). **Todo el que tenga la 1.2.5 verá «1.2.0»**, así que cualquier informe de error llegará atribuido a la versión equivocada. Verificado también en `git show v1.2.5:js/state.js`: la etiqueta ya salió con el número viejo.

*Arreglo:* una sola fuente de verdad (leer la versión de un `version.txt` o inyectarla en el build) y un paso del CI que la compare con la etiqueta. Hoy nada impide volver a olvidarlo.

### 3.2 No hay pruebas en el repositorio — **riesgo alto**

`docs/INFORME-PULIDO-UI.md:391` documenta que la suite de 143 pruebas se **borró a propósito** tras confirmarla en verde. La consecuencia: las cifras («143/143», «0 violaciones axe») no se pueden reproducir, y **cualquier cambio futuro va sin red**. El CI (`.github/workflows/release.yml`) solo empaqueta y publica: no ejecuta ni una comprobación de código.

Un punto de partida barato y de alto valor: el arnés que usé para esta auditoría (≈90 líneas: `jsdom` + `fake-indexeddb` + audio simulado) ya detecta humo y regresiones de cola en menos de un segundo.

### 3.3 La biblioteca no tiene copia de seguridad — **riesgo alto de producto**

Se pueden exportar listas (`.m3u8`), letras y canciones sueltas al chat, pero **no existe «exportar biblioteca» ni «importar respaldo»**. El CHANGELOG lo dice explícitamente («El blindaje de datos se evaluó y se descartó expresamente»). Con la música guardada como blobs dentro de una instancia del `.xdc`, borrar el chat, limpiar datos del sistema o reenviar el archivo **destruye la colección sin retorno**. Es el peor escenario posible para el usuario y el único punto de esta lista que puede costarle algo irrecuperable.

*Mínimo viable:* un JSON con metadatos, listas, favoritos, notas y estadísticas (sin audio) + re-vincular al volver a importar los archivos por nombre. Sin librerías: `sendToChat` ya está resuelto.

### 3.4 El arranque carga toda la biblioteca, blobs incluidos — **rendimiento medio**

`loadAllFromStorage()` llama a `getAllTracks()` (`js/init.js:197`), y cada registro guardado **lleva dentro el `fileBlob`** (`js/library.js:799-812`). Solo se borra `src`. En Chromium los blobs son referencias al almacén, pero `getAll()` deserializa miles de registros con sus blobs al abrir la app: con una biblioteca grande, el arranque se resiente y la memoria queda retenida desde el segundo cero.

*Mejora:* guardar el blob en un almacén aparte (`blobs`, clave = `trackId`) y listar metadatos sin él; el blob se pide al reproducir (la caché `_urlCache` ya está preparada para eso).

### 3.5 La caché de `objectURL` no se vacía nunca durante la sesión — **rendimiento bajo/medio**

`getTrackUrl()` cachea una URL por pista y solo se limpia al cerrar (`pagehide`) o al vaciar la biblioteca (`js/library.js:346-374`, `releaseAllUrls`). Una sesión de 6 horas escuchando 200 canciones mantiene las 200 vivas. No es catastrófico (el `fileBlob` ya estaba en memoria), pero agrava 3.4.

*Mejora:* desalojo por tamaño (conservar actual + siguiente + últimas 10).

### 3.6 La detección de duplicados es heurística — **correctitud media**

`_dupKey()` compara `nombre.toLowerCase() + '|' + tamaño` (`js/library.js:289`). Dos consecuencias:
- **falsos negativos:** la misma canción con otro nombre o reetiquetada no se detecta;
- **falsos positivos:** dos archivos distintos con el mismo nombre y tamaño (raro, pero posible con nombres genéricos tipo `track01.mp3`) se descartan como duplicados **y se revoca su `objectURL`**, de modo que el usuario pierde una pista sin aviso.

*Mejora:* huella barata (tamaño + SHA-256 de los primeros 64 KB) en lugar de solo nombre y tamaño.

### 3.7 Estado de diagnóstico que nadie lee — **mantenimiento bajo**

`App._lastError` se asigna en tres sitios (`js/audio.js:515`, `js/events.js:883`, `js/library.js:262`) y **no se lee en ningún sitio**. Se recoge el error para nada: el usuario no tiene forma de saber qué falló y quien depura tampoco (en WebXDC no hay consola).

*Mejora:* mostrarlo en Ajustes → Acerca de («último error») o en un «copiar diagnóstico».

### 3.8 Documentación y comentarios desincronizados — **bajo, pero engañoso**

- `js/data.js:38` dice «Idiomas soportados: es, en, pt, zh, ja, fr, it, ru» (8). Son **14**.
- `js/settings.js:605` repite «limitado a los 8 soportados».
- `README.md:5` mantiene la versión vieja (ver 3.1).
- El informe de UI afirma «143 pruebas» de una suite que ya no existe.

En un proyecto que se apoya tanto en comentarios, un comentario mentiroso cuesta más que no tenerlo.

### 3.9 Nits reales pero menores

- ~~**Dos `<h1>` en el mismo documento**~~ — **revisado y descartado:** las vistas inactivas llevan `visibility: hidden` (`.view` en `css/styles.css`) e `inert`, así que nunca hay dos encabezados expuestos a la vez. No se toca.
- **`webxdc.js` da 404 en navegador** (`index.html:24`). Documentado y esperado, pero ensucia la consola.
- **26 `!important`** en CSS: casi todos para `[hidden]` (legítimo), pero es una costura que conviene no dejar crecer.
- **`js/data.js` con 4 320 líneas** mezcla datos, paletas y 4 718 cadenas de traducción. Funciona, pero revisar una traducción ahí es incómodo: separar `i18n/*.js` por idioma haría las revisión nativa mucho más fácil (y el paquete sigue sin cargar nada por red).

---

## 4. Qué probé y qué salió

Arnés propio: `index.html` cargado en `jsdom` con `indexedDB` real (`fake-indexeddb`), `<audio>` y `AudioContext` instrumentados, `URL.createObjectURL` simulado.

| Prueba | Resultado |
|---|---|
| Arranque completo (`App.init`) | ✅ sin errores de consola |
| 14 cambios de idioma con biblioteca cargada | ✅ sin excepciones |
| Importar 2 archivos (metadatos, IndexedDB) | ✅ 2 pistas en memoria y en la BD |
| Reproducir, `next`, `prev`, `repeat all/one` | ✅ |
| Aleatorio: ancla, sin duplicados, restaurar | ✅ |
| Cola de lista ordenada por estrellas | ✅ |
| Favoritos como contexto de cola | ✅ |
| Borrar en reproducción + «Deshacer» (biblioteca y cola) | ✅ |
| Guardar/restaurar sesión | ✅ |
| Inyección de HTML en el título de una pista | ✅ escapado |
| 20 hojas abiertas/cerradas, 3 vistas, 14 idiomas | ✅ sin excepciones |
| Reconstruir el `.xdc` dos veces | ✅ mismo SHA-256 |
| IDs duplicados / nombres accesibles / `alt` / etiquetas | ✅ 0 problemas |

Cuatro «fallos» iniciales fueron del arnés, no de la app, y conviene dejarlo dicho: `trackPlayCompleted()` exige `audio.played` real (mi stub no lo tenía), y `searchTracks()` no existe con ese nombre. Ninguno era un defecto del producto.

---

## 5. Plan recomendado

**Hoy (menos de una hora)**
1. Arreglar la versión: `App.VERSION` y `README` a `1.2.5` + paso de CI que compare etiqueta, `App.VERSION` y CHANGELOG.
2. Corregir los dos comentarios de «8 idiomas».

**Esta semana**
3. Añadir `test/smoke.mjs` con el arnés de esta auditoría y un job de CI `npm test` (sin dependencias de red en el `.xdc`: el test no viaja en el paquete).
4. Sacar `_lastError` a la vista (Acerca de → «último error»).
5. Desalojo en `_urlCache`.

**Siguiente iteración**
6. **Copia de seguridad/restauración de metadatos y listas** (el punto que más duele).
7. Separar los blobs de audio en su propio almacén de IndexedDB para que el arranque no los toque.
8. Huella de contenido para duplicados.

Nada de esto exige cambiar la arquitectura: la base es buena.

---

## 6. Estado de implementación (misma fecha, después de la auditoría)

Implementado **todo el plan salvo la copia de seguridad** (punto 6), que se
retiró por completo a petición expresa (sin módulo `js/backup.js`, sin sección
en Ajustes, sin formato `.aurora` y sin marcadores huérfanos en
`localStorage`):

| # | Punto del informe | Estado |
|---|---|---|
| 1 | Versión desincronizada (§3.1) | ✅ `App.VERSION`, README y HTML sincronizados · `build-xdc.py` rechaza el paquete si no coinciden · el flujo de publicación rechaza una etiqueta que no cuadre con `App.VERSION` |
| 2 | Comentarios «8 idiomas» (§3.8) | ✅ corregidos a 14 |
| 3 | Sin pruebas ni CI (§3.2) | ✅ `npm test`: suite sobre la app real + flujo de GitHub Actions |
| 4 | `_lastError` sin leer (§3.7) | ✅ Ajustes → Acerca de → Diagnóstico, con «Copiar diagnóstico» |
| 5 | Caché de `objectURL` sin tope (§3.5) | ✅ tope de 12, sin revocar la pista en curso ni la precargada |
| 6 | Copia de seguridad (§3.3) | ❌ retirada por completo a petición (la biblioteca vive únicamente en la instancia del `.xdc`) |
| 7 | Blobs fuera del listado de arranque (§3.4) | ✅ almacén `blobs` aparte (BD v2), lectura bajo demanda en reproducir/precargar/compartir/releer etiquetas, migración con cursor y 8 pruebas |
| 8 | Huella de contenido en duplicados (§3.6) | ✅ huella = tamaño + SHA-256 de los primeros 256 KB (hash propio sin `crypto.subtle`); nombre y tamaño solo acotan candidatos; 7 pruebas |

**Efecto secundario de las pruebas:** encontraron un fallo real que no había
visto la lectura del código. `togglePlay()` guarda un token por intento de
`play()`, pero `stopPlayback()` y `loadTrackPaused()` no lo invalidaban: si se
borraba o paraba la pista justo después de arrancar, la promesa pendiente
devolvía `isPlaying = true` (y arrancaba el conteo de estadísticas) sobre una
pista ya parada. Corregido con `_invalidatePendingPlay()`.

**Verificación final:** `npm test` → 46/46 en verde · `python3 build-xdc.py` →
28 archivos, `.xdc` válido · dos builds con el mismo SHA-256.
