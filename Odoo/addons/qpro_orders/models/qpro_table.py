# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError


class QproTable(models.Model):
    """Mesa física dentro de un restaurante.

    Cada mesa pertenece a un qpro.restaurant y tiene un estado que
    refleja su disponibilidad operativa. El número de mesa es único
    dentro del mismo restaurante (no globalmente).
    """

    _name = 'qpro.table'
    _description = 'Mesa de restaurante'
    _order = 'restaurant_id, number'
    # Heredamos mail.thread para auditoría automática en chatter
    _inherit = ['mail.thread', 'mail.activity.mixin']

    # === Identificación ===
    name = fields.Char(
        string='Nombre',
        compute='_compute_name',
        store=True,
        help='Nombre legible generado automáticamente (ej. "Mesa 5").',
    )
    number = fields.Integer(
        string='Número',
        required=True,
        tracking=True,
        help='Número físico de la mesa dentro del restaurante.',
    )
    restaurant_id = fields.Many2one(
        comodel_name='qpro.restaurant',
        string='Restaurante',
        required=True,
        ondelete='restrict',
        tracking=True,
        help='Restaurante al que pertenece la mesa.',
    )

    # === Operación ===
    state = fields.Selection(
        selection=[
            ('free', 'Disponible'),
            ('occupied', 'Ocupada'),
            ('awaiting_payment', 'Esperando pago'),
        ],
        string='Estado',
        default='free',
        required=True,
        tracking=True,
        help='Estado operativo actual de la mesa.',
    )
    capacity = fields.Integer(
        string='Capacidad',
        default=4,
        help='Número máximo de comensales que la mesa admite.',
    )

    # === QR y archivado ===
    qr_code = fields.Binary(
        string='Código QR',
        attachment=True,
        help='QR que el cliente escanea para acceder al menú digital.',
    )
    active = fields.Boolean(
        string='Activa',
        default=True,
        help='Si está desmarcada, la mesa queda archivada (no se muestra).',
    )

    # === Restricciones ===
    _sql_constraints = [
        (
            'qpro_table_number_unique_per_restaurant',
            'UNIQUE(restaurant_id, number)',
            'El número de mesa debe ser único dentro del mismo restaurante.',
        ),
    ]

    @api.constrains('number', 'capacity')
    def _check_positive_values(self):
        for record in self:
            if record.number <= 0:
                raise ValidationError('El número de mesa debe ser positivo.')
            if record.capacity <= 0:
                raise ValidationError('La capacidad debe ser positiva.')

    # === Computed fields ===
    @api.depends('number', 'restaurant_id.name')
    def _compute_name(self):
        for record in self:
            if record.number:
                record.name = f'Mesa {record.number}'
            else:
                record.name = 'Mesa nueva'