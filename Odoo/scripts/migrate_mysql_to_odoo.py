#!/usr/bin/env python3
"""
Script de migración: MySQL (restaurantebd) → Odoo 17 (PostgreSQL)

Ejecución:
    python migrate_mysql_to_odoo.py --db-host localhost --db-name restaurantebd \
        --db-user root --db-pass root \
        --odoo-url http://localhost:8069 \
        --odoo-db qpro_dev \
        --odoo-user admin \
        --odoo-pass admin

Orden de migración (datos maestros primero, luego transaccionales):
    1. Categorías de inventario (product.category)
    2. Platillos (product.template → product.product)
    3. Usuarios → res.users (solo mapeo; NO se crean passwords)
    4. Mesas (qpro.table)
    5. Clientes (res.partner)
    6. Direcciones de entrega (qpro.delivery.address)
    7. Pedidos (qpro.order) + Líneas (qpro.order.line)
    8. Pagos (qpro.payment)
    9. Facturas (qpro.invoice)
    10. Domicilios (qpro.delivery) + Líneas
"""
import argparse
import json
import sys
import xmlrpc.client
import pymysql  # pip install PyMySQL


# ── Helpers xmlrpc ────────────────────────────────────────────────────────────

def odoo_connect(url, db, user, password):
    common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common')
    uid = common.authenticate(db, user, password, {})
    if not uid:
        print("ERROR: Autenticación Odoo fallida")
        sys.exit(1)
    models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object')
    return uid, models, db, password


def odoo_search(models, db, uid, pwd, model, domain, fields=None):
    ids = models.execute_kw(db, uid, pwd, model, 'search', [domain])
    if not ids:
        return []
    return models.execute_kw(db, uid, pwd, model, 'read', [ids], {'fields': fields or []})


def odoo_create(models, db, uid, pwd, model, vals):
    return models.execute_kw(db, uid, pwd, model, 'create', [vals])


def odoo_write(models, db, uid, pwd, model, ids, vals):
    return models.execute_kw(db, uid, pwd, model, 'write', [[ids], vals])


# ── Mapeo de enums ────────────────────────────────────────────────────────────

STATE_ORDER_MAP = {
    'EnProceso': 'draft',
    'Listo': 'ready',
    'Entregado': 'served',
    'Pagado': 'paid',
    'Cancelado': 'cancelled',
}

STATE_DETAIL_MAP = {
    'Pendiente': 'pending',
    'EnPreparacion': 'preparing',
    'Listo': 'ready',
    'Cancelado': 'cancelled',
}

STATE_TABLE_MAP = {
    'Disponible': 'free',
    'Ocupada': 'occupied',
    'EsperandoPago': 'awaiting_payment',
}

PAYMENT_METHOD_MAP = {
    'Efectivo': 'cash',
    'Tarjeta': 'card',
    'QR': 'qr',
}

CATEGORY_TYPE_MAP = {
    'Ingrediente': 'ingredient',
    'Bebida': 'beverage',
    'MaterialLimpieza': 'cleaning',
    'ProductoTerminado': 'finished',
    'Otro': 'other',
}


# ── Pasos de migración ────────────────────────────────────────────────────────

def migrate_categories(cursor, odoo):
    """CategoriasInventario → product.category (con campos QPro extendidos)"""
    uid, models, db, pwd = odoo
    cursor.execute("SELECT Id, Nombre, Tipo, Color FROM CategoriasInventario WHERE Activo=1")
    rows = cursor.fetchall()
    mapping = {}  # mysql_id → odoo_id

    for row in rows:
        odoo_id = odoo_create(models, db, uid, pwd, 'product.category', {
            'name': row['Nombre'],
            'qpro_type': CATEGORY_TYPE_MAP.get(row['Tipo'], 'other'),
            'qpro_color': row['Color'] or '#3b82f6',
        })
        mapping[row['Id']] = odoo_id
        print(f"  Categoría: {row['Nombre']} → Odoo #{odoo_id}")

    return mapping


