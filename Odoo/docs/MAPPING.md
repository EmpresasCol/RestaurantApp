# QPro — Mapeo de Migración: MySQL → Odoo (PostgreSQL)

> **Documento vivo.** Se actualiza a medida que avanza la migración.
> Última actualización: <fecha>
> Responsables: Mateo, Abrahan, Ivan

---

## 1. Contexto

QPro nació como un sistema con tres componentes:

- **API ASP.NET Core** (backend REST)
- **Frontend React + Tailwind** (web administrativa)
- **App Flutter** (móvil para meseros)

Todo conectado a una base de datos **MySQL** (`restaurantebd.sql`).

A partir de mayo de 2026 el proyecto se reestructura completamente
sobre **Odoo 17 Community** desplegado con Docker en VPS económico.

Este documento define **cómo cada tabla y entidad del sistema viejo
se traduce al ecosistema Odoo**, distinguiendo entre:

- **Modelos nativos de Odoo** que se reutilizan tal cual.
- **Modelos nativos extendidos** con campos específicos de QPro.
- **Modelos nuevos** con prefijo `qpro.` creados desde cero.
- **Funcionalidades nativas** que reemplazan tablas antiguas sin
  necesidad de modelo nuevo.

---

## 2. Principios de migración

1. **No reinventar lo que Odoo ya trae.** Si Odoo tiene un modelo
   nativo equivalente, se reutiliza. Solo se crean modelos nuevos
   para conceptos específicos del dominio "restaurante" que Odoo
   no contempla (mesas, pedidos de mesa, domicilios).

2. **Los modelos QPro nuevos llevan el prefijo `qpro.`** para
   diferenciarlos de los nativos.

3. **Los modelos nativos extendidos heredan con `_inherit`** y se
   mantienen en su nombre original (`product.product`, no
   `qpro.product`).

4. **Toda relación a un modelo nativo se hace por su nombre nativo**
   (ej. `partner_id = fields.Many2one('res.partner')`).

5. **Auditoría, mensajería interna y actividades** se resuelven con
   los mixins `mail.thread` y `mail.activity.mixin`, no con tablas
   propias.

---

## 3. Tabla maestra de mapeo

| # | Tabla MySQL | Modelo Odoo | Tipo | Módulo QPro responsable |
|---|---|---|---|---|
| 1 | `clientes` | `res.partner` | Nativo | qpro_core |
| 2 | `proveedores` | `res.partner` (supplier_rank > 0) | Nativo | qpro_inventory |
| 3 | `usuarios` | `res.users` | Nativo + grupos QPro | qpro_core |
| 4 | `usuariosfcm` | `qpro.fcm.token` | **Nuevo** | qpro_mobile_api |
| 5 | `direcciones` | `res.partner` (registros hijos) | Nativo | qpro_core |
| 6 | `mesas` | `qpro.table` | **Nuevo** | qpro_orders |
| 7 | `platillos` | `product.product` | Nativo extendido | qpro_orders |
| 8 | `categoriasinventario` | `product.category` | Nativo | qpro_inventory |
| 9 | `productosinventario` | `product.product` (type=product) | Nativo | qpro_inventory |
| 10 | `recetas` | `mrp.bom` | Nativo | qpro_recipes |
| 11 | `almacenes` | `stock.warehouse` + `stock.location` | Nativo | qpro_inventory |
| 12 | `stock` | `stock.quant` | Nativo (auto) | qpro_inventory |
| 13 | `movimientosinventario` | `stock.move` | Nativo | qpro_inventory |
| 14 | `lotes` | `stock.lot` | Nativo | qpro_inventory |
| 15 | `alertasinventario` | `stock.warehouse.orderpoint` | Nativo | qpro_inventory |
| 16 | `ordenescompra` | `purchase.order` | Nativo | qpro_inventory |
| 17 | `detallesordencompra` | `purchase.order.line` | Nativo | qpro_inventory |
| 18 | `pedidos` | `qpro.order` | **Nuevo** | qpro_orders |
| 19 | `pedidodetalles` | `qpro.order.line` | **Nuevo** | qpro_orders |
| 20 | `domicilios` | `qpro.delivery` | **Nuevo** | qpro_delivery |
| 21 | `domiciliodetalles` | `qpro.delivery.line` | **Nuevo** | qpro_delivery |
| 22 | `historialestadosdomicilio` | `qpro.delivery.state.log` | **Nuevo** | qpro_delivery |
| 23 | `configuraciondomicilios` | `res.config.settings` (extendido) | Nativo extendido | qpro_delivery |
| 24 | `facturas` | `account.move` | Nativo | qpro_billing |
| 25 | `pagos` | `account.payment` | Nativo | qpro_billing |
| 26 | `auditlog` | `mail.thread` (mixin) | Nativo | (todos) |
| 27 | (Restaurantes — nueva entidad) | `qpro.restaurant` | **Nuevo** | qpro_core |

