/* =====================================================================
   UN TECHO (portada, sección #casitas)

   La ilustración se arma en seis pasos: el perrito bajo la lluvia, alguien
   se fija en él, nos escribe, se dibuja el plano, aparecen la comida y el
   agua (el compromiso) y, al final, se construye la casita.

   Cada pieza del SVG lleva data-desde (y a veces data-hasta): aparece desde
   ese paso y se va después del otro. Aquí sólo se decide qué paso toca; el
   movimiento lo hace el CSS.
   ===================================================================== */

import { leerJSON, sinMovimiento } from "./animales.js";

const DURACION_PASO = 2600; // ms que se queda cada paso en la reproducción
const ULTIMO = 6;

function montar() {
  const raiz = document.querySelector("[data-casitas]");
  if (!raiz) return;

  const pasos = [...raiz.querySelectorAll(".casitas-paso")];
  const capas = [...raiz.querySelectorAll("[data-desde]")];
  const repetir = raiz.querySelector("[data-casitas-repetir]");
  let reloj = null;

  function irA(n) {
    raiz.dataset.paso = String(n);
    for (const p of pasos) {
      const k = Number(p.dataset.n);
      p.classList.toggle("is-activo", k === n);
      p.classList.toggle("is-hecho", k < n);
      const btn = p.querySelector("button");
      if (k === n) btn.setAttribute("aria-current", "step");
      else btn.removeAttribute("aria-current");
    }
    for (const c of capas) {
      const desde = Number(c.dataset.desde);
      const hasta = Number(c.dataset.hasta || ULTIMO);
      c.classList.toggle("is-on", n >= desde && n <= hasta);
    }
    if (repetir) repetir.hidden = n < ULTIMO;
  }

  function parar() {
    window.clearInterval(reloj);
    reloj = null;
    raiz.classList.remove("is-reproduciendo");
  }

  function reproducir() {
    parar();
    raiz.classList.add("is-reproduciendo");
    let n = 1;
    irA(n);
    reloj = window.setInterval(() => {
      n += 1;
      irA(n);
      if (n >= ULTIMO) parar();
    }, DURACION_PASO);
  }

  // tocar un paso lleva a ese paso y detiene la reproducción
  for (const p of pasos) {
    p.querySelector("button").addEventListener("click", () => {
      parar();
      irA(Number(p.dataset.n));
    });
  }
  repetir?.addEventListener("click", () => {
    if (sinMovimiento()) irA(ULTIMO);
    else reproducir();
  });

  // Sin movimiento, o sin IntersectionObserver: la casita ya terminada. Si
  // no, se queda en el primer paso hasta que la sección entra en pantalla y
  // ahí se cuenta sola, una vez.
  if (sinMovimiento() || !("IntersectionObserver" in window)) {
    irA(ULTIMO);
  } else {
    irA(1);
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        reproducir();
      },
      { threshold: 0.45 }
    );
    obs.observe(raiz);
  }

  cifra();
}

/** "N casitas instaladas", sólo si el dato existe y es mayor que cero:
    nunca se inventa un número. */
async function cifra() {
  const caja = document.querySelector("[data-casitas-cifra]");
  if (!caja) return;
  const datos = await leerJSON("data/cifras.json");
  const n = datos?.cifras?.casitas?.instaladas;
  if (typeof n !== "number" || n <= 0) return;
  caja.querySelector("[data-casitas-n]").textContent = new Intl.NumberFormat("es-CL").format(n);
  caja.querySelector("span").textContent = n === 1 ? "casita instalada hasta hoy" : "casitas instaladas hasta hoy";
  caja.hidden = false;
}

montar();
