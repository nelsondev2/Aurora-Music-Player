#!/usr/bin/env python3
# =====================================================================
#  build-xdc.py — Empaqueta Aurora Music Player como webxdc (.xdc)
# =====================================================================
#  Genera aurora-music-player.xdc listo para adjuntar en un chat de
#  Delta Chat. Un .xdc es simplemente un ZIP con index.html en la RAÍZ
#  (sin carpeta contenedora) y rutas con "/" (nunca "\").
#
#  Uso:     python3 build-xdc.py
#  Salida:  aurora-music-player.xdc
# =====================================================================
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "aurora-music-player.xdc")

# Todo lo que la app necesita para funcionar (webxdc incluye icon.png
# y manifest.toml automáticamente desde la raíz del zip).
INCLUDE = [
    "index.html",
    "manifest.toml",
    "icon.png",
    "LICENSE",
    "styles.css",
    "data.js",
    "storage.js",
    "uploader.js",
    "js",            # módulos de la app
    "assets",        # jsmediatags + sprite de iconos
]


def collect():
    files = []
    for entry in INCLUDE:
        path = os.path.join(ROOT, entry)
        if os.path.isfile(path):
            files.append((path, entry))
        elif os.path.isdir(path):
            for dirpath, dirnames, filenames in os.walk(path):
                # nunca incluir subdirectorios ocultos
                dirnames[:] = [d for d in dirnames if not d.startswith(".")]
                for fn in sorted(filenames):
                    if fn.startswith("."):
                        continue
                    full = os.path.join(dirpath, fn)
                    rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
                    files.append((full, rel))
    return sorted(files, key=lambda x: x[1])


def main():
    files = collect()
    if not any(rel == "index.html" for _, rel in files):
        print("ERROR: index.html no encontrado — el .xdc sería inválido")
        sys.exit(1)

    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for full, rel in files:
            # rel ya usa "/" — requisito para zips webxdc
            z.write(full, rel)

    size = os.path.getsize(OUT)
    print(f"✅ {os.path.basename(OUT)} · {len(files)} archivos · {size/1024:.1f} KB")
    print("   index.html en la raíz:", any(rel == "index.html" for _, rel in files))
    # Verificación: sin backslashes ni carpetas contenedoras
    with zipfile.ZipFile(OUT) as z:
        bad = [n for n in z.namelist() if "\\" in n or n.startswith("./")]
        print("   entradas con formato inválido:", bad if bad else "ninguna ✅")


if __name__ == "__main__":
    main()
