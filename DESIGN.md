---
name: Qpro
description: Menú QR, cocina y caja de un restaurante en un solo sistema; caramelo y espresso del logo sobre blanco cálido.
colors:
  espresso: "#2A1D15"
  espresso-raised: "#3A2A20"
  caramel: "#C8955E"
  caramel-deep: "#865B35"
  caramel-light: "#EBD3B6"
  caramel-soft: "#F5E9DA"
  caramel-wash: "#FBF6F0"
  teal-deep: "#1E505A"
  teal-light: "#82BCC3"
  teal-wash: "#EFF7F7"
  white: "#FFFFFF"
  stone-50: "#FAFAF9"
  stone-100: "#F5F5F4"
  stone-200: "#E7E5E4"
  stone-300: "#D6D3D1"
  stone-400: "#A8A29E"
  stone-500: "#78716C"
  stone-600: "#57534E"
  stone-900: "#1C1917"
  success: "#15803D"
  success-bright: "#16A34A"
  success-wash: "#F0FDF4"
  warning: "#FBBF24"
  warning-wash: "#FFFBEB"
  danger: "#DC2626"
  danger-deep: "#B91C1C"
  danger-wash: "#FEF2F2"
typography:
  display:
    fontFamily: "Manrope, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  amount:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "'tnum' 1"
  headline:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  section:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.375
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.625
  small:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.25
  kds-item:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.375
rounded:
  control: "12px"
  surface: "16px"
  card: "20px"
  ticket: "22px"
  feature: "24px"
  sheet: "28px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "56px"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "{colors.stone-900}"
  button-staff:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "0 16px"
  button-staff-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "0 16px"
  input-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  input-search-menu:
    backgroundColor: "{colors.stone-100}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.surface}"
    height: "44px"
    padding: "0 14px"
  dish-card:
    backgroundColor: "{colors.stone-100}"
    rounded: "{rounded.card}"
    width: "72vw"
  stepper-on-photo:
    backgroundColor: "{colors.white}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.pill}"
    height: "44px"
  bottom-sheet:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.sheet}"
  cart-bar:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.white}"
    rounded: "{rounded.ticket}"
    height: "64px"
  cart-bar-count:
    backgroundColor: "{colors.caramel}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.surface}"
    height: "40px"
  category-tab:
    textColor: "{colors.stone-600}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 16px"
  category-tab-active:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.white}"
  staff-nav-active:
    backgroundColor: "{colors.caramel-soft}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.pill}"
    height: "40px"
  kitchen-ticket:
    backgroundColor: "{colors.espresso-raised}"
    textColor: "{colors.white}"
    rounded: "{rounded.ticket}"
  kitchen-qty:
    backgroundColor: "{colors.caramel}"
    textColor: "{colors.espresso}"
    height: "40px"
  kitchen-action-confirm:
    backgroundColor: "{colors.white}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.surface}"
    height: "56px"
  invoice-row:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.surface}"
    padding: "16px 20px"
  payment-modal:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.feature}"
    padding: "24px"
  chip-paid:
    backgroundColor: "{colors.success-wash}"
    textColor: "#166534"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  chip-pending:
    backgroundColor: "{colors.warning-wash}"
    textColor: "#92400E"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  chip-cancelled:
    backgroundColor: "{colors.danger-wash}"
    textColor: "#991B1B"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
---

# Design System: Qpro

## Overview

**Creative North Star: "La carta a un toque"**

Qpro es el menú digital que todos reconocen, ejecutado sin fricción: blanco limpio, neutros cálidos de piedra, tinta espresso y el caramelo del logo como única voz de marca. La forma es el canon de la categoría (apps de pedidos y cartas digitales), elegida a propósito: el comensal no aprende nada nuevo. El valor está en la ejecución: fotos a escala fija, cifras tabulares, radios generosos, sombras suaves teñidas de espresso y movimiento con desaceleración larga.

El sistema tiene dos climas. El comensal, la caja y el login viven en claro (blanco o piedra 50). La cocina vive en espresso oscuro, porque se lee a distancia en una pantalla compartida; ahí el caramelo marca cantidades y el color de estado (a tiempo, demorado, urgente, listo) gobierna el borde de cada comanda. La densidad es baja en el menú (una mano, objetivos de 44 px o más) y media en caja.

