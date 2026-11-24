/* =====================================================================
   ANIMALES EN ADOPCIÓN — datos y ficha
   Lo comparten la portada (el anillo) y adopta.html (el catálogo con
   filtros), para que los dos digan exactamente lo mismo de cada animal.

   Los datos salen de data/adopciones.json, que genera
   scripts/traer-datos.mjs contra la API de MascotaApp. No se llama a la API
   desde aquí: exige una llave y quedaría a la vista en el código fuente.
   ===================================================================== */

export const CORREO = "fundacionpatitasunidaschile@gmail.com";
export const INSTAGRAM = "https://www.instagram.com/fundacionpatitasunidaschile/";

const movimientoReducido = window.matchMedia("(prefers-reduced-motion: reduce)");
export const sinMovimiento = () => movimientoReducido.matches;

/* ---------- utilidades de texto ----------
   Los datos vienen de personas escribiendo en una app desde el teléfono, así
   que llegan como llegan: "Sin nombre", "macho" o "MACHO", saltos de línea.
   Se limpian aquí en vez de exigirle formato a quien rescata un perro. */

const SIN_NOMBRE = /^(sin nombre|no tiene|s\/n|-+|\?+)$/i;

export function tieneNombre(n) {
  const t = (n || "").trim();
  return Boolean(t) && !SIN_NOMBRE.test(t);
}

export function nombreDigno(n) {
  return tieneNombre(n) ? n.trim() : "Aún sin nombre";
}

