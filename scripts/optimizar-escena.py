"""Convierte a WebP las imagenes de la escena de portada.

    python scripts/optimizar-escena.py

Estas imagenes se descargan TODAS al abrir la pagina, sin lazy loading: forman
la escena que se ve desde el primer pixel. Medido en produccion pesaban 3,45 MB
y hacian que todo lo demas (incluidas las fotos de adopcion, ya optimizadas)
esperara su turno.

WebP pesa bastante menos que JPEG a igual calidad, y soporta transparencia, asi
que sirve tambien para el logo.

Reescribe las referencias en index.html y styles.css. Es idempotente: si ya
estan convertidas, no hace nada.

Requiere Pillow:  python -m pip install Pillow
"""
from PIL import Image
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RAIZ, "img")

# nombre -> (ancho maximo, calidad)
PLAN = {
    "sky.jpg": (1600, 72),
    "ground.jpg": (1600, 72),
    "frame-two.jpg": (1600, 72),
    "hero.jpg": (1400, 76),
    "split-left.jpg": (900, 78),
    "split-right.jpg": (900, 78),
    "pin-1.jpg": (320, 80),
    "pin-2.jpg": (320, 80),
    "pin-3.jpg": (320, 80),
    "logo.png": (400, 82),
}

renombrados = {}
antes = despues = 0

for nombre, (ancho_max, calidad) in PLAN.items():
    ruta = os.path.join(IMG, nombre)
    if not os.path.exists(ruta):
        print(f"(saltado, no existe) {nombre}")
        continue

    peso_antes = os.path.getsize(ruta)
    im = Image.open(ruta)
    # el logo necesita conservar la transparencia; el resto no
    modo = "RGBA" if im.mode in ("RGBA", "LA", "P") and nombre.endswith(".png") else "RGB"
    im = im.convert(modo)

    ancho, alto = im.size
    if ancho > ancho_max:
        im = im.resize((ancho_max, round(alto * ancho_max / ancho)), Image.LANCZOS)

    base = os.path.splitext(nombre)[0]
    destino = os.path.join(IMG, base + ".webp")
    im.save(destino, "WEBP", quality=calidad, method=6)
    os.remove(ruta)

    renombrados[f"img/{nombre}"] = f"img/{base}.webp"
    peso_despues = os.path.getsize(destino)
    antes += peso_antes
    despues += peso_despues
    print(
        f"{nombre:<18} {ancho}x{alto} -> {im.size[0]}x{im.size[1]}   "
        f"{peso_antes/1024:>6.0f} KB -> {peso_despues/1024:>5.0f} KB"
    )

if not renombrados:
    sys.exit("\nNada que convertir: ya estan en WebP.")

# --- reescribir referencias ---
for archivo in ("index.html", "styles.css"):
    ruta = os.path.join(RAIZ, archivo)
    with open(ruta, encoding="utf-8") as f:
        texto = f.read()
    nuevo = texto
    for viejo, actual in renombrados.items():
        nuevo = nuevo.replace(viejo, actual)
    if nuevo != texto:
        with open(ruta, "w", encoding="utf-8") as f:
            f.write(nuevo)
        cambios = sum(texto.count(v) for v in renombrados)
        print(f"{archivo}: {cambios} referencia(s) actualizada(s)")

print(f"\nTOTAL {antes/1024/1024:.2f} MB -> {despues/1024/1024:.2f} MB "
      f"({100 - despues * 100 / antes:.0f} % menos)")
