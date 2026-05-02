# -*- coding: utf-8 -*-
from odoo import models, fields


class ProductTemplateExt(models.Model):
    """Extiende product.template con campos de ProductosInventario.

    Los campos de stock mínimo/máximo, punto de reorden y gestión de lotes
    ya existen en Odoo (stock.warehouse.orderpoint, tracking='lot').
    Aquí solo añadimos los campos QPro-específicos.
    """

    _inherit = 'product.template'

    # ── Campos de QPro Inventory (ProductosInventario) ───────────────────────
    qpro_code = fields.Char(
        string='Código QPro',
        index=True,
        copy=False,
        help='Código interno del producto en el sistema legacy.',
    )
    qpro_requires_expiry = fields.Boolean(
        string='Requiere fecha de caducidad',
        default=False,
        help='Activa el control de lotes con fecha de vencimiento.',
    )
    qpro_expiry_days = fields.Integer(
        string='Días de vencimiento',
        default=0,
        help='Días de vida útil por defecto al crear un lote.',
    )
    qpro_cost_price = fields.Float(
        string='Precio de costo QPro',
        digits='Product Price',
        help='Precio de costo registrado en el sistema legacy.',
    )
    qpro_min_stock = fields.Float(
        string='Stock mínimo QPro',
        digits='Product Unit of Measure',
        help='Umbral de alerta de stock bajo.',
    )
    qpro_max_stock = fields.Float(
        string='Stock máximo QPro',
        digits='Product Unit of Measure',
    )
    qpro_reorder_point = fields.Float(
        string='Punto de reorden QPro',
        digits='Product Unit of Measure',
    )

    # ── Campos de Platillos (tabla Platillos de MySQL) ───────────────────────
    # La imagen ya está en product.template (image_1920).
    # El precio de venta es list_price (nativo).
    # La categoría es categ_id (nativo).
    # Solo añadimos is_dish para filtrar platillos vs ingredientes.
    qpro_is_dish = fields.Boolean(
        string='Es platillo',
        default=False,
        help='Marca este producto como platillo del menú (visible en pedidos).',
    )