**Resumen:** de las 27 tablas originales, solo **9 se traducen a
modelos QPro nuevos**. Las 18 restantes se resuelven con modelos
nativos de Odoo.

---

## 4. Detalles por dominio

### 4.1 Personas (clientes, proveedores, usuarios)

#### `clientes` → `res.partner`

`res.partner` es el modelo universal de "tercero" en Odoo. Sirve para
clientes, proveedores, contactos, empleados externos, sucursales, etc.

**Campos clave de `res.partner`:**

- `name` — nombre o razón social
- `email`, `phone`, `mobile`
- `vat` — NIT / cédula
- `street`, `city`, `state_id`, `country_id`, `zip`
- `customer_rank` — entero, > 0 indica que es cliente
- `supplier_rank` — entero, > 0 indica que es proveedor
- `parent_id` — para sucursales o direcciones de envío
- `child_ids` — direcciones adicionales
- `type` — `contact` / `invoice` / `delivery` / `other`

**Pendiente:** ver qué campos extra tiene `clientes` en MySQL para
saber si requiere un `_inherit` con campos QPro adicionales.

#### `proveedores` → `res.partner` con `supplier_rank > 0`

Mismo modelo. Para distinguir proveedores se usa el flag.

#### `usuarios` → `res.users`

`res.users` es el modelo de usuarios autenticables del sistema.
Internamente cada `res.users` tiene un `partner_id` ligado a `res.partner`.

**Grupos personalizados QPro (a crear en `qpro_core`):**

- `qpro.group_waiter` — Mesero
- `qpro.group_chef` — Cocinero
- `qpro.group_cashier` — Cajero
- `qpro.group_delivery` — Domiciliario
- `qpro.group_manager` — Administrador de restaurante

Los grupos heredan de `base.group_user` (empleado interno).

#### `usuariosfcm` → `qpro.fcm.token` (nuevo)

Tabla específica para almacenar tokens de Firebase Cloud Messaging
asociados a cada usuario, para enviar notificaciones push a Flutter.

**Estructura propuesta:**

```python
class QproFcmToken(models.Model):
    _name = 'qpro.fcm.token'
    _description = 'Token FCM de usuario para notificaciones push'

    user_id = fields.Many2one('res.users', required=True, ondelete='cascade')
    token = fields.Char(required=True)
    device_type = fields.Selection([('android','Android'),('ios','iOS')])
    last_used = fields.Datetime()
    active = fields.Boolean(default=True)
```

#### `direcciones` → `res.partner` (registros hijos)

Odoo modela direcciones múltiples como sub-partners. Un cliente
"Juan Pérez" tiene `child_ids` que son direcciones con `type='delivery'`.

---

### 4.2 Catálogo y productos

#### `platillos` → `product.product`

Los platillos son productos vendibles. Se reutiliza `product.product`
y se extiende con campos específicos de restaurante:

```python
class ProductTemplate(models.Model):
    _inherit = 'product.template'

    qpro_is_dish = fields.Boolean('Es platillo')
    qpro_prep_time = fields.Integer('Tiempo de preparación (min)')
    qpro_is_daily_special = fields.Boolean('Plato del día')
    qpro_kitchen_notes = fields.Text('Notas para cocina')
```

#### `categoriasinventario` → `product.category`

Categorías jerárquicas nativas. Soporta árbol (categoría padre / hija).

#### `productosinventario` (ingredientes) → `product.product`

Mismo modelo que platillos, pero con `type='product'` (producto
almacenable, controla stock) en vez de `type='consu'` (consumible
sin control de stock).

#### `recetas` → `mrp.bom` (Bill of Materials)

Una receta es una "lista de materiales" en términos ERP: el platillo
(producto final) consume X gramos del ingrediente A, Y gramos del
ingrediente B, etc.

