# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError


class QproDeliveryLine(models.Model):
    """Línea de producto en un pedido a domicilio.

    Equivalente a la tabla `DomicilioDetalles` de MySQL.
    """

    _name = 'qpro.delivery.line'
    _description = 'Línea de domicilio QPro'
    _order = 'delivery_id, sequence'

    delivery_id = fields.Many2one(
        comodel_name='qpro.delivery',
        string='Domicilio',
        required=True,
        ondelete='cascade',
        index=True,
    )
    sequence = fields.Integer(default=10)
    product_id = fields.Many2one(
        comodel_name='product.product',
        string='Platillo',
        required=True,
        ondelete='restrict',
    )
    quantity = fields.Float(string='Cantidad', default=1.0)
    price_unit = fields.Monetary(
        string='Precio unitario',
        currency_field='currency_id',
    )
    subtotal = fields.Monetary(
        string='Subtotal',
        compute='_compute_subtotal',
        store=True,
        currency_field='currency_id',
    )
    note = fields.Char(string='Nota')
    currency_id = fields.Many2one(
        related='delivery_id.currency_id',
        readonly=True,
    )

    @api.depends('quantity', 'price_unit')
    def _compute_subtotal(self):
        for line in self:
            line.subtotal = line.quantity * line.price_unit

    @api.onchange('product_id')
    def _onchange_product_id(self):
        if self.product_id:
            self.price_unit = self.product_id.lst_price

    @api.constrains('quantity')
    def _check_quantity(self):
        for line in self:
            if line.quantity <= 0:
                raise ValidationError('La cantidad debe ser mayor a cero.')
