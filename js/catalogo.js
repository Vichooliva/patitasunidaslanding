/* =====================================================================
   CATÁLOGO DE ADOPCIÓN (adopta.html)

   Todos los animales en adopción, con buscador y filtros.

   Los filtros se arman con lo que traen los datos: si nadie registró el
   tamaño, no aparece un filtro de tamaño que siempre devolvería cero. A
   medida que la fundación complete fichas en MascotaApp, los filtros
   aparecen solos.

   El estado vive en la URL (?q=…&comuna=…), así que una búsqueda se puede
   compartir, y #id abre directamente la ficha de un animal.
   ===================================================================== */

import { cargarAnimales, abrirFicha, barajar, plano, recortar, sinMovimiento } from "./animales.js";

/* Facetas de una sola opción (se elige una o ninguna) y de varias (se
   suman: "con niños" Y "en departamento"). */
const UNICAS = [
  { clave: "especie", titulo: "Especie", de: (a) => a.especie },
  { clave: "sexo", titulo: "Sexo", de: (a) => a.sexo },
  { clave: "tamano", titulo: "Tamaño", de: (a) => a.tamano },
];

const MULTIPLES = [
  {
    clave: "ideal",
    titulo: "Se lleva bien con",
    opciones: [
      ["ninos", "Niños", (a) => a.ideal.ninos],
      ["perros", "Otros perros", (a) => a.ideal.perros],
      ["gatos", "Gatos", (a) => a.ideal.gatos],
      ["depto", "Vivir en depto.", (a) => a.ideal.depto],
    ],
  },
  {
    clave: "salud",
    titulo: "Salud",
    opciones: [
      ["vacunado", "Vacunado", (a) => a.vacunado],
      ["esterilizado", "Esterilizado", (a) => a.esterilizado],
    ],
  },
];

// 24 horas: con "p. m." la frase acababa en doble punto
const fechaHora = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const el = (etiqueta, clase, texto) => {
  const n = document.createElement(etiqueta);
  if (clase) n.className = clase;
  if (texto != null) n.textContent = texto;
  return n;
};

/** Valores presentes y cuántos animales tiene cada uno, de más a menos. */
function contar(animales, de) {
  const m = new Map();
  for (const a of animales) {
    const v = de(a);
    if (v) m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], "es"));
}

