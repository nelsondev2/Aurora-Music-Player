/* =====================================================================
 *  webxdc.js — Stub para navegador / desarrollo
 * =====================================================================
 *  En Delta Chat, este archivo lo proporciona el mensajero automáticamente.
 *  En navegador normal, usamos este stub que simula la API webxdc
 *  para que la app funcione sin errores.
 *
 *  API real: https://webxdc.org/docs/spec/api.html
 *
 *  Este stub ahora también simula joinRealtimeChannel() para poder
 *  probar el sistema de compartir música en tiempo real entre varias
 *  pestañas del mismo navegador. Los mensajes se difunden entre
 *  pestañas a través del BroadcastChannel.
 * ===================================================================== */

window.webxdc = window.webxdc || (function () {
  'use strict';

  // Simulación de la API webxdc para desarrollo en navegador
  const updates = [];
  let listener = null;
  let serial = 0;

  // --- Simulación de realtime channel entre pestañas ---
  // Usamos BroadcastChannel para que varias pestañas del navegador
  // puedan intercambiar mensajes en tiempo real (simulando peers).
  const bc = (typeof BroadcastChannel !== 'undefined')
    ? new BroadcastChannel('aurora-realtime-dev')
    : null;

  // Contador simple de "peers" conectados (para mostrar algo en el botón)
  let peerCount = 0;
  let peerCountListeners = [];
  function notifyPeerCount() {
    peerCountListeners.forEach(fn => { try { fn(peerCount); } catch (e) {} });
  }
  // Anunciar llegada al instante
  if (bc) {
    bc.postMessage({ kind: 'hello' });
    bc.onmessage = (ev) => {
      const m = ev.data;
      if (!m) return;
      if (m.kind === 'hello') {
        peerCount++;
        notifyPeerCount();
        // Responder con un 'ack' para que la nueva pestaña nos cuente
        bc.postMessage({ kind: 'ack' });
      } else if (m.kind === 'ack') {
        peerCount++;
        notifyPeerCount();
      } else if (m.kind === 'bye') {
        peerCount = Math.max(0, peerCount - 1);
        notifyPeerCount();
      }
    };
    window.addEventListener('beforeunload', () => {
      try { bc.postMessage({ kind: 'bye' }); } catch (e) {}
    });
  }

  // Nombre aleatorio persistente por pestaña (para distinguir "peers")
  const tabId = (function () {
    const k = '__webxdc_stub_tabid';
    let v = sessionStorage.getItem(k);
    if (!v) {
      v = 'peer-' + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem(k, v);
    }
    return v;
  })();

  return {
    // Dirección del peer actual (simulada)
    selfAddr: tabId + '@localhost',

    // Nombre del usuario (simulado). Se puede personalizar cambiando
    // localStorage 'aurora_dev_name' o sessionStorage 'aurora_dev_name'
    // (sessionStorage da un nombre distinto por pestaña, útil para
    // probar varios "peers" abriendo varias pestañas en el navegador).
    get selfName() {
      let n = null;
      try { n = sessionStorage.getItem('aurora_dev_name'); } catch (e) {}
      if (!n) {
        try { n = localStorage.getItem('aurora_dev_name'); } catch (e) {}
      }
      if (!n) {
        // Generar un nombre aleatorio persistente por pestaña
        const adj = ['Cosmic', 'Neon', 'Crystal', 'Solar', 'Lunar', 'Cyber', 'Pixel', 'Aurora', 'Echo', 'Vivid'];
        const noun = ['Listener', 'DJ', 'Panda', 'Fox', 'Wolf', 'Tiger', 'Falcon', 'Otter', 'Lynx', 'Orca'];
        n = adj[Math.floor(Math.random() * adj.length)] + ' ' + noun[Math.floor(Math.random() * noun.length)];
        try { sessionStorage.setItem('aurora_dev_name', n); } catch (e) {}
      }
      return n;
    },

    // Enviar update a todos los peers (en navegador, solo lo guarda localmente)
    sendUpdate: function (update, descr) {
      serial++;
      const fullUpdate = {
        payload: update.payload,
        serial: serial,
        max_serial: serial,
        info: update.info || '',
        document: update.document || '',
        summary: update.summary || ''
      };
      updates.push(fullUpdate);
      if (listener) {
        try { listener(fullUpdate); } catch (e) { console.warn('[webxdc stub] listener error:', e); }
      }
      console.log('[webxdc stub] sendUpdate:', descr, update.payload);
    },

    // Registrar listener para recibir updates
    setUpdateListener: function (callback, startSerial) {
      listener = callback;
      // Enviar updates ya existentes si el serial solicitado es menor
      const fromSerial = startSerial || 0;
      updates.filter(u => u.serial > fromSerial).forEach(u => {
        try { callback(u); } catch (e) { console.warn('[webxdc stub] callback error:', e); }
      });
      return Promise.resolve();
    },

    // API para compartir archivos al chat (opcional, simulada)
    sendToChat: function (message) {
      console.log('[webxdc stub] sendToChat:', message);
      return Promise.resolve();
    },

    // === Realtime API ===
    // En Delta Chat moderno esto devuelve un canal en tiempo real
    // (mensajes P2P, sin persistir en el chat).
    // Aquí simulamos con BroadcastChannel para desarrollo multi-pestaña.
    joinRealtimeChannel: function () {
      if (!bc) {
        // Sin BroadcastChannel: devolver un canal no-op para no romper
        return {
          send: function () {},
          setListener: function () {},
          leave: function () {}
        };
      }
      return {
        send: function (data) {
          try {
            // data puede ser Uint8Array o ArrayBuffer
            let bytes = data;
            if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
            // BroadcastChannel admite cualquier valor clonable;
            // pasamos el Uint8Array directamente.
            bc.postMessage({ kind: 'rt', payload: bytes });
          } catch (e) {
            console.warn('[webxdc stub] rt send error:', e);
          }
        },
        setListener: function (fn) {
          // Reemplazamos el handler para que solo invoque al listener
          // con el payload cuando llegue un mensaje 'rt'.
          bc.onmessage = (ev) => {
            const m = ev.data;
            if (!m) return;
            if (m.kind === 'hello') {
              peerCount++;
              notifyPeerCount();
              bc.postMessage({ kind: 'ack' });
            } else if (m.kind === 'ack') {
              peerCount++;
              notifyPeerCount();
            } else if (m.kind === 'bye') {
              peerCount = Math.max(0, peerCount - 1);
              notifyPeerCount();
            } else if (m.kind === 'rt') {
              try { fn(m.payload); } catch (e) { console.warn('[webxdc stub] rt listener error:', e); }
            }
          };
        },
        leave: function () {}
      };
    },

    // API interna del stub para saber cuántos "peers" hay (dev only)
    _onPeerCount: function (fn) {
      peerCountListeners.push(fn);
      // Notificar estado actual de inmediato
      try { fn(peerCount); } catch (e) {}
    }
  };
})();
