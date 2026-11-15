/* =====================================================================
 *  portadas.js — Portada generada (la que se pinta cuando la pista no
 *  trae carátula)
 *  Reproductor de música profesional · mobile-first
 *
 *  Había dos pintores —uno en el reproductor y otro en las filas y
 *  tarjetas— que dibujaban lo mismo con distinto grosor de surco, otro
 *  tamaño de letra y otro alfa: la misma canción se veía distinta según
 *  dónde miraras. Este es el único, y lo usan los dos.
 *
 *  Se expone en `window.AuroraCover.paint(ctx, W, H, opts)` para que la
 *  vista previa (`npm run covers:preview`) pinte con ESTE código y no
 *  con una copia que se desincronice.
 * ===================================================================== */

'use strict';

(function () {
  /* Semilla estable: el mismo texto da siempre la misma portada, así que
   * una canción no cambia de aspecto entre arranques. */
  function seedOf(text) {
    const s = String(text == null ? '' : text);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  const AuroraCover = {
    seedOf,

    /**
     * Números del fondo de una lista sin carátula: el ángulo del
     * degradado y dónde cae la luz. La app lo pasa a CSS
     * (`playlistCoverStyle`) y la vista previa a SVG, con los mismos
     * valores y sin duplicar la cuenta.
     */
    listParams(name, palette) {
      const seed = seedOf(name || '');
      return {
        angle: 115 + (seed % 5) * 10,        // 115…155°
        gx: 18 + ((seed >>> 3) % 64),        // 18…82 %
        gy: 14 + ((seed >>> 11) % 52),       // 14…66 %
        from: (palette && palette.from) || '#6E5CFF',
        to: (palette && palette.to) || '#FF7AB6'
      };
    },

    /**
     * Pinta la portada generada.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} W  ancho del lienzo en píxeles reales
     * @param {number} H  alto
     * @param {object} opts {from, to, text, letter, seed}
     *   from/to — pareja de la paleta (COVER_PALETTE)
     *   text    — de dónde sale la semilla (título de la pista)
     *   letter  — inicial ya elegida (si no, la primera letra del texto)
     */
    paint(ctx, W, H, opts) {
      if (!ctx || !(W > 0) || !(H > 0)) return;
      const o = opts || {};
      const S = Math.min(W, H);
      const from = o.from || '#6E5CFF';
      const to = o.to || '#FF7AB6';
      const seed = (typeof o.seed === 'number') ? o.seed : seedOf(o.text);
      const flip = (seed & 1) === 1;
      //  Por debajo de 48 px (filas de 40, miniaturas) los resplandores y
      //  los surcos se convierten en suciedad: queda el degradado y la letra.
      const detail = S >= 48;

      // 1. Degradado base, con el ángulo elegido por la semilla: dos
      //    pistas que empiecen por la misma letra no se ven iguales.
      const grad = flip
        ? ctx.createLinearGradient(W, 0, 0, H)
        : ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, from);
      grad.addColorStop(1, to);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      if (detail) {
        const gx = 0.18 + (((seed >>> 3) % 64) / 64) * 0.64;   // 0.18…0.82
        const gy = 0.16 + (((seed >>> 11) % 64) / 64) * 0.52;  // 0.16…0.68

        // 2. Resplandor («aurora»): luz fría arriba, donde mira el ojo.
        const glow = ctx.createRadialGradient(W * gx, H * gy, 0, W * gx, H * gy, S * 0.95);
        glow.addColorStop(0, 'rgba(255,255,255,0.22)');
        glow.addColorStop(0.55, 'rgba(255,255,255,0.05)');
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        // 3. Sombra en la esquina opuesta: da volumen sin oscurecer todo.
        const shade = ctx.createRadialGradient(W * (1 - gx), H * (1 - gy), 0, W * (1 - gx), H * (1 - gy), S * 0.85);
        shade.addColorStop(0, 'rgba(0,0,0,0.22)');
        shade.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, W, H);

        // 4. Surcos concéntricos muy tenues, descentrados como el surco
        //    de un disco que gira fuera del eje.
        ctx.save();
        ctx.globalAlpha = 0.10;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, S / 220);
        const cx = W * (flip ? 0.58 : 0.42);
        const cy = H * 0.5;
        const step = S / 5.5;
        for (let r = step; r < Math.max(W, H) * 1.15; r += step) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 5. Inicial. Con sombra suave: sin ella desaparece sobre el lado
      //    claro del degradado.
      const letter = o.letter || (String(o.text || '').match(/[\p{L}\p{N}]/u) || ['♪'])[0].toUpperCase();
      //  En miniaturas el cuerpo baja un poco: con acento (Á, É) la letra
      //  casi tocaba los bordes.
      const size = Math.round(S * (detail ? 0.50 : 0.46));
      ctx.save();
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 ' + size + 'px Outfit, ui-rounded, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      try {
        ctx.shadowColor = 'rgba(0,0,0,0.28)';
        ctx.shadowBlur = Math.max(2, S * 0.05);
        ctx.shadowOffsetY = Math.max(1, S * 0.012);
      } catch (e) { /* motor sin sombras: la letra sigue ahí */ }
      ctx.fillText(letter, W / 2, H / 2 + size * 0.04);
      ctx.restore();
    }
  };

  window.AuroraCover = AuroraCover;
})();
