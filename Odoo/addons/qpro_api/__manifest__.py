{
    'name': 'QPro API',
    'version': '17.0.1.0.0',
    'category': 'Restaurant',
    'summary': 'Controladores HTTP REST que reemplazan la API .NET',
    'author': 'Equipo QPro - CECAR',
    'license': 'LGPL-3',
    'depends': ['qpro_payments', 'qpro_delivery', 'qpro_inventory'],
    'data': [
        'security/ir.model.access.csv',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
}
