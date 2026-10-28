---
version: 1
slug: "web-mi-restaurante-src-app-js"
primary_target: "web/mi-restaurante/src/App.js"
related_targets: ["web/mi-restaurante/src/components/Login.js","web/mi-restaurante/src/CocinaView.js","web/mi-restaurante/src/Facturacion.js"]
---

# Qpro web — menú QR y pantallas del personal

Scope: menú QR del comensal (celular, prioridad), login, barra de navegación del personal, cocina (KDS), caja/facturación. Mode: Operate.

Audiencia y tarea: comensal pide desde la mesa con una mano; cocina lee comandas a distancia; caja cobra y factura durante el servicio.

Constraints: logo `src/components/logo.jpg` obligatorio; marca Qpro; React 19 CRA + Tailwind CDN; precios con impoconsumo incluido.

Chosen direction: el estándar de la categoría (menú digital/app de pedidos), ejecutado a nivel de los mejores productos del sector, elegido por el usuario con el pedido explícito de verse profesional, fluido, con animaciones limpias, componentes React Bits y carrusel por categoría.

## Direction contract

THESIS: El menú digital que todos reconocen, sin una sola fricción: la carta, el plato y el carrito están siempre a un toque. Rechaza el menú simplón de tarjetas grises con botón naranja y modales de alerta.

OWN-WORLD: Fondo blanco, neutros cálidos (stone), tinta espresso #2A1D15, caramelo del logo #C8955E para marca y selección, cacao para énfasis. Manrope en todo, cifras tabulares. Tarjetas con foto a escala fija, radios 16–20 px, sombras suaves con desplazamiento. Cocina en espresso oscuro por legibilidad a distancia.

STORY: El comensal ve platos con foto por categoría, toca uno, ajusta nota y cantidad, revisa el carrito y envía; sabe en todo momento cuánto lleva y que la cocina recibió el pedido.

FIRST VIEWPORT: Celular 390 px: cabecera con logo y "Mesa N"; pestañas de categoría fijas con indicador deslizante; carrusel de destacados; rieles horizontales por categoría con tarjetas de foto; barra flotante del carrito abajo con total animado y botón "Ver pedido".

FORM: canon (estándar de la categoría), elegido por el usuario; seed:258bca45e2fafbb5. Signature interaction: agregar un plato hace crecer el botón + en un selector − 1 +, el total del carrito cuenta hacia arriba y el carrito se abre como hoja inferior.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
