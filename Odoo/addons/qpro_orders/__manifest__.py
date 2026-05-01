{
    'name': 'QPro Orders',
    'version': '17.0.1.0.0',
    'category': 'Restaurant',
    'summary': 'Gestión de mesas, pedidos y líneas de pedido para QPro',
    'description': """
QPro Orders
===========
Módulo central de la operación del restaurante. Gestiona:

- Mesas (qpro.table) con estados Disponible/Ocupada/EsperandoPago.
- Pedidos (qpro.order) con flujo de 7 estados desde borrador hasta pagado.
- Líneas de pedido (qpro.order.line) referenciando productos del catálogo.

Reemplaza las tablas Mesas, Pedidos y PedidoDetalles del sistema legacy.
""",
    'author': 'Equipo QPro - CECAR',
    'website': 'https://github.com/tu-usuario/QPro',
    'license': 'LGPL-3',

    # Dependencias:
    # - base: módulo raíz de Odoo.
    # - mail: para chatter automático en pedidos (mail.thread).
    # - product: para referenciar product.product en las líneas.
    # - qpro_core: para referenciar qpro.restaurant.
    'depends': ['base', 'mail', 'product', 'qpro_core'],

    # Orden importa: data → security → views → menus.
    'data': [
        # 1. Datos auxiliares (secuencias)
        'data/ir_sequence_data.xml',

        # 2. Seguridad: primero grupos, luego accesos
        'security/qpro_orders_groups.xml',
        'security/ir.model.access.csv',

        # 3. Vistas
        'views/qpro_table_views.xml',
        'views/qpro_order_line_views.xml',
        'views/qpro_order_views.xml',
        

        # 4. Menús (al final, porque referencian acciones de las vistas)
        'views/qpro_orders_menus.xml',
    ],

    'installable': True,
    'auto_install': False,
    'application': True,
}