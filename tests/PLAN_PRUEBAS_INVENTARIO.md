# Plan de pruebas de funcionamiento: inventario y disponibilidad de platillos

Fecha: 30/10/2026. Alcance: descuento de insumos por recetas, bloqueo de pedidos sin
ingredientes, carta con "No disponible por el momento" y movimientos manuales de inventario.

## 1. Regla de negocio

- Un pedido (mesa, menú QR, mesero, domicilio del personal o domicilio público) **solo se
  guarda si hay insumos para todo lo pedido**. Si falta algo, la API responde 400 con
  `Platillo no disponible por el momento: <nombres>. No hay ingredientes suficientes.` y no
  guarda nada: ni pedido, ni ocupación de mesa, ni movimiento de stock.
- Al editar un pedido, lo que ese mismo pedido ya consumió cuenta como disponible: solo se
  exige stock para la diferencia.
- La carta (`GET /api/platillos`) devuelve `disponible` y `porcionesDisponibles`:
  - `porcionesDisponibles` = mínimo, entre los insumos obligatorios de la receta, de
    `existencias totales ÷ cantidad por porción` (redondeado hacia abajo).
  - Un insumo inactivo o con stock negativo cuenta como 0.
  - Los insumos marcados como opcionales no bloquean la venta.
  - Un platillo sin receta usa el producto de nombre idéntico (bebidas embotelladas). Si
    tampoco existe, no tiene control de inventario: `porcionesDisponibles = null`, `disponible = true`.
- El stock nunca queda negativo.

## 2. Pruebas automáticas

| Capa | Archivo | Qué cubre |
| --- | --- | --- |
| API | `RestaurantApi.Tests/DisponibilidadTests.cs` | 11 casos: rechazo sin stock, límite exacto, edición, PUT parcial, domicilio público, carta, insumo inactivo, opcional, stock negativo heredado, ajuste a 0, lotes |
| API | `InventarioServiceTests.cs`, `CorreccionesTests.cs` | Descuento, devolución y cancelación (pruebas ya existentes) |
| Web | `src/__tests__/disponibilidad.test.js` | Tope de porciones en el carrito y estado agotado |

Ejecución:

```bash
dotnet test tests/RestaurantApi.Tests
```

```bash
cd web/mi-restaurante && npm test -- --watchAll=false
```

Resultado al cierre: API 85/85, web 36/36.

## 3. Pruebas manuales (end to end)

Preparación: inicia sesión como Administrador. En Inventario → Recetas, confirma que
"Hamburguesa Clasica" usa 0,20 kg de "Carne de res". En Inventario → Movimientos, registra un
**Ajuste** de "Carne de res" a **1,00** en el almacén de cocina. Con eso alcanzan 5 hamburguesas.

| ID | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| INV-01 | Carta con porciones | Abrir el menú QR de la mesa 1 | Hamburguesa visible y pedible; en el carrito no deja subir de 5 |
| INV-02 | Pedido al límite | Pedir 5 hamburguesas desde el QR | Pedido creado; stock de carne = 0,00; la mesa queda Ocupada |
| INV-03 | Platillo agotado en la carta | Recargar el menú QR | Hamburguesa en gris con "No disponible por el momento", sin botón + ni "Agregar"; no sale en Destacados |
| INV-04 | Pedido rechazado | Con la carta abierta desde antes de INV-02, pedir 1 hamburguesa | Mensaje "Platillo no disponible por el momento: Hamburguesa Clasica…"; no se crea pedido; la carta se refresca |
| INV-05 | App del mesero | En la app, nuevo pedido → tocar Hamburguesa | Aviso "no disponible por el momento"; no se agrega |
| INV-06 | Domicilio del personal | Domicilios → Nuevo domicilio | Botón "No disponible por el momento" deshabilitado |
| INV-07 | Domicilio público | Pedir hamburguesa desde la página pública | 400 con el mismo mensaje; no se crea domicilio |
| INV-08 | Reponer stock | Movimiento **Entrada** de 0,40 kg de carne | La carta muestra la hamburguesa disponible con tope 2 |
| INV-09 | Editar sin pedir más | Editar el pedido de INV-02 dejando 5 | Se guarda (usa lo que ya consumió) |
| INV-10 | Editar pidiendo más | Editar el pedido de INV-02 a 8 (faltan 3 y solo alcanzan 2) | Rechazado; stock sin cambios |
| INV-11 | Cancelar devuelve | Cancelar el pedido de INV-02 | La carne vuelve a 1,40 kg (1,00 + 0,40) |
| INV-12 | Ingrediente opcional | Agregar a la receta un insumo sin stock marcado Opcional | El platillo sigue disponible |
| INV-13 | Insumo inactivo | Desactivar "Carne de res" | Hamburguesa "No disponible por el momento" |
| INV-14 | Platillo sin receta | Crear un platillo sin receta ni producto homónimo | Siempre disponible (sin control de inventario) |
| INV-15 | Salida mayor al stock | Movimiento Salida de 999 | 400 "Stock insuficiente" |
| INV-16 | Ajuste a cero | Movimiento Ajuste con cantidad 0 | Aceptado; stock 0; los lotes quedan en 0 |
| INV-17 | Salida con lotes | Producto con lote de 100, Merma de 30 | Stock 70 y lote 70 |
| INV-18 | Cantidad 0 o negativa | Entrada o Salida con 0 o −5 | 400 |
| INV-19 | Datos heredados | Ejecutar la consulta de la sección 5 en TiDB | Sin filas; si hay, corregir con un Ajuste |

