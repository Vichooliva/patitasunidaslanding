# Patitas Unidas Chile

Sitio de la **Fundación Patitas Unidas**: animales en situación de calle en Chile.
Familia primero; cuando no se puede, techo, alimento y seguimiento. Y esterilización,
que es lo único que reduce la población en calle.

Los textos usan lenguaje genérico («animales») a propósito: hoy la fundación atiende
sólo perros, pero el plan es incorporar gatos y así no hay que reescribir la web.

Vanilla: HTML + CSS + JS, sin frameworks ni paso de build.

## Ejecutar en local

Hace falta un servidor (no vale abrir `index.html` con doble clic: las rutas de
`/img`, el `@import` de la fuente y el portapapeles necesitan origen HTTP).

```bash
python -m http.server 3008
# http://localhost:3008
```

## Estructura

```
index.html        escena cinematográfica + secciones de contenido
styles.css        capas de la escena, ~50 custom properties, y las secciones
script.js         motor de scroll (rAF + lerp), carrusel infinito, copiar cuenta
img/              9 fotos CC0 optimizadas (4,4 MB) + logo.png
CREDITOS.md       origen y licencia de cada imagen y de la tipografía
_seleccion.html   hoja de contactos con 40 fotos candidatas (archivo de trabajo)
```

## La escena cinematográfica

`.cinema-scroll` mide `100vh + 3700px` con un `.stage` en `position: sticky`.
`script.js` traduce la distancia de scroll a custom properties CSS; el CSS hace
el resto.

| Scroll | Qué pasa |
|---|---|
| 0 – 650 | El título sube y se desvanece; el párrafo y las píldoras bajan |
| 560 – 1620 | La lámina central se expande y sale volando; las hojas laterales se abren; entra «Primero, una familia» |
| 1760 – 2700 | Entra «Entre todos, cosas muy grandes» |
| 2760 – 3560 | Entra el carrusel de tarjetas desde la derecha |
| 3360 – 3660 | Aparecen los botones ← → del carrusel |

El carrusel clona el juego de 5 tarjetas tres veces y salta sin transición al
llegar a un extremo: bucle infinito y sin costura.

## Secciones de contenido

Debajo de la escena, con la paleta del logo (crema, terracota, marrón):

- `#nosotros` — misión y los cuatro pilares (familia, techo, alimento, esterilización)
- `#ayuda` — voluntariado vía MascotaApp + datos de donación con botón de copiar
- `#veterinarios` — plataforma de gestión clínica y el 70 % de descuento
- pie — contacto y enlaces a MascotaApp (web, Android, iPhone)

## Pendiente

- [ ] **Sustituir las dos cifras `000`** de la escena por datos reales de la
      fundación (ver comentario en `index.html`). Están en blanco a propósito.
- [ ] **El menú desaparece al salir de la escena.** El header vive dentro del
      `.stage` sticky, así que en las secciones de contenido no hay navegación.
      Se arregla con un segundo header fijo; dímelo y lo hago.
- [ ] Cambiar las fotos de stock por fotos propias de los perros de la fundación.
- [ ] Borrar `_seleccion.html` antes de publicar (es un archivo de trabajo).
- [ ] Aviso legal y política de privacidad.
