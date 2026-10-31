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