Registrar cada caso con: fecha, quién lo probó, resultado (Pasa / Falla) y evidencia
(captura o respuesta HTTP).

## 4. Fallos encontrados y estado

### Corregidos

1. **Se podía pedir sin ingredientes.** Ningún endpoint de pedido o domicilio revisaba el
   stock; el servicio descontaba lo que hubiera y solo generaba una alerta. Ahora se rechaza
   antes de guardar en `PedidosController` (crear, editar completo, PUT parcial),
   `DomiciliosController` (crear), `DomiciliosPublicoController` (crear y editar) y
   `PedidoDetallesController`.
2. **La carta no sabía qué estaba agotado.** `PlatilloDto` ahora trae `disponible` y
   `porcionesDisponibles`; el menú QR, Nuevo domicilio y la app Flutter lo usan.
3. **`PedidoDetallesController` no tocaba el inventario.** Crear, editar o borrar un detalle
   no descontaba ni devolvía stock. Ahora valida y sincroniza.
4. **Un Ajuste no podía dejar el stock en 0** (la validación exigía ≥ 0,01).
5. **Salida, Merma y Ajuste no descontaban de los lotes**: los lotes mostraban más
   existencias que el stock y el reporte de vencimientos quedaba inflado.
6. **El costo promedio se calculaba mal con stock previo ≤ 0** (podía dividir entre 0).
7. **Se aceptaba un costo unitario negativo** en los movimientos.
8. **El stock negativo heredado de versiones anteriores contaba como existencia.** Ahora
   cuenta como 0 para la disponibilidad.

### Pendientes (riesgo conocido)

1. **Concurrencia.** Dos pedidos simultáneos por el último insumo pueden pasar la
   validación a la vez. El descuento nunca baja de 0 y genera alerta, pero se vende una
   porción sin insumo. La solución completa es un token de concurrencia en `Stock` o
   bloquear la fila al descontar.
2. **Actualización perdida en `Stock`.** Sin token de concurrencia, dos descuentos al mismo
   tiempo pueden dejar el stock más alto que el real.
3. **Unidades.** `Receta.UnidadMedida` no se convierte: si la receta está en kg y el
   producto en gramos, el descuento sale 1000 veces menor. Las recetas deben usar la
   misma unidad que el producto.
4. **Kárdex de ajustes.** Un Ajuste guarda como cantidad el total nuevo, no la diferencia.
5. **Referencias manuales.** Un movimiento manual cuya referencia empiece por
   `Pedido #N - ` se mezcla con los del pedido N al sincronizar.
6. **El menú QR no se actualiza solo** (el hub de SignalR exige sesión). Se refresca al
   abrirlo y después de cada envío.

## 5. Consulta para datos heredados

```sql
SELECT s.Id, p.Codigo, p.Nombre, s.AlmacenId, s.Cantidad
FROM Stock s JOIN ProductosInventario p ON p.Id = s.ProductoId
WHERE s.Cantidad < 0;

SELECT l.Id, l.NumeroLote, l.ProductoId, l.CantidadActual
FROM Lotes l WHERE l.CantidadActual < 0;
```

## 6. Operación diaria del inventario (31/10/2026)

Antes de probar: ejecutar `migraciones/2026-10-31_presentaciones_compra.sql` una vez en la
base (local y TiDB). Crea `PresentacionesCompra` y convierte los `CodigoBarras` existentes en
presentaciones "por unidad". Es idempotente.

Modelo: el **insumo** (lo que gasta la receta, en su unidad) está separado del **producto de
compra** (`PresentacionCompra`: "Caja 10 kg" = 10 kg del insumo, con su código de barras). Un
insumo admite varias presentaciones, así que varios códigos llevan al mismo insumo.

Automáticas: `ComprasTests.cs` (11 casos) y `src/__tests__/inventario.test.js`.

