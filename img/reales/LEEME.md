# Fotos de la fundación

## De dónde salen ahora

Las fotos de **casos y animales en adopción** las trae la API de MascotaApp:

```powershell
$env:MASCOTAAPP_API_KEY = "la_llave"
node scripts/traer-datos.mjs
```

Eso descarga las imágenes a `img/casos/` y deja las fichas en `data/*.json`.
Se guardan como archivos del repositorio en vez de enlazar a la API en caliente,
para que la web siga mostrando las fotos aunque la API esté caída o cambie la
llave.

## Lo que la API no cubre

Las capas de ambiente de la escena de portada no son fotos de casos, así que
siguen siendo de stock (CC0). Si consigues fotos propias para estas, ponlas aquí
con estos nombres y dime:

| Nombre | Qué necesito | Orientación |
|---|---|---|
| `cielo.jpg` | Entorno amplio: terreno, calle, el refugio por fuera | Horizontal, grande |
| `suelo.jpg` | Otra vista del mismo sitio, para la banda inferior | Horizontal, grande |

Fotos de celular directas están bien: el procesado recorta, aplica el tono
cálido y optimiza el peso.

## Aviso

Si sale gente reconocible (voluntarios, adoptantes), hace falta su permiso para
publicarlas. Con los animales no hay problema.
