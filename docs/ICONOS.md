# Sistema de iconos — Aurora Music Player

**Estado:** 54 símbolos · `index.html` (sprite inline) · vista previa en `docs/iconos-sprite.png`

## Por qué un sprite inline y no un archivo aparte

Los iconos viven en un `<svg class="icon-sprite">` con un `<symbol>` por icono,
al principio del `<body>`, y se usan con `<use href="#i-play">`. **No** se pueden
mover a `assets/icons.svg` y referenciar desde fuera:

- el sprite externo (`<use href="icons.svg#i-play">`) **no funciona en el
  WebView de iOS** (ni en WebKit antiguo), y Delta Chat en iPhone es WebKit;
- el `.xdc` no tiene red, así que no hay CDN que valga;
- un `<symbol>` inline se hereda con `currentColor` sin coste: el mismo icono
  sirve para los tres temas y los cinco acentos sin duplicar archivos.

Coste real: el sprite pesa ~16 KB de los ~386 KB del paquete.

## Reglas de dibujo

| Regla | Valor |
|---|---|
| Rejilla | 24 × 24, contenido dentro de 2…22 |
| Trazo | 1,9 (se ve ~1,3 px a 16 px, ~2,0 px a 26 px) |
| Extremos y uniones | `round` |
| Color | `stroke="currentColor"` / `fill="currentColor"` (hereda del CSS) |
| Relleno | **solo** transporte y estados marcados (play, pause, skip, star, heart-solid, puntos) |
| Formas | esquinas suaves, nada de ángulos vivos: el resto de la interfaz es redonda |

Los sólidos llevan `fill` **y** `stroke` del mismo color con `linejoin="round"`:
es lo que redondea las puntas del triángulo de play sin dibujar una curva a mano.

**Un icono, un significado.** Cuando dos símbolos sirven para lo mismo sobra uno:
`file-import` es «traer un archivo» (también las letras `.lrc`) y `folder` es
«traer una carpeta entera». El antiguo `file-arrow-up` hacía lo mismo que
`file-import` con la flecha al revés y se retiró.

## Anatomía de un símbolo

```html
<symbol id="i-plus" viewBox="0 0 24 24">
  <g fill="none" stroke="currentColor" stroke-width="1.9"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </g>
</symbol>
```

El `fill="none"` del `<g>` gana al `fill: currentColor` que `.ico` hereda del CSS
(por eso los trazos no se rellenan). Para un sólido, `fill="currentColor"` y
`stroke="currentColor"`.

## Cómo añadir uno

1. Dibújalo en la rejilla de 24, con el contenido dentro de 2…22 y trazo 1,9.
2. Añade el `<symbol>` al sprite de `index.html`, junto a los demás.
3. Úsalo: `<svg class="ico" aria-hidden="true"><use href="#i-nuevo"></use></svg>`.
4. Comprueba el tamaño al que se va a ver. Los tamaños reales de la app son
   16 px (filas de menú), 18 px (botones de icono), 20 px (navegación),
   26 px (transporte) y 12–15 px en la barra de Letras.

## Dónde está cada tamaño

| Contexto | Clase | Tamaño |
|---|---|---|
| Navegación inferior | `.nav-btn .ico` | 20 px (16 en pantallas muy pequeñas) |
| Filas de menú / ajustes | `.menu-row .ico` | 16 px |
| Botones de icono | `.icon-btn .ico` | 18 px |
| Transporte | `.ctrl-play`, `.ctrl-prev`, `.ctrl-next` | 26 px |
| Barra de Letras | `.lt-btn .ico` | 12 px |
| Estado vacío | `.empty-icon .ico` | 32 px |

## Vista previa

`docs/iconos-sprite.png` muestra los 54 símbolos a 48 px y 16 px, más una tira
con los tres temas (Oscuro, AMOLED, Claro) para comprobar que el contraste
funciona sobre el fondo y sobre el acento:

```bash
# regenerar (requiere resvg: npm i -g @resvg/resvg-js o uso local)
node tools/preview-iconos.mjs
```

La app **no** necesita nada de esto para funcionar: el sprite ya viaja dentro
de `index.html`.
