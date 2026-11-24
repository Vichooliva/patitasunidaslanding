/* =====================================================================
   FINALES FELICES (portada, sección #historias)

   Arriba, un carrusel de tiras que se abren: la activa se ensancha y se ve a
   color, las demás quedan como lomos de libro. Gira solo hasta que alguien
   lo toca. Abajo, el relato de la activa: dónde la encontraron (un punto
   sobre el largo de Chile), cuántos días pasaron hasta su final feliz (un
   contador) y su línea de tiempo, que se dibuja hito a hito con huellas
   entre uno y otro.

   Los datos salen de data/historias.json: casos resueltos y adopciones
   concretadas, con los hitos públicos que registró la fundación.
   ===================================================================== */

import { leerJSON, recortar, sinMovimiento, tieneNombre, mostrarSeccion } from "./animales.js";

const INTERVALO = 9000; // ms entre historias en el giro automático
const MIN_TIRAS = 12; // el diseño de tiras necesita doce para llenar la fila
const MIN_PARA_GIRAR = 4; // con menos se muestran todas, sin girar

const fecha = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" });

const TIPOS = {
  rescue: "Rescate",
  medical: "Veterinario",
  transport: "Traslado",
  fostering: "Hogar temporal",
  adoption: "Adopción",
  followup: "Seguimiento",
  fundraising: "Colecta",
  other: "Hito",
  fin: "Final feliz",
};

/* ---------- dónde: el largo de Chile ----------
   Latitud de la capital de cada región. Basta para poner un punto sobre una
   franja vertical que va de Arica (-17,5) al cabo de Hornos (-56). */

const LAT_NORTE = -17.5;
const LAT_SUR = -56;

const REGIONES = [
  ["arica", -18.48],
  ["tarapaca", -20.21],
  ["antofagasta", -23.65],
  ["atacama", -27.37],
  ["coquimbo", -29.9],
  ["valparaiso", -33.05],
  ["metropolitana", -33.45],
  ["santiago", -33.45],
  ["higgins", -34.17],
  ["maule", -35.43],
  ["nuble", -36.61],
  ["biobio", -36.83],
  ["bio bio", -36.83],
  ["araucania", -38.74],
  ["los rios", -39.81],
  ["los lagos", -41.47],
  ["aysen", -45.57],
  ["aisen", -45.57],
  ["magallanes", -53.16],
];

const REFERENCIAS = [
  ["Arica", -18.48],
  ["Santiago", -33.45],
  ["Puerto Montt", -41.47],
  ["Punta Arenas", -53.16],
];

const fraccion = (lat) => (lat - LAT_NORTE) / (LAT_SUR - LAT_NORTE);

/** "Metropolitana" → "Región Metropolitana", "Maule" → "Región del Maule". */
function nombreRegion(region) {
  const r = region.trim();
  if (/^regi[oó]n/i.test(r)) return r;
  if (/^metropolitana/i.test(r)) return "Región Metropolitana";
  if (/^(maule|b[ií]o\s?b[ií]o)$/i.test(r)) return `Región del ${r}`;
  return `Región de ${r}`;
}

