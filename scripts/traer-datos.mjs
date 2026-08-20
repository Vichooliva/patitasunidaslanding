/**
 * Trae datos y fotos de la API pública de MascotaApp y los deja como archivos
 * estáticos, para que la web los use sin exponer la llave.
 *
 * POR QUÉ ASÍ
 * La API exige la cabecera X-API-Key. Este sitio es estático y no tiene
 * servidor donde esconder un secreto: si el navegador hiciera la petición, la
 * llave viajaría en el código fuente. Así que la petición se hace AQUÍ, en tu
 * máquina o en CI, y al repositorio sólo llega el resultado.
 *
 * USO
 *   $env:MASCOTAAPP_API_KEY = "la_llave"     (PowerShell)
 *   node scripts/traer-datos.mjs
 *
 * Cada endpoint se pide por separado y un fallo no aborta el resto: si uno
 * devuelve 500, verás cuál fue y con qué cuerpo, y los demás datos igual se
 * descargan.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://mascotaapp.cl/api/public/v1";
const SLUG = process.env.MASCOTAAPP_SLUG || "patitas-unidas";
const LLAVE = process.env.MASCOTAAPP_API_KEY;

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATOS = resolve(RAIZ, "data");
const FOTOS = resolve(RAIZ, "img", "casos");

if (!LLAVE) {
  console.error(
    'Falta MASCOTAAPP_API_KEY.\n  $env:MASCOTAAPP_API_KEY = "la_llave"'
  );
  process.exit(1);
}

const cabeceras = { "X-API-Key": LLAVE, Accept: "application/json" };
const fallos = [];

/** Pide una ruta. Nunca lanza: devuelve null y anota el fallo. */
async function pedir(ruta) {
  let r;
  try {
    r = await fetch(BASE + ruta, { headers: cabeceras });
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

/* Lista blanca de campos: copiamos sólo lo que la web pinta, para que un campo
   nuevo con datos sensibles no acabe en el repositorio por inercia. */

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
  nombre: a.nombre ?? null,
  especie: a.especie ?? null,
  sexo: a.sexo ?? null,
  historia: a.historia ?? null,
  personalidad: a.personalidad ?? null,
  salud: a.salud ?? null,
  convivencia: a.convivencia ?? null,
  comuna: a.ubicacion?.comuna ?? null,
  fotoRemota: a.fotoPrincipalUrl ?? null,
  foto: null,
});

/**
 * Descarga una foto al repositorio.
 * Se guardan localmente en vez de enlazar a la API en caliente: así la web no
 * depende de que la API esté arriba para mostrar una imagen, y las fotos siguen
 * cargando aunque cambie la llave o el endpoint.
 */
async function bajarFoto(url, nombre) {
  if (!url) return null;
  try {
    const r = await fetch(url, { headers: cabeceras, redirect: "follow" });
    if (!r.ok) {
      fallos.push({ ruta: `foto ${nombre}`, detalle: `HTTP ${r.status}` });
      return null;
    }
    const tipo = r.headers.get("content-type") || "";
    const ext = tipo.includes("png")
      ? ".png"
      : tipo.includes("webp")
      ? ".webp"
      : extname(new URL(url).pathname) || ".jpg";
    const archivo = `${nombre}${ext}`;
    await writeFile(resolve(FOTOS, archivo), Buffer.from(await r.arrayBuffer()));
    return `img/casos/${archivo}`;
  } catch (e) {
    fallos.push({ ruta: `foto ${nombre}`, detalle: e.message });
    return null;
  }
}

async function guardar(nombre, datos) {
  await writeFile(
    resolve(DATOS, nombre),
    JSON.stringify({ generado: new Date().toISOString(), ...datos }, null, 2) + "\n",
    "utf8"
  );
  console.log(`  ✓ data/${nombre}`);
}

async function main() {
  await mkdir(DATOS, { recursive: true });
  await mkdir(FOTOS, { recursive: true });

  console.log(`API  : ${BASE}`);
  console.log(`Slug : ${SLUG}\n`);

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

  // --- casos, con sus fotos ---
  for (const [destacado, archivo] of [
    ["help", "casos-ayuda.json"],
    ["success", "casos-exito.json"],
  ]) {
    const res = await pedir(`/foundations/${SLUG}/cases?featured=${destacado}&limit=6`);
    if (!res?.data) continue;
    const casos = res.data.map(soloCaso);
    for (const [i, c] of casos.entries()) {
      c.foto = await bajarFoto(c.fotoRemota, `${destacado}-${i + 1}`);
    }
    await guardar(archivo, { total: res.paginacion?.total ?? casos.length, casos });
  }

  // --- animales en adopción ---
  const ad = await pedir(`/foundations/${SLUG}/adoptions?status=available&limit=12`);
  if (ad?.data) {
    const animales = ad.data.map(soloAdopcion);
    for (const [i, a] of animales.entries()) {
      a.foto = await bajarFoto(a.fotoRemota, `adopcion-${i + 1}`);
    }
    await guardar("adopciones.json", {
      total: ad.paginacion?.total ?? animales.length,
      animales,
    });
  }

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

  if (fallos.length) {
    console.log(`\n${fallos.length} fallo(s):`);
    for (const f of fallos) console.log(`  ✗ ${f.ruta}\n      ${f.detalle}`);
    console.log(
      "\nUn 500 significa que la llave se aceptó y el error está dentro del\n" +
        "servidor de MascotaApp: revisa los logs de Cloud Run para esa ruta."
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