Se rechaza explícitamente el menú simplón de tarjetas grises con botón naranja y las alertas modales del navegador: cada confirmación vive dentro del flujo (hoja inferior, doble toque, aviso flotante).

**Key Characteristics:**
- Espresso para acción y selección; caramelo para marca, conteos y foco; piedra cálida para todo lo demás.
- Manrope en todas las pantallas, pesos 500 a 800, cifras con `tabular-nums`.
- Píldoras para controles táctiles, radios de 16 a 28 px para superficies.
- Sombras de dos capas teñidas de espresso, nunca grises puras ni duras.
- Una sola curva de movimiento: `cubic-bezier(0.16, 1, 0.3, 1)`.
- Cocina en espresso oscuro; el estado de espera se lee por color del borde y del chip.

## Colors

Paleta cálida derivada del logo: caramelo y espresso sobre piedra, con petróleo como segundo acento funcional y verdes, ámbar y rojos solo para estado.

La paleta vive en el tema de Tailwind (`public/index.html`) como remapeo: la escala `orange` es la familia caramelo (50 `#FBF6F0` a 950 `#2A1D15`), `gray` es piedra cálida y `purple` es petróleo (50 `#EFF7F7` a 950 `#0C2128`). Así las pantallas que usan clases `orange-*`, `gray-*` o `purple-*` heredan la paleta sin reescribirse. `src/index.css` repite en variables `--qp-ink`, `--qp-caramel`, `--qp-caramel-soft` y `--qp-line` lo necesario para selección, foco, cursor y barras de desplazamiento.

### Primary
- **Espresso** (espresso): tinta del texto principal, fondo de botones primarios, pestaña activa, barra del carrito, fondo de la cocina, velo de modales al 55 %. Es el color de "hacer".
- **Caramelo del logo** (caramel): insignias de conteo (carrito, cantidades de comanda), anillo de foco global de 2 px, cursor de texto, chispa del botón +, filtro activo en cocina. Siempre con texto espresso encima, nunca blanco.
- **Caramelo profundo** (caramel-deep): precio en la hoja del plato, enlaces de texto, íconos sobre caramelo lavado. Es el caramelo legible sobre blanco.

### Secondary
- **Petróleo** (teal-deep, teal-light, teal-wash): identifica domicilios y mensajes informativos. Ícono del camión en la comanda (claro sobre oscuro), recuadro de datos del cliente (`#0C2128` al 50 %), cuadro de tipo domicilio en caja, aviso de cuenta de mesero en login.

### Neutral
- **Blanco** (white): lienzo del menú, login, hojas, tarjetas de caja.
- **Piedra 50** (stone-50): lienzo de las pantallas del personal.
- **Piedra 100** (stone-100): fondo de la búsqueda del menú, placeholder de foto, botones circulares secundarios.
- **Piedra 200** (stone-200): líneas, divisores, bordes de tarjeta y de los selectores secundarios (`--qp-line`).
- **Piedra 300** (stone-300): bordes de campos del personal, tirador de la hoja, barra de desplazamiento.
- **Piedra 500** (stone-500): texto secundario y placeholders (4.8:1 sobre blanco).
- **Piedra 600** (stone-600): pestañas inactivas, texto de apoyo de mayor peso.
- **Piedra 900** (stone-900): hover de los botones espresso.
- **Caramelo suave y lavado** (caramel-soft, caramel-wash): selección de texto, pestaña activa del personal, placeholder sin foto, avisos de vista previa. En la cocina, **caramelo claro** (caramel-light) y la escala 100 son el texto secundario sobre espresso.

### Estado
- **Verde** (success, success-bright): listo, pagado, pedido enviado. **Ámbar** (warning): demorado, pendiente de cobro (borde ámbar 300 en la fila). **Rojo** (danger, danger-deep): urgente, errores, eliminar. Las versiones lavadas (success-wash, warning-wash, danger-wash) con texto 800 forman los chips de caja. Estos colores no se remapearon: son la paleta estándar de Tailwind.

