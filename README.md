# Patitas Unidas Chile

Sitio de la **Fundación Patitas Unidas**: animales en situación de calle en Chile.
Familia primero; cuando no se puede, techo, alimento y seguimiento. Y esterilización,
que es lo único que reduce la población en calle.

Los textos usan lenguaje genérico («animales») a propósito: hoy la fundación atiende
sólo perros, pero el plan es incorporar gatos y así no hay que reescribir la web.

En producción: **https://fundacionpatitasunidas.cl**

Vanilla: HTML + CSS + JS, sin frameworks ni paso de build.

## Ejecutar en local

Hace falta un servidor (no vale abrir `index.html` con doble clic: las rutas de
`/img`, el `@import` de la fuente, el `fetch` de `data/` y el portapapeles
necesitan origen HTTP).

```bash
python -m http.server 3008
# http://localhost:3008
```

## Estructura

```
index.html        escena de portada + secciones de contenido
legal.html        aviso legal, privacidad y créditos
404.html          página de error (GitHub Pages la sirve sola)
styles.css        capas de la escena, custom properties, y las secciones
script.js         motor de scroll (rAF + lerp), navegación, datos de la API
data/             JSON generado desde MascotaApp (no se edita a mano)
img/              escena en WebP + logo + fotos de casos en img/casos/
scripts/          descarga de datos y optimización de imágenes
CREDITOS.md       origen y licencia de cada imagen y de la tipografía
_seleccion.html   hoja de contactos con 40 fotos candidatas (archivo de trabajo)
```

## La escena de portada

`.cinema-scroll` mide `100vh + 1950px` con un `.stage` en `position: sticky`.
`script.js` traduce la distancia de scroll a custom properties CSS; el CSS hace
el resto. Nada de librerías de animación.

| Scroll | Qué pasa |
|---|---|
| 0 – 450 | El título sube y se desvanece; el párrafo y las píldoras bajan |
| 390 – 1130 | La lámina central se expande y sale volando, las hojas laterales se abren, y entra «Primero, una familia» con los contadores |
| 1230 – 1890 | Entra «Entre todos, cosas muy grandes» con el botón de ayudar |

> Antes eran 3.700 px con un carrusel de cinco tarjetas al final. Se quitó: repetía
> peor lo que ahora cuentan las secciones **Nosotros** y **Adopta**, y con fotos de
> stock en vez de los perros reales. La escena pasó a 1.950 px.

## Secciones de contenido

- `#nosotros` — misión y los cuatro pilares (familia, techo, alimento, esterilización)
- `#adopta` — animales reales con foto, comuna e historia, desde la API
- `#ayuda` — voluntariado vía MascotaApp, botones de tienda, QR, y datos de donación
- `#veterinarios` — plataforma de gestión clínica y el 70 % de descuento
- pie — contacto y enlaces a MascotaApp

## Actualizar los datos

Las cifras y las fotos de casos vienen de la API pública de MascotaApp. La llave
**nunca** llega al navegador: la petición se hace desde tu máquina y al repositorio
sólo llega el resultado.

```powershell
$env:MASCOTAAPP_API_KEY = "la_llave"
node scripts/traer-datos.mjs      # descarga JSON y fotos
python scripts/optimizar-fotos.py # obligatorio: llegan a 900x1200 y ~250 KB
git add -A ; git commit -m "Actualiza datos" ; git push
```

`scripts/optimizar-escena.py` hace lo mismo con las imágenes de la portada; sólo
hace falta si las reemplazas.

## Pendiente

- [ ] **`esterilizaciones` viene en 0** desde la API. Es la métrica insignia de la
      fundación —la web dice que es «lo único que reduce la población en calle»— y
      está en blanco. O no se registran, o falta la función en MascotaApp.
- [ ] **Ningún caso destacado.** `featured=help` y `featured=success` devuelven
      vacío. Si un administrador marca casos en la app, se pueden montar dos
      secciones más: «Necesitan ayuda ahora» y «Finales felices».
- [ ] **El correo de la API no coincide.** Devuelve `contacto@patitasunidas.cl`;
      el correcto es `fundacionpatitasunidaschile@gmail.com`.
- [ ] **El enlace de Android va a una búsqueda** en Play Store, no a la ficha de
      la app. Falta el enlace directo `play.google.com/store/apps/details?id=...`.
- [ ] **Cloud Run usa una cuenta de servicio prestada.** `mascota-app-us` corre con
      la cuenta de Compute por defecto porque la de Firebase no tiene
      `cloudsql.client` sobre el proyecto `sit-holding`. Funciona, pero conviene
      pedirle a Hugo el permiso y volver a la cuenta propia.
- [ ] Fotos de ambiente propias para la escena (ver `img/reales/LEEME.md`).
- [ ] **Falta el domicilio de la fundación** en `legal.html`. Es el único dato
      del aviso legal que no se puede deducir; está marcado como pendiente.
- [ ] **Que alguien con criterio legal revise `legal.html`.** El texto describe
      con exactitud lo que hace el sitio (que es muy poco: sin formularios, sin
      cookies, sin analítica), pero eso no lo convierte en un documento validado.
- [ ] Borrar `_seleccion.html` antes de publicar (es un archivo de trabajo).

## Publicación

GitHub Pages sirve la rama `main`. El dominio está en NIC Chile, que no aloja
zonas DNS: sólo delega. Por eso los servidores de nombres apuntan a Cloudflare
(`kehlani` y `woz.ns.cloudflare.com`), y los registros A del apex y el CNAME de
`www` viven en Cloudflare **en modo DNS only** — con el proxy activo GitHub no
puede emitir el certificado.
