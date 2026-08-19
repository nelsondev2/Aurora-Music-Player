/* =====================================================================
 *  js/main.js — Aurora Music Player
 *  Bootstrap: detección de entorno y arranque
 *
 *  Cargar SIEMPRE el último. Detecta si corre dentro de Delta Chat
 *  (webxdc real) o en un navegador normal y adapta la UI:
 *  en modo normal (standalone) la app es un reproductor local completo
 *  y las funciones exclusivas de P2P/chat se ocultan.
 * ===================================================================== */

'use strict';

/* ¿Webxdc real (inyectado por Delta Chat) o stub de navegador? */
App.isRealWebxdc = !!(window.webxdc && !window.webxdc.__isStub);
/* true = reproductor normal en navegador; false = dentro de Delta Chat */
App.standalone = !App.isRealWebxdc;

document.addEventListener('DOMContentLoaded', () => {
  /* --- Modo reproductor normal: ocultar lo que exige Delta Chat --- */
  if (App.standalone) {
    // Compartir al chat requiere webxdc.sendToChat (solo en Delta Chat)
    const menuShare = document.getElementById('menuShareTrack');
    if (menuShare) menuShare.style.display = 'none';
  }
  App.init();
});

// Reanudar audio context al volver a la app (iOS)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && App.audioCtx && App.audioCtx.state === 'suspended' && App.isPlaying) {
    App.audioCtx.resume().catch(() => {});
  }
});
