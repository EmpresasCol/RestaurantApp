# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError


class QproOrderLine(models.Model):
    """Línea de un pedido: un platillo solicitado con su cantidad.

    Cada línea referencia un product.product (platillo) y mantiene un
    snapshot del precio al momento del pedido para que cambios futuros
    en el catálogo no alteren pedidos pasados.
    """

    _name = 'qpro.order.line'
    _description = 'Línea de pedido QPro'
    _order = 'order_id, sequence, id'

    # === Relaciones ===
    order_id = fields.Many2one(
        comodel_name='qpro.order',
        string='Pedido',
        required=True,
        ondelete='cascade',
        index=True,
    )
    product_id = fields.Many2one(
        comodel_name='product.product',
        string='Platillo',
        required=True,
        ondelete='restrict',
        domain="[('sale_ok', '=', True)]",
        help='Producto del catálogo que el cliente solicita.',
    )

    # === Datos de la línea ===
    sequence = fields.Integer(
        string='Secuencia',
        default=10,
        help='Orden de las líneas dentro del pedido.',
    )
    quantity = fields.Float(
        string='Cantidad',
        default=1.0,
        required=True,
    )
    price_unit = fields.Monetary(
        string='Precio unitario',
        required=True,
        help='Precio congelado al momento de añadir el platillo al pedido.',
    )
    price_subtotal = fields.Monetary(
        string='Subtotal',
        compute='_compute_subtotal',
        store=True,
    )
    note = fields.Char(
        string='Nota para cocina',
        help='Indicaciones especiales (ej. "sin cebolla", "término medio").',
    )
    state = fields.Selection(
        selection=[
            ('pending', 'Pendiente'),
            ('preparing', 'En preparación'),
            ('ready', 'Listo'),
            ('cancelled', 'Cancelado'),
        ],
        string='Estado',
        default='pending',
        required=True,
    )

    # === Campos relacionados (heredados del pedido) ===
    currency_id = fields.Many2one(
        related='order_id.currency_id',
        store=True,
        readonly=True,
    )
    restaurant_id = fields.Many2one(
        related='order_id.restaurant_id',
        store=True,
        readonly=True,
    )

    # === Validaciones ===
    @api.constrains('quantity')
    def _check_quantity_positive(self):
        for line in self:
            if line.quantity <= 0:
                raise ValidationError(
                    'La cantidad debe ser mayor que cero.'
                )

    # === Computed ===
    @api.depends('quantity', 'price_unit')
    def _compute_subtotal(self):
        for line in self:
            line.price_subtotal = line.quantity * line.price_unit

    # === Onchange (UI dinámica) ===
    @api.onchange('product_id')
    def _onchange_product_id(self):
        """Cuando se selecciona un producto, autocompleta el precio."""
        if self.product_id:
            self.price_unit = self.product_id.lst_price