/** Sin tildes y en minúsculas, para buscar "Ñuñoa" escribiendo "nunoa". */
export function plano(t) {
  return (t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** "MACHO" → "Macho". Sólo para valores de categoría, no para nombres. */
function capital(t) {
  const s = (t || "").trim();
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : null;
}

/** La historia suele acabar con "Rescatado el DD-MM-AAAA en X." Se separa
    para mostrarlo como dato aparte y que el párrafo respire. */
export function partirHistoria(texto) {
  const limpio = (texto || "").replace(/\s*\n+\s*/g, " ").trim();
  const m = limpio.match(/^(.*?)\s*(Rescatad[oa]\s+el\s+.+?)\.?$/i);
  return m ? { cuerpo: m[1].trim(), rescate: m[2].trim() } : { cuerpo: limpio, rescate: "" };
}

export function recortar(texto, max) {
  if (!texto || texto.length <= max) return texto || "";
  const corte = texto.slice(0, max);
  const esp = corte.lastIndexOf(" ");
  return (esp > max * 0.6 ? corte.slice(0, esp) : corte).replace(/[.,;:]$/, "") + "…";
}

/** Fisher-Yates sobre una copia, para no tocar los datos. */
export function barajar(lista) {
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export async function leerJSON(ruta) {
  try {
    const r = await fetch(ruta, { cache: "no-cache" });
    return r.ok ? await r.json() : null;
  } catch {
    return null; // sin datos todavía: quien llama decide qué ocultar
  }
}

/* ---------- normalización ----------
   Acepta el formato nuevo de data/adopciones.json y también el anterior
   (sin especie, sexo, código ni fecha), para que la web no se rompa entre
   que se sube este código y corre la primera actualización de datos. */

export function normalizarAnimal(a, orden = 0) {
  const { cuerpo, rescate } = partirHistoria(a.historia);
  const sexo = capital(a.sexo);
  const salud = a.salud || {};
  const conv = a.convivencia || {};
  const raza = (a.raza || "").trim();

  return {
    id: a.id,
    codigo: a.codigo || null,
    nombre: nombreDigno(a.nombre),
    conNombre: tieneNombre(a.nombre),
    especie: capital(a.especie),
    sexo: sexo === "Desconocido" ? null : sexo,
    edad: (a.edad || "").trim() || null,
    tamano: capital(a.tamano),
    raza: raza || (a.esMestizo ? "Mestizo" : null),
    color: (a.color || "").trim() || null,
    comuna: a.comuna || a.ciudad || null,
    historia: cuerpo,
    rescate,
    personalidad: (a.personalidad || "").trim() || null,
    actividades: (a.actividadesFavoritas || "").trim() || null,
    salud: [
      salud.vacunado && "Vacunado",
      salud.esterilizado && "Esterilizado",
      salud.desparasitado && "Desparasitado",
    ].filter(Boolean),
    necesidades: salud.necesidadesEspeciales
      ? (salud.detalleNecesidadesEspeciales || "").trim() || "Sí, consúltanos."
      : null,
    // sólo lo que se sabe: null significa "no lo registraron", no "no"
    convivencia: [
      ["Con niños", conv.conNinos],
      ["Con perros", conv.conPerros],
      ["Con gatos", conv.conGatos],
      ["En departamento", conv.aptoDepartamento],
    ]
      .filter(([, v]) => typeof v === "boolean")
      .map(([etiqueta, valor]) => ({ etiqueta, valor })),
    ideal: {
      ninos: conv.conNinos === true,
      perros: conv.conPerros === true,
      gatos: conv.conGatos === true,
      depto: conv.aptoDepartamento === true,
    },
    vacunado: Boolean(salud.vacunado),
    esterilizado: Boolean(salud.esterilizado),
    energia: Number.isInteger(conv.nivelDeEnergia) ? conv.nivelDeEnergia : null,
    foto: a.foto || null,
    publicadoEn: Date.parse(a.publicadoEn) || null,
    orden,
  };
}

/** Todos los animales, con y sin foto. Quien pinta decide qué hacer con los
    que no tienen: el anillo los salta, el catálogo los muestra igual. */
export async function cargarAnimales() {
  const datos = await leerJSON("data/adopciones.json");
  if (!datos) return null;
  const animales = (datos.animales || []).map(normalizarAnimal);
  return {
    total: animales.length,
    generado: Date.parse(datos.generado) || null,
    animales,
  };
}

/* Si la persona ya movió la página, no se la arrastra a ningún lado. */
let yaSeMovio = false;
for (const tipo of ["wheel", "touchstart", "keydown", "pointerdown"]) {
  window.addEventListener(tipo, () => (yaSeMovio = true), { once: true, passive: true });
}

/**
 * Muestra una sección que empezó oculta (hidden) porque esperaba sus datos.
 *
 * Si se llegó con un #ancla —p. ej. "index.html#historias" desde
 * adopta.html—, el navegador intentó saltar cuando el destino aún estaba
 * oculto, o saltó y luego otra sección apareció encima y lo empujó. Así que
 * cada vez que aparece una sección se vuelve a saltar al ancla, de golpe y no
 * en suave (un desplazamiento suave de 4.000 px se cortaba a medio camino), y
 * una última vez al terminar de cargar, cuando ya no cambia nada de alto.
 */
export function mostrarSeccion(seccion) {
  seccion.hidden = false;

  const id = decodeURIComponent(location.hash.slice(1));
  const destino = id && document.getElementById(id);
  if (!destino || destino.hidden || yaSeMovio) return;

  const saltar = () => {
    if (!yaSeMovio) destino.scrollIntoView({ behavior: "instant", block: "start" });
  };
  requestAnimationFrame(saltar);
  if (document.readyState !== "complete") {
    window.addEventListener("load", () => requestAnimationFrame(saltar), { once: true });
  }
}

/** Enlace que abre directamente la ficha de un animal. Es lo que se comparte
    por WhatsApp: a quien lo recibe le llega el animal, no la portada. */
export function enlaceFicha(animal) {
  return new URL(`adopta.html#${encodeURIComponent(animal.id)}`, document.baseURI).href;
}

/* ---------- la ficha ----------
   Un <dialog> nativo: trae el foco atrapado, Esc para cerrar y el fondo
   inerte sin una línea de JS. Se crea una sola vez y se rellena en cada
   apertura. */

let dialogo = null;
let alCerrar = null;
let promesaAbierta = null;

const el = (etiqueta, clase, texto) => {
  const n = document.createElement(etiqueta);
  if (clase) n.className = clase;
  if (texto != null) n.textContent = texto;
  return n;
};

function crearDialogo() {
  const d = el("dialog", "ficha");
  d.setAttribute("aria-labelledby", "ficha-nombre");
  d.innerHTML = `
    <button class="ficha-cerrar" type="button" aria-label="Cerrar" data-cerrar>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
    <div class="ficha-grid">
      <figure class="ficha-foto"><img alt="" data-f="foto" /></figure>
      <div class="ficha-cuerpo">
        <p class="ficha-lugar" data-f="lugar"></p>
        <h2 class="ficha-nombre" id="ficha-nombre" data-f="nombre"></h2>
        <ul class="ficha-datos" data-f="datos"></ul>
        <div class="ficha-texto" data-f="texto"></div>
        <div class="ficha-acciones">
          <a class="btn btn-primary" data-f="adoptar"></a>
          <button class="btn btn-ghost" type="button" data-f="compartir">Compartir</button>
        </div>
        <p class="ficha-nota" data-f="nota" role="status" aria-live="polite"></p>
      </div>
    </div>`;

  // clic en el fondo oscuro: el ::backdrop entrega el clic al propio <dialog>
  d.addEventListener("click", (e) => {
    if (e.target === d || e.target.closest("[data-cerrar]")) d.close();
  });
  d.addEventListener("close", () => {
    const hecho = alCerrar;
    alCerrar = null;
    hecho?.();
  });

  document.body.append(d);
  return d;
}

const parte = (nombre) => dialogo.querySelector(`[data-f="${nombre}"]`);

function bloque(contenedor, titulo, contenido) {
  if (!contenido) return;
  contenedor.append(el("h3", "ficha-sub", titulo));
  contenedor.append(typeof contenido === "string" ? el("p", null, contenido) : contenido);
}

/**
 * Abre la ficha de un animal. Devuelve una promesa que se resuelve al
 * cerrarla, para que el anillo sepa cuándo volver a girar.
 * @param {object} animal  animal normalizado
 * @param {HTMLElement} [origen]  a dónde vuelve el foco al cerrar
 */
export function abrirFicha(animal, origen) {
  dialogo ??= crearDialogo();

  const foto = parte("foto");
  const marco = foto.parentElement;
  marco.classList.toggle("is-vacia", !animal.foto);
  if (animal.foto) {
    foto.src = animal.foto;
    foto.alt = `Foto de ${animal.nombre}`;
  } else {
    foto.removeAttribute("src");
    foto.alt = "";
  }

  parte("lugar").textContent = animal.comuna || "";
  parte("lugar").hidden = !animal.comuna;
  parte("nombre").textContent = animal.nombre;

  const datos = parte("datos");
  datos.replaceChildren(
    ...[animal.especie, animal.sexo, animal.edad, animal.tamano, animal.raza]
      .filter(Boolean)
      .map((d) => el("li", null, d))
  );
  datos.hidden = !datos.children.length;

  const texto = parte("texto");
  texto.replaceChildren();
  if (animal.historia) texto.append(el("p", "ficha-historia", animal.historia));
  bloque(texto, "Cómo es", animal.personalidad);
  bloque(texto, "Le encanta", animal.actividades);

  if (animal.salud.length || animal.necesidades) {
    const ul = el("ul", "adopta-salud");
    animal.salud.forEach((s) => ul.append(el("li", null, s)));
    bloque(texto, "Salud", ul.children.length ? ul : null);
    if (animal.necesidades) {
      texto.append(el("p", "ficha-necesidades", `Necesidades especiales: ${animal.necesidades}`));
    }
  }

  if (animal.convivencia.length) {
    const ul = el("ul", "ficha-convive");
    for (const { etiqueta, valor } of animal.convivencia) {
      const li = el("li", valor ? "es-si" : "es-no", etiqueta);
      li.prepend(el("span", "sr-only", valor ? "Sí: " : "No: "));
      ul.append(li);
    }
    bloque(texto, "Convivencia", ul);
  }

  if (animal.rescate) texto.append(el("p", "adopta-rescate", animal.rescate));

  // La adopción la gestiona la fundación en persona. El correo sale ya con
  // el nombre y el código, para que no tengan que adivinar de quién hablas.
  const enlace = enlaceFicha(animal);
  // "a Zeus", pero "al animal ADO-0009" (no "a el")
  const aQuien = animal.conNombre
    ? `a ${animal.nombre}`
    : animal.codigo
      ? `al animal ${animal.codigo}`
      : "a este animal";
  const asunto = `Quiero adoptar ${aQuien}${animal.conNombre && animal.codigo ? ` (${animal.codigo})` : ""}`;
  const cuerpo =
    `Hola, vi ${aQuien} en la web de la fundación y me gustaría adoptar. ` +
    `¿Me cuentan cuáles son los pasos?\n\n${enlace}`;
  const adoptar = parte("adoptar");
  adoptar.href = `mailto:${CORREO}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  adoptar.textContent = animal.conNombre ? `Quiero adoptar a ${animal.nombre}` : "Quiero adoptar";

  const nota = parte("nota");
  nota.textContent = animal.codigo ? `Código ${animal.codigo}` : "";

  const compartir = parte("compartir");
  compartir.onclick = async () => {
    const titulo = `${animal.conNombre ? animal.nombre : "Este animal"} busca familia`;
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, text: `${titulo} · Patitas Unidas`, url: enlace });
        return;
      }
      await navigator.clipboard.writeText(enlace);
      nota.textContent = "Enlace copiado. Pégalo donde quieras.";
    } catch (e) {
      if (e?.name === "AbortError") return; // cerró el menú de compartir
      nota.textContent = enlace; // sin portapapeles: al menos que lo vea
    }
  };

  dialogo.querySelector(".ficha-cuerpo").scrollTop = 0;
  dialogo.scrollTop = 0;

  // Ya abierta (p. ej. cambió el #id de la URL con la ficha a la vista): se
  // cambia el contenido y se conserva la misma promesa y el mismo foco de
  // vuelta.
  if (dialogo.open && promesaAbierta) return promesaAbierta;

  dialogo.showModal();
  promesaAbierta = new Promise((resolver) => {
    alCerrar = () => {
      promesaAbierta = null;
      if (origen?.isConnected) origen.focus({ preventScroll: true });
      resolver();
    };
  });
  return promesaAbierta;
}
