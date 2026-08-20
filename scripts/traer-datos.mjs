/**
 * Trae datos de la API pública de MascotaApp y los deja como JSON estático
 * en data/, para que la web los lea sin exponer la llave.
 *
 * POR QUÉ ASÍ
 * La API exige la cabecera X-API-Key (comprobado: sin ella responde 401). Este
 * sitio es estático y no tiene servidor donde esconder un secreto: si el
 * navegador hiciera la petición, la llave viajaría en el código fuente y
 * cualquiera podría leerla. Así que la petición se hace AQUÍ, en tu máquina o
 * en CI, y al repositorio sólo llega el resultado ya filtrado.
 *
 * USO
 *   set MASCOTAAPP_API_KEY=la_llave      (PowerShell: $env:MASCOTAAPP_API_KEY="...")
 *   node scripts/traer-datos.mjs
 *
 * La llave NUNCA se escribe en un archivo del repositorio.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://mascotaapp.cl/api/public/v1";
const SLUG = "patitas-unidas";
const LLAVE = process.env.MASCOTAAPP_API_KEY;

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = resolve(RAIZ, "data");

if (!LLAVE) {
  console.error(
    "Falta MASCOTAAPP_API_KEY.\n" +
      "  PowerShell:  $env:MASCOTAAPP_API_KEY = \"la_llave\"\n" +
      "  bash:        export MASCOTAAPP_API_KEY=la_llave"
  );
  process.exit(1);
}

async function pedir(ruta) {
  const r = await fetch(BASE + ruta, { headers: { "X-API-Key": LLAVE } });
  if (r.status === 401) throw new Error(`401 en ${ruta}: la llave no es válida`);
  if (r.status === 429) throw new Error(`429 en ${ruta}: espera ${r.headers.get("retry-after")}s`);
  if (!r.ok) throw new Error(`${r.status} en ${ruta}`);
  return r.json();
}

/* Lista blanca de campos.
   Copiamos sólo lo que la web pinta. Si mañana la API añade un campo con datos
   sensibles, no acaba en el repositorio por accidente. */

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
  foto: c.fotoPrincipalUrl ?? null,
  fotos: c.cantidadDeFotos ?? 0,
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
  foto: a.fotoPrincipalUrl ?? null,
});

async function main() {
  await mkdir(SALIDA, { recursive: true });
  const generado = new Date().toISOString();
  const escritos = [];

  async function guardar(nombre, datos) {
    const ruta = resolve(SALIDA, nombre);
    await writeFile(ruta, JSON.stringify({ generado, ...datos }, null, 2) + "\n", "utf8");
    escritos.push(nombre);
  }

  // --- ficha ---
  const ficha = await pedir(`/foundations/${SLUG}`);
  await guardar("fundacion.json", {
    nombre: ficha.data.nombre,
    descripcion: ficha.data.descripcion,
    email: ficha.data.contacto?.email ?? null,
    telefono: ficha.data.contacto?.telefono ?? null,
    logoUrl: ficha.data.logoUrl ?? null,
  });

  // --- cifras ---
  const stats = await pedir(`/foundations/${SLUG}/stats`);
  await guardar("cifras.json", { cifras: stats.data });

  // --- casos que necesitan ayuda y finales felices ---
  const ayuda = await pedir(`/foundations/${SLUG}/cases?featured=help&limit=6`);
  await guardar("casos-ayuda.json", {
    total: ayuda.paginacion?.total ?? ayuda.data.length,
    casos: ayuda.data.map(soloCaso),
  });

  const exito = await pedir(`/foundations/${SLUG}/cases?featured=success&limit=6`);
  await guardar("casos-exito.json", {
    total: exito.paginacion?.total ?? exito.data.length,
    casos: exito.data.map(soloCaso),
  });

  // --- animales en adopción ---
  const adopciones = await pedir(`/foundations/${SLUG}/adoptions?status=available&limit=12`);
  await guardar("adopciones.json", {
    total: adopciones.paginacion?.total ?? adopciones.data.length,
    animales: adopciones.data.map(soloAdopcion),
  });

  console.log(`Listo. ${escritos.length} archivos en data/:`);
  for (const n of escritos) console.log("  " + n);

  const c = stats.data;
  console.log(
    `\nResumen: ${c.casos?.total ?? "?"} casos · ` +
      `${c.voluntarios?.activos ?? "?"} voluntarios · ` +
      `${c.esterilizaciones?.realizadas ?? "?"} esterilizaciones · ` +
      `${c.adopciones?.concretadas ?? "?"} adopciones`
  );
}

main().catch((e) => {
  console.error("Falló:", e.message);
  process.exit(1);
});
