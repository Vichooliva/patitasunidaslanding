(() => {
  const section = document.querySelector(".cinema-scroll");
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!section) return;

  let targetMouseX = 0;
  let targetMouseY = 0;
  let mouseX = 0;
  let mouseY = 0;
  let targetScroll = 0;
  let smoothScroll = 0;
  let initialized = false;
  let rafPending = false;

  /* ---------- helpers ---------- */

  /* Escritura de custom properties con caché.
     En la mayor parte del recorrido casi todas las variables valen lo mismo que
     en el frame anterior (los tramos frame2/frame3 están inactivos, el ratón
     está quieto…). Cada setProperty invalida estilos aunque el valor no cambie,
     así que sólo escribimos lo que de verdad se movió. */
  const varCache = new Map();

  function setVar(name, value) {
    const next = String(value);
    if (varCache.get(name) === next) return;
    varCache.set(name, next);
    root.style.setProperty(name, next);
  }

  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

  const smoothstep = (e0, e1, v) => {
    const x = clamp((v - e0) / (e1 - e0));
    return x * x * (3 - 2 * x);
  };

  const lerp = (a, b, t) => a + (b - a) * t;

  const segmentInOut = (s, a, b, c, d) => {
    const enter = smoothstep(a, b, s);
    const exit = smoothstep(c, d, s);
    return { enter, exit, active: enter * (1 - exit) };
  };

  const getScrollDistance = () =>
    clamp(-section.getBoundingClientRect().top, 0, section.offsetHeight - window.innerHeight);

  /* ---------- animation engine ---------- */

  function update() {
    rafPending = false;

    targetScroll = getScrollDistance();

    if (!initialized || reduceMotion.matches) {
      smoothScroll = targetScroll;
      initialized = true;
    } else {
      smoothScroll = lerp(smoothScroll, targetScroll, 0.14);
    }

    if (Math.abs(smoothScroll - targetScroll) < 0.08) {
      smoothScroll = targetScroll;
    }

    mouseX = lerp(mouseX, targetMouseX, 0.12);
    mouseY = lerp(mouseY, targetMouseY, 0.12);

    /* Tramos reescalados de 2700 a 1890 px al quitar el carrusel: la escena
       eran cinco pantallas de animacion antes de llegar a nada accionable. */
    const frame2 = segmentInOut(smoothScroll, 390, 630, 910, 1130);
    const frame3 = segmentInOut(smoothScroll, 1230, 1500, 1780, 1890);
    const progress = clamp(smoothScroll / 1890);
    const introExit = smoothstep(60, 450, smoothScroll);
    const blurActive = clamp(frame2.active + frame3.active);
    const frame2Opacity = frame2.active * (1 - frame3.enter);
    const splitDrift = Math.pow(frame2.enter, 1.5);
    const panel2Opacity = frame2.active * (1 - frame2.exit);
    const panel3Opacity = frame3.active * (1 - frame3.exit);
    const backScale = 0.76 + progress * 0.2 + frame2.enter * 0.18 + frame3.enter * 0.16;
    const sharedHeroY = progress * -74;
    const sharedHeroScale = progress * 0.23;

    setVar("--mx", (reduceMotion.matches ? 0 : mouseX).toFixed(4));
    setVar("--my", (reduceMotion.matches ? 0 : mouseY).toFixed(4));

    setVar("--back-opacity", 1 - frame2.active * 0.06);
    setVar("--back-x", `${mouseX * -12}px`);
    setVar("--back-y", `${mouseY * -4}px`);
    setVar("--back-scale", backScale);
    setVar("--four-y", `${10 + progress * 10}vh`);
    setVar("--four-scale", 0.78 + progress * 0.16);
    setVar("--bazaar-y", `${20 - progress * 8}vh`);
    /* Un filtro cuesta un pase de composición completo sobre imágenes a
       pantalla completa. Mientras no haya nada que aplicar vale "none", que es
       gratis; blur(0px) NO lo es. */
    setVar(
      "--scene-filter",
      blurActive < 0.002
        ? "none"
        : `blur(${blurActive * 14}px) brightness(${1 - blurActive * 0.255})`
    );
    setVar(
      "--ground-filter",
      frame2.active < 0.002 && frame3.active < 0.002
        ? "none"
        : `blur(${frame2.active * 14}px)` +
          ` brightness(${1 - frame2.active * 0.255 - frame3.active * 0.06})` +
          ` saturate(${1 + frame3.active * 0.18})`
    );
    setVar("--shade-opacity", "1");
    // z 6 (no 2): la foto de frame-two vive en z 5, así que con el valor
    // original el velo quedaba por debajo y no la atenuaba nada.
    setVar("--shade-z", frame2.active > 0.02 ? "6" : "0");
    setVar("--shade-top-alpha", blurActive * 0.465);
    setVar("--shade-mid-alpha", blurActive * 0.42);
    setVar("--shade-bottom-alpha", blurActive * 0.51);

    setVar("--title-y", `${introExit * -210}px`);
    setVar("--title-scale", 1 - introExit * 0.08);
    setVar("--title-opacity", 1 - introExit);

    setVar("--bridge-x", `calc(-50% + ${mouseX * 18}px)`);
    setVar(
      "--bridge-y",
      `calc(${mouseY * 8 + sharedHeroY - frame2.exit * 760}px + ${frame2.enter * 34}vh)`
    );
    /* La lámina sigue yendo de 44vw/34vh a ~105vw/80vh, pero ahora por scale()
       en vez de animar width/height/bottom. Ambos ejes crecían con factores casi
       idénticos (2.39 y 2.35), así que un escalado uniforme lo reproduce y deja
       de forzar relayout en cada frame. */
    const bridgeGrow = 1 + frame2.enter * 1.386;
    setVar("--bridge-scale", (1.02 + sharedHeroScale + frame2.exit * 0.46) * bridgeGrow);
    setVar("--bridge-opacity", 1 - frame2.exit);

    setVar("--split-left-x", `calc(-50% + ${-splitDrift * 46}vw + ${mouseX * 22}px)`);
    setVar("--split-left-y", `${mouseY * 10 + sharedHeroY - splitDrift * 180}px`);
    setVar("--split-left-scale", 1 + sharedHeroScale + frame2.enter * 0.74);
    setVar("--split-right-x", `calc(-50% + ${splitDrift * 46}vw + ${mouseX * 22}px)`);
    setVar("--split-right-y", `${mouseY * 10 + sharedHeroY - splitDrift * 180}px`);
    setVar("--split-right-scale", 1 + sharedHeroScale + frame2.enter * 0.74);

    setVar("--frame2-opacity", frame2Opacity);
    setVar("--frame2-x", `calc(-50% + ${mouseX * 10}px)`);
    setVar("--frame2-y", `calc(-50% + ${mouseY * 8 - frame2.exit * 150}px)`);
    setVar("--frame2-scale", 1.06 + frame2.enter * 0.08 + frame2.exit * 0.08);

    setVar("--intro-copy-y", `${introExit * 90}px`);
    setVar("--intro-copy-opacity", 1 - introExit);
    setVar("--panel2-opacity", panel2Opacity);
    setVar(
      "--panel2-y",
      `calc(-50% + ${-frame2.exit * 86 + (1 - frame2.enter) * 58}px)`
    );
    setVar("--panel3-opacity", panel3Opacity);
    setVar(
      "--panel3-y",
      `calc(-50% + ${-frame3.exit * 86 + (1 - frame3.enter) * 58}px)`
    );

    highlightNav(smoothScroll);

    if (
      Math.abs(smoothScroll - targetScroll) > 0.08 ||
      Math.abs(mouseX - targetMouseX) > 0.001 ||
      Math.abs(mouseY - targetMouseY) > 0.001
    ) {
      requestTick();
    }
  }

  function requestTick() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(update);
  }

  /* ---------- listeners ---------- */

  window.addEventListener("scroll", requestTick, { passive: true });

  window.addEventListener("resize", requestTick);

  window.addEventListener(
    "pointermove",
    (event) => {
      targetMouseX = event.clientX / window.innerWidth - 0.5;
      targetMouseY = event.clientY / window.innerHeight - 0.5;
      requestTick();
    },
    { passive: true }
  );

  /* ---------- navegación ----------
     Los enlaces del menú apuntan a secciones reales por ancla; sólo "Inicio" y
     el logo usan data-scroll, porque su destino es un punto dentro de la escena
     y no un elemento con id. */

  function goTo(distance) {
    const top = section.offsetTop + distance;
    window.scrollTo({
      top,
      behavior: reduceMotion.matches ? "auto" : "smooth"
    });
  }

  document.querySelectorAll("[data-scroll]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      goTo(Number(el.dataset.scroll) || 0);
    });
  });

  // Marca en el menú el tramo en el que estás.
  const navLinks = Array.from(document.querySelectorAll(".site-nav [data-scroll]"));

  function highlightNav(distance) {
    let active = null;
    for (const link of navLinks) {
      if (distance >= Number(link.dataset.scroll) - 260) active = link;
    }
    navLinks.forEach((link) => {
      link.classList.toggle("is-current", link === active);
      if (link === active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }

  /* El conmutador de idioma: por ahora sólo hay español, así que en vez de
     fingir un desplegable avisa de que la versión en inglés no existe todavía.
     Cuando haya traducción, este bloque se sustituye por el cambio real. */
  const langSwitcher = document.querySelector(".language-switcher");
  if (langSwitcher) {
    langSwitcher.addEventListener("click", () => {
      const label = langSwitcher.querySelector(".lang-current");
      if (!label || langSwitcher.dataset.busy) return;
      langSwitcher.dataset.busy = "1";
      const original = label.textContent;
      label.textContent = "Sólo ES";
      window.setTimeout(() => {
        label.textContent = original;
        delete langSwitcher.dataset.busy;
      }, 1600);
    });
  }

  /* Copiar los datos de transferencia.
     Se leen del propio <dl> del DOM en vez de duplicarlos aquí: si alguien
     corrige el número de cuenta en el HTML, el botón copia el valor corregido
     y no una copia obsoleta escondida en el JS. */
  const copyButton = document.querySelector("[data-copy]");
  const copyStatus = document.querySelector("[data-copy-status]");

  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const rows = document.querySelectorAll(".bank > div");
      const text = Array.from(rows)
        .map((row) => {
          const dt = row.querySelector("dt");
          const dd = row.querySelector("dd");
          return dt && dd ? `${dt.textContent.trim()}: ${dd.textContent.trim()}` : "";
        })
        .filter(Boolean)
        .join("\n");

      try {
        await navigator.clipboard.writeText(text);
        if (copyStatus) copyStatus.textContent = "Datos copiados al portapapeles.";
      } catch {
        // clipboard falla sin HTTPS o sin permiso: seleccionamos el bloque
        // para que la persona pueda copiarlo a mano en vez de quedarse sin nada
        const list = document.querySelector(".bank");
        if (list) {
          const range = document.createRange();
          range.selectNodeContents(list);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
        if (copyStatus) copyStatus.textContent = "No se pudo copiar: los datos quedaron seleccionados.";
      }

      window.setTimeout(() => {
        if (copyStatus) copyStatus.textContent = "";
      }, 4000);
    });
  }

  /* ---------- cifras reales desde MascotaApp ----------
     Lee data/cifras.json, que genera scripts/traer-datos.mjs. No se llama a la
     API desde el navegador a propósito: exige una cabecera X-API-Key y este
     sitio es estático, así que la llave quedaría a la vista en el código fuente.
     Si el archivo no existe todavía, los marcadores 000 se quedan como están. */

  async function cargarCifras() {
    const huecos = document.querySelectorAll("[data-cifra]");
    if (!huecos.length) return;

    let cifras;
    try {
      const r = await fetch("data/cifras.json", { cache: "no-cache" });
      if (!r.ok) return;
      ({ cifras } = await r.json());
    } catch {
      return; // sin datos aún: se queda el marcador
    }
    if (!cifras) return;

    const valor = (ruta) =>
      ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), cifras);

    huecos.forEach((el) => {
      const n = valor(el.dataset.cifra);
      // un 0 real es un dato válido, pero anunciar "0 esterilizaciones" en
      // portada no ayuda a nadie: se deja el marcador hasta que haya cifra
      if (typeof n !== "number" || n <= 0) return;
      el.textContent = new Intl.NumberFormat("es-CL").format(n);
      el.removeAttribute("data-placeholder");
      const pie = el.parentElement?.querySelector("[data-cifra-pie]");
      if (pie) pie.textContent = pie.dataset.cifraPie || pie.textContent;
    });
  }

  cargarCifras();

  /* ---------- animales en adopción ----------
     Se pintan desde data/adopciones.json. Los datos vienen de personas
     escribiendo en una app, así que llegan como llegan: nombres tipo
     "Sin nombre", especie y sexo en null, historias con saltos de línea.
     Se limpian aquí en vez de exigirle formato a quien rescata un perro. */

  const SIN_NOMBRE = /^(sin nombre|no tiene|s\/n|-+)$/i;

  function nombreDigno(n) {
    const t = (n || "").trim();
    return !t || SIN_NOMBRE.test(t) ? "Aún sin nombre" : t;
  }

  /** La historia suele acabar con "Rescatado el DD-MM-AAAA en X." Se separa
      para mostrarlo como dato aparte y que el párrafo respire. */
  function partirHistoria(texto) {
    const limpio = (texto || "").replace(/\s*\n+\s*/g, " ").trim();
    const m = limpio.match(/^(.*?)\s*(Rescatad[oa]\s+el\s+.+?)\.?$/i);
    return m
      ? { cuerpo: m[1].trim(), rescate: m[2].trim() }
      : { cuerpo: limpio, rescate: "" };
  }

  function recortar(texto, max) {
    if (texto.length <= max) return texto;
    const corte = texto.slice(0, max);
    const esp = corte.lastIndexOf(" ");
    return (esp > max * 0.6 ? corte.slice(0, esp) : corte).replace(/[.,;]$/, "") + "…";
  }

  async function cargarAdopciones() {
    const seccion = document.getElementById("adopta");
    const lista = document.querySelector("[data-adopta-lista]");
    if (!seccion || !lista) return;

    let datos;
    try {
      const r = await fetch("data/adopciones.json", { cache: "no-cache" });
      if (!r.ok) return;
      datos = await r.json();
    } catch {
      return; // sin datos: la sección se queda oculta
    }

    const conFoto = (datos.animales || []).filter((a) => a.foto);
    if (!conFoto.length) return; // sin fotos no hay sección que mostrar

    /* Se muestran sólo tres, elegidos al azar en cada visita.
       Con la reja completa siempre salían los mismos y el resto no lo veía
       nadie; rotando, todos tienen su turno de que alguien se fije en ellos.
       Barajado de Fisher-Yates sobre una copia, para no tocar los datos. */
    const barajado = conFoto.slice();
    for (let i = barajado.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [barajado[i], barajado[j]] = [barajado[j], barajado[i]];
    }
    const animales = barajado.slice(0, 3);

    lista.replaceChildren(
      ...animales.map((a) => {
        const { cuerpo, rescate } = partirHistoria(a.historia);
        const art = document.createElement("article");
        art.className = "adopta-card";

        const fig = document.createElement("img");
        fig.className = "adopta-foto";
        fig.src = a.foto;
        fig.alt = `Foto de ${nombreDigno(a.nombre)}`;
        fig.loading = "lazy";
        fig.decoding = "async";

        const cuerpoEl = document.createElement("div");
        cuerpoEl.className = "adopta-cuerpo";

        const h3 = document.createElement("h3");
        h3.textContent = nombreDigno(a.nombre);
        cuerpoEl.appendChild(h3);

        if (a.comuna) {
          const loc = document.createElement("p");
          loc.className = "adopta-comuna";
          loc.textContent = a.comuna;
          cuerpoEl.appendChild(loc);
        }

        if (cuerpo) {
          const p = document.createElement("p");
          p.className = "adopta-historia";
          p.textContent = recortar(cuerpo, 190);
          cuerpoEl.appendChild(p);
        }

        // sólo se muestran las marcas de salud que son ciertas: un listado de
        // "no vacunado / no esterilizado" no ayuda a que lo adopten
        const salud = a.salud || {};
        const marcas = [
          salud.vacunado && "Vacunado",
          salud.esterilizado && "Esterilizado",
          salud.desparasitado && "Desparasitado",
          salud.necesidadesEspeciales && "Necesidades especiales",
        ].filter(Boolean);

        if (marcas.length) {
          const ul = document.createElement("ul");
          ul.className = "adopta-salud";
          for (const m of marcas) {
            const li = document.createElement("li");
            li.textContent = m;
            ul.appendChild(li);
          }
          cuerpoEl.appendChild(ul);
        }

        if (rescate) {
          const r = document.createElement("p");
          r.className = "adopta-rescate";
          r.textContent = rescate;
          cuerpoEl.appendChild(r);
        }

        art.append(fig, cuerpoEl);
        return art;
      })
    );

    const resumen = document.querySelector("[data-adopta-resumen]");
    if (resumen) {
      // el total viene de la API: es cuántos hay de verdad, no cuántos pintamos
      const n = datos.total || conFoto.length;
      resumen.textContent =
        n > animales.length
          ? `${animales.length} de los ${n} que hoy esperan familia.`
          : `${n} ${n === 1 ? "animal espera" : "animales esperan"} familia ahora mismo.`;
    }

    seccion.hidden = false;
  }

  cargarAdopciones();

  requestTick();
})();