def migrate_platillos(cursor, odoo, cat_map):
    """Platillos → product.template (qpro_is_dish=True)"""
    uid, models, db, pwd = odoo
    cursor.execute("SELECT Id, Nombre, Descripcion, Precio, ImagenUrl, Categoria FROM Platillos")
    rows = cursor.fetchall()
    mapping = {}

    # Buscar o crear categoría por nombre string (campo legacy)
    def get_or_create_category(name):
        cats = odoo_search(models, db, uid, pwd, 'product.category', [('name', '=', name)], ['id'])
        if cats:
            return cats[0]['id']
        return odoo_create(models, db, uid, pwd, 'product.category', {'name': name})

    for row in rows:
        vals = {
            'name': row['Nombre'],
            'description_sale': row['Descripcion'] or '',
            'list_price': float(row['Precio']),
            'type': 'consu',
            'qpro_is_dish': True,
        }
        if row.get('Categoria'):
            vals['categ_id'] = get_or_create_category(row['Categoria'])
        if row.get('ImagenUrl') and len(row['ImagenUrl']) < 5_000_000:
            raw = row['ImagenUrl']
            if ',' in raw:
                raw = raw.split(',')[1]
            vals['image_1920'] = raw

        tmpl_id = odoo_create(models, db, uid, pwd, 'product.template', vals)
        # Obtener el product.product generado
        variants = odoo_search(models, db, uid, pwd, 'product.product',
                               [('product_tmpl_id', '=', tmpl_id)], ['id'])
        product_id = variants[0]['id'] if variants else tmpl_id
        mapping[row['Id']] = product_id
        print(f"  Platillo: {row['Nombre']} → Odoo #{product_id}")

    return mapping


def migrate_users(cursor, odoo):
    """Usuarios → intentar mapear a res.users existentes por nombre/login.
    NO se crean usuarios nuevos (se necesita admin para eso manualmente).
    """
    uid, models, db, pwd = odoo
    cursor.execute("SELECT Id, Nombre, Usuario, Rol FROM Usuarios")
    rows = cursor.fetchall()
    mapping = {}  # mysql_id → odoo_uid

    all_users = odoo_search(models, db, uid, pwd, 'res.users', [], ['id', 'name', 'login'])
    user_by_login = {u['login']: u['id'] for u in all_users}
    user_by_name = {u['name']: u['id'] for u in all_users}

    for row in rows:
        odoo_id = user_by_login.get(row['Usuario']) or user_by_name.get(row['Nombre'])
        if odoo_id:
            mapping[row['Id']] = odoo_id
            print(f"  Usuario mapeado: {row['Nombre']} → Odoo #{odoo_id}")
        else:
            print(f"  WARN: Usuario '{row['Nombre']}' no encontrado en Odoo. "
                  f"Crea el usuario manualmente con login='{row['Usuario']}'")
            mapping[row['Id']] = uid  # fallback: admin

    return mapping


def migrate_mesas(cursor, odoo, restaurant_id):
    """Mesas → qpro.table"""
    uid, models, db, pwd = odoo
    cursor.execute("SELECT Id, Numero, Estado FROM Mesas")
    rows = cursor.fetchall()
    mapping = {}

    for row in rows:
        odoo_id = odoo_create(models, db, uid, pwd, 'qpro.table', {
            'number': row['Numero'],
            'restaurant_id': restaurant_id,
            'state': STATE_TABLE_MAP.get(row['Estado'], 'free'),
        })
        mapping[row['Id']] = odoo_id
        print(f"  Mesa #{row['Numero']} → Odoo #{odoo_id}")

    return mapping


