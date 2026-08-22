"""Genera el favicon, el icono de iOS y la imagen para compartir.

    python scripts/generar-iconos.py

Sin esto, la pestana del navegador sale en blanco y al pegar el enlace en
WhatsApp o Instagram aparece una URL pelada, sin imagen ni descripcion. Para
una fundacion que depende de que la compartan, eso importa mas que casi
cualquier detalle visual de la propia pagina.

Requiere Pillow:  python -m pip install Pillow
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RAIZ, "img")
LOGO = os.path.join(IMG, "logo.webp")
FONDO = os.path.join(IMG, "hero.webp")

CREMA = (250, 242, 234)
TERRACOTA = (196, 99, 76)

if not os.path.exists(LOGO):
    sys.exit(f"Falta {LOGO}")


def fuente(nombres, tam):
    """Primera fuente del sistema que exista, con respaldo a la de Pillow."""
    for n in nombres:
        for base in (r"C:\Windows\Fonts", "/usr/share/fonts/truetype"):
            ruta = os.path.join(base, n)
            if os.path.exists(ruta):
                try:
                    return ImageFont.truetype(ruta, tam)
                except OSError:
                    pass
    return ImageFont.load_default()


# ---------- favicon e icono de iOS ----------
logo = Image.open(LOGO).convert("RGBA")

for tam, nombre in ((32, "favicon-32.png"), (180, "apple-touch-icon.png")):
    icono = logo.resize((tam, tam), Image.LANCZOS)
    if nombre.startswith("apple"):
        # iOS no respeta la transparencia: recorta a cuadrado y pone fondo
        fondo = Image.new("RGB", (tam, tam), CREMA)
        fondo.paste(icono, (0, 0), icono)
        icono = fondo
    icono.save(os.path.join(IMG, nombre), optimize=True)
    print(f"  img/{nombre}  {tam}x{tam}")

# .ico con varios tamanos, para navegadores viejos y accesos directos
logo.resize((64, 64), Image.LANCZOS).save(
    os.path.join(RAIZ, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)]
)
print("  favicon.ico")

# ---------- imagen para compartir (1200x630) ----------
W, H = 1200, 630
lienzo = Image.new("RGB", (W, H), (26, 19, 16))

if os.path.exists(FONDO):
    foto = Image.open(FONDO).convert("RGB")
    # recorte que cubre 1200x630 sin deformar
    escala = max(W / foto.width, H / foto.height)
    foto = foto.resize((round(foto.width * escala), round(foto.height * escala)), Image.LANCZOS)
    izq = (foto.width - W) // 2
    arriba = (foto.height - H) // 2
    foto = foto.crop((izq, arriba, izq + W, arriba + H))
    foto = foto.filter(ImageFilter.GaussianBlur(3))
    lienzo.paste(foto, (0, 0))

# velo oscuro para que el texto se lea sobre cualquier foto
velo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(velo)
for y in range(H):
    d.line([(0, y), (W, y)], fill=(24, 17, 14, int(150 + 90 * (y / H))))
lienzo = Image.alpha_composite(lienzo.convert("RGBA"), velo).convert("RGB")

d = ImageDraw.Draw(lienzo)

# logo arriba a la izquierda
marca = logo.resize((132, 132), Image.LANCZOS)
lienzo.paste(marca, (72, 64), marca)

titulo = fuente(["georgiab.ttf", "Georgia.ttf", "times.ttf"], 96)
bajada = fuente(["segoeui.ttf", "arial.ttf"], 34)
pie = fuente(["segoeuib.ttf", "arialbd.ttf"], 26)

d.text((72, 250), "Patitas Unidas", font=titulo, fill=CREMA)
d.text((72, 368), "Fundación chilena de rescate y adopción", font=bajada, fill=CREMA)
d.text(
    (72, 430),
    "Siempre buscamos familia. Cuando no se puede, un techo.",
    font=bajada,
    fill=(226, 214, 200),
)

# franja de acento abajo
d.rectangle([(72, 520), (72 + 96, 526)], fill=TERRACOTA)
d.text((72, 552), "FUNDACIONPATITASUNIDAS.CL", font=pie, fill=TERRACOTA)

salida = os.path.join(IMG, "compartir.jpg")
lienzo.save(salida, "JPEG", quality=86, optimize=True, progressive=True)
print(f"  img/compartir.jpg  {W}x{H}  {os.path.getsize(salida)/1024:.0f} KB")
