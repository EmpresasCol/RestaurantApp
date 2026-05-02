{
    'name': 'QPro Inventory',
    'version': '17.0.1.0.0',
    'category': 'Restaurant',
    'summary': 'Extensión de inventario para QPro: categorías tipadas y FIFO automático',
    'author': 'Equipo QPro - CECAR',
    'license': 'LGPL-3',
    # stock trae: product.category, stock.quant, stock.lot, stock.move, stock.warehouse
    # purchase trae: purchase.order, purchase.order.line
    'depends': ['qpro_orders', 'stock', 'purchase'],
    'data': [
        'security/ir.model.access.csv',
        'views/qpro_product_category_views.xml',
        'views/qpro_product_template_views.xml',
        'views/qpro_inventory_menus.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
}