def migrate_clientes(cursor, odoo):
    """Clientes → res.partner"""
    uid, models, db, pwd = odoo
    cursor.execute("SELECT Id, Nombre, Telefono, Email FROM Clientes")
    rows = cursor.fetchall()
    mapping = {}

    for row in rows:
        odoo_id = odoo_create(models, db, uid, pwd, 'res.partner', {
            'name': row['Nombre'],
            'phone': row['Telefono'] or False,
            'email': row['Email'] or False,
            'customer_rank': 1,
        })
        mapping[row['Id']] = odoo_id
        print(f"  Cliente: {row['Nombre']} → Odoo #{odoo_id}")

    return mapping


def migrate_direcciones(cursor, odoo, cliente_map):
    """Direcciones → qpro.delivery.address"""
    uid, models, db, pwd = odoo
    cursor.execute("""
        SELECT Id, ClienteId, DireccionCompleta, Barrio,
               ReferenciasAdicionales, Ciudad, Departamento
        FROM Direcciones
    """)
    rows = cursor.fetchall()
    mapping = {}

    for row in rows:
        partner_id = cliente_map.get(row['ClienteId'])
        if not partner_id:
            print(f"  SKIP Dirección Id={row['Id']}: ClienteId={row['ClienteId']} no mapeado")
            continue
        odoo_id = odoo_create(models, db, uid, pwd, 'qpro.delivery.address', {
            'partner_id': partner_id,
            'street': row['DireccionCompleta'],
            'neighborhood': row['Barrio'] or False,
            'additional_ref': row['ReferenciasAdicionales'] or False,
            'city': row['Ciudad'] or 'Sincelejo',
            'state_name': row['Departamento'] or 'Sucre',
        })
        mapping[row['Id']] = odoo_id

    print(f"  Direcciones migradas: {len(mapping)}")
    return mapping


def migrate_pedidos(cursor, odoo, mesa_map, user_map, product_map):
    """Pedidos + PedidoDetalles → qpro.order + qpro.order.line"""
    uid, models, db, pwd = odoo
    cursor.execute("""
        SELECT p.Id, p.MesaId, p.UsuarioId, p.Estado, p.Fecha
        FROM Pedidos p
        ORDER BY p.Fecha ASC
    """)
    pedidos = cursor.fetchall()
    mapping = {}

    for pedido in pedidos:
        table_id = mesa_map.get(pedido['MesaId'])
        waiter_id = user_map.get(pedido['UsuarioId'], uid)

        if not table_id:
            print(f"  SKIP Pedido Id={pedido['Id']}: Mesa {pedido['MesaId']} no mapeada")
            continue

        # Obtener detalles
        cursor.execute("""
            SELECT PlatilloId, Cantidad, Nota, Estado,
                   (SELECT Precio FROM Platillos WHERE Id = PlatilloId) as Precio
            FROM PedidoDetalles
            WHERE PedidoId = %s
        """, (pedido['Id'],))
        detalles = cursor.fetchall()

        lines = []
        for d in detalles:
            prod_id = product_map.get(d['PlatilloId'])
            if not prod_id:
                continue
            lines.append((0, 0, {
                'product_id': prod_id,
                'quantity': d['Cantidad'],
                'price_unit': float(d['Precio'] or 0),
                'note': d['Nota'] or '',
                'state': STATE_DETAIL_MAP.get(d['Estado'], 'pending'),
            }))

        odoo_id = odoo_create(models, db, uid, pwd, 'qpro.order', {
            'table_id': table_id,
            'waiter_id': waiter_id,
            'state': STATE_ORDER_MAP.get(pedido['Estado'], 'draft'),
            'date_order': str(pedido['Fecha']),
            'order_line_ids': lines,
        })
        mapping[pedido['Id']] = odoo_id

    print(f"  Pedidos migrados: {len(mapping)}")
    return mapping


