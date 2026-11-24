/**
 * Trae datos y fotos de la API pública de MascotaApp y los deja como archivos
 * estáticos, para que la web los use sin exponer la llave.
 *
 * POR QUÉ ASÍ
 * La API exige la cabecera X-API-Key, también para las fotos. Este sitio es
 * estático y no tiene servidor donde esconder un secreto: si el navegador
 * hiciera la petición, la llave viajaría en el código fuente. Así que la
 * petición se hace AQUÍ —en tu máquina o en GitHub Actions— y al repositorio
 * sólo llega el resultado.
 *
 * QUIÉN LO CORRE
 * Lo corre solo .github/workflows/publicar.yml cada 6 horas, con la
 * llave guardada como secreto del repositorio (ver README, "Publicación").
 * A mano:
 *
 *   $env:MASCOTAAPP_API_KEY = "la_llave"          (PowerShell)
 *   node scripts/traer-datos.mjs                   baja sólo las fotos nuevas
 *   node scripts/traer-datos.mjs --todas-las-fotos las vuelve a bajar todas
 *   python scripts/optimizar-fotos.py              obligatorio después
 *
 * QUÉ GENERA
 *   data/fundacion.json   ficha
 *   data/cifras.json      contadores de la portada
 *   data/casos-ayuda.json   casos destacados como "necesita ayuda"
 *   data/casos-exito.json   casos destacados como "final feliz"
 *   data/adopciones.json  TODOS los animales en adopción (el anillo de la
 *                         portada elige unos pocos; adopta.html los filtra)
 *   data/historias.json   finales felices: casos resueltos y adopciones
 *                         concretadas, con su línea de tiempo de hitos
 *
 * Cada endpoint se pide por separado y un fallo no aborta el resto. Si un
 * conjunto falla, su archivo anterior se queda como estaba: más vale una web
 * con datos de ayer que una web vacía.
 */

