/**
 * webxdc.js — Aurora Music Player
 * Stub de compatibilidad WebXDC para desarrollo local y navegadores estándar.
 *
 * En Delta Chat (Android, iOS, Desktop), el cliente webxdc reemplaza
 * este archivo automáticamente con la API nativa de Delta Chat.
 */
(function () {
  'use strict';

  if (window.webxdc) return;

  window.webxdc = {
    _isStub: true,
    selfName: 'Usuario Aurora',
    selfAddr: 'self@localhost',

    /**
     * sendToChat({ file: { name, blob, plainText, base64 }, text: string })
     * En Delta Chat: abre el diálogo nativo para enviar a un chat o mensajes guardados.
     * En navegador (stub): descarga el archivo localmente como fallback.
     */
    sendToChat: async function (message) {
      console.info('[WebXDC Stub] sendToChat llamado con:', message);
      if (!message) return Promise.resolve();

      if (message.file) {
        const name = message.file.name || 'archivo';
        let blob = null;

        if (message.file.blob instanceof Blob) {
          blob = message.file.blob;
        } else if (typeof message.file.plainText === 'string') {
          blob = new Blob([message.file.plainText], { type: 'text/plain;charset=utf-8' });
        } else if (typeof message.file.base64 === 'string') {
          try {
            const byteCharacters = atob(message.file.base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            blob = new Blob([new Uint8Array(byteNumbers)]);
          } catch (e) {
            console.error('[WebXDC Stub] Error decodificando base64:', e);
          }
        }

        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1500);
        }
      }

      return Promise.resolve();
    }
  };
})();
