{
    'name': 'QPro Delivery',
    'version': '17.0.1.0.0',
    'category': 'Restaurant',
    'summary': 'Gestión de pedidos a domicilio para QPro',
    'author': 'Equipo QPro - CECAR',
    'license': 'LGPL-3',
    'depends': ['qpro_orders', 'mail'],
    'data': [
        'security/ir.model.access.csv',
        'data/ir_sequence_data.xml',
        'views/qpro_delivery_address_views.xml',
        'views/qpro_delivery_views.xml',
        'views/qpro_delivery_menus.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
}
