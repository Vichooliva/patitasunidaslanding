"""Deja las fotos que descarga traer-datos.mjs al tamano en que se ven.

    python scripts/optimizar-fotos.py

Llegan tal cual las subio la gente desde el telefono: 900x1200 px y hasta
250 KB cada una. En la web se muestran en tarjetas de ~280x250, o sea que
se descargaban diez veces mas pixeles de los que se ven. Aqui se reducen a
600 px de ancho y se convierten a WebP, que a igual calidad pesa bastante
menos que JPEG.

Ademas reescribe las rutas en data/*.json, porque cambia la extension.

Hay que correrlo despues de cada `node scripts/traer-datos.mjs`. No va dentro
del script de Node porque Node no trae manejo de imagenes en su libreria
estandar y este proyecto no usa dependencias ni paso de build.

Requiere Pillow:  python -m pip install Pillow
"""
from PIL import Image, ImageOps
import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOTOS = os.path.join(RAIZ, "img", "casos")
DATOS = os.path.join(RAIZ, "data")

ANCHO_MAX = 600   # las tarjetas miden ~280 px; 600 cubre pantallas retina
CALIDAD = 75

if not os.path.isdir(FOTOS):
    sys.exit(f"No existe {FOTOS}. Corre antes: node scripts/traer-datos.mjs")

originales = sorted(
    f for f in os.listdir(FOTOS)
    if f.lower().endswith((".jpg", ".jpeg", ".png"))
)
if not originales:
    print("No hay fotos JPEG/PNG que convertir.")

renombrados = {}
antes = despues = 0

for nombre in originales:
    ruta = os.path.join(FOTOS, nombre)
    peso_antes = os.path.getsize(ruta)

    im = Image.open(ruta)
    im = ImageOps.exif_transpose(im).convert("RGB")  # respeta la rotacion del movil
    ancho, alto = im.size
    if ancho > ANCHO_MAX:
        im = im.resize((ANCHO_MAX, round(alto * ANCHO_MAX / ancho)), Image.LANCZOS)

    base = os.path.splitext(nombre)[0]
    destino = os.path.join(FOTOS, base + ".webp")
    im.save(destino, "WEBP", quality=CALIDAD, method=6)

    os.remove(ruta)
    renombrados[f"img/casos/{nombre}"] = f"img/casos/{base}.webp"

    peso_despues = os.path.getsize(destino)
    antes += peso_antes
    despues += peso_despues
    print(
        f"{nombre:<20} {ancho}x{alto} -> {im.size[0]}x{im.size[1]}   "
        f"{peso_antes/1024:>6.0f} KB -> {peso_despues/1024:>5.0f} KB"
    )

# --- actualizar las rutas en los JSON ---
if renombrados and os.path.isdir(DATOS):
    for archivo in sorted(os.listdir(DATOS)):
        if not archivo.endswith(".json"):
            continue
        ruta = os.path.join(DATOS, archivo)
        with open(ruta, encoding="utf-8") as f:
            texto = f.read()
        nuevo = texto
        for viejo, actual in renombrados.items():
            nuevo = nuevo.replace(viejo, actual)
        if nuevo != texto:
            with open(ruta, "w", encoding="utf-8") as f:
                f.write(nuevo)
            print(f"rutas actualizadas en data/{archivo}")

if antes:
    print(f"\nTOTAL {antes/1024/1024:.2f} MB -> {despues/1024/1024:.2f} MB "
          f"({100 - despues * 100 / antes:.0f} % menos)")
