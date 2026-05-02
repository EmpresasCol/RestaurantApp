# -*- coding: utf-8 -*-
from odoo import models, fields


class QproDeliveryAddress(models.Model):
    """Dirección de entrega para domicilios.

    Equivalente a la tabla `Direcciones` de MySQL.
    El cliente (res.partner) puede tener múltiples direcciones.
    """

    _name = 'qpro.delivery.address'
    _description = 'Dirección de entrega QPro'
    _rec_name = 'street'
    _order = 'partner_id, id'

    partner_id = fields.Many2one(
        comodel_name='res.partner',
        string='Cliente',
        required=True,
        ondelete='cascade',
        index=True,
    )
    street = fields.Char(
        string='Dirección completa',
        required=True,
    )
    neighborhood = fields.Char(string='Barrio')
    additional_ref = fields.Char(string='Referencias adicionales')
    city = fields.Char(string='Ciudad', default='Sincelejo')
    state_name = fields.Char(string='Departamento', default='Sucre')

    active = fields.Boolean(default=True)

    def name_get(self):
        result = []
        for rec in self:
            name = rec.street
            if rec.neighborhood:
                name = f'{name}, {rec.neighborhood}'
            result.append((rec.id, name))
        return result
