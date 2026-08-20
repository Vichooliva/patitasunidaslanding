"""Reduce las fotos que descarga traer-datos.mjs.

Llegan tal cual las subio la gente desde el telefono: hasta 400 KB cada una y
varios miles de pixeles de ancho, cuando en la web se ven a 400 px. Esto las
deja en un tamano razonable sin que se note.

    python scripts/optimizar-fotos.py

Hay que correrlo despues de cada `node scripts/traer-datos.mjs`. No va dentro
del script de Node porque Node no trae manejo de imagenes en la libreria
estandar, y este proyecto no usa dependencias ni paso de build.

Requiere Pillow:  python -m pip install Pillow
"""
from PIL import Image, ImageOps
import os
import sys

DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "img", "casos"
)
ANCHO_MAX = 900
CALIDAD = 80

if not os.path.isdir(DIR):
    sys.exit(f"No existe {DIR}. Corre antes: node scripts/traer-datos.mjs")

archivos = sorted(
    f for f in os.listdir(DIR) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
)
if not archivos:
    sys.exit("No hay fotos que optimizar.")

antes = despues = 0
for nombre in archivos:
    ruta = os.path.join(DIR, nombre)
    peso_antes = os.path.getsize(ruta)

    im = Image.open(ruta)
    im = ImageOps.exif_transpose(im).convert("RGB")  # respeta la rotacion del movil
    ancho, alto = im.size
    if ancho > ANCHO_MAX:
        im = im.resize((ANCHO_MAX, round(alto * ANCHO_MAX / ancho)), Image.LANCZOS)

    destino = os.path.splitext(ruta)[0] + ".jpg"
    im.save(destino, "JPEG", quality=CALIDAD, optimize=True, progressive=True)
    if destino != ruta:
        os.remove(ruta)

    peso_despues = os.path.getsize(destino)
    antes += peso_antes
    despues += peso_despues
    print(
        f"{nombre:<20} {ancho}x{alto} -> {im.size[0]}x{im.size[1]}   "
        f"{peso_antes/1024:>6.0f} KB -> {peso_despues/1024:>5.0f} KB"
    )

print(f"\nTOTAL {antes/1024/1024:.2f} MB -> {despues/1024/1024:.2f} MB")
