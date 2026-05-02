# -*- coding: utf-8 -*-
from odoo import models, fields


class ProductCategoryExt(models.Model):
    """Extiende product.category con los campos de CategoriasInventario.

    Agrega `qpro_type` (Tipo ENUM de MySQL) y `qpro_color`
    a la categoría de producto nativa de Odoo.
    """

    _inherit = 'product.category'

    qpro_type = fields.Selection(
        selection=[
            ('ingredient', 'Ingrediente'),
            ('beverage', 'Bebida'),
            ('cleaning', 'Material de limpieza'),
            ('finished', 'Producto terminado'),
            ('other', 'Otro'),
        ],
        string='Tipo QPro',
        help='Clasifica la categoría según el tipo de inventario del restaurante.',
    )
    qpro_color = fields.Char(
        string='Color (hex)',
        default='#3b82f6',
        help='Color de identificación visual en la interfaz.',
    )

    # ── Helper: mapear tipo legacy de MySQL ──────────────────────────────────
    @staticmethod
    def _type_from_legacy(value: str) -> str:
        mapping = {
            'Ingrediente': 'ingredient',
            'Bebida': 'beverage',
            'MaterialLimpieza': 'cleaning',
            'ProductoTerminado': 'finished',
            'Otro': 'other',
        }
        return mapping.get(value, 'other')
