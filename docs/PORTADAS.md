# Portada generada — Aurora Music Player

**Estado:** un solo pintor (`js/portadas.js`) para las portadas de pista y la cuenta compartida de las de lista · vista previa en `docs/portadas.png`

Cuando una pista no trae carátula, la app dibuja una. No es un hueco gris: es la
misma portada en la fila de 40 px, en la tarjeta de 120 px, en la miniatura del
reproductor y en el lienzo grande de «ahora suena».

## Por qué un pintor y no dos

Hasta la 1.3 había **dos** funciones dibujando lo mismo, una en el reproductor y
otra en las filas, con distinto grosor de surco (2 px frente a 1), distinto
cuerpo de letra (220 px frente a 0,48 del lienzo) y distinto alfa (0,85 frente a
0,92). La misma canción se veía distinta según dónde la miraras. Ahora
`player-ui.drawCover()` y `playlist-ui._paintLetterCover()` llaman a
`window.AuroraCover.paint()`.

## Cómo se compone

| Capa | Qué hace |
|---|---|
| 1. Degradado | La pareja de `COVER_PALETTE` de la pista, en diagonal. La semilla decide el sentido (↘ o ↙). |
| 2. Resplandor | Un radial blanco al 22 % desplazado según la semilla: la luz no cae siempre en el mismo sitio. |
| 3. Sombra | Un radial negro al 22 % en la esquina opuesta. Da volumen sin apagar la portada. |
| 4. Surcos | Círculos al 10 % desplazados del centro, como el surco de un disco que gira fuera del eje. |
| 5. Inicial | `coverInitial(título)` a 800, media caja, con sombra suave (sin ella desaparece sobre el lado claro). |

**La semilla es el título** (FNV-1a): la misma canción siempre sale igual, dos
canciones distintas casi nunca iguales. Por debajo de 48 px de lienzo se
suprimen resplandor, sombra y surcos: a ese tamaño solo son suciedad.

## Portadas de lista

Una lista sin carátula tampoco es un cuadrado de color: lleva **su inicial** y
el mismo tipo de luz que la portada de una pista, con el ángulo y la posición
del resplandor derivados de su nombre (`AuroraCover.listParams`). Antes todas
las listas mostraban el mismo icono de lista sobre un degradado plano y solo se
distinguían leyendo el nombre.

Aquí no hay lienzo: el fondo es CSS (`playlistCoverStyle`, dos capas:
`radial-gradient` de luz + `linear-gradient` de la paleta) porque en Listas se
pintan muchas y un canvas por tarjeta sería trabajo de más. Los colores
guardados se acotan a hex antes de entrar en el `style`: un registro manipulado
no puede colar CSS.

## Vista previa

```bash
npm run covers:preview     # → docs/portadas.png
```

El script **evalúa `js/portadas.js` de verdad** y le pasa un contexto 2D que
traduce las llamadas a SVG; no hay una copia del dibujo que se pueda quedar
atrás. La lámina muestra 250, 120 y 40 px, que son los tres tamaños reales de la
app.

## Lo que no hace

- No usa imágenes ni fuentes nuevas: la inicial se pinta con Outfit, que ya
  viaja en `assets/fonts`, y si el motor no la tiene cae a la del sistema.
- No genera portadas para las listas con carátula propia: esas usan su imagen.
- No persiste nada: la portada generada se calcula al pintar, sin ocupar
  almacenamiento.
