/**
 * Worker de Cloudflare que vuelve a publicar el sitio cada 6 horas, para que
 * traiga datos nuevos de MascotaApp (scripts/construir.mjs los baja en cada
 * publicación).
 *
 * Este archivo no se despliega solo: se pega en el editor del Worker en el
 * panel de Cloudflare. Ver README → "Publicación en Cloudflare Pages".
 *
 * CONFIGURACIÓN DEL WORKER
 *   Secreto  DEPLOY_HOOK_URL   la URL del "deploy hook" del proyecto de Pages
 *                              (el proyecto → Settings → Builds → Deploy hooks;
 *                              igual si el proyecto es Pages o Worker)
 *   Cron     23 *\/6 * * *     cada 6 horas (hora UTC), sin la barra invertida
 *
 * Plan gratuito: hasta 5 cron por cuenta y 10 ms de CPU por ejecución; esto
 * usa una fracción, porque sólo hace una petición y espera.
 */

export default {
  async scheduled(_evento, env) {
    if (!env.DEPLOY_HOOK_URL) {
      console.log("Falta el secreto DEPLOY_HOOK_URL: no se publica nada.");
      return;
    }
    const r = await fetch(env.DEPLOY_HOOK_URL, { method: "POST" });
    console.log(`Deploy hook → HTTP ${r.status}`);
  },

  // Abrir la URL del Worker no dispara nada: si no, cualquiera podría
  // gastar las 500 publicaciones gratis del mes.
  async fetch() {
    return new Response("Reconstruye fundacionpatitasunidas.cl cada 6 horas.\n", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