import { writeFile, readFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.MASCOTAAPP_BASE || "https://mascotaapp.cl/api/public/v1";
const SLUG = process.env.MASCOTAAPP_SLUG || "patitas-unidas";
const LLAVE = process.env.MASCOTAAPP_API_KEY;
const TODAS_LAS_FOTOS = process.argv.includes("--todas-las-fotos");

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATOS = resolve(RAIZ, "data");
const FOTOS = resolve(RAIZ, "img", "casos");

const POR_PAGINA = 50; // el máximo que acepta la API
const MAX_ADOPCIONES = 200; // tope de la paginación, por si algo se descontrola
const MAX_HISTORIAS = 12;
const MAX_FOTOS_DE_HITOS = 4; // por historia: la línea de tiempo no es una galería

if (!LLAVE) {
  console.error('Falta MASCOTAAPP_API_KEY.\n  $env:MASCOTAAPP_API_KEY = "la_llave"');
  process.exit(1);
}

const HOST_API = new URL(BASE).host;
const fallos = [];

/** La llave sólo viaja a MascotaApp, nunca a otro host. */
function cabecerasPara(url) {
  return new URL(url).host === HOST_API
    ? { "X-API-Key": LLAVE, Accept: "application/json" }
    : {};
}

/**
 * fetch que respeta el límite de la API (120 peticiones por minuto por IP,
 * y las fotos cuentan). Si responde 429 espera lo que dice Retry-After y
 * reintenta, hasta dos veces. Importa sobre todo en Cloudflare, donde cada
 * publicación parte de cero y baja todas las fotos seguidas.
 */
async function traer(url, opciones, intento = 1) {
  const r = await fetch(url, opciones);
  if (r.status !== 429 || intento > 2) return r;
  const segundos = Math.min(65, Number(r.headers.get("retry-after")) || 30);
  console.log(`  … la API pide calma (429): espero ${segundos} s y reintento`);
  await new Promise((listo) => setTimeout(listo, segundos * 1000));
  return traer(url, opciones, intento + 1);
}

/** Pide una ruta. Nunca lanza: devuelve null y anota el fallo. */
async function pedir(ruta) {
  let r;
  try {
    r = await traer(BASE + ruta, { headers: cabecerasPara(BASE) });
  } catch (e) {
    fallos.push({ ruta, detalle: `sin red: ${e.message}` });
    return null;
  }

  if (!r.ok) {
    // el cuerpo del error suele traer la causa; es lo que necesitas para el log
    let cuerpo = "";
    try {
      cuerpo = (await r.text()).slice(0, 400).replace(/\s+/g, " ").trim();
    } catch {}
    fallos.push({
      ruta,
      detalle: `HTTP ${r.status}${cuerpo ? ` — ${cuerpo}` : " (sin cuerpo)"}`,
    });
    return null;
  }

  try {
    return await r.json();
  } catch (e) {
    fallos.push({ ruta, detalle: `respuesta no es JSON: ${e.message}` });
    return null;
  }
}

/**
 * Recorre todas las páginas de un listado.
 * Si una página falla devuelve null: un catálogo a medias publicado como si
 * estuviera completo es peor que conservar el anterior.
 */
async function pedirTodo(ruta, max) {
  const filas = [];
  const sep = ruta.includes("?") ? "&" : "?";
  while (filas.length < max) {
    const res = await pedir(`${ruta}${sep}limit=${POR_PAGINA}&offset=${filas.length}`);
    if (!res?.data) return null;
    filas.push(...res.data);
    if (!res.paginacion?.hayMas || !res.data.length) break;
  }
  return { filas: filas.slice(0, max), total: filas.length };
}

/* ---------- limpieza de texto ----------
   Los textos los escribe gente desde el teléfono. La API ya filtra los campos
   con datos personales, pero dentro de un texto libre alguien puede haber
   dejado su número o su correo. En la web de la fundación no aportan nada y
   sí exponen a quien los escribió. */

const CORREO = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const TELEFONO = /(?:\+?56[\s.-]?)?(?:9[\s.-]?)?\d{4}[\s.-]?\d{4}\b/g;

function sinContacto(texto) {
  if (typeof texto !== "string") return null;
  const limpio = texto.replace(CORREO, "[correo omitido]").replace(TELEFONO, "[teléfono omitido]").trim();
  return limpio || null;
}

const SIN_NOMBRE = /^(sin nombre|no tiene|s\/n|-+|\?+)$/i;
const nombreReal = (n) => {
  const t = typeof n === "string" ? n.trim() : "";
  return t && !SIN_NOMBRE.test(t) ? t : null;
};

const si = (v) => v === true;
const siNoNulo = (v) => (typeof v === "boolean" ? v : null);

/* ---------- lista blanca de campos ----------
   Copiamos sólo lo que la web pinta, para que un campo nuevo con datos
   sensibles no acabe en el repositorio por inercia. Lo que empieza por "_" se
   usa durante la descarga y no se guarda.

   OJO: especie, sexo, raza, edad y tamaño vienen DENTRO de `animal`. La
   versión anterior los leía del primer nivel y por eso salían siempre en
   null. */

const soloCaso = (c) => ({
  id: c.id,
  titulo: c.titulo,
  descripcion: c.descripcion,
  estado: c.estado,
  urgencia: c.urgencia,
  especie: c.animal?.especie ?? null,
  nombre: c.animal?.nombre ?? null,
  comuna: c.ubicacion?.comuna ?? null,
  region: c.ubicacion?.region ?? null,
  fotoRemota: c.fotoPrincipalUrl ?? null,
  foto: null, // se rellena al descargar
  creadoEn: c.creadoEn ?? null,
});

const soloAdopcion = (a) => ({
  id: a.id,
  codigo: a.codigo ?? null,
  casoId: a.casoId ?? null,
  nombre: a.nombre ?? null,
  especie: a.animal?.especie ?? null,
  raza: a.animal?.raza ?? null,
  esMestizo: siNoNulo(a.animal?.esMestizo),
  edad: a.animal?.edadAproximada ?? null,
  sexo: a.animal?.sexo ?? null,
  tamano: a.animal?.tamano ?? null,
  color: a.animal?.color ?? null,
  historia: sinContacto(a.historia),
  personalidad: sinContacto(a.personalidad),
  actividadesFavoritas: sinContacto(a.actividadesFavoritas),
  salud: {
    vacunado: si(a.salud?.vacunado),
    esterilizado: si(a.salud?.esterilizado),
    desparasitado: si(a.salud?.desparasitado),
    necesidadesEspeciales: si(a.salud?.necesidadesEspeciales),
    detalleNecesidadesEspeciales: sinContacto(a.salud?.detalleNecesidadesEspeciales),
  },
  convivencia: {
    nivelDeEnergia: Number.isInteger(a.convivencia?.nivelDeEnergia)
      ? a.convivencia.nivelDeEnergia
      : null,
    conNinos: siNoNulo(a.convivencia?.conNinos),
    conPerros: siNoNulo(a.convivencia?.conPerros),
    conGatos: siNoNulo(a.convivencia?.conGatos),
    aptoDepartamento: siNoNulo(a.convivencia?.aptoDepartamento),
  },
  comuna: a.ubicacion?.comuna ?? null,
  ciudad: a.ubicacion?.ciudad ?? null,
  publicadoEn: a.publicadoEn ?? null,
  foto: null,
  _fotoRemota: a.fotoPrincipalUrl ?? null,
});

/**
 * Una historia junta el caso (dónde y cuándo se rescató, sus hitos, cómo
 * terminó) con la ficha de adopción si la hubo (nombre, foto de después).
 * Se omite a propósito `ubicacion.referencia`: suele ser una dirección exacta,
 * a veces la casa de quien dio el aviso. Comuna y región bastan para contar
 * la historia.
 */
function armarHistoria(caso, adopcion) {
  return {
    id: caso.id,
    nombre: nombreReal(adopcion?.nombre) ?? nombreReal(caso.animal?.nombre),
    titulo: caso.titulo ?? null,
    especie: adopcion?.animal?.especie ?? caso.animal?.especie ?? null,
    comuna: caso.ubicacion?.comuna ?? adopcion?.ubicacion?.comuna ?? null,
    region: caso.ubicacion?.region ?? null,
    rescatadoEn: caso.creadoEn ?? null,
    resueltoEn: caso.resueltoEn ?? adopcion?.adoptadoEn ?? null,
    adoptado: Boolean(adopcion),
    comoLlego: sinContacto(caso.descripcion),
    historia: sinContacto(adopcion?.historia),
    final: sinContacto(caso.notasDeCierre),
    foto: null,
    fotoFinal: null,
    hitos: (caso.hitos || []).map((h) => ({
      tipo: h.tipo ?? "other",
      titulo: h.titulo ?? null,
      descripcion: sinContacto(h.descripcion),
      fecha: h.fecha ?? null,
      foto: null,
      _fotoRemota: Array.isArray(h.fotosUrls) ? h.fotosUrls[0] ?? null : null,
      _id: h.id,
    })),
    // la foto del caso suele ser la del rescate (el antes) y la de la ficha
    // de adopción, la del después; si falta una se usa la otra
    _fotoRemota: caso.fotoPrincipalUrl ?? adopcion?.fotoPrincipalUrl ?? null,
    _fotoFinalRemota: caso.fotoPrincipalUrl ? adopcion?.fotoPrincipalUrl ?? null : null,
  };
}

/* ---------- fotos ---------- */

/**
 * Descarga una foto al repositorio, con un nombre fijo por id.
 * Se guardan localmente en vez de enlazar a la API en caliente: la API exige
 * la llave también para las imágenes, y así la web no depende de que la API
 * esté arriba para mostrar una foto.
 *
 * Si la foto ya está optimizada (.webp con ese nombre) no se vuelve a bajar:
 * la Action corre cada 6 horas y no tiene sentido reprocesar las mismas
 * fotos cada vez.
 */
async function bajarFoto(url, base) {
  if (!url) return null;
  const lista = `img/casos/${base}.webp`;
  if (!TODAS_LAS_FOTOS && existsSync(resolve(RAIZ, lista))) return lista;

  try {
    // La API responde 302 al bucket cuando la foto vive en Google Cloud
    // Storage. La redirección se sigue a mano porque fetch conserva las
    // cabeceras propias al saltar de origen, y la llave acabaría en los logs
    // de un host que no es MascotaApp.
    let actual = url;
    let r = await traer(actual, { headers: cabecerasPara(actual), redirect: "manual" });
    for (let saltos = 0; r.status >= 300 && r.status < 400 && saltos < 4; saltos += 1) {
      const destino = r.headers.get("location");
      if (!destino) break;
      actual = new URL(destino, actual).href;
      r = await fetch(actual, { headers: cabecerasPara(actual), redirect: "manual" });
    }

    if (!r.ok) {
      fallos.push({ ruta: `foto ${base}`, detalle: `HTTP ${r.status}` });
      return null;
    }
    const tipo = r.headers.get("content-type") || "";
    if (!tipo.startsWith("image/")) {
      fallos.push({ ruta: `foto ${base}`, detalle: `no es una imagen (${tipo || "sin tipo"})` });
      return null;
    }
    const ext = tipo.includes("png") ? ".png" : tipo.includes("webp") ? ".webp" : ".jpg";
    const archivo = `${base}${ext}`;
    await writeFile(resolve(FOTOS, archivo), Buffer.from(await r.arrayBuffer()));
    return `img/casos/${archivo}`;
  } catch (e) {
    fallos.push({ ruta: `foto ${base}`, detalle: e.message });
    return null;
  }
}

/* ---------- escritura ---------- */

/** JSON sin los campos internos (los que empiezan por "_"). */
const aJSON = (datos, sinSellos = false) =>
  JSON.stringify(
    datos,
    (k, v) =>
      k.startsWith("_") || (sinSellos && (k === "generado" || k === "actualizadoEn"))
        ? undefined
        : v,
    sinSellos ? 0 : 2
  );

/**
 * Escribe sólo si algo cambió de verdad. Sin esto, la marca de tiempo haría
 * que cada pasada de la Action generara un commit aunque los datos fueran
 * idénticos.
 */
async function guardar(nombre, datos) {
  const ruta = resolve(DATOS, nombre);
  try {
    const previo = JSON.parse(await readFile(ruta, "utf8"));
    if (aJSON(previo, true) === aJSON(datos, true)) {
      console.log(`  = data/${nombre} (sin cambios)`);
      return;
    }
  } catch {}
  await writeFile(ruta, aJSON({ generado: new Date().toISOString(), ...datos }) + "\n", "utf8");
  console.log(`  ✓ data/${nombre}`);
}

/**
 * AVISA (no borra) de las fotos que ya no menciona ningún JSON: animales que
 * salieron del catálogo, o los nombres por posición de la versión anterior
 * (adopcion-1, adopcion-2…). Borrarlas o no lo decide la fundación: el
 * script no elimina nada por su cuenta.
 */
async function avisarFotosSinUso() {
  const usadas = new Set();
  for (const archivo of ["adopciones.json", "historias.json", "casos-ayuda.json", "casos-exito.json"]) {
    try {
      const texto = await readFile(resolve(DATOS, archivo), "utf8");
      for (const m of texto.matchAll(/img\/casos\/([^"/]+?)\.(?:webp|jpe?g|png)/g)) usadas.add(m[1]);
    } catch {}
  }
  if (!usadas.size) return;

  const sobran = (await readdir(FOTOS)).filter((f) => {
    const base = f.replace(/\.(webp|jpe?g|png)$/i, "");
    return base !== f && !usadas.has(base);
  });
  if (sobran.length) {
    console.log(`\n  i ${sobran.length} foto(s) en img/casos que ningún JSON usa (no se borran):`);
    for (const f of sobran) console.log(`      img/casos/${f}`);
  }
}

/* ---------- conjuntos ---------- */

async function traerAdopciones() {
  const res = await pedirTodo(`/foundations/${SLUG}/adoptions?status=available`, MAX_ADOPCIONES);
  if (!res) return;
  const animales = res.filas.map(soloAdopcion);
  for (const a of animales) a.foto = await bajarFoto(a._fotoRemota, `adopcion-${a.id}`);
  await guardar("adopciones.json", { total: animales.length, animales });
}

async function traerHistorias() {
  const resueltos = await pedir(
    `/foundations/${SLUG}/cases?status=resolved&limit=${MAX_HISTORIAS}`
  );
  const adoptados = await pedir(
    `/foundations/${SLUG}/adoptions?status=adopted&limit=${MAX_HISTORIAS}`
  );
  if (!resueltos?.data || !adoptados?.data) return;

  const adopcionDelCaso = new Map(
    adoptados.data.filter((a) => a.casoId).map((a) => [a.casoId, a])
  );

  // Candidatos: los casos resueltos y, además, los casos de adopciones
  // concretadas que no figuren como resueltos (un caso puede quedar cerrado o
  // en seguimiento después de que el animal encontró familia).
  const ids = resueltos.data.map((c) => c.id);
  for (const a of adoptados.data) if (a.casoId && !ids.includes(a.casoId)) ids.push(a.casoId);

  const historias = [];
  for (const id of ids) {
    const detalle = await pedir(`/foundations/${SLUG}/cases/${id}`);
    const caso = detalle?.data ?? resueltos.data.find((c) => c.id === id);
    if (!caso) continue;
    historias.push(armarHistoria(caso, adopcionDelCaso.get(id) ?? null));
  }

  const cuando = (h) => Date.parse(h.resueltoEn ?? h.rescatadoEn ?? 0) || 0;
  historias.sort((a, b) => cuando(b) - cuando(a));
  const elegidas = historias.slice(0, MAX_HISTORIAS);

  for (const h of elegidas) {
    h.foto = await bajarFoto(h._fotoRemota, `historia-${h.id}`);
    h.fotoFinal = await bajarFoto(h._fotoFinalRemota, `historia-${h.id}-final`);
    let conFoto = 0;
    for (const hito of h.hitos) {
      if (!hito._fotoRemota || conFoto >= MAX_FOTOS_DE_HITOS) continue;
      hito.foto = await bajarFoto(hito._fotoRemota, `hito-${hito._id}`);
      if (hito.foto) conFoto += 1;
    }
  }

  await guardar("historias.json", { total: elegidas.length, historias: elegidas });
}

async function main() {
  await mkdir(DATOS, { recursive: true });
  await mkdir(FOTOS, { recursive: true });

  console.log(`API  : ${BASE}`);
  console.log(`Slug : ${SLUG}`);
  if (TODAS_LAS_FOTOS) console.log("Fotos: se vuelven a bajar todas");
  console.log("");

  // --- ficha ---
  const ficha = await pedir(`/foundations/${SLUG}`);
  if (ficha?.data) {
    await guardar("fundacion.json", {
      nombre: ficha.data.nombre,
      descripcion: ficha.data.descripcion,
      email: ficha.data.contacto?.email ?? null,
      telefono: ficha.data.contacto?.telefono ?? null,
    });
  }

  // --- cifras ---
  const stats = await pedir(`/foundations/${SLUG}/stats`);
  if (stats?.data) await guardar("cifras.json", { cifras: stats.data });

  // --- casos destacados, con sus fotos ---
  // Las fotos van por id y no por posición (help-1, help-2…): como el script
  // ya no vuelve a bajar una foto que existe, con nombres por posición un caso
  // nuevo heredaría la foto del anterior.
  for (const [destacado, archivo] of [
    ["help", "casos-ayuda.json"],
    ["success", "casos-exito.json"],
  ]) {
    const res = await pedir(`/foundations/${SLUG}/cases?featured=${destacado}&limit=6`);
    if (!res?.data) continue;
    const casos = res.data.map(soloCaso);
    for (const c of casos) {
      c.foto = await bajarFoto(c.fotoRemota, `${destacado}-${c.id}`);
    }
    await guardar(archivo, { total: res.paginacion?.total ?? casos.length, casos });
  }

  await traerAdopciones();
  await traerHistorias();
  await avisarFotosSinUso();

  // --- resumen ---
  if (stats?.data) {
    const c = stats.data;
    console.log(
      `\n${c.casos?.total ?? "?"} casos · ` +
        `${c.voluntarios?.activos ?? "?"} voluntarios · ` +
        `${c.esterilizaciones?.realizadas ?? "?"} esterilizaciones · ` +
        `${c.adopciones?.concretadas ?? "?"} adopciones`
    );
  }

  // Las fotos llegan como salen del teléfono: ~900x1200 y hasta 250 KB.
  console.log(
    "\nSiguiente paso obligatorio:\n" +
      "  python scripts/optimizar-fotos.py\n" +
      "  (reduce las fotos nuevas y actualiza las rutas en data/)"
  );

  if (fallos.length) {
    console.log(`\n${fallos.length} fallo(s):`);
    for (const f of fallos) console.log(`  ✗ ${f.ruta}\n      ${f.detalle}`);
    console.log(
      "\nUn 401 es la llave (falta, o se rotó en Cloud Run). Un 500 significa\n" +
        "que la llave se aceptó y el error está dentro del servidor de\n" +
        "MascotaApp: revisa los logs de Cloud Run para esa ruta."
    );
    process.exitCode = 1;
  } else {
    console.log("\nSin fallos.");
  }
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(1);
});
