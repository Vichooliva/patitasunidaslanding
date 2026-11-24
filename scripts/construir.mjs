/**
 * Construye el sitio para Cloudflare Pages.
 *
 * En Cloudflare (Workers & Pages → el proyecto → Settings → Build):
 *   Build command:           node scripts/construir.mjs
 *   Build output directory:  dist
 *   Variable secreta:        MASCOTAAPP_API_KEY
 *
 * QUÉ HACE, EN ORDEN
 *   1. Si hay llave, trae datos frescos de MascotaApp (scripts/traer-datos.mjs).
 *   2. Optimiza las fotos nuevas (scripts/optimizar-fotos.py, con Pillow).
 *   3. Copia a dist/ sólo lo que es sitio.
 *
 * Los datos frescos van a dist/ y NO vuelven al repositorio: cada publicación
 * los trae de nuevo. El data/ del repositorio queda como respaldo: si la API
 * falla, se publica con lo que haya en vez de dejar la web caída.
 *
 * Lo que publica Cloudflare cada 6 horas lo dispara el Worker de
 * cloudflare/reconstruir-cada-6h.js llamando al "deploy hook" del proyecto.
 */

import { spawnSync } from "node:child_process";
import { cpSync, readdirSync, rmSync, mkdirSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = resolve(RAIZ, "dist");

/* Lo que no es sitio. Antes, en GitHub Pages, Jekyll ya ignoraba lo que
   empieza por "_" o "." (_seleccion.html, img/_sin-tono): aquí se replica. */
const FUERA_EN_LA_RAIZ = new Set(["scripts", "cloudflare", "node_modules", "dist", "README.md"]);
const seExcluye = (nombre) => nombre.startsWith("_") || nombre.startsWith(".");

function correr(comando, args) {
  console.log(`\n$ ${comando} ${args.join(" ")}`);
  const r = spawnSync(comando, args, { cwd: RAIZ, stdio: "inherit", env: process.env });
  return !r.error && r.status === 0;
}

function pythonDisponible() {
  for (const p of ["python3", "python"]) {
    const r = spawnSync(p, ["--version"], { stdio: "ignore" });
    if (!r.error && r.status === 0) return p;
  }
  return null;
}

/* ---------- 1 y 2: datos y fotos ---------- */

if (process.env.MASCOTAAPP_API_KEY) {
  if (!correr("node", ["scripts/traer-datos.mjs"])) {
    console.log(
      "\nAVISO: traer-datos.mjs terminó con fallos (mira arriba cuáles).\n" +
        "Se publica igual, con los datos que alcanzaron a llegar o los del repositorio."
    );
  }

  const py = pythonDisponible();
  if (!py) {
    console.log("\nAVISO: no hay Python; las fotos nuevas se publican sin optimizar.");
  } else if (
    !correr(py, ["-m", "pip", "install", "--quiet", "--disable-pip-version-check", "Pillow>=11,<12"]) ||
    !correr(py, ["scripts/optimizar-fotos.py"])
  ) {
    console.log("\nAVISO: no se pudieron optimizar las fotos; se publican tal como llegaron.");
  }
} else {
  console.log(
    "Sin MASCOTAAPP_API_KEY: se publica con los datos del repositorio.\n" +
      "(Se agrega en Cloudflare → el proyecto → Settings → Variables and Secrets.)"
  );
}

/* ---------- 3: carpeta del sitio ---------- */

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA);

let archivos = 0;
for (const nombre of readdirSync(RAIZ)) {
  if (FUERA_EN_LA_RAIZ.has(nombre) || seExcluye(nombre)) continue;
  cpSync(resolve(RAIZ, nombre), resolve(SALIDA, nombre), {
    recursive: true,
    filter: (origen) => {
      if (seExcluye(basename(origen))) return false;
      archivos += 1;
      return true;
    },
  });
}

console.log(`\nListo: dist/ con ${archivos} entradas.`);
