/* =====================================================================
   ANILLO 3D DE ADOPCIÓN (portada, sección #adopta)

   Las fotos van montadas en el interior de un cilindro y se ven desde
   dentro: la del centro queda al fondo y las de los lados se acercan. Gira
   solo, se arrastra con el dedo o el ratón (con inercia al soltar) y cada
   foto se desliza dentro de su marco según el ángulo, como una ventana.

   Sin librerías: cada tarjeta recibe su rotateY() en cada frame. Son doce
   transforms, que el navegador compone en GPU, y el bucle se detiene cuando
   el anillo sale de pantalla o no hay nada que mover.
   ===================================================================== */

import { cargarAnimales, abrirFicha, barajar, sinMovimiento, mostrarSeccion } from "./animales.js";

const MAX_TARJETAS = 12; // hay más en adopta.html; aquí, los justos para girar
const MIN_RANURAS = 8; // con menos animales el anillo tendría huecos: se repiten
const VEL_AUTO = 7; // grados por segundo
const UMBRAL_ARRASTRE = 6; // px antes de tomarlo como arrastre y no como toque
const PAUSA_TRAS_ARRASTRE = 2600; // ms quieto antes de volver a girar solo

/** Ángulo en (-180, 180]. */
const envolver = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

async function montar() {
  const seccion = document.getElementById("adopta");
  const anillo = seccion?.querySelector("[data-anillo]");
  const rueda = anillo?.querySelector("[data-rueda]");
  if (!rueda) return;

  const datos = await cargarAnimales();
  const conFoto = (datos?.animales || []).filter((a) => a.foto);
  if (!conFoto.length) return; // sin datos la sección se queda oculta

  // Al azar en cada visita: con un orden fijo siempre salían los mismos al
  // frente y el resto no lo veía nadie.
  const elegidos = barajar(conFoto).slice(0, MAX_TARJETAS);
  const N = Math.max(MIN_RANURAS, elegidos.length);
  const PASO = 360 / N;

  const tarjetas = Array.from({ length: N }, (_, i) =>
    crearTarjeta(elegidos[i % elegidos.length], i >= elegidos.length)
  );
  rueda.replaceChildren(...tarjetas.map((t) => t.el));

  seccion.querySelectorAll("[data-total]").forEach((n) => {
    n.textContent = String(datos.total);
  });
  mostrarSeccion(seccion);

  /* ---------- estado ---------- */

  let rot = 0; // giro del anillo en grados
  let vel = 0; // inercia, en grados por ms
  let velAuto = 0; // giro automático actual, en grados por s (arranca suave)
  let objetivo = null; // giro hacia el que se anima (al enfocar con teclado)
  let reanudarEn = 0;
  const pausas = new Set(); // "raton", "foco", "ficha"

  let radio = 0;
  let juego = 0; // cuánto se desliza la foto dentro del marco, en px
  let gradosPorPx = 0;
  let frente = null;

  let enPantalla = false;
  let corriendo = false;
  let ultimo = 0;

  /* ---------- geometría ---------- */

  function medir() {
    const ancho = anillo.clientWidth || window.innerWidth;
    const w = ancho < 640 ? Math.min(210, ancho * 0.5) : limitar(ancho * 0.19, 200, 270);
    const h = Math.round(w * 1.32);
    // radio con el que las tarjetas casi se tocan: cuerda = 2r·sen(π/N)
    radio = Math.round((w / 2 / Math.sin(Math.PI / N)) * 1.05);
    const perspectiva = Math.round(radio * 3);
    juego = w * 0.14; // la foto mide el 128 % del marco: 14 % de juego por lado

    // Al arrastrar, la tarjeta del centro sigue al dedo: se descuenta la
    // escala con que la perspectiva la encoge allá al fondo.
    const escalaCentro = perspectiva / (perspectiva + radio);
    gradosPorPx = 180 / Math.PI / (radio * escalaCentro);

    anillo.style.setProperty("--tarjeta-ancho", `${Math.round(w)}px`);
    anillo.style.setProperty("--tarjeta-alto", `${h}px`);
    anillo.style.setProperty("--perspectiva", `${perspectiva}px`);
  }

  function pintar() {
    let mejor = null;
    let menor = Infinity;

    for (let i = 0; i < N; i += 1) {
      const t = tarjetas[i];
      const th = envolver(rot + i * PASO);
      const abs = Math.abs(th);
      const visible = abs < 96; // pasado 90° da la espalda: ni se pinta

      if (visible !== t.visible) {
        t.el.style.visibility = visible ? "" : "hidden";
        t.visible = visible;
      }
      if (!visible) continue;

      t.el.style.transform = `rotateY(${th.toFixed(3)}deg) translateZ(${-radio}px)`;
      t.el.style.setProperty("--px", `${((th / 90) * juego).toFixed(2)}px`);
      // las de los extremos se oscurecen: el ojo va al centro
      t.el.style.setProperty("--sombra", (Math.pow(abs / 90, 1.6) * 0.72).toFixed(3));

      if (!t.copia && abs < menor) {
        menor = abs;
        mejor = t;
      }
    }

    // Tab entra siempre por la tarjeta que está al frente (tabindex móvil):
    // doce paradas de tabulador seguidas serían un muro.
    if (mejor && mejor !== frente && !anillo.contains(document.activeElement)) {
      if (frente) frente.boton.tabIndex = -1;
      mejor.boton.tabIndex = 0;
      frente = mejor;
    }
  }

  /* ---------- bucle ---------- */

  const velocidadDeseada = () =>
    sinMovimiento() || pausas.size || performance.now() < reanudarEn ? 0 : VEL_AUTO;

  function avanzar(dt) {
    if (presionado && arrastrando) return; // manda el dedo

    if (objetivo !== null) {
      const d = envolver(objetivo - rot);
      if (sinMovimiento() || Math.abs(d) < 0.05) {
        rot = objetivo;
        objetivo = null;
      } else {
        rot += d * (1 - Math.pow(0.002, dt / 1000));
      }
      return;
    }

    if (Math.abs(vel) > 0.00005) {
      rot += vel * dt;
      vel *= Math.pow(0.95, dt / 16.67);
      return;
    }
    vel = 0;

    const deseada = velocidadDeseada();
    velAuto += (deseada - velAuto) * (1 - Math.pow(0.03, dt / 1000));
    if (deseada === 0 && velAuto < 0.02) velAuto = 0;
    rot += (velAuto * dt) / 1000;
  }

  const hayMovimiento = () =>
    presionado || objetivo !== null || vel !== 0 || velAuto !== 0 || velocidadDeseada() > 0;

  function frame(t) {
    const dt = Math.min(50, t - ultimo);
    ultimo = t;
    avanzar(dt);
    rot = envolver(rot);
    pintar();
    if (enPantalla && !document.hidden && hayMovimiento()) {
      requestAnimationFrame(frame);
    } else {
      corriendo = false;
    }
  }

  function despertar() {
    if (corriendo || !enPantalla || document.hidden) return;
    corriendo = true;
    ultimo = performance.now();
    requestAnimationFrame(frame);
  }

  /* ---------- arrastre ---------- */

  let presionado = false;
  let arrastrando = false;
  let recienArrastrado = false;
  let puntero = null;
  let inicioX = 0;
  let ultimoX = 0;
  let muestras = [];

  anillo.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    presionado = true;
    arrastrando = false;
    puntero = e.pointerId;
    inicioX = ultimoX = e.clientX;
    muestras = [{ x: e.clientX, t: e.timeStamp }];
    vel = 0;
    objetivo = null;
    despertar();
  });

  anillo.addEventListener("pointermove", (e) => {
    if (!presionado || e.pointerId !== puntero) return;
    if (!arrastrando) {
      if (Math.abs(e.clientX - inicioX) < UMBRAL_ARRASTRE) return;
      // La captura se pide recién aquí y no en pointerdown: si se pidiera
      // antes, el clic de un toque simple acabaría en el anillo y no en la
      // tarjeta, y no se abriría la ficha.
      arrastrando = true;
      anillo.setPointerCapture(e.pointerId);
      anillo.classList.add("is-arrastrando");
    }
    rot -= (e.clientX - ultimoX) * gradosPorPx;
    ultimoX = e.clientX;
    muestras.push({ x: e.clientX, t: e.timeStamp });
    if (muestras.length > 8) muestras.shift();
  });

  function soltar(e) {
    if (!presionado || e.pointerId !== puntero) return;
    presionado = false;

    if (arrastrando) {
      anillo.classList.remove("is-arrastrando");
      objetivo = null;
      // velocidad con los últimos 100 ms, no con todo el gesto: es la que
      // lleva el dedo al despegarse
      const recientes = muestras.filter((m) => e.timeStamp - m.t < 100);
      if (!sinMovimiento() && e.type === "pointerup" && recientes.length > 1) {
        const a = recientes[0];
        const b = recientes[recientes.length - 1];
        vel = limitar((-(b.x - a.x) / Math.max(16, b.t - a.t)) * gradosPorPx, -1.4, 1.4);
      }
      reanudarEn = performance.now() + PAUSA_TRAS_ARRASTRE;
      window.setTimeout(despertar, PAUSA_TRAS_ARRASTRE + 50);
      recienArrastrado = true;
      window.setTimeout(() => {
        recienArrastrado = false;
      }, 0);
    }
    arrastrando = false;
    despertar();
  }

  anillo.addEventListener("pointerup", soltar);
  anillo.addEventListener("pointercancel", soltar);

  // un arrastre que termina encima de una tarjeta no es un clic sobre ella
  anillo.addEventListener(
    "click",
    (e) => {
      if (!recienArrastrado) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  /* ---------- pausas ---------- */

  anillo.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    pausas.add("raton");
  });
  anillo.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "mouse") return;
    pausas.delete("raton");
    despertar();
  });

  /* ---------- teclado ---------- */

  const indiceDe = (nodo) => tarjetas.findIndex((t) => t.boton === nodo);

  // Al enfocar una tarjeta con el teclado, el anillo la trae al frente.
  // Sólo con :focus-visible: un clic también enfoca el botón, y si ese clic
  // era el comienzo de un arrastre, el anillo volvería de golpe a esa tarjeta
  // al soltar en vez de seguir su inercia.
  rueda.addEventListener("focusin", (e) => {
    const i = indiceDe(e.target);
    if (i < 0 || !e.target.matches(":focus-visible")) return;
    pausas.add("foco");
    if (frente && frente !== tarjetas[i]) frente.boton.tabIndex = -1;
    frente = tarjetas[i];
    frente.boton.tabIndex = 0;
    objetivo = envolver(-i * PASO);
    vel = 0;
    despertar();
  });
  rueda.addEventListener("focusout", (e) => {
    if (rueda.contains(e.relatedTarget)) return;
    pausas.delete("foco");
    despertar();
  });

  // Flechas: la tarjeta de la derecha es la anterior en el anillo (i - 1),
  // porque al crecer el ángulo las tarjetas se van hacia la izquierda.
  rueda.addEventListener("keydown", (e) => {
    const i = indiceDe(document.activeElement);
    if (i < 0) return;
    const sentido = { ArrowRight: -1, ArrowLeft: 1 }[e.key];
    if (!sentido) return;
    e.preventDefault();
    let j = i;
    do {
      j = (j + sentido + N) % N;
    } while (tarjetas[j].copia && j !== i);
    tarjetas[j].boton.focus({ preventScroll: true });
  });

  /* ---------- ficha ---------- */

  tarjetas.forEach((t) => {
    t.boton.addEventListener("click", () => {
      pausas.add("ficha");
      abrirFicha(t.animal, t.copia ? null : t.boton).then(() => {
        pausas.delete("ficha");
        despertar();
      });
    });
  });

  /* ---------- visibilidad ---------- */

  medir();
  pintar();
  tarjetas.forEach((t) => {
    t.boton.tabIndex = t === frente ? 0 : -1;
  });

  // La entrada escalonada va de izquierda a derecha según donde quedó cada
  // tarjeta, no según su orden en el HTML.
  tarjetas
    .filter((t) => t.visible)
    .map((t) => ({ t, x: -Math.sin(((rot + tarjetas.indexOf(t) * PASO) * Math.PI) / 180) }))
    .sort((a, b) => a.x - b.x)
    .forEach(({ t }, orden) => t.boton.style.setProperty("--orden", orden));

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entrada]) => {
        enPantalla = entrada.isIntersecting;
        if (enPantalla) {
          anillo.classList.add("is-in");
          despertar();
        }
      },
      { threshold: 0.2 }
    ).observe(anillo);
  } else {
    enPantalla = true;
    anillo.classList.add("is-in");
    despertar();
  }

  document.addEventListener("visibilitychange", despertar);

  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      medir();
      pintar();
    }).observe(anillo);
  }
}

