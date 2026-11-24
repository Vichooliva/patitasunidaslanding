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
adopta.html       todos los animales en adopción, con buscador y filtros
legal.html        aviso legal, privacidad y créditos
404.html          página de error (GitHub Pages la sirve sola)
styles.css        capas de la escena, custom properties, y las secciones
script.js         motor de scroll (rAF + lerp), navegación, datos de la API
                  (cifras y las tres tarjetas al azar de #adopta)
js/animales.js    datos de adopción y la ficha de cada animal (<dialog>)
js/anillo.js      anillo 3D de la sección Adopta
js/historias.js   carrusel y relato animado de Finales felices
js/catalogo.js    buscador y filtros de adopta.html
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
- `#adopta` — animales reales con foto, comuna e historia, desde la API: un
  anillo 3D con hasta doce al azar (las tres tarjetas al azar se quitaron a
  pedido; el código sigue en `script.js`). Cada uno muestra su código de
  MascotaApp, donde se postula a la adopción: gira solo, se
  arrastra con inercia y cada foto abre la ficha completa. Lleva a
  `adopta.html`, donde están todos con buscador (sin tildes: «nunoa» encuentra
  «Ñuñoa»), filtros y orden. Los filtros se arman con lo que traen los datos:
  si nadie cargó el tamaño, no aparece un filtro de tamaño. La URL guarda la
  búsqueda (`?sexo=Hembra&ideal=ninos`) y `adopta.html#<id>` abre la ficha de
  un animal: es el enlace que sale al pulsar «Compartir».
- `#casitas` — «Un techo»: cómo se llega a una casita, en seis pasos, con
  una ilustración que se arma sola (`js/casita.js`). La idea que manda: sin un
  vecino comprometido no hay casita. Muestra «N casitas instaladas» sólo si el
  dato de `/stats` es mayor que cero.
- `#historias` — finales felices: casos resueltos y adopciones concretadas.
  Arriba, tiras que se abren; abajo, el relato de la activa: dónde (un punto
  que cae sobre el largo de Chile hasta su región), cuántos días tardó (un
  contador) y su línea de tiempo con los hitos que registró la fundación.
- `#ayuda` — voluntariado vía MascotaApp, botones de tienda, QR, y datos de donación
- `#veterinarios` — plataforma de gestión clínica y el 70 % de descuento
- pie — contacto y enlaces a MascotaApp

## Actualizar los datos

Las cifras y las fotos de casos vienen de la API pública de MascotaApp. La llave
**nunca** llega al navegador: la petición se hace desde tu máquina y al repositorio
sólo llega el resultado.

Todo viene de la API pública de MascotaApp (documentada en
`mascotas-main/docs/api-publica-fundacion.md`). La API exige `X-API-Key`
**también para las fotos**, así que el navegador no puede llamarla: la llave
quedaría a la vista en el código fuente. La petición se hace fuera del
navegador y al repositorio sólo llega el resultado.

**Normalmente no hay que hacer nada:** `.github/workflows/publicar.yml` lo
corre solo cada 6 horas con la llave guardada como secreto del repositorio, y
si algo cambió hace commit y publica. Para forzarlo: pestaña **Actions →
Publicar el sitio → Run workflow**.

A mano, para probar en local:

```powershell
$env:MASCOTAAPP_API_KEY = "la_llave"
node scripts/traer-datos.mjs      # descarga JSON y fotos (sólo las nuevas)
python scripts/optimizar-fotos.py # obligatorio: llegan a 900x1200 y ~250 KB
git add -A ; git commit -m "Actualiza datos" ; git push
```

| Archivo | Endpoint | Lo usa |
|---|---|---|
| `data/cifras.json` | `/stats` | contadores de la escena |
| `data/casos-ayuda.json` | `/cases?featured=help` | (aún ninguna sección) |
| `data/casos-exito.json` | `/cases?featured=success` | (aún ninguna sección) |
| `data/adopciones.json` | casos `ready_adopt` (con los datos de su ficha `/adoptions?status=available` si la tienen) | anillo, tarjetas y `adopta.html` |
| `data/historias.json` | `/cases?status=resolved` + `/adoptions?status=adopted` + `/cases/{id}` por cada una | Finales felices |

Lo que conviene saber del script:

- **Sólo escribe si algo cambió** (ignora las marcas de tiempo), y sólo baja
  fotos que no tenga: las nombra por id (`adopcion-<id>.webp`). Con
  `--todas-las-fotos` las vuelve a bajar todas.
- **En adopción sólo van casos "listos para adoptar"** (`ready_adopt`): así lo
  pidió la fundación. Una ficha "disponible" cuyo caso sigue abierto, en
  atención o ya resuelto no se publica, y el registro dice cuál fue.
- **No borra nada.** Al final lista las fotos de `img/casos` que ningún JSON
  usa (animales que salieron del catálogo); borrarlas lo decide la fundación.
- **Si un conjunto falla, conserva el archivo anterior.** Una web con datos de
  ayer es mejor que una vacía.
- **Tapa teléfonos y correos** que alguien haya escrito dentro de un texto
  libre, y **no guarda `ubicacion.referencia`**, que suele ser una dirección
  exacta. Comuna y región bastan.
- La API redirige las fotos a Google Cloud Storage. El script sigue esa
  redirección a mano para **no reenviarle la llave a Google**: `fetch` conserva
  las cabeceras propias al saltar de dominio.

`scripts/optimizar-escena.py` hace lo mismo con las imágenes de la portada; sólo
hace falta si las reemplazas.

## Pendiente

- [ ] **`esterilizaciones` viene en 0** desde la API. Es la métrica insignia de la
      fundación —la web dice que es «lo único que reduce la población en calle»— y
      está en blanco. O no se registran, o falta la función en MascotaApp.
- [ ] **«Finales felices» está oculta** hasta la primera pasada del flujo
      `publicar.yml`: `data/historias.json` todavía no existe.
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

**Hoy publica Cloudflare**, gratis (desde el 24-11-2026):

- Proyecto **`patitasunidaslanding`** (Workers & Pages → Worker de sólo
  archivos estáticos, configurado en `wrangler.jsonc`). Se construye solo en
  cada push a `main` con `scripts/construir.mjs`, que trae los datos frescos
  de MascotaApp con la llave guardada en Cloudflare (Settings → Builds →
  Variables and secrets → `MASCOTAAPP_API_KEY`, tipo *Secret*).
- Worker **`patitas-reconstruir`** (código en
  `cloudflare/reconstruir-cada-6h.js`): cron `23 */6 * * *` que llama al
  deploy hook `cada-6-horas` del proyecto (secreto `DEPLOY_HOOK_URL`). Así
  los datos se actualizan cada 6 horas aunque nadie haga push.
- Dominio: `fundacionpatitasunidas.cl` es *Custom domain* del proyecto, y
  `www` es un CNAME *proxied* al dominio más una *Route*
  `www.fundacionpatitasunidas.cl/*` al mismo proyecto.
- El `data/` del repositorio es sólo respaldo: si la API falla durante una
  publicación, se usa ése.

**GitHub Pages ya no recibe el dominio** (sus registros DNS se borraron al
pasar a Cloudflare). `.github/workflows/publicar.yml` sigue en el repo pero
GitHub Actions está bloqueado en la cuenta por facturación, así que sus
ejecuciones fallan; si algún día se vuelve a GitHub, ver abajo.

### Antes: GitHub Pages

GitHub Pages servía la rama `main` (Settings → Pages → «Deploy from a branch»).

Está preparado `.github/workflows/publicar.yml` para que publique el flujo en
vez de GitHub por su cuenta. Se activa cambiando la fuente a **GitHub
Actions** en **Settings → Pages**, y sólo cuando Actions funcione en la cuenta
(hoy está bloqueado por un tema de facturación de GitHub). Con eso:

- cada push a `main` publica el sitio;
- cada 6 horas trae los datos de MascotaApp y, si cambiaron, hace commit y
  publica;
- a mano: **Actions → Publicar el sitio → Run workflow**.

Por qué así: los commits que hace un flujo con su token automático **no**
disparan la publicación de Pages (lo dice la documentación de GitHub), así que
si sólo hiciera commit de los datos, la web no se enteraría.

No se publican `scripts/`, `.github/`, `README.md` ni nada que empiece por `_`
(`_seleccion.html`, `img/_sin-tono/`). Antes los ocultaba Jekyll; ahora los
excluye el flujo.

Necesita el secreto **`MASCOTAAPP_API_KEY`** en **Settings → Secrets and
variables → Actions**. Si falta o se rota la llave en Cloud Run, el flujo se
pone en rojo y GitHub avisa por correo; la web sigue con los últimos datos.

### Publicación en Cloudflare Pages (alternativa gratuita)

Mientras GitHub Actions siga bloqueado, la forma de tener los datos al día sin
pagar nada es que **Cloudflare** construya y publique la web. El DNS ya vive en
Cloudflare, así que **NIC Chile no se toca**: sólo cambian los registros del
dominio dentro de Cloudflare.

| En Cloudflare | Valor |
|---|---|
| Build command | `node scripts/construir.mjs` |
| Build output directory | `dist` |
| Variable secreta | `MASCOTAAPP_API_KEY` |

- `scripts/construir.mjs` trae los datos frescos (si hay llave), optimiza las
  fotos y arma `dist/` sin `scripts/`, `README.md` ni nada que empiece por `_`
  o `.`. Si la API falla, publica igual con los datos del repositorio.
- Cada 6 horas lo dispara un Worker con tarea programada
  (`cloudflare/reconstruir-cada-6h.js`) que llama al *deploy hook* del
  proyecto.
- Plan gratuito: 500 publicaciones al mes (se usan ~120), 5 tareas
  programadas por cuenta, 20 minutos por publicación.
- **Si el panel ofrece "Worker" en vez de "Pages"** (la modalidad nueva de
  Cloudflare): mismo *Build command*, *Deploy command* `npx wrangler deploy`,
  y la llave como **Build variable**. La configuración está en
  `wrangler.jsonc` (sitio estático desde `dist/`, `404.html` para lo que no
  existe). El campo `name` tiene que coincidir con el nombre del proyecto.

El dominio está en NIC Chile, que no aloja
zonas DNS: sólo delega. Por eso los servidores de nombres apuntan a Cloudflare
(`kehlani` y `woz.ns.cloudflare.com`). **NIC no se tocó al pasar a Cloudflare.**

Registros en Cloudflare desde el 24-11-2026: el apex es un registro de tipo
*Worker* (lo crea Cloudflare al agregar el *Custom domain*) y `www` es un CNAME
al apex, ambos **proxied**. Antes, con GitHub Pages, eran cuatro A a
`185.199.108–111.153` y un CNAME a `vichooliva.github.io` en modo *DNS only*
(con el proxy activo GitHub no podía emitir el certificado); si algún día se
vuelve a GitHub, hay que reponerlos así.