async function montar() {
  const raiz = document.querySelector("[data-catalogo]");
  if (!raiz) return;

  const $ = (sel) => raiz.querySelector(sel);
  const grid = $("[data-grid]");
  const cuenta = $("[data-cuenta]");
  const vacio = $("[data-vacio]");
  const buscar = $("[data-buscar]");
  const selComuna = $("[data-comuna]");
  const selOrden = $("[data-orden]");
  const chips = $("[data-chips]");
  const limpiar = raiz.querySelectorAll("[data-limpiar]");

  const datos = await cargarAnimales();
  if (!datos || !datos.animales.length) {
    $("[data-sin-datos]").hidden = false;
    $("[data-con-datos]").hidden = true;
    return;
  }

  const { animales } = datos;
  document.querySelectorAll("[data-total]").forEach((n) => {
    n.textContent = String(datos.total);
  });
  const actualizado = document.querySelector("[data-actualizado]");
  if (actualizado && datos.generado) {
    actualizado.textContent = `Datos de MascotaApp actualizados el ${fechaHora.format(datos.generado)}.`;
  }

  // texto donde se busca, calculado una vez
  const pajar = new Map(
    animales.map((a) => [
      a.id,
      plano(
        [a.nombre, a.comuna, a.especie, a.sexo, a.edad, a.tamano, a.raza, a.color, a.historia, a.personalidad, a.actividades, a.codigo]
          .filter(Boolean)
          .join(" ")
      ),
    ])
  );

  /* ---------- estado y URL ---------- */

  const estado = {
    q: "",
    especie: "",
    sexo: "",
    tamano: "",
    comuna: "",
    ideal: new Set(),
    salud: new Set(),
    orden: "recientes",
  };
  let azar = null;

  function leerURL() {
    const p = new URLSearchParams(location.search);
    estado.q = p.get("q") || "";
    for (const { clave } of UNICAS) estado[clave] = p.get(clave) || "";
    estado.comuna = p.get("comuna") || "";
    for (const { clave } of MULTIPLES) {
      estado[clave] = new Set((p.get(clave) || "").split(",").filter(Boolean));
    }
    estado.orden = p.get("orden") || "recientes";
  }

  function escribirURL() {
    const p = new URLSearchParams();
    if (estado.q.trim()) p.set("q", estado.q.trim());
    for (const { clave } of UNICAS) if (estado[clave]) p.set(clave, estado[clave]);
    if (estado.comuna) p.set("comuna", estado.comuna);
    for (const { clave } of MULTIPLES) if (estado[clave].size) p.set(clave, [...estado[clave]].join(","));
    if (estado.orden !== "recientes") p.set("orden", estado.orden);
    const qs = p.toString();
    history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
  }

  const hayFiltros = () =>
    Boolean(
      estado.q.trim() ||
        estado.comuna ||
        UNICAS.some(({ clave }) => estado[clave]) ||
        MULTIPLES.some(({ clave }) => estado[clave].size)
    );

  /* ---------- controles ----------
     Se pintan sólo las facetas con al menos dos valores distintos (o, en
     las de varias opciones, con al menos un animal que cumpla). */

  function crearChip(clave, texto, n, activo, alPulsar) {
    const b = el("button", "chip");
    b.type = "button";
    b.dataset.k = clave;
    b.setAttribute("aria-pressed", String(activo));
    b.append(el("span", null, texto), el("span", "chip-n", String(n)));
    b.addEventListener("click", alPulsar);
    return b;
  }

  function pintarControles() {
    const grupos = [];

    for (const faceta of UNICAS) {
      const valores = contar(animales, faceta.de);
      if (valores.length < 2) continue;
      const g = el("div", "filtro-grupo");
      g.setAttribute("role", "group");
      g.setAttribute("aria-label", faceta.titulo);
      g.append(el("span", "filtro-titulo", faceta.titulo));
      for (const [valor, n] of valores) {
        g.append(
          crearChip(`${faceta.clave}:${valor}`, valor, n, estado[faceta.clave] === valor, () => {
            estado[faceta.clave] = estado[faceta.clave] === valor ? "" : valor;
            cambio();
          })
        );
      }
      grupos.push(g);
    }

    for (const faceta of MULTIPLES) {
      const opciones = faceta.opciones
        .map(([clave, texto, cumple]) => [clave, texto, animales.filter(cumple).length])
        .filter(([, , n]) => n > 0);
      if (!opciones.length) continue;
      const g = el("div", "filtro-grupo");
      g.setAttribute("role", "group");
      g.setAttribute("aria-label", faceta.titulo);
      g.append(el("span", "filtro-titulo", faceta.titulo));
      for (const [clave, texto, n] of opciones) {
        const sel = estado[faceta.clave];
        g.append(
          crearChip(`${faceta.clave}:${clave}`, texto, n, sel.has(clave), () => {
            if (sel.has(clave)) sel.delete(clave);
            else sel.add(clave);
            cambio();
          })
        );
      }
      grupos.push(g);
    }

    chips.replaceChildren(...grupos);
    chips.hidden = !grupos.length;
  }

  const comunas = contar(animales, (a) => a.comuna).sort((x, y) => x[0].localeCompare(y[0], "es"));
  if (comunas.length > 1) {
    for (const [c, n] of comunas) {
      const op = el("option", null, `${c} (${n})`);
      op.value = c;
      selComuna.append(op);
    }
  } else {
    selComuna.closest("label").hidden = true;
  }

  /* ---------- filtrado ---------- */

  function filtrar() {
    const palabras = plano(estado.q).split(/\s+/).filter(Boolean);
    const lista = animales.filter((a) => {
      if (palabras.length) {
        const texto = pajar.get(a.id);
        if (!palabras.every((p) => texto.includes(p))) return false;
      }
      for (const { clave, de } of UNICAS) if (estado[clave] && de(a) !== estado[clave]) return false;
      if (estado.comuna && a.comuna !== estado.comuna) return false;
      for (const { clave, opciones } of MULTIPLES) {
        for (const [op, , cumple] of opciones) if (estado[clave].has(op) && !cumple(a)) return false;
      }
      return true;
    });

    if (estado.orden === "nombre") {
      // los que aún no tienen nombre, al final: "Aún sin nombre" no es una A
      lista.sort((x, y) => (y.conNombre - x.conNombre) || x.nombre.localeCompare(y.nombre, "es"));
    } else if (estado.orden === "azar") {
      azar ??= new Map(barajar(animales).map((a, i) => [a.id, i]));
      lista.sort((x, y) => azar.get(x.id) - azar.get(y.id));
    } else {
      // más recientes primero; los datos antiguos no traen fecha y llegan ya
      // ordenados así desde la API
      lista.sort((x, y) => (y.publicadoEn || 0) - (x.publicadoEn || 0) || x.orden - y.orden);
    }
    return lista;
  }

  /* ---------- tarjetas ---------- */

  const tarjetas = new Map();

  function tarjeta(a) {
    if (tarjetas.has(a.id)) return tarjetas.get(a.id);

    const art = el("article", "adopta-card catalogo-card");
    art.style.viewTransitionName = `a-${a.id.replace(/[^\w-]/g, "")}`;

    if (a.foto) {
      const img = el("img", "adopta-foto");
      img.src = a.foto;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      art.append(img);
    } else {
      const hueco = el("div", "adopta-foto adopta-foto-vacia");
      hueco.append(el("span", null, "Aún sin foto"));
      art.append(hueco);
    }

    const cuerpo = el("div", "adopta-cuerpo");
    const h3 = el("h3");
    // Botón dentro del título, estirado sobre toda la tarjeta con ::after:
    // la tarjeta entera es clicable y el lector de pantalla oye un botón con
    // el nombre, no un bloque de texto entero.
    const abrir = el("button", "adopta-abrir", a.nombre);
    abrir.type = "button";
    abrir.addEventListener("click", () => mostrar(a, abrir));
    h3.append(abrir);
    cuerpo.append(h3);

    if (a.comuna) cuerpo.append(el("p", "adopta-comuna", a.comuna));
    const meta = [a.especie, a.sexo, a.edad, a.tamano].filter(Boolean).join(" · ");
    if (meta) cuerpo.append(el("p", "adopta-meta", meta));
    if (a.historia) cuerpo.append(el("p", "adopta-historia", recortar(a.historia, 150)));
    if (a.salud.length) {
      const ul = el("ul", "adopta-salud");
      a.salud.forEach((s) => ul.append(el("li", null, s)));
      cuerpo.append(ul);
    }
    if (a.codigo) {
      const codigo = el("p", "adopta-codigo");
      codigo.append(el("span", null, a.codigo), document.createTextNode(" Postula en MascotaApp"));
      cuerpo.append(codigo);
    }

    art.append(cuerpo);
    tarjetas.set(a.id, art);
    return art;
  }

  function pintar(animar) {
    const lista = filtrar();
    const hacer = () => {
      grid.replaceChildren(...lista.map(tarjeta));
      cuenta.textContent =
        lista.length === animales.length
          ? `${lista.length} ${lista.length === 1 ? "animal" : "animales"}`
          : `${lista.length} de ${animales.length}`;
      vacio.hidden = lista.length > 0;
      limpiar.forEach((b) => {
        b.hidden = !hayFiltros();
      });
    };
    // Las tarjetas se reacomodan deslizándose en vez de saltar. Sólo donde
    // existe la API y nunca mientras se escribe: una transición por tecla
    // congelaría la página a cada letra.
    if (animar && document.startViewTransition && !sinMovimiento()) {
      document.startViewTransition(hacer);
    } else {
      hacer();
    }
  }

  function cambio({ animar = true } = {}) {
    escribirURL();
    // los chips se vuelven a crear: el foco del teclado vuelve al mismo
    const enfocado = chips.contains(document.activeElement) ? document.activeElement.dataset.k : null;
    pintarControles();
    if (enfocado) {
      [...chips.querySelectorAll("[data-k]")].find((b) => b.dataset.k === enfocado)?.focus();
    }
    pintar(animar);
  }

  /* ---------- eventos ---------- */

  let espera = null;
  buscar.addEventListener("input", () => {
    estado.q = buscar.value;
    window.clearTimeout(espera);
    espera = window.setTimeout(() => cambio({ animar: false }), 160);
  });
  selComuna.addEventListener("change", () => {
    estado.comuna = selComuna.value;
    cambio();
  });
  selOrden.addEventListener("change", () => {
    estado.orden = selOrden.value;
    azar = null;
    cambio();
  });
  limpiar.forEach((b) =>
    b.addEventListener("click", () => {
      estado.q = "";
      estado.comuna = "";
      for (const { clave } of UNICAS) estado[clave] = "";
      for (const { clave } of MULTIPLES) estado[clave].clear();
      sincronizarCampos();
      cambio();
      buscar.focus();
    })
  );

  function sincronizarCampos() {
    buscar.value = estado.q;
    selComuna.value = comunas.some(([c]) => c === estado.comuna) ? estado.comuna : "";
    estado.comuna = selComuna.value;
    selOrden.value = ["recientes", "nombre", "azar"].includes(estado.orden) ? estado.orden : "recientes";
    estado.orden = selOrden.value;
  }

  /* ---------- ficha por #id ---------- */

  function mostrar(a, origen) {
    history.replaceState(null, "", `${location.pathname}${location.search}#${encodeURIComponent(a.id)}`);
    abrirFicha(a, origen).then(() => {
      // al cerrar se quita el #id, para que recargar no la vuelva a abrir
      if (location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`);
    });
  }

  function abrirDesdeHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const a = id && animales.find((x) => x.id === id);
    if (!a) return;
    const origen = tarjetas.get(a.id)?.querySelector(".adopta-abrir") ?? null;
    mostrar(a, origen);
  }

  window.addEventListener("hashchange", abrirDesdeHash);

  leerURL();
  sincronizarCampos();
  pintarControles();
  pintar(false);
  abrirDesdeHash();
}

montar();
