/* =====================================================================
 *  js/main.js — Aurora Music Player
 *  Bootstrap: arranque de la app
 *
 *  Cargar SIEMPRE el último.
 * ===================================================================== */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Reanudar audio context al volver a la app (iOS)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && App.audioCtx && App.audioCtx.state === 'suspended' && App.isPlaying) {
    App.audioCtx.resume().catch(() => {});
  }
});
