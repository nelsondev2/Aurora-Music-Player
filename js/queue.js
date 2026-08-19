/* =====================================================================
 *  js/queue.js — Aurora Music Player
 *  File picker · cola inteligente (#4)
 *
 *  Parte del refactor (C) de app.js: mismo código, módulos por funcionalidad.
 *  Este archivo se carga tras js/state.js y completa el objeto App con
 *  Object.assign (los scripts son clásicos por compatibilidad webxdc).
 * ===================================================================== */

'use strict';

Object.assign(App, {
    /* ============================================================
     *  File picker (input file oculto)
     *  - Se crea UNA sola vez y se reutiliza
     *  - multiple=true para permitir varios archivos
     *  - Soporta selección de carpeta (webkitdirectory)
     *  - Se resetea el value ANTES de click() para que el mismo
     *    archivo pueda seleccionarse otra vez, y DESPUÉS de procesar
     *    para que la próxima apertura empiece limpia.
     * ============================================================ */
    /* Abre el selector de archivos del sistema.
     *   useDirectory    — true para activar el modo "carpeta completa"
     *   targetPlaylistId — ID de playlist a la que añadir las pistas subidas.
     *                      Si es null/undefined, las pistas van a "Mi Música".
     * Creamos un input NUEVO cada vez para evitar problemas de reutilización
     * y asegurar que el click() se ejecute dentro del gesto de usuario. */
    openFilePicker(useDirectory, targetPlaylistId) {
      const UPLOADER = window.AuroraUploader;
      const acceptedTypes = (UPLOADER && typeof UPLOADER.ACCEPTED === 'string')
        ? UPLOADER.ACCEPTED
        : '.mp3,.m4a,.flac,.wav,.ogg,.webm,.opus,audio/*';

      // Crear input SIEMPRE nuevo para evitar problemas de reutilización
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.style.display = 'none';

      if (useDirectory) {
        // Modo carpeta: NO usar accept (interfiere en algunos navegadores)
        // y añadir todos los atributos de directorio conocidos.
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
        input.setAttribute('mozdirectory', '');
        input.setAttribute('nwdirectory', '');
      } else {
        input.accept = acceptedTypes + ',.lrc,.txt';
      }

      document.body.appendChild(input);

      input.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          const arr = Array.from(files);
          const destId = targetPlaylistId || null;
          // Filtrar solo archivos de audio + .lrc/.txt si venimos de carpeta
          // (webkitdirectory devuelve TODOS los archivos de la carpeta)
          const filtered = useDirectory
            ? arr.filter(f => {
                const name = f.name.toLowerCase();
                return f.type.startsWith('audio/') ||
                       /\.(mp3|m4a|flac|wav|ogg|webm|opus|lrc|txt)$/i.test(name);
              })
            : arr;
          if (filtered.length > 0) {
            await this.handleFileInput(filtered, useDirectory, destId);
          } else if (useDirectory) {
            this.toast(this.t('toast_load_failed'));
          }
        }
        // Limpiar el input del DOM tras usarlo
        setTimeout(() => { try { input.remove(); } catch (er) {} }, 100);
      });

      // click() dentro del gesto de usuario
      input.click();
    },

    /* ============================================================
     *  Cola inteligente (#4)
     * ============================================================ */

    /* Añadir pista al final de la cola */
    addToQueue(trackId) {
      this.queue.push(trackId);
      this.renderQueue();
      this.toast(this.t('toast_added_to_queue'));
    },

    /* "Reproducir siguiente": inserta en la posición inmediatamente
     * después de la pista actual, desplazando el resto */
    playNext(trackId) {
      const insertAt = this.queueIdx + 1;
      this.queue.splice(insertAt, 0, trackId);
      this.renderQueue();
      this.toast(this.t('toast_play_next'));
    },

    /* Modo "Radio": genera una cola a partir de la pista actual,
     * mezclando pistas del mismo artista/álbum primero, luego el resto */
    startRadio(trackId) {
      const seed = this.tracks.find(t => t.id === trackId);
      if (!seed) return;
      const sameArtist = this.tracks.filter(t => t.id !== trackId && t.artist === seed.artist);
      const sameAlbum = this.tracks.filter(t => t.id !== trackId && t.album === seed.album && t.artist !== seed.artist);
      const others = this.tracks.filter(t =>
        t.id !== trackId && t.artist !== seed.artist && t.album !== seed.album
      );
      // Mezclar cada grupo
      const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
      this.queue = [trackId, ...shuffle(sameArtist), ...shuffle(sameAlbum), ...shuffle(others)];
      this.queueIdx = 0;
      this.playFromQueue(0);
      this.toast(this.t('toast_radio_based') + ' ' + seed.title);
    },
});