def migrate_pagos(cursor, odoo, pedido_map):
    """Pagos → qpro.payment"""
    uid, models, db, pwd = odoo
    cursor.execute("SELECT Id, PedidoId, Monto, MontoPropina, MetodoPago, Fecha FROM Pagos")
    rows = cursor.fetchall()
    mapping = {}

    for row in rows:
        order_id = pedido_map.get(row['PedidoId'])
        if not order_id:
            continue
        odoo_id = odoo_create(models, db, uid, pwd, 'qpro.payment', {
            'order_id': order_id,
            'amount': float(row['Monto']),
            'tip_amount': float(row['MontoPropina'] or 0),
            'payment_method': PAYMENT_METHOD_MAP.get(row['MetodoPago'], 'cash'),
            'date': str(row['Fecha']),
        })
        mapping[row['Id']] = odoo_id

    print(f"  Pagos migrados: {len(mapping)}")
    return mapping


def migrate_facturas(cursor, odoo, pago_map):
    """Facturas → qpro.invoice"""
    uid, models, db, pwd = odoo
    cursor.execute("""
        SELECT Id, PagoId, NitCliente, NombreCliente,
               Subtotal, Propina, Total, FechaEmision
        FROM Facturas
    """)
    rows = cursor.fetchall()

    for row in rows:
        payment_id = pago_map.get(row['PagoId'])
        if not payment_id:
            continue
        odoo_create(models, db, uid, pwd, 'qpro.invoice', {
            'payment_id': payment_id,
            'customer_nit': row['NitCliente'] or '',
            'customer_name': row['NombreCliente'] or '',
            'subtotal': float(row['Subtotal']),
            'tip': float(row['Propina'] or 0),
            'issue_date': str(row['FechaEmision']),
        })

    print(f"  Facturas migradas: {len(rows)}")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Migrar restaurantebd → Odoo')
    parser.add_argument('--db-host', default='localhost')
    parser.add_argument('--db-name', default='restaurantebd')
    parser.add_argument('--db-user', default='root')
    parser.add_argument('--db-pass', default='root')
    parser.add_argument('--odoo-url', default='http://localhost:8069')
    parser.add_argument('--odoo-db', required=True)
    parser.add_argument('--odoo-user', default='admin')
    parser.add_argument('--odoo-pass', default='admin')
    parser.add_argument('--restaurant-id', type=int, required=True,
                        help='ID del qpro.restaurant en Odoo donde se migran las mesas')
    parser.add_argument('--step', choices=[
        'all', 'categories', 'products', 'users', 'tables',
        'clients', 'addresses', 'orders', 'payments', 'invoices'
    ], default='all')
    args = parser.parse_args()

    # MySQL
    conn = pymysql.connect(
        host=args.db_host, db=args.db_name,
        user=args.db_user, password=args.db_pass,
        charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor,
    )
    cursor = conn.cursor()

    # Odoo
    odoo = odoo_connect(args.odoo_url, args.odoo_db, args.odoo_user, args.odoo_pass)
    print(f"Conectado a Odoo como UID={odoo[0]}")

    step = args.step

    print("\n=== PASO 1: Categorías de inventario ===")
    cat_map = migrate_categories(cursor, odoo)

    print("\n=== PASO 2: Platillos ===")
    product_map = migrate_platillos(cursor, odoo, cat_map)

    print("\n=== PASO 3: Usuarios (mapeo) ===")
    user_map = migrate_users(cursor, odoo)

    print("\n=== PASO 4: Mesas ===")
    mesa_map = migrate_mesas(cursor, odoo, args.restaurant_id)

    print("\n=== PASO 5: Clientes ===")
    cliente_map = migrate_clientes(cursor, odoo)

    print("\n=== PASO 6: Direcciones de entrega ===")
    direccion_map = migrate_direcciones(cursor, odoo, cliente_map)

    print("\n=== PASO 7: Pedidos + Líneas ===")
    pedido_map = migrate_pedidos(cursor, odoo, mesa_map, user_map, product_map)

    print("\n=== PASO 8: Pagos ===")
    pago_map = migrate_pagos(cursor, odoo, pedido_map)

    print("\n=== PASO 9: Facturas ===")
    migrate_facturas(cursor, odoo, pago_map)

    cursor.close()
    conn.close()
    print("\n✅ Migración completa.")


if __name__ == '__main__':
    main()
