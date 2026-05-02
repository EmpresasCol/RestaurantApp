{
    'name': 'QPro Payments',
    'version': '17.0.1.0.0',
    'category': 'Restaurant',
    'summary': 'Pagos y Facturas para pedidos QPro',
    'author': 'Equipo QPro - CECAR',
    'license': 'LGPL-3',
    'depends': ['qpro_orders'],
    'data': [
        'security/ir.model.access.csv',
        'data/ir_sequence_data.xml',
        'views/qpro_payment_views.xml',
        'views/qpro_invoice_views.xml',
        'views/qpro_payments_menus.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
}