| ID | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| OPE-01 | Hoy | Abrir Inventario | Indicadores de agotados, por pedir, por vencer, vencidos y pedidos por llegar; cada uno lleva a su pantalla |
| OPE-02 | Ficha | Tocar un insumo en cualquier lista | Stock, cobertura, niveles, lotes con vencimiento, presentaciones, platillos que lo usan y movimientos |
| OPE-03 | Niveles | En la ficha, Ajustar → punto 20, máximo 50 | Se guardan sin borrar la imagen ni el código del insumo |
| OPE-04 | Código nuevo | Recibir → escanear un código desconocido | Panel "Código nuevo": elegir insumo y "Caja de 12"; la línea entra con 12 unidades por caja |
| OPE-05 | Multi-código | Asociar al mismo insumo el código de la unidad y el de la caja | Ambos se reconocen; la caja suma 12, la unidad 1 |
| OPE-06 | Lector de mano | Con una pistola USB, escanear en el campo de Recibir | Agrega la línea al leer (Enter automático); escanear otra vez la misma caja suma 1 |
| OPE-07 | Cámara | En el celular (https), Recibir → Cámara | Abre la cámara trasera; al leer el código agrega la línea y vibra |
| OPE-08 | Perecedero | Recibir un insumo marcado perecedero sin fecha | No deja registrar; con "dura N días" sugiere la fecha |
| OPE-09 | Fecha vencida | Recibir con fecha de ayer | 400 "la fecha de vencimiento ya pasó" |
| OPE-10 | Entrada | Registrar 2 cajas a $300.000 | Stock +20 kg, lote con vencimiento, movimiento Entrada, costo promedio ponderado y precio de la caja actualizado |
| OPE-11 | Qué pedir | Insumo con 8 kg, punto 20, máximo 50, caja de 10 | Sugiere 5 cajas; tras pedir 40 kg sugiere 1 caja |
| OPE-12 | Orden y WhatsApp | Crear orden → Enviar por WhatsApp | Abre WhatsApp con el pedido en cajas; la orden pasa a "Enviada" |
| OPE-13 | Recibir orden | Órdenes → Recibir | Precarga lo pendiente; parcial queda "Llegó una parte", completa "Recibida" |
| OPE-14 | Orden manual | Pedidos → Orden manual | Proveedor, insumos y precios libres |
| OPE-15 | Vencidos | Lote vencido → Dar de baja (dos toques) | Sale del stock como Merma, el lote queda "Vencido" y se informa la pérdida |
| OPE-16 | Conteo | Contar 92 kg donde el sistema dice 100 | Ajuste de 8 kg, lotes descontados, diferencia valorizada; contar lo mismo otra vez no genera ajuste |
| OPE-17 | Conteo escaneando | Escanear 3 veces la caja de 10 kg | El conteo de ese insumo sube a 30 |
| OPE-18 | Celular | Repetir OPE-04, 10 y 16 a 390 px | Todo cabe sin desplazamiento horizontal; botones de 44 px o más |

## 7. Movimientos, configuración y reglas de la vida real (31/10/2026)

Automáticas: `InventarioRealTests.cs` (8 casos) y la prueba de signos en `inventario.test.js`.

Reglas nuevas:
- **Lo vencido no se usa:** un lote con fecha pasada sigue en bodega hasta darlo de baja,
  pero no se vende, no se gasta en recetas y no cuenta para "disponible" ni para el estado.
- **Niveles con decimales** (2,5 kg). **Receta en la unidad del insumo** y sin insumos repetidos.
- **Kárdex:** un ajuste guarda la diferencia (100 → 96 = 4), no el total.
- **Código interno automático** (PROD-021) y **código de barras único** entre insumos y presentaciones.
- Almacén o proveedor con historial: se desactiva, no se elimina.

| ID | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| REAL-01 | Vencido no se vende | Insumo cuyo único lote venció | Platillo "No disponible por el momento"; la ficha avisa los vencidos |
| REAL-02 | Corregir fecha | Vencimientos o ficha → lápiz → nueva fecha | El lote vuelve a ser utilizable y sale de vencidos |
| REAL-03 | Traslado | Movimientos → Registrar → Traslado 4 L Bodega → Bar | Dos movimientos (salida y llegada); el lote viaja con su fecha |
| REAL-04 | Merma / salida | Registrar → Merma "Se cayó" 1 kg | Baja el stock y el lote más próximo a vencer |
| REAL-05 | Ajuste | Registrar → Ajuste a 96 donde hay 100 | Kárdex muestra ±4 con "100 → 96" |
| REAL-06 | Nuevo insumo escaneando | Configuración → Catálogo → Nuevo → escanear código | Se crea con PROD-0xx y el código; escanearlo en Recibir lo reconoce |
| REAL-07 | Producto nuevo al recibir | Recibir → código desconocido → "Crear insumo nuevo" | Se crea y entra a la recepción |
| REAL-08 | Receta | Recetas → agregar insumo y cantidad | Cantidad en la unidad del insumo; costo y % del precio se actualizan |
| REAL-09 | Kárdex | Movimientos → 30 días, filtro Merma | Agrupado por día, con quién lo hizo y el valor perdido |
| REAL-10 | Desactivar | Intentar eliminar un almacén con historial | Mensaje: desactívalo en lugar de eliminarlo |