function latitudDe(region) {
  const r = (region || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (!r) return null;
  const par = REGIONES.find(([clave]) => r.includes(clave));
  return par ? par[1] : null;
}

/* ---------- datos ---------- */

const ms = (iso) => Date.parse(iso) || null;

function diasEntre(desde, hasta) {
  const a = ms(desde);
  const b = ms(hasta);
  if (!a || !b || b < a) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * La línea de tiempo que se cuenta. Si la fundación no registró el rescate
 * o el final, se completan con las fechas del propio caso —cuándo se abrió y
 * cuándo se resolvió—, que son datos, no adornos.
 */
function armarLinea(h) {
  const hitos = (h.hitos || [])
    .filter((x) => ms(x.fecha))
    .map((x) => ({ ...x }))
    .sort((a, b) => ms(a.fecha) - ms(b.fecha));

  if (h.rescatadoEn && (!hitos.length || hitos[0].tipo !== "rescue")) {
    hitos.unshift({ tipo: "rescue", titulo: "Se abre su caso", fecha: h.rescatadoEn });
  }
  if (h.resueltoEn && !hitos.some((x) => x.tipo === "adoption")) {
    hitos.push({
      tipo: "fin",
      titulo: h.adoptado ? "Encuentra familia" : "Caso resuelto",
      fecha: h.resueltoEn,
    });
    hitos.sort((a, b) => ms(a.fecha) - ms(b.fecha));
  }

  // con muchos hitos se cuenta el principio y el final, que es lo que importa
  return hitos.length > 6 ? [hitos[0], ...hitos.slice(-5)] : hitos;
}

function normalizar(h) {
  return {
    ...h,
    nombre: tieneNombre(h.nombre) ? h.nombre.trim() : h.titulo || "Sin nombre aún",
    dias: diasEntre(h.rescatadoEn, h.resueltoEn),
    lat: latitudDe(h.region),
    linea: armarLinea(h),
  };
}

/* ---------- DOM ---------- */

const el = (etiqueta, clase, texto) => {
  const n = document.createElement(etiqueta);
  if (clase) n.className = clase;
  if (texto != null) n.textContent = texto;
  return n;
};

function crearTira(h, i, copia) {
  const li = el("li", "carrusel-item");
  li.dataset.i = String(i);
  li.tabIndex = copia ? -1 : 0;
  if (copia) li.setAttribute("aria-hidden", "true");
  else li.setAttribute("aria-label", `Historia de ${h.nombre}`);

  const caja = el("div", "carrusel-caja");
  const foto = el("div", "carrusel-foto");
  const img = el("img");
  img.src = h.foto;
  img.alt = "";
  img.width = 480;
  img.height = 720;
  img.loading = "lazy";
  img.decoding = "async";
  img.draggable = false;
  foto.append(img);

  const texto = el("div", "carrusel-texto");
  texto.append(el("h3", "carrusel-nombre", h.nombre));
  const sub = [h.comuna, h.dias != null ? `${h.dias} ${h.dias === 1 ? "día" : "días"}` : null]
    .filter(Boolean)
    .join(" · ");
  if (sub) texto.append(el("p", "carrusel-sub", sub));

  caja.append(foto, texto);
  li.append(caja);
  return li;
}

function crearDonde(h) {
  const donde = el("div", "relato-donde");
  donde.append(el("p", "relato-etiqueta", "Dónde"));

  if (h.lat != null) {
    const chile = el("div", "chile");
    chile.setAttribute("aria-hidden", "true");
    chile.append(el("span", "chile-franja"));
    for (const [nombre, lat] of REFERENCIAS) {
      const ref = el("span", "chile-ref", nombre);
      ref.style.setProperty("--lat", fraccion(lat).toFixed(3));
      chile.append(ref);
    }
    const punto = el("span", "chile-punto");
    punto.style.setProperty("--lat", fraccion(h.lat).toFixed(3));
    chile.append(punto);
    donde.append(chile);
  }

  const lugar = el("p", "relato-lugar");
  if (h.comuna) lugar.append(el("strong", null, h.comuna));
  if (h.region) lugar.append(el("span", null, nombreRegion(h.region)));
  if (!lugar.children.length) lugar.append(el("span", null, "Chile"));
  donde.append(lugar);
  return donde;
}

function crearLinea(h) {
  const ol = el("ol", "relato-hitos");
  ol.style.setProperty("--n", String(h.linea.length));

  h.linea.forEach((hito, i) => {
    const li = el("li", "hito");
    li.dataset.tipo = hito.tipo;
    li.style.setProperty("--i", String(i));

    li.append(el("span", "hito-punto"));

    const cabeza = el("p", "hito-tipo");
    cabeza.append(el("span", null, TIPOS[hito.tipo] || TIPOS.other));
    if (hito.fecha) {
      const t = el("time", null, fecha.format(new Date(hito.fecha)));
      t.dateTime = hito.fecha;
      cabeza.append(t);
    }
    li.append(cabeza);

    if (hito.titulo) li.append(el("p", "hito-titulo", hito.titulo));
    if (hito.descripcion) li.append(el("p", "hito-desc", recortar(hito.descripcion, 150)));
    if (hito.foto) {
      const img = el("img", "hito-foto");
      img.src = hito.foto;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      li.append(img);
    }

    // huellas hasta el siguiente hito: el camino que recorrió
    if (i < h.linea.length - 1) {
      const huellas = el("span", "huellas");
      huellas.setAttribute("aria-hidden", "true");
      huellas.append(el("i"), el("i"), el("i"));
      li.append(huellas);
    }
    ol.append(li);
  });
  return ol;
}

function crearRelato(h) {
  const frag = document.createDocumentFragment();

  const cabeza = el("header", "relato-cabeza");
  cabeza.append(el("p", "relato-etiqueta", h.adoptado ? "Final feliz · adoptado" : "Final feliz"));
  cabeza.append(el("h3", "relato-nombre", h.nombre));
  if (h.dias != null) {
    const dias = el("p", "relato-dias");
    const n = el("strong", null, String(h.dias));
    n.dataset.dias = String(h.dias);
    dias.append(n, el("span", null, `${h.dias === 1 ? "día" : "días"} ${h.adoptado ? "de la calle a un hogar" : "hasta su final feliz"}`));
    cabeza.append(dias);
  }

  const textos = el("div", "relato-textos");
  if (h.comoLlego) {
    const fig = el("figure", "relato-cita");
    fig.append(el("figcaption", "relato-etiqueta", "Así llegó"));
    fig.append(el("blockquote", null, recortar(h.comoLlego, 320)));
    textos.append(fig);
  }
  const final = h.final || h.historia;
  if (final) {
    const fig = el("figure", "relato-cita relato-cita-final");
    fig.append(el("figcaption", "relato-etiqueta", "Así terminó"));
    fig.append(el("blockquote", null, recortar(final, 320)));
    textos.append(fig);
  }
  if (h.fotoFinal) {
    const img = el("img", "relato-despues");
    img.src = h.fotoFinal;
    img.alt = `${h.nombre}, hoy`;
    img.loading = "lazy";
    img.decoding = "async";
    textos.append(img);
  }

  frag.append(cabeza, crearDonde(h), crearLinea(h));
  if (textos.children.length) frag.append(textos);
  return frag;
}

/** El contador de días sube de 0 a n. Es la cifra que cuenta la historia. */
function animarContador(nodo) {
  if (!nodo) return;
  const fin = Number(nodo.dataset.dias) || 0;
  if (sinMovimiento() || fin === 0) return;
  const dur = Math.min(1600, 500 + fin * 12);
  const inicio = performance.now();
  nodo.textContent = "0";
  const paso = (t) => {
    if (!nodo.isConnected) return;
    const x = Math.min(1, (t - inicio) / dur);
    nodo.textContent = String(Math.round(fin * (1 - Math.pow(1 - x, 3))));
    if (x < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/* ---------- montaje ---------- */

async function montar() {
  const seccion = document.getElementById("historias");
  const carrusel = seccion?.querySelector("[data-carrusel]");
  const lista = carrusel?.querySelector("[data-carrusel-lista]");
  const relato = seccion?.querySelector("[data-relato]");
  if (!lista || !relato) return;

  const datos = await leerJSON("data/historias.json");
  const historias = (datos?.historias || []).filter((h) => h.foto).map(normalizar);
  if (!historias.length) return; // sin historias todavía: la sección no aparece

  const gira = historias.length >= MIN_PARA_GIRAR;
  carrusel.classList.toggle("is-pocas", !gira);

  // El diseño de tiras necesita doce para llenar la fila: con menos
  // historias se repiten (ocultas al lector de pantalla). La fila es un
  // bucle, así que la repetición no se nota como tal.
  const tiras = [];
  const total = gira ? Math.max(MIN_TIRAS, historias.length) : historias.length;
  for (let k = 0; k < total; k += 1) {
    tiras.push(crearTira(historias[k % historias.length], k % historias.length, k >= historias.length));
  }
  lista.replaceChildren(...tiras);

  mostrarSeccion(seccion);

  /* ---------- carrusel ---------- */

  let actual = -1;
  let auto = null;
  let detenido = sinMovimiento(); // tras tocarlo, ya no gira solo
  let enPantalla = false;
  let programatico = false;

  const items = () => Array.from(lista.children);
  const indiceActivo = () => items().findIndex((n) => n.hasAttribute("data-activo"));
  const estrecho = () => window.matchMedia("(max-width: 600px)").matches;

  function contar(k) {
    if (k === actual) return;
    actual = k;
    relato.replaceChildren(crearRelato(historias[k]));
    animarContador(relato.querySelector("[data-dias]"));
  }

  function activar(item) {
    if (!item) return;
    items().forEach((n) => n.toggleAttribute("data-activo", n === item));
    // El foco sólo se mueve si ya estaba dentro de la fila. El original lo
    // movía siempre, y con el giro automático la página saltaba al carrusel
    // aunque estuvieras leyendo otra sección.
    if (lista.contains(document.activeElement) && document.activeElement !== item) {
      programatico = true;
      item.focus({ preventScroll: true });
      programatico = false;
    }
    contar(Number(item.dataset.i));
  }

  function siguiente() {
    if (!gira) {
      const todos = items();
      activar(todos[(indiceActivo() + 1) % todos.length]);
      return;
    }
    const i = indiceActivo();
    lista.append(lista.firstElementChild);
    activar(items()[i]);
  }

  function anterior() {
    if (!gira) {
      const todos = items();
      activar(todos[(indiceActivo() - 1 + todos.length) % todos.length]);
      return;
    }
    const i = indiceActivo();
    lista.prepend(lista.lastElementChild);
    activar(items()[i]);
  }

  /** Elegir una tira: si es la del borde, la fila corre un paso. */
  function elegir(item) {
    if (!gira) {
      activar(item);
      return;
    }
    const max = estrecho() ? 5 : 8;
    const i = items().indexOf(item);
    if (i < 3 || i > max) return;
    if (i === max) siguiente();
    if (i === 3) anterior();
    activar(item);
  }

  /* ---------- giro automático ---------- */

  const parar = () => {
    window.clearInterval(auto);
    auto = null;
  };
  const arrancar = () => {
    if (auto || detenido || !enPantalla || document.hidden) return;
    auto = window.setInterval(siguiente, INTERVALO);
  };
  const tocado = () => {
    detenido = true;
    parar();
  };

  carrusel.querySelector("[data-carrusel-siguiente]")?.addEventListener("click", () => {
    tocado();
    siguiente();
  });
  carrusel.querySelector("[data-carrusel-anterior]")?.addEventListener("click", () => {
    tocado();
    anterior();
  });

  lista.addEventListener("focusin", (e) => {
    if (programatico) return;
    const item = e.target.closest(".carrusel-item");
    if (!item) return;
    tocado();
    elegir(item);
  });
  // Safari no enfoca al hacer clic: sin esto, allí no se podría elegir
  lista.addEventListener("click", (e) => {
    const item = e.target.closest(".carrusel-item");
    if (!item || item.hasAttribute("data-activo")) return;
    tocado();
    elegir(item);
  });
  lista.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      tocado();
      anterior();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      tocado();
      siguiente();
    }
  });

  // mientras el ratón está encima se lee: no se cambia la historia
  seccion.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse") parar();
  });
  seccion.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") arrancar();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entrada]) => {
        enPantalla = entrada.isIntersecting;
        if (enPantalla) arrancar();
        else parar();
      },
      { threshold: 0.35 }
    ).observe(carrusel);
  }
  document.addEventListener("visibilitychange", () => (document.hidden ? parar() : arrancar()));

  // La activa empieza en la quinta tira, como en el diseño: deja una tira
  // estrecha a la izquierda para que se entienda que hay más hacia atrás.
  activar(gira ? items()[4] : items()[0]);
}

montar();
