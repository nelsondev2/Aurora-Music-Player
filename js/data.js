/* =====================================================================
 *  data.js — Catálogo de pistas y configuración de la app
 *  Reproductor de música profesional · mobile-first
 *
 *  El catálogo empieza vacío: el usuario carga sus propias pistas
 *  desde el almacenamiento local. Se guardan en IndexedDB
 *  (ver storage.js y uploader.js).
 *
 *  Las traducciones ya no viven aquí: están en js/i18n.js (antes eran
 *  más de 4.000 líneas de este archivo y revisar un idioma entre el
 *  catálogo y las utilidades era incómodo).
 * ===================================================================== */

/* Catálogo inicial vacío. Las pistas se añaden con el botón "+". */
const TRACKS = [];

/* Paleta para generar portadas dinámicas cuando una pista no trae
 * artwork en sus metadatos ID3.
 * Familia aurora (noche fría + ámbar/rosa de contraste), no catálogo
 * Tailwind. El ángulo varía para que el fondo de Now Playing no repita. */
const COVER_PALETTE = [
  { from: '#6E5CFF', to: '#FF7AB6', angle: 135 },
  { from: '#1A508C', to: '#5AD4DC', angle: 135 },
  { from: '#2846A0', to: '#B48CFF', angle: 120 },
  { from: '#14285A', to: '#508CDC', angle: 150 },
  { from: '#0C4A5E', to: '#46C8DC', angle: 120 },
  { from: '#C45C18', to: '#E8B84A', angle: 135 },
  { from: '#C8505A', to: '#FFA078', angle: 120 },
  { from: '#7A1E3C', to: '#E85A7A', angle: 150 },
  { from: '#2A6B48', to: '#A8C86A', angle: 135 },
  { from: '#4C2E9E', to: '#8B7CFF', angle: 135 },
  { from: '#96275C', to: '#E87AB0', angle: 120 },
  { from: '#2E3A5C', to: '#7C8CFF', angle: 150 }
];

/* Texto LRC de muestra para cuando una pista no trae letra.
 * Vacío = el usuario debe cargar su propio .lrc o aceptar "sin letra". */
const SAMPLE_LRC = null;

window.TRACKS = TRACKS;
window.COVER_PALETTE = COVER_PALETTE;
window.SAMPLE_LRC = SAMPLE_LRC;
