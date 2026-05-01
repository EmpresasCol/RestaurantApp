# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError


class QproRestaurant(models.Model):
    """Representa un restaurante o sucursal gestionada por QPro.

    Cada restaurante agrupa sus propios pedidos, mesas, personal y
    configuración. Todo el resto del sistema (pedidos, cocina,
    domicilios) referencia a un qpro.restaurant.
    """

    _name = 'qpro.restaurant'
    _description = 'Restaurante QPro'
    _order = 'name asc'

    # === Campos básicos ===
    name = fields.Char(
        string='Nombre',
        required=True,
        help='Nombre comercial del restaurante o sucursal.',
    )
    code = fields.Char(
        string='Código',
        required=True,
        help='Código único interno (ej. CTG-01, BOG-02).',
    )
    active = fields.Boolean(
        string='Activo',
        default=True,
        help='Si está desmarcado, el restaurante queda archivado.',
    )

    # === Datos de contacto ===
    address = fields.Char(string='Dirección')
    phone = fields.Char(string='Teléfono')
    email = fields.Char(string='Correo electrónico')

    # === Restricciones SQL ===
    _sql_constraints = [
        (
            'qpro_restaurant_code_unique',
            'UNIQUE(code)',
            'El código del restaurante debe ser único.',
        ),
    ]

    # === Validaciones a nivel ORM ===
    @api.constrains('code')
    def _check_code_format(self):
        """El código no puede tener espacios ni estar vacío."""
        for record in self:
            if not record.code or ' ' in record.code:
                raise ValidationError(
                    'El código del restaurante no puede estar vacío '
                    'ni contener espacios.'
                )