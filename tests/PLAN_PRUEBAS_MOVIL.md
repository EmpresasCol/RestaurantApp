# Plan de pruebas manuales: app móvil (meseros y domiciliarios)

Lo que las pruebas automáticas no cubren: cámara, push, tiempo real con la API publicada y el
recorrido completo con la web de cocina y caja. Usuarios de la semilla: `juan.mesero`,
`domiciliario`, `carlos.cocina`, `pedro.caja` (clave en `restaurantebd.sql`).

## Preparación

1. Aplicar `migraciones/2026-11-03_solicitudes_cuenta.sql` en la base que use la API (TiDB antes de desplegar).
2. Instalar la app: `flutter build apk --release --split-per-abi` y copiar `app-arm64-v8a-release.apk` al celular.
   Contra la API local: `--dart-define=API_BASE_URL=http://<IP del PC>:5000`.
3. Abrir la web en otra pantalla con Cocina y Caja.

## Mesero

| ID | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| MOV-01 | Un solo login | Entrar con `juan.mesero` y luego con `domiciliario` | Cada uno llega a su inicio; `pedro.caja` ve "Tu usuario entra por la web" |
| MOV-02 | Tomar pedido | Mesa libre → Tomar pedido → 2 platos con nota → Enviar a cocina | La comanda aparece en Cocina sin recargar; la mesa queda "En cocina" |
| MOV-03 | Agotado | Dejar un insumo en 0 desde Inventario | El plato sale "No disponible por el momento" y su + está apagado |
| MOV-04 | Tope de porciones | Plato con "Quedan 2" | No deja pedir más de 2 |
| MOV-05 | Editar antes de cocina | Pedido "Sin empezar" → Editar → cambiar cantidad → Guardar | Cocina ve el cambio; el inventario se ajusta solo por la diferencia |
| MOV-06 | Cocina empieza | En Cocina tocar "Empezar a preparar" | En la app el pedido pasa a "Preparando" y ya no muestra Editar ni Cancelar |
| MOV-07 | Agregar después | Con un pedido en preparación, tocar Agregar | Se crea un pedido nuevo de la misma mesa; Cocina solo ve lo nuevo |
| MOV-08 | Cancelar | Pedido "Sin empezar" → Cancelar (doble toque) | Desaparece de Cocina y el stock vuelve |
| MOV-09 | Pedido listo | Cocina marca Listo | Suena el aviso, aparece en "Para servir" y en Avisos |
| MOV-10 | Servir | "Servido" (doble toque) | El pedido queda "Servido" y Caja ya lo puede cobrar |
| MOV-11 | Pedir la cuenta | Mesa → Pedir la cuenta | En Caja la mesa sube al inicio con "Pidió la cuenta"; Caja imprime la cuenta |
| MOV-12 | Efectivo | Registrar pago → Efectivo → Avisar a caja | Caja ve "Paga en efectivo: el mesero lo trae" con el método ya elegido |
| MOV-13 | Datáfono | Registrar pago → Tarjeta | Caja ve "Pagó con tarjeta en el datáfono" |
| MOV-14 | Transferencia | Registrar pago → Transferencia → Tomar foto → Avisar a caja | Sin foto no deja enviar; Caja ve la foto al abrir el cobro |
| MOV-15 | Cobro cierra la solicitud | Caja cobra la mesa | La mesa vuelve a Libre en la app; la solicitud queda ligada a la factura |
| MOV-16 | El mesero no cobra | (API) `PUT pedidos/{id}/estado` con `Pagado` y token de mesero | 403 "El pago se registra en caja" |
| MOV-17 | Sin red | Activar modo avión con la app abierta | Aviso "Sin conexión…" y se ve lo último que cargó; al volver la red se actualiza sola |
| MOV-18 | Sesión vencida | Reiniciar la API sin `Jwt__Key` | La app vuelve al login con "Tu sesión venció" |
| MOV-19 | Llamada de mesa | Desde el QR de la mesa 4: "Llamar al mesero" | En el salón aparece "Te llaman · Mesa 4 te llama" y la mesa lleva campana; el comensal ve "Solicitud recibida" |
| MOV-20 | Dos meseros a la vez | Dos celulares con la llamada; tocar "Voy" casi al mismo tiempo | Uno queda "Vas tú"; al otro le sale "<Nombre> ya va para la mesa 4" y ve el mismo estado |
| MOV-21 | Atendida | "Atendida" en la tarjeta | Desaparece en los dos celulares y en el tablero de Caja; el comensal ve "Ya te atendieron" |
| MOV-22 | Salir quita los avisos | Cerrar sesión y llamar desde el QR | Ese celular ya no recibe el push de la llamada |

## Domiciliario

| ID | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| DOM-01 | Recoger | Domicilio Listo → Recoger (doble toque) | Pasa a "Mis entregas"; otro domiciliario ya no lo ve |
| DOM-02 | Salir | Salir a entregar | Estado "En camino" en la web de Domicilios |
| DOM-03 | Entregar y cobrar | Entregado y cobrado | Sale de la lista; sube "entregas hoy" y Caja lo cuenta en el cierre |
| DOM-04 | Contacto | Llamar, WhatsApp, Abrir en el mapa | Abren el marcador, WhatsApp con +57 y Google Maps con la dirección |

## Celular real (pendiente de equipo)

- Cámara del celular (MOV-14) en Android e iPhone.
- Push con la app cerrada (MOV-09) en Android. En iPhone requiere `GoogleService-Info.plist`.
- Push de llamada con la app en segundo plano y cerrada (MOV-19): al tocarlo abre la mesa. Anotar modelo, versión de Android, si estaba en ahorro de batería y cuánto tardó.
- Avisos del comensal (Web Push), en la URL https de producción:
  - Android Chrome: "Avisarme cuando cambie mi pedido" → aceptar → bloquear el teléfono → Cocina marca Listo. Debe llegar "Mesa N: tu pedido está listo…"; al tocarlo abre la carta con el estado al día.
  - iPhone (iOS 16.4 o posterior): sin agregar a inicio la página explica cómo hacerlo; agregada a inicio y abierta desde ahí, aceptar y repetir el caso anterior.
  - Rechazar el permiso: el seguimiento se sigue viendo en la página.
  - Pagar toda la cuenta en Caja: llega "Tu cuenta quedó pagada" y la página deja de mostrar los pedidos.
  - Con el teléfono apagado no llega nada en ese momento; al encenderlo y abrir la página se ve el estado real (el aviso vence a la hora).
