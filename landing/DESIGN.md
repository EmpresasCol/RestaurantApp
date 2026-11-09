# Qpro — Landing comercial

Página para conseguir restaurantes clientes. Es independiente de la web del proyecto. Una sola acción principal: **agendar una demo gratis** (formulario que abre WhatsApp con el mensaje armado; alternativa por correo).

## Identidad

- Colores del logo: espresso `#2A1D15`, caramelo `#C8955E` (texto sobre claro: `#865B35`), crema `#FBF6F0`, caramelo suave `#F5E9DA`, petróleo `#1E505A`. Fondos planos, sin degradados.
- Tipografía única: Manrope 500/600/700. Tamaños en la escala de Tailwind (12 a 72 px). Sin cursivas.
- Íconos: Phosphor (`@phosphor-icons/react`).
- Radios: 8, 12, 16, 24 px y píldora. Botón principal: píldora de 56 px, espresso, con círculo caramelo que gira la flecha al pasar el mouse.

## Recorrido

1. Hero: titular, demo gratis, tres pruebas sin cifras inventadas, celular con el carrito real, pedidos que llegan en pila y sello giratorio «escanea · pide · disfruta».
2. Franja inclinada con tipos de restaurante.
3. Antes y después: interruptor «Sin Qpro / Con Qpro» sobre cinco problemas del servicio.
4. Demo interactiva (momento firma): el visitante pide en la mesa 4, cocina lo prepara, caja cobra y el inventario baja por receta.
5. Frase que se enciende palabra por palabra con el scroll.
6. Seis módulos con capturas reales en un panel fijo (escritorio) o tarjetas apiladas (móvil).
7. Roles y pantallas, tres pasos para empezar, dos planes sin precio («precio según tu restaurante»), preguntas frecuentes con schema FAQ, contacto y cierre.

## Movimiento

Curva base `cubic-bezier(0.22, 1, 0.36, 1)`. Entradas de 32 px al aparecer, una sola vez. Píldoras compartidas (`layoutId`) en navegación, interruptor y etapas de la demo. Con movimiento reducido: sin desplazamientos, franja y sello quietos, frase visible completa.

## Contenido

No hay testimonios, clientes ni métricas inventadas. Las capturas usan datos de demostración. Los datos de contacto y legales viven en `site.config.json`. Páginas aparte: `privacidad.html`, `terminos.html` y un 404 con un ticket de cocina extraviado, todas en HTML estático con la misma hoja de estilos.
