# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Comensal en mesa:** escanea el QR de su mesa con el celular y pide sin esperar al mesero. Prioridad de diseño: el pedido desde el celular debe ser rápido e intuitivo.
- **Cocina:** ve las comandas en una pantalla (tablet o monitor) y las marca como listas.
- **Caja:** cobra pedidos de mesa y domicilios, emite facturas y revisa el cierre del día.
- **Administrador:** gestiona platillos, usuarios, inventario, reportes, domicilios y genera los QR de las mesas.
- Meseros y domiciliarios usan la app móvil Flutter, no la web.

## Product Purpose

Qpro digitaliza la operación de un restaurante: pedido por QR o mesero, comandas en cocina, caja y facturación, domicilios e inventario que se descuenta por recetas. Es un proyecto de grado (CECAR) que debe funcionar de punta a punta y sostener una sustentación.

## Positioning

Un solo sistema conecta el pedido del comensal, la cocina, la caja y el inventario por recetas, para que lo vendido y lo descontado coincidan.

## Operating Context

- Menú QR: celular del comensal, una mano, en la mesa; sin login.
- Cocina: pantalla compartida, lectura a distancia, toques rápidos.
- Caja y admin: escritorio o portátil durante el servicio.
- API .NET 8 con JWT; la web es React 19 (Create React App) desplegada en GitHub Pages / Render.

## Capabilities and Constraints

- Roles web: Administrador, Caja, Cocina. Comensal anónimo por `?mesa=<id>&numero=<n>`.
- Precios con impoconsumo incluido (decisión pendiente de confirmar con el asesor).
- Moneda COP, idioma español (Colombia).

## Brand Commitments

- Nombre visible en toda la web: **Qpro**.
- Logo existente obligatorio: `web/mi-restaurante/src/components/logo.jpg`.

## Evidence on Hand

- Platillos, mesas y pedidos reales vienen de la API; no inventar reseñas, clientes ni métricas.

## Product Principles

1. El comensal pide en segundos desde el celular, sin ayuda.
2. Cocina y caja leen el estado de un vistazo; nada compite con la comanda o el cobro.
3. Lo que muestra la interfaz es lo que cobra y descuenta el servidor.
4. Mismo nivel de acabado en todas las pantallas del personal.

## Accessibility & Inclusion

- Objetivos táctiles de al menos 44 px en el menú QR y la cocina; contraste AA.
