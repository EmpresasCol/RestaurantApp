{
    'name': 'QPro Core',
    'version': '17.0.1.0.0',
    'category': 'Restaurant',
    'summary': 'Módulo base del sistema de gestión de restaurantes QPro',
    'description': """
QPro Core
=========
Módulo base del sistema QPro. Define las entidades fundamentales
compartidas por el resto de módulos QPro (qpro_orders, qpro_kitchen,
qpro_delivery, qpro_inventory, qpro_billing).
""",
    'author': 'Equipo QPro - CECAR',
    'website': 'https://github.com/tu-usuario/QPro',
    'license': 'LGPL-3',

    # Otros módulos de Odoo que necesitamos que estén instalados antes que el nuestro.
    # 'base' es el módulo raíz de Odoo, siempre se incluye.
    'depends': ['base'],

    # Archivos que Odoo carga al instalar el módulo, EN ORDEN.
    # El orden importa: primero seguridad, luego vistas.
    'data': [
        'security/ir.model.access.csv',
        'views/qpro_restaurant_views.xml',
    ],

    # True = aparece en la lista de Apps instalables.
    'installable': True,
    # False = no se instala automáticamente con dependencias.
    'auto_install': False,
    # True = es una "Application" visible en el módulo Apps.
    'application': True,
}