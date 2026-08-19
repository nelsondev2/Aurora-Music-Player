/* =====================================================================
 *  uploader.js — Carga de archivos de música desde el almacenamiento local
 *  Reproductor de música profesional · mobile-first
 *
 *  Funciones:
 *    - Aceptar mp3/m4a/flac/wav/ogg vía input file o drag-drop
 *    - Leer metadatos ID3 con jsmediatags (embebido localmente)
 *    - Generar portada dinámica si no hay artwork
 *    - Intentar cargar archivo .lrc con el mismo nombre
 *    - Guardar el blob en IndexedDB y devolver un objectURL
 * ===================================================================== */

/* eslint-disable no-unused-vars */
(function () {
  'use strict';

  const Uploader = {
    ACCEPTED: '.mp3,.m4a,.flac,.wav,.ogg,.webm,.opus,audio/*',
    PALETTE: window.COVER_PALETTE || [
      { from: '#7C3AED', to: '#EC4899', angle: 135 }
    ],

    /* ---------- Procesa una lista de File y devuelve tracks ---------- */
    async processFiles(fileList) {
      const out = [];
      // Separar audio vs lrc para emparejarlos por nombre
      const audios = [];
      const lrcs = {};
      Array.from(fileList).forEach(f => {
        const name = f.name.toLowerCase();
        if (name.endsWith('.lrc') || name.endsWith('.txt')) {
          const key = name.replace(/\.(lrc|txt)$/, '');
          lrcs[key] = f;
        } else if (f.type.startsWith('audio/') || /\.(mp3|m4a|flac|wav|ogg|webm|opus)$/i.test(name)) {
          audios.push(f);
        }
      });

      // Procesar en paralelo con límite de concurrencia para no bloquear.
      // jsmediatags y el parser ID3v2 son asíncronos y pueden ejecutarse
      // concurrentemente; el límite evita saturar la CPU/memoria con muchos archivos.
      const CONCURRENCY = 3;
      let index = 0;
      const results = new Array(audios.length);

      const worker = async () => {
        while (index < audios.length) {
          const myIdx = index++;
          const file = audios[myIdx];
          try {
            const track = await this.processOne(file, lrcs);
            results[myIdx] = track;
          } catch (e) {
            console.warn('[Aurora] No se pudo procesar', file.name, e);
            results[myIdx] = this.fallbackTrack(file);
          }
        }
      };

      // Lanzar N workers concurrentes
      const workers = [];
      for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
      await Promise.all(workers);

      // Filtrar nulos (por si acaso) y devolver en orden
      for (const t of results) {
        if (t) out.push(t);
      }
      return out;
    },

    /* ---------- Procesa un único File ---------- */
    async processOne(file, lrcsMap) {
      const baseName = file.name.replace(/\.[^.]+$/, '').toLowerCase();
      const id = 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const fromName = this.parseFilename(file.name);

      let meta = {
        title: fromName.title || this.cleanName(file.name),
        artist: fromName.artist || 'Artista desconocido',
        album: 'Sin álbum',
        cover: null,
        lrc: null
      };

      const lrcFile = lrcsMap && lrcsMap[baseName];
      const [tags, lrcText] = await Promise.all([
        this.readTags(file).catch(() => null),
        lrcFile ? this.readTextFile(lrcFile).catch(() => null) : Promise.resolve(null)
      ]);

      if (tags) {
        const title = this.tagText(tags.title);
        const artist = this.tagText(tags.artist) || this.tagText(tags.albumartist);
        const album = this.tagText(tags.album);
        if (title) meta.title = title;
        if (artist) meta.artist = artist;
        if (album) meta.album = album;
        if (tags.picture) meta.cover = this.pictureToDataURL(tags.picture);
        const usltLyrics = this.extractUslt(tags);
        if (usltLyrics) meta.lrc = this.normalizeLyrics(usltLyrics);
        if (!meta.lrc) {
          const syltLyrics = this.extractSylt(tags);
          if (syltLyrics) meta.lrc = syltLyrics;
        }
      }

      if (!meta.lrc) {
        try {
          const customLyrics = await this.readLyricsFromId3v2(file);
          if (customLyrics) {
            const norm = this.normalizeLyrics(customLyrics);
            if (norm && norm.length) meta.lrc = norm;
          }
        } catch (e) {}
      }

      if (lrcText) meta.lrc = this.normalizeLyrics(lrcText);
      if (!meta.cover) meta.cover = this.randomCover();

      return {
        id,
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        duration: 0,
        src: URL.createObjectURL(file),
        cover: meta.cover,
        coverIsImage: typeof meta.cover === 'string' && (meta.cover.startsWith('data:') || meta.cover.startsWith('blob:')),
        lrc: meta.lrc,
        fileSize: file.size,
        fileName: file.name,
        _file: file
      };
    },

    tagText(v) {
      if (v == null) return '';
      if (typeof v === 'string') return v.trim();
      if (typeof v === 'number') return String(v);
      if (typeof v === 'object') {
        if (typeof v.data === 'string') return v.data.trim();
        if (Array.isArray(v.data)) {
          return v.data.map((x) => (typeof x === 'string' ? x : '')).join('').trim();
        }
        if (typeof v.text === 'string') return v.text.trim();
        if (typeof v.description === 'string' && typeof v.text !== 'string') return '';
      }
      return '';
    },

    parseFilename(name) {
      const base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
      const m = base.match(/^(?:\d+[\s._-]+)?(.+?)\s[-–—]\s+(.+)$/);
      if (m) return { artist: m[1].trim(), title: m[2].trim() };
      return { artist: '', title: this.cleanName(name) };
    },

    /* ---------- Lee tags ID3 con jsmediatags (cargado desde CDN) ---------- */
    readTags(file) {
      return new Promise((resolve, reject) => {
        if (!window.jsmediatags) return resolve(null);
        try {
          // Solicitamos explícitamente lyrics para asegurar que USLT se lea.
          // jsmediatags por defecto puede no incluir lyrics en algunos builds.
          window.jsmediatags.read(file, {
            tags: ['title', 'artist', 'album', 'year', 'comment', 'track', 'genre', 'picture', 'lyrics', 'composer', 'USLT', 'SYLT'],
            onSuccess: (r) => resolve(r.tags || null),
            onError: (e) => resolve(null)
          });
        } catch (e) { resolve(null); }
      });
    },

    /* ---------- Convierte la imagen ID3 (APIC) a dataURL ---------- */
    pictureToDataURL(picture) {
      try {
        const { data, format } = picture;
        const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < u8.length; i += chunk) {
          binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
        }
        return `data:${format || 'image/jpeg'};base64,${btoa(binary)}`;
      } catch (e) { return null; }
    },

    /* ---------- Genera una portada aleatoria ---------- */
    randomCover() {
      const p = this.PALETTE[Math.floor(Math.random() * this.PALETTE.length)];
      return { from: p.from, to: p.to, angle: p.angle || 135 };
    },

    /* ---------- Limpia el nombre del archivo para usar como título ---------- */
    cleanName(name) {
      return name
        .replace(/\.[^.]+$/, '')
        .replace(/^\d+[\s._-]+/, '')      // quita "01 - " del inicio
        .replace(/[_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    },

    /* ---------- Lee un archivo de texto (.lrc) ---------- */
    readTextFile(file) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsText(file);
      });
    },

    /* Lee la duración real del archivo con un <audio> temporal. */
    probeDuration(file) {
      return new Promise((resolve) => {
        try {
          const a = document.createElement('audio');
          a.preload = 'metadata';
          const url = URL.createObjectURL(file);
          let settled = false;
          const finish = (sec) => {
            if (settled) return;
            settled = true;
            try { URL.revokeObjectURL(url); } catch (e) {}
            try { a.removeAttribute('src'); a.load(); } catch (e) {}
            resolve(sec > 0 && isFinite(sec) ? Math.round(sec) : 0);
          };
          a.addEventListener('loadedmetadata', () => finish(a.duration));
          a.addEventListener('error', () => finish(0));
          setTimeout(() => finish(0), 8000);
          a.src = url;
        } catch (e) {
          resolve(0);
        }
      });
    },

    /* ---------- Track mínimo de respaldo si todo falla ---------- */
    fallbackTrack(file) {
      const id = 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      return {
        id,
        title: this.cleanName(file.name),
        artist: 'Artista desconocido',
        album: 'Sin álbum',
        duration: 0,
        src: URL.createObjectURL(file),
        cover: this.randomCover(),
        coverIsImage: false,
        lrc: null,
        fileSize: file.size,
        fileName: file.name,
        _file: file
      };
    },

    /* ---------- Parsea un archivo .lrc externo ---------- */
    async parseLrcFile(file) {
      try {
        const text = await this.readTextFile(file);
        return text.split(/\r?\n/);
      } catch (e) { return []; }
    },

    /* ============================================================
     *  Extracción de letras embebidas en ID3
     * ============================================================ */

    /* Extrae USLT (Unsynchronized Lyrics).
     * jsmediatags puede devolver tags.lyrics como:
     *   - string (texto directo)
     *   - { language, description, text }
     *   - { language, description, lyrics }
     * También puede estar en tags.USLT. */
    extractUslt(tags) {
      const candidates = [tags.lyrics, tags.USLT, tags.LYRICS, tags.UnsynchronizedLyrics];
      for (const c of candidates) {
        if (!c) continue;
        if (typeof c === 'string') {
          if (c.trim().length > 0) return c;
        } else if (typeof c === 'object') {
          const text = c.text || c.lyrics || c.value;
          if (typeof text === 'string' && text.trim().length > 0) return text;
        }
      }
      return null;
    },

    /* Extrae SYLT (Synchronized Lyrics).
     * jsmediatags no parsea SYLT por defecto, pero si está presente
     * lo devolverá como objeto binario. Lo intentamos decodificar. */
    extractSylt(tags) {
      const raw = tags.SYLT || tags.sylt || tags.SynchronizedLyrics;
      if (!raw) return null;

      // Si ya es un array de strings con timestamps, usarlo directamente
      if (Array.isArray(raw) && raw.length && typeof raw[0] === 'string') {
        return raw;
      }

      // Si es un objeto con data (binario), intentar parsear
      if (raw.data && Array.isArray(raw.data)) {
        return this.parseSyltBinary(raw.data, raw.encoding || 0);
      }
      // Si tiene texto ya parseado
      if (raw.text && typeof raw.text === 'string') {
        return this.normalizeLyrics(raw.text);
      }
      return null;
    },

    /* Parsea un SYLT binario (raro, pero por si acaso).
     * Formato: [encoding(1)][language(3)][timestamp_format(1)][content_type(1)][descriptor(null-terminated)]
     * Luego repetido: [text(null-terminated)][timestamp(4 bytes big-endian)] */
    parseSyltBinary(bytes, encoding) {
      try {
        const lines = [];
        let offset = 0;
        // Skip header: encoding(1) + language(3) + timestamp_format(1) + content_type(1) = 6
        // + descriptor (null-terminated)
        offset = 6;
        // Skip descriptor
        while (offset < bytes.length && bytes[offset] !== 0) offset++;
        offset++; // skip null

        // Read sync'd text + timestamp pairs
        while (offset < bytes.length - 4) {
          // Read text (null-terminated, may be UTF-16)
          let text = '';
          const start = offset;
          if (encoding === 1 || encoding === 2) {
            // UTF-16: null-terminated with 2 bytes
            while (offset < bytes.length - 1 && !(bytes[offset] === 0 && bytes[offset+1] === 0)) offset += 2;
            const u16 = new Uint8Array(bytes.slice(start, offset));
            text = new TextDecoder(encoding === 2 ? 'utf-16be' : 'utf-16le').decode(u16);
            offset += 2; // skip null terminator (2 bytes)
          } else {
            // Latin1 or UTF-8: null-terminated with 1 byte
            while (offset < bytes.length && bytes[offset] !== 0) offset++;
            const u8 = new Uint8Array(bytes.slice(start, offset));
            text = new TextDecoder(encoding === 3 ? 'utf-8' : 'latin1').decode(u8);
            offset++; // skip null terminator
          }
          // Read timestamp (4 bytes big-endian, milliseconds if format=1)
          if (offset + 4 > bytes.length) break;
          const ts = (bytes[offset] << 24) | (bytes[offset+1] << 16) | (bytes[offset+2] << 8) | bytes[offset+3];
          offset += 4;
          // Convert milliseconds to [mm:ss.xx]
          const totalSec = ts / 1000;
          const m = Math.floor(totalSec / 60);
          const s = Math.floor(totalSec % 60);
          const cs = Math.floor((totalSec * 100) % 100);
          const stamp = '[' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') + '.' + String(cs).padStart(2,'0') + ']';
          lines.push(stamp + text);
        }
        return lines.length ? lines : null;
      } catch (e) {
        console.debug('[Aurora] SYLT parse falló:', e.message);
        return null;
      }
    },

    /* Normaliza cualquier texto de letras a un array de líneas.
     * - Si ya tiene timestamps LRC [mm:ss.xx], respeta el formato.
     * - Si es texto plano sin timestamps, lo deja como líneas sueltas
     *   (js/realtime-bridge.js las mostrará sin sincronización).
     * - Filtra metadata LRC irrelevante ([ar:], [ti:], etc.) solo si
     *   hay timestamps reales; si no, las mantiene como texto normal. */
    normalizeLyrics(text) {
      if (!text) return null;
      if (Array.isArray(text)) return text;
      // Normalizar saltos de línea
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      // Detectar si hay timestamps LRC reales
      const hasLrcStamps = lines.some(l => /^\s*\[\d+:\d+/.test(l));
      if (hasLrcStamps) {
        // Filtrar metadata LRC como [ar:Artist], [ti:Title], etc.
        // pero mantener líneas con timestamp [mm:ss.xx]
        return lines.filter(l => {
          const trimmed = l.trim();
          if (!trimmed) return true; // mantener líneas vacías para separación visual
          // Si es metadata LRC (no timestamp), filtrar
          if (/^\[(ar|ti|al|by|offset|length|re|ve|id):/i.test(trimmed)) return false;
          return true;
        });
      }
      // Texto plano: devolver líneas tal cual
      return lines;
    },

    /* ============================================================
     *  Parser ID3v2 propio para USLT/SYLT
     * ============================================================
     *  jsmediatags (CDN) no parsea USLT por defecto. Este método
     *  lee los primeros bytes del archivo, localiza el header ID3v2,
     *  itera sobre los frames y extrae USLT (y SYLT si existe).
     *  Soporta ID3v2.3 (4 bytes de tamaño sincronizado) y 2.4.
     * ============================================================ */
    async readLyricsFromId3v2(file) {
      // Leer los primeros 256KB deberían ser suficientes para los tags
      // (típicamente el header + frames caben en los primeros 10-100KB)
      const chunk = file.slice(0, Math.min(file.size, 512 * 1024));
      const buf = await this.readArrayBuffer(chunk);
      const view = new DataView(buf);
      const u8 = new Uint8Array(buf);

      // Verificar header ID3v2: 'I' 'D' '3'
      if (u8[0] !== 0x49 || u8[1] !== 0x44 || u8[2] !== 0x33) {
        return null;  // no es ID3v2
      }
      const majorVersion = u8[3];  // 3 = v2.3, 4 = v2.4
      // Tamaño del tag (synchsafe integer en v2.4, también en v2.3 según spec real)
      // synchsafe: cada byte usa solo 7 bits
      const tagSize = (u8[6] << 21) | (u8[7] << 14) | (u8[8] << 7) | u8[9];
      const headerSize = 10;
      const flags = u8[5];
      const unsync = (flags & 0x80) !== 0;

      let offset = headerSize;
      const end = Math.min(headerSize + tagSize, u8.length);

      // Si hay extended header, saltarlo
      if (flags & 0x40) {
        if (offset + 4 > end) return null;
        let extSize;
        if (majorVersion === 4) {
          extSize = (u8[offset] << 21) | (u8[offset+1] << 14) | (u8[offset+2] << 7) | u8[offset+3];
        } else {
          extSize = (u8[offset] << 24) | (u8[offset+1] << 16) | (u8[offset+2] << 8) | u8[offset+3];
        }
        offset += extSize;
      }

      // Iterar frames
      while (offset + 10 <= end) {
        // ID del frame (4 bytes ASCII)
        const frameId = String.fromCharCode(u8[offset], u8[offset+1], u8[offset+2], u8[offset+3]);
        if (frameId.charCodeAt(0) === 0) break;  // padding

        // Tamaño del frame
        let frameSize;
        if (majorVersion === 4) {
          // synchsafe
          frameSize = (u8[offset+4] << 21) | (u8[offset+5] << 14) | (u8[offset+6] << 7) | u8[offset+7];
        } else {
          // v2.3: tamaño normal de 4 bytes big-endian
          frameSize = (u8[offset+4] << 24) | (u8[offset+5] << 16) | (u8[offset+6] << 8) | u8[offset+7];
        }
        const frameFlags = (u8[offset+8] << 8) | u8[offset+9];
        offset += 10;  // header del frame

        if (frameSize <= 0 || offset + frameSize > end) {
          break;
        }

        const frameData = u8.subarray(offset, offset + frameSize);

        // Procesar USLT (Unsynchronized Lyrics) - frame oficial
        if (frameId === 'USLT') {
          const text = this.parseUsltFrame(frameData, majorVersion);
          if (text) return text;
        }

        // Procesar SYLT (Synchronized Lyrics) - frame oficial
        if (frameId === 'SYLT') {
          const lines = this.parseSyltFrame(frameData);
          if (lines && lines.length) return lines.join('\n');
        }

        // Procesar TXXX (User-defined text) que contenga letras
        // Algunos codificadores (ffmpeg, iTunes) guardan letras como
        // TXXX con description="USLT", "lyrics", "LYRICS", "UNSYNCED LYRICS", etc.
        if (frameId === 'TXXX') {
          const txxx = this.parseTxxxFrame(frameData);
          if (txxx) {
            const desc = txxx.description.toLowerCase();
            if (desc === 'uslt' || desc === 'lyrics' || desc === 'unsynced lyrics' ||
                desc === 'unsynchronised lyrics' || desc === 'letra' || desc === 'letras') {
              if (txxx.value && txxx.value.trim().length > 0) {
                return txxx.value;
              }
            }
          }
        }

        offset += frameSize;
      }
      return null;
    },

    /* Parsea un frame TXXX (User-defined text).
     * Formato: [encoding(1)][description(null-term)][value(null-term)]
     * Devuelve { description, value } */
    parseTxxxFrame(data) {
      try {
        const encoding = data[0];
        let pos = 1;
        // Description (null-terminated según encoding)
        const descEnd = this.findNullTerminator(data, pos, encoding);
        const descBytes = data.subarray(pos, descEnd);
        const description = this.decodeText(descBytes, encoding);
        pos = descEnd + (encoding === 1 || encoding === 2 ? 2 : 1);
        // Value (resto del frame, null-terminated o hasta el final)
        const valueEnd = this.findNullTerminator(data, pos, encoding);
        const valueBytes = data.subarray(pos, valueEnd);
        const value = this.decodeText(valueBytes, encoding);
        return { description, value };
      } catch (e) {
        return null;
      }
    },

    /* Parsea un frame USLT.
     * Formato: [encoding(1)][language(3)][description(null-term)][lyrics(null-term)] */
    parseUsltFrame(data, id3Version) {
      try {
        const encoding = data[0];
        let pos = 1;
        // Language (3 bytes)
        pos += 3;
        // Description (null-terminated según encoding)
        const descEnd = this.findNullTerminator(data, pos, encoding);
        pos = descEnd + (encoding === 1 || encoding === 2 ? 2 : 1);
        // Lyrics text (resto del frame)
        const textBytes = data.subarray(pos);
        return this.decodeText(textBytes, encoding);
      } catch (e) {
        console.debug('[Aurora] USLT parse error:', e.message);
        return null;
      }
    },

    /* Parsea un frame SYLT.
     * Formato: [encoding(1)][language(3)][timestamp_format(1)][content_type(1)][descriptor(null-term)]
     * Luego repetido: [text(null-term)][timestamp(4 bytes BE)] */
    parseSyltFrame(data) {
      try {
        const encoding = data[0];
        const tsFormat = data[4];  // 1 = milliseconds
        let pos = 5;
        // Descriptor (null-terminated)
        const descEnd = this.findNullTerminator(data, pos, encoding);
        pos = descEnd + (encoding === 1 || encoding === 2 ? 2 : 1);

        const lines = [];
        while (pos < data.length - 4) {
          // Text (null-terminated)
          const textEnd = this.findNullTerminator(data, pos, encoding);
          const textBytes = data.subarray(pos, textEnd);
          const text = this.decodeText(textBytes, encoding);
          pos = textEnd + (encoding === 1 || encoding === 2 ? 2 : 1);
          // Timestamp (4 bytes big-endian)
          if (pos + 4 > data.length) break;
          const ts = (data[pos] << 24) | (data[pos+1] << 16) | (data[pos+2] << 8) | data[pos+3];
          pos += 4;
          // Convert to [mm:ss.xx]
          const totalSec = tsFormat === 1 ? ts / 1000 : ts / 1000;  // assume ms
          const m = Math.floor(totalSec / 60);
          const s = Math.floor(totalSec % 60);
          const cs = Math.floor((totalSec * 100) % 100);
          const stamp = '[' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') + '.' + String(cs).padStart(2,'0') + ']';
          lines.push(stamp + text);
        }
        return lines;
      } catch (e) {
        console.debug('[Aurora] SYLT parse error:', e.message);
        return null;
      }
    },

    /* Encuentra el terminador nulo según el encoding */
    findNullTerminator(data, start, encoding) {
      if (encoding === 1 || encoding === 2) {
        // UTF-16: par de bytes nulos
        for (let i = start; i < data.length - 1; i += 2) {
          if (data[i] === 0 && data[i+1] === 0) return i;
        }
      } else {
        // Latin1 / UTF-8: byte nulo
        for (let i = start; i < data.length; i++) {
          if (data[i] === 0) return i;
        }
      }
      return data.length;
    },

    /* Decodifica texto según encoding ID3
     * 0 = ISO-8859-1 (Latin1)
     * 1 = UTF-16 with BOM
     * 2 = UTF-16BE without BOM
     * 3 = UTF-8 */
    decodeText(bytes, encoding) {
      try {
        if (encoding === 0) return new TextDecoder('latin1').decode(bytes);
        if (encoding === 1) {
          // UTF-16 with BOM - detectar endianness
          if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
            return new TextDecoder('utf-16le').decode(bytes.subarray(2));
          }
          if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
            return new TextDecoder('utf-16be').decode(bytes.subarray(2));
          }
          return new TextDecoder('utf-16le').decode(bytes);
        }
        if (encoding === 2) return new TextDecoder('utf-16be').decode(bytes);
        if (encoding === 3) return new TextDecoder('utf-8').decode(bytes);
        return new TextDecoder('utf-8').decode(bytes);
      } catch (e) {
        // Fallback: tratar como latin1
        let s = '';
        for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        return s;
      }
    },

    /* Lee un ArrayBuffer desde un File/Blob */
    readArrayBuffer(blob) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsArrayBuffer(blob);
      });
    }
  };

  window.AuroraUploader = Uploader;
})();