Cuando el módulo `manufacturing` (MRP) está instalado, al vender un
platillo Odoo puede descontar automáticamente los ingredientes del
inventario.

---

### 4.3 Inventario y compras

Todo este dominio se resuelve con los módulos nativos `stock` y
`purchase` de Odoo, que son maduros y completos. El módulo
`qpro_inventory` solo agrega configuración específica y vistas
adaptadas al lenguaje de un restaurante.

---

### 4.4 Operación del restaurante (núcleo de QPro)

Aquí están los modelos QPro nuevos. Es el dominio único que justifica
todo el desarrollo personalizado.

#### `mesas` → `qpro.table`

Representa una mesa física del restaurante.

**Estructura propuesta** (a refinar con CREATE TABLE):

```python
class QproTable(models.Model):
    _name = 'qpro.table'
    _description = 'Mesa de restaurante'

    name = fields.Char(required=True)
    number = fields.Integer(required=True)
    capacity = fields.Integer()
    restaurant_id = fields.Many2one('qpro.restaurant', required=True)
    state = fields.Selection([
        ('free', 'Libre'),
        ('occupied', 'Ocupada'),
        ('reserved', 'Reservada'),
        ('cleaning', 'En limpieza'),
    ], default='free')
    qr_code = fields.Binary('QR de menú')
```

#### `pedidos` → `qpro.order`

Modelo central de la operación. Equivale conceptualmente a `pos.order`
del POS de Odoo, pero diseñado específicamente para el flujo de QPro.

**Estados del pedido:**
- `draft` — borrador
- `sent` — enviado a cocina
- `preparing` — en preparación
- `ready` — listo para servir/entregar
- `served` — entregado al cliente
- `paid` — pagado (genera `account.move`)
- `cancelled` — cancelado

#### `pedidodetalles` → `qpro.order.line`

Líneas del pedido. Cada platillo pedido es una línea con cantidad,
precio, notas para cocina, estado individual.

---

### 4.5 Domicilios

Dominio específico de QPro. Tres modelos nuevos.

#### `domicilios` → `qpro.delivery`
#### `domiciliodetalles` → `qpro.delivery.line`
#### `historialestadosdomicilio` → `qpro.delivery.state.log`

`configuraciondomicilios` se modela como extensión de
`res.config.settings` para que aparezca en Ajustes → QPro.

---

### 4.6 Facturación

#### `facturas` → `account.move`

Modelo nativo completo. Cuando un `qpro.order` cambia a estado `paid`,
se genera automáticamente un `account.move` con sus líneas.

#### `pagos` → `account.payment`

Modelo nativo de pagos con conciliación bancaria, múltiples métodos
de pago (efectivo, tarjeta, transferencia), etc.

---

### 4.7 Auditoría

#### `auditlog` → `mail.thread`

Cualquier modelo que herede de `mail.thread` lleva su propio
"chatter" con log de cambios automáticos, comentarios y actividades.

Por defecto, todos los modelos QPro principales heredarán de
`mail.thread`:

```python
class QproOrder(models.Model):
    _name = 'qpro.order'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    # ...
```

---

## 5. Estrategia de migración de datos

> **NOTA:** la migración de datos del MySQL viejo al PostgreSQL de
> Odoo se hará en una fase posterior, una vez que todos los modelos
> QPro estén implementados y probados.

**Enfoque:**

1. Exportar datos de MySQL a CSV por tabla.
2. Limpiar y transformar cada CSV con un script Python.
3. Importar a Odoo usando:
   - La función nativa **Importar** de Odoo (para datos simples).
   - Scripts XML-RPC / JSON-RPC (para relaciones complejas).
4. Verificar integridad referencial post-importación.

---

## 6. Estado de migración por módulo

| Módulo | Estado | Fecha |
|---|---|---|
| qpro_core | 🟢 En desarrollo | 2026-05-01 |
| qpro_orders | ⚪ Pendiente | — |
| qpro_kitchen | ⚪ Pendiente | — |
| qpro_billing | ⚪ Pendiente | — |
| qpro_delivery | ⚪ Pendiente | — |
| qpro_inventory | ⚪ Pendiente | — |
| qpro_recipes | ⚪ Pendiente | — |
| qpro_mobile_api | ⚪ Pendiente | — |
| qpro_portal_qr | ⚪ Pendiente | — |

**Leyenda:** 🟢 En desarrollo · 🟡 En pruebas · ✅ Completado · ⚪ Pendiente