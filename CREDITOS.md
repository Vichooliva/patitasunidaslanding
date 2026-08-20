# Créditos de imágenes y tipografía

## Fotografías

**Todas las imágenes de `/img` son CC0 (dominio público).** No obligan legalmente a
citar autor. Se listan igualmente por buena práctica y para poder rastrear el origen
si hiciera falta reemplazarlas.

| Archivo | Origen | Autor | Licencia |
|---|---|---|---|
| `sky.jpg` | [Dog park Grunewald 2021-06-10 22](https://commons.wikimedia.org/wiki/File:Dog_park_Grunewald_2021-06-10_22.jpg) — Wikimedia Commons | Leonhard Lenz | CC0 |
| `ground.jpg` | [Dog park Grunewald 2021-06-10 57](https://commons.wikimedia.org/wiki/File:Dog_park_Grunewald_2021-06-10_57.jpg) — Wikimedia Commons | Leonhard Lenz | CC0 |
| `frame-two.jpg` | [Freedom Park Dog Park](https://commons.wikimedia.org/wiki/File:Freedom_Park_Dog_Park.jpeg) — Wikimedia Commons | GA_Kevin | CC0 |
| `hero.jpg` | [Labrador con pelota](https://pd.w.org/2024/11/2316734abafa97e69.56576607-2048x1536.jpg) — WordPress Photo Directory | — | CC0 |
| `split-left.jpg` | Border collie corriendo — rawpixel | — | CC0 |
| `split-right.jpg` | Bulldog corriendo — rawpixel | — | CC0 |
| `pin-1.jpg` | Cachorro golden retriever — rawpixel | — | CC0 |
| `pin-2.jpg` | Labrador negro — rawpixel | — | CC0 |
| `pin-3.jpg` | Cachorro terrier — rawpixel | — | CC0 |

Todas fueron redimensionadas y recomprimidas (15 MB → 4,4 MB) respecto al original.

> **Recomendación:** en cuanto la fundación tenga fotos propias de sus perros,
> sustituirlas. Funcionan mucho mejor para captar adopciones que el stock genérico,
> y eliminan cualquier duda de licencia.

## Logotipo

`img/logo.png` — logotipo propio de la Fundación Patitas Unidas.

Llegó como captura de pantalla (1435×1290, con restos de interfaz en los bordes:
texto cortado, iconos sueltos). Se procesó automáticamente: detección del círculo
crema por color, recorte cuadrado centrado, escalado a 512×512 y máscara circular
con fondo transparente. El archivo original sin tocar está en `img/logo-original.png`.

> Si en algún momento consiguen el logo vectorial (SVG o AI), conviene sustituirlo:
> se vería nítido a cualquier tamaño y pesaría una fracción.

## Tipografía

**Playfair Display** — Claus Eggers Sørensen, [SIL Open Font License 1.1](https://openfontlicense.org/),
servida desde Google Fonts.

Sustituye a `Ogg Medium`, la fuente del diseño original: es un tipo **comercial de
Sharp Type** y se cargaba desde el CDN de un tercero, es decir, sin licencia. Si la
fundación adquiere una licencia de Ogg, basta con restaurar el `@font-face` y cambiar
`--font-display` en [`styles.css`](styles.css).