function crearTarjeta(animal, copia) {
  const el = document.createElement("div");
  el.className = "anillo-tarjeta";

  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "anillo-boton";
  boton.tabIndex = -1;
  if (copia) {
    // repetición para rellenar el anillo: el lector de pantalla no la oye
    // dos veces, pero con el ratón se puede abrir igual
    boton.setAttribute("aria-hidden", "true");
  } else {
    boton.setAttribute(
      "aria-label",
      `${animal.nombre}${animal.comuna ? `, ${animal.comuna}` : ""}` +
        `${animal.codigo ? `, código ${animal.codigo}` : ""}. Ver su ficha`
    );
  }

  const marco = document.createElement("span");
  marco.className = "anillo-foto";
  const img = document.createElement("img");
  img.src = animal.foto;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  img.draggable = false;
  marco.append(img);

  const texto = document.createElement("span");
  texto.className = "anillo-texto";
  const nombre = document.createElement("strong");
  nombre.textContent = animal.nombre;
  texto.append(nombre);
  if (animal.comuna) {
    const lugar = document.createElement("small");
    lugar.textContent = animal.comuna;
    texto.append(lugar);
  }
  // el código con que se postula en MascotaApp
  if (animal.codigo) {
    const codigo = document.createElement("em");
    codigo.className = "anillo-codigo";
    codigo.textContent = animal.codigo;
    texto.append(codigo);
  }

  boton.append(marco, texto);
  el.append(boton);
  return { el, boton, animal, copia, visible: true };
}

montar();