### Named Rules
**La Regla del Espresso que Actúa.** El botón primario, la pestaña activa y la barra del carrito son espresso. El caramelo no es color de botón: marca conteos, foco y marca. Un botón naranja relleno es el menú simplón que este sistema rechaza.

**La Regla del Texto sobre Caramelo.** Todo texto sobre caramelo 500 es espresso. El blanco sobre caramelo no pasa contraste.

**La Regla del Estado Reservado.** Verde, ámbar y rojo solo significan estado (tiempo de espera, cobro, error). Nunca decoran.

## Typography

**Display Font:** Manrope (con system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Manrope
**Label/Mono Font:** Manrope con `font-variant-numeric: tabular-nums` (clase `.tabular`) en todo precio, total, cantidad, hora y número de orden.

**Character:** Una sola grotesca geométrica y cálida en todos los pesos. La jerarquía sale del peso (800 para títulos y cifras) y del tracking negativo, no de cambiar de familia.

### Hierarchy
- **Display** (800, 44px, 1.05, -0.03em): solo el panel de marca del login en escritorio.
- **Amount** (800, 40px, 1, -0.03em, tabular): el total en el modal de cobro. Cifras de resumen de caja a 26px.
- **Headline** (800, 24 a 30px, -0.02em): títulos de hoja ("Tu pedido", nombre del plato a 24px), "Caja" a 28px, "Inicia sesión" a 30px, mesa de la comanda a 26px.
- **Section** (800, 20px, -0.02em): encabezados de riel por categoría y "Destacados".
- **Title** (700 a 800, 15 a 17px): nombre del plato en tarjeta (16px), fila de factura (17px), ítem del carrito (15px).
- **Body** (500, 15px, 1.625): descripciones y textos de hoja, con `max-width: 65ch`. Descripción en tarjeta a 13px con dos líneas máximo.
- **Small** (500 a 600, 13px): metadatos, conteo de platos, número de factura.
- **Label** (700, 14px): pestañas, filtros, botones del personal. Etiquetas de campo a 14px/600.
- **KDS item** (700, 22px): ítems de la comanda; cantidad a 20px/800; notas a 17px/600 en ámbar 200; hora y minutos a 22px/800.

### Named Rules
**La Regla de las Cifras Alineadas.** Todo número que se compara o se cobra lleva `.tabular`. Un precio que baila al contar no es aceptable.

**La Regla de la Distancia.** En cocina nada que se deba leer baja de 13px y los ítems no bajan de 22px: la pantalla se lee a dos metros.

## Layout

El menú es móvil primero a 390 px: cabecera fija (logo, mesa, carrito, búsqueda y pestañas), carrusel de destacados y un riel horizontal por categoría con tarjetas de 72vw (máximo 260px) y snap (`.qp-rail`, `scroll-padding-inline: 16px`). Desde `lg` (1024px) los rieles se vuelven cuadrícula de 3 columnas, 4 en `xl`; el contenedor tiene 1152px máximo (`max-w-6xl`). El cuerpo deja 128px abajo para la barra del carrito y respeta `env(safe-area-inset-*)`.

Margen lateral de 16px en móvil y 24px en escritorio. Ritmo vertical: 32px entre secciones del menú, 12px entre encabezado y riel, 16px entre tarjetas. Las secciones usan `scroll-margin-top: 150px` para quedar bajo la cabecera fija.

El personal trabaja bajo una barra superior de 64px (contenedor de 1440px). Caja usa un contenedor de 1280px con banda de resumen en tres columnas y filas apiladas con 12px de separación. La cocina es una cuadrícula de 1, 2, 3 y 4 columnas (sm, lg, 2xl) con 20px de separación y 24px de margen.

Las hojas son inferiores en móvil (ancho completo, alto máximo 92vh) y centradas a 512px desde `md`. El modal de cobro mide 448px.

## Elevation & Depth

Híbrido: las superficies del personal son planas con borde de piedra 200 y ganan sombra solo al pasar el cursor; el menú usa sombra suave en tarjetas y controles flotantes. Las sombras son de dos capas (contacto más ambiente con desplazamiento negativo) y teñidas de espresso. En la cocina no hay sombra: la profundidad sale del tono (`espresso-raised` sobre espresso, ítems en negro al 20 %) y del anillo de estado.

### Shadow Vocabulary
- **card** (`box-shadow: 0 1px 2px rgba(42,29,21,.06), 0 8px 24px -12px rgba(42,29,21,.18)`): tarjeta de plato en reposo, selector de cantidad, botón de cerrar sobre foto, hover de la fila de factura.
- **lift** (`box-shadow: 0 2px 4px rgba(42,29,21,.06), 0 18px 40px -16px rgba(42,29,21,.28)`): hover de la tarjeta de plato, hoja inferior, barra del carrito, modal de cobro, avisos flotantes.

### Named Rules
**La Regla de la Sombra Cálida.** Solo existen `card` y `lift`, ambas teñidas de espresso. Nada de sombras grises de Tailwind ni sombras duras desplazadas.

**La Regla del Tono en Cocina.** Sobre espresso la profundidad es tonal y el borde comunica estado; las sombras no se ven a distancia y no se usan.

## Shapes

Formas redondeadas y blandas, en dos familias. Los controles táctiles son píldoras completas: pestañas, filtros, selectores de cantidad, notas rápidas, botones primarios del menú, chips de estado. Las superficies crecen en radio con su tamaño: 12px para campos y botones del personal, 16px para filas de caja, búsqueda y textos de nota, 20px para la foto del plato, 22px para la comanda y la barra del carrito, 24px para el carrusel y el modal de cobro, 28px para la parte superior de la hoja. Las fotos van recortadas dentro de su contenedor a proporción fija: 4:3 en tarjeta, 16:10 en la hoja, 1.5 / 2.3 / 3.4 en el carrusel según el ancho. El logo siempre va en un cuadrado redondeado a 12 a 16px con anillo de piedra 200 o fondo blanco sobre espresso.

## Components

### Tarjeta de plato y selector de cantidad
Foto primero, texto debajo, acción sobre la foto.
- **Forma:** foto 4:3 recortada a 20px sobre piedra 100, sombra `card` y `lift` al pasar el cursor; la foto escala a 1.04 en 700ms.
- **Texto:** nombre a 16px/700, descripción a 13px piedra 500 en dos líneas, precio a 15px/800 tabular, con 4px de margen lateral.
- **Selector:** píldora de 44px abajo a la derecha de la foto, blanca con texto espresso (espresso con texto blanco fuera de la foto). Empieza como un botón + de 44×44; al primer toque crece con animación `layout` (350ms) en un selector − n +. El número entra desde abajo (220ms). Cada toque lanza una chispa caramelo (ClickSpark, 8 chispas, 420ms).
- **Sin foto:** caramelo lavado con ícono de cubiertos en caramelo 300.
- **Entrada:** sube 16px y aparece al entrar en vista (500ms, una sola vez).

### Hoja inferior
El único patrón de diálogo del comensal (detalle del plato y carrito).
- **Forma:** blanca, 28px arriba (todas las esquinas desde `md`), sombra `lift`, alto máximo 92vh; tirador de 40×6px en piedra 300 solo en móvil.
- **Velo:** espresso al 55 %, entra en 300ms.
- **Movimiento:** sube desde 100 % en 450ms; se cierra arrastrando más de 120px o a más de 600px/s, con Escape o tocando el velo. Bloquea el desplazamiento del cuerpo.
- **Pie fijo:** borde superior piedra 200, 16px de relleno más el área segura. En el plato: selector con borde de 56px más botón espresso de 56px "Agregar · precio". En el carrito: total a 22px/800 y botón "Enviar pedido a cocina".
- **Notas rápidas:** píldoras de 36px, borde piedra 200; activas en espresso con texto blanco (`aria-pressed`).
- **Éxito:** círculo verde de 80px con check, título 24px, resumen de unidades y total.

### Barra flotante del carrito
- **Forma:** espresso, 64px de alto, 22px de radio, sombra `lift`, ancho máximo 512px, 12px de margen y área segura abajo.
- **Contenido:** conteo en bloque caramelo de 40px con texto espresso, "Ver pedido" a 15px/700 y total a 16px/800 que cuenta desde el valor anterior (CountUp, 600ms, separador de miles con punto).
- **Movimiento:** aparece desde 120px abajo en 500ms cuando hay platos y se oculta mientras la hoja del carrito está abierta. Al presionar escala a 0.99.

### Pestañas de categoría con indicador deslizante
- **Estilo:** píldoras de 40px, 14px/700, en riel horizontal sin barra visible. Inactivas en piedra 600, hover espresso.
- **Activa:** una sola píldora espresso compartida (`layoutId`) que se desliza entre pestañas en 400ms; texto blanco.
- **Comportamiento:** tocar desplaza suave a la sección; al desplazarse, la pestaña sigue la sección visible (IntersectionObserver).

### Barra superior del personal
- **Estilo:** blanca, 64px, borde inferior piedra 200, fija. Logo de 36px más "Qpro" a 17px/800.
- **Navegación:** botones de 40px en píldora con ícono de 17px y etiqueta 14px/600, piedra 500 inactivos. La activa lleva una píldora caramelo suave deslizante (`layoutId`, 400ms) con texto espresso. Cocina muestra un contador espresso de 20px con los pedidos pendientes.
- **Usuario:** nombre 14px/700 y rol 12px, iniciales en círculo espresso de 36px, salir como botón circular de 40px.

### Comanda de cocina
La pieza central del KDS en espresso.
- **Forma:** `espresso-raised` con 22px de radio y anillo de 2px que codifica el estado: blanco al 10 % a tiempo (menos de 10 min), ámbar 400 al 60 % demorado (10 min o más), rojo 500 al 70 % urgente (15 min o más), verde 500 al 60 % listo.
- **Cabecera:** "Mesa N" o "Domicilio" a 26px/800 (camión petróleo claro), número de orden en caramelo claro, chip de estado en mayúsculas 13px/700 con tracking 0.06em (blanco al 10 %, ámbar con texto espresso, rojo o verde 700 con texto blanco) y minutos a 22px/800.
- **Ítems:** filas en negro al 20 % con 12px de radio; cantidad en bloque caramelo de 40px con texto espresso a 20px/800; nombre a 22px; nota en ámbar 200 a 17px.
- **Acción con doble toque:** botón de 56px a ancho completo, 16px de radio, blanco al 8 % con texto y anillo verde ("Listo") o caramelo ("Entregado", solo en la vista del administrador). El primer toque lo vuelve blanco con texto espresso y "Toca otra vez para confirmar"; vuelve solo a los 3 s. Nunca un modal.
- **Orden:** por prioridad (minutos de espera más un punto por plato); las listas al final.
- **Movimiento:** entra subiendo 24px y desde 0.98 (450ms); sale a 0.94 con desenfoque de 4px.
- **Modo incrustado:** dentro de la barra del personal, sin cabecera propia, con filtros por mesa en píldoras de 36px (activa caramelo con texto espresso).

### Fila de factura y modal de cobro
- **Fila:** blanca, 16px de radio, borde piedra 200 (ámbar 300 si está pendiente), sombra `card` al pasar el cursor, 16 a 20px de relleno. Cuadro de tipo de 44px a 12px de radio (caramelo lavado con caramelo profundo para mesa, petróleo lavado con petróleo profundo para domicilio), título 17px/800, número de factura tabular, chip de estado, cliente y fecha a 13px, total a 18px/800.
- **Acciones:** botones de 40px a 12px de radio: "Detalles" fantasma, "Imprimir" con borde piedra 300 y "Cobrar" espresso dividido con menú de estados.
- **Modal de cobro:** velo espresso al 55 %, tarjeta blanca de 448px, 24px de radio y de relleno, sombra `lift`, abajo en móvil y centrada desde `sm`. Total a 40px/800 tabular con la etiqueta del impuesto debajo. Métodos de pago como filas de 56px a 16px de radio con borde piedra 200 e ícono en cuadro caramelo lavado; al pasar el cursor la fila completa se vuelve espresso con texto blanco.

### Chips de estado
- **Caja:** píldora 12px/700 con 2×10px de relleno: pagada (verde lavado, verde 800, con check), pendiente (ámbar lavado, ámbar 800), cancelada (rojo lavado, rojo 800).
- **Cocina:** ver la comanda; en la cabecera, conteo en píldora blanca al 10 % con punto verde y "N urgentes" en rojo 600.

### Campos
- **Personal y login:** 48px en login y 40px en caja, borde piedra 300, 12px de radio, 15px o 14px. Foco: borde caramelo 500 y halo de 4px en caramelo suave.
- **Búsqueda del menú:** 44px, piedra 100 sin borde, 16px de radio; al enfocar pasa a blanco con anillo de 2px en caramelo 300.
- **Foco global:** contorno de 2px caramelo con 2px de separación en todo elemento con `:focus-visible`.

### Avisos
Píldora flotante con sombra `lift`, 15px/700, ícono de 20px: blanca con check verde para éxito, rojo 700 para error. Entra subiendo 24px (350ms) y se va sola a los 2 s (3.5 s si es error).

### Carrusel de destacados
React Bits Carousel sin marco, 24px de radio, 12px entre diapositivas, asomo de 14px en móvil, autoplay a 4.5 s con pausa al pasar el cursor, puntos espresso. Degradado negro de abajo hacia arriba (70 % a transparente) bajo el nombre (18px/800 blanco) y el precio; botón blanco "Ver" de 40px.

## Do's and Don'ts

### Do:
- **Do** usar espresso para la acción principal y el estado activo, con texto blanco.
- **Do** poner texto espresso sobre caramelo 500 y usar caramelo profundo cuando el caramelo sea texto sobre blanco.
- **Do** aplicar `.tabular` a todo precio, total, cantidad, hora y número de orden.
- **Do** mantener objetivos táctiles de 44px o más en el menú y de 56px en las acciones de cocina.
- **Do** animar con `cubic-bezier(0.16, 1, 0.3, 1)`: 220 a 250ms para microcambios, 350 a 450ms para layout y hojas, 500 a 600ms para entradas.
- **Do** respetar "reducir movimiento": `MotionConfig reducedMotion="user"` y la regla global de 0.01ms en `index.css`.
- **Do** resolver las confirmaciones dentro del flujo: hoja inferior, doble toque o aviso flotante.
- **Do** usar solo las sombras `card` y `lift`.

### Don't:
- **Don't** rellenar botones con caramelo ni poner texto blanco sobre caramelo.
- **Don't** usar `alert()`, `confirm()` ni modales para confirmar una acción repetitiva de cocina.
- **Don't** usar verde, ámbar o rojo fuera de su significado de estado.
- **Don't** poner la cocina sobre fondo claro ni bajar sus ítems de 22px.
- **Don't** usar sombras grises de Tailwind (`shadow-lg`, `shadow-xl`) ni sombras duras desplazadas.
- **Don't** introducir otra familia tipográfica ni pesos por debajo de 400.
- **Don't** usar etiquetas pequeñas en mayúsculas sobre los títulos. Las mayúsculas solo van en el chip de estado de la comanda.

### Brechas conocidas
- Inventario sigue este sistema en sus tareas diarias (Hoy, Recibir, Pedidos, Vencimientos, Conteo, Insumos y la ficha lateral, con piezas en `components/inventario/ui.js`); sus pantallas de Configuración (catálogo, recetas, categorías, almacenes, proveedores) y Movimientos conservan el estilo anterior.
- Domicilios, NuevoDomicilio, Reportes, GestionPlatillos, GestionUsuarios y GeneradorQR no se rediseñaron: solo heredan la paleta por el remapeo de Tailwind y conservan su estructura anterior (`rounded-lg`, `shadow-lg`, botones `orange-600` rellenos, spinners con borde). No son referencia de este sistema.
- En Caja, el menú de estados (`shadow-xl`) y los avisos arriba a la derecha con animación `ease-out` propia siguen el estilo anterior. El detalle expandido de la factura ya sigue este sistema.
