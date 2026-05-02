# -*- coding: utf-8 -*-
import uuid
from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError


class QproDelivery(models.Model):
    """Pedido a domicilio.

    Equivalente a la tabla `Domicilios` de MySQL.
    Estados: pending → preparing → on_way → delivered | cancelled

    El historial de cambios de estado queda en el chatter (mail.thread),
    reemplazando la tabla `HistorialEstadosDomicilio`.
    """

    _name = 'qpro.delivery'
    _description = 'Pedido a domicilio QPro'
    _order = 'order_date desc, id desc'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _rec_name = 'name'

    name = fields.Char(
        string='Folio',
        required=True,
        copy=False,
        readonly=True,
        default=lambda self: self.env['ir.sequence'].next_by_code('qpro.delivery'),
    )

    # ── Relaciones principales ───────────────────────────────────────────────
    partner_id = fields.Many2one(
        comodel_name='res.partner',
        string='Cliente',
        required=True,
        ondelete='restrict',
        index=True,
        tracking=True,
    )
    address_id = fields.Many2one(
        comodel_name='qpro.delivery.address',
        string='Dirección de entrega',
        required=True,
        ondelete='restrict',
        domain="[('partner_id', '=', partner_id)]",
    )
    creator_id = fields.Many2one(
        comodel_name='res.users',
        string='Creado por',
        required=True,
        default=lambda self: self.env.user,
        ondelete='restrict',
        tracking=True,
    )
    delivery_person_id = fields.Many2one(
        comodel_name='res.users',
        string='Domiciliario',
        ondelete='set null',
        tracking=True,
        domain="[('groups_id.name', 'ilike', 'Domiciliario')]",
    )
    restaurant_id = fields.Many2one(
        comodel_name='qpro.restaurant',
        string='Restaurante',
        required=True,
        ondelete='restrict',
    )

    # ── Estado ───────────────────────────────────────────────────────────────
    state = fields.Selection(
        selection=[
            ('pending', 'Pendiente'),
            ('preparing', 'En preparación'),
            ('on_way', 'En camino'),
            ('delivered', 'Entregado'),
            ('cancelled', 'Cancelado'),
        ],
        string='Estado',
        default='pending',
        required=True,
        tracking=True,
        index=True,
    )

    # ── Fechas ────────────────────────────────────────────────────────────────
    order_date = fields.Datetime(
        string='Fecha del pedido',
        default=fields.Datetime.now,
        required=True,
    )
    estimated_delivery_date = fields.Datetime(string='Entrega estimada')
    pickup_date = fields.Datetime(string='Fecha de recogida', readonly=True)
    delivery_date = fields.Datetime(string='Fecha de entrega', readonly=True)

    # ── Tracking público (equivalente a TokenSeguimiento) ───────────────────
    tracking_token = fields.Char(
        string='Token de seguimiento',
        copy=False,
        readonly=True,
        index=True,
    )

    # ── Montos ────────────────────────────────────────────────────────────────
    currency_id = fields.Many2one(
        comodel_name='res.currency',
        default=lambda self: self.env.company.currency_id,
        required=True,
    )
    subtotal = fields.Monetary(
        compute='_compute_subtotal',
        store=True,
        string='Subtotal',
        currency_field='currency_id',
    )
    delivery_cost = fields.Monetary(
        string='Costo de envío',
        default=0.0,
        currency_field='currency_id',
    )
    total = fields.Monetary(
        compute='_compute_total',
        store=True,
        string='Total',
        currency_field='currency_id',
    )

    # ── Pago ─────────────────────────────────────────────────────────────────
    payment_method = fields.Selection(
        selection=[
            ('cash', 'Efectivo'),
            ('card', 'Tarjeta'),
            ('qr', 'QR'),
        ],
        string='Método de pago',
        default='cash',
    )
    prepaid = fields.Boolean(string='Pagado anticipadamente', default=False)

    # ── Observaciones ─────────────────────────────────────────────────────────
    customer_notes = fields.Text(string='Notas del cliente')
    internal_notes = fields.Text(string='Notas internas')

    # ── Líneas ────────────────────────────────────────────────────────────────
    line_ids = fields.One2many(
        comodel_name='qpro.delivery.line',
        inverse_name='delivery_id',
        string='Productos',
    )

    # ── Computed ─────────────────────────────────────────────────────────────
    @api.depends('line_ids.subtotal')
    def _compute_subtotal(self):
        for rec in self:
            rec.subtotal = sum(l.subtotal for l in rec.line_ids)

    @api.depends('subtotal', 'delivery_cost')
    def _compute_total(self):
        for rec in self:
            rec.total = rec.subtotal + rec.delivery_cost

    # ── Crear: generar token ──────────────────────────────────────────────────
    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get('tracking_token'):
                vals['tracking_token'] = str(uuid.uuid4())[:12].upper()
        return super().create(vals_list)

    # ── Transiciones de estado ────────────────────────────────────────────────
    def action_start_preparing(self):
        for rec in self:
            if rec.state != 'pending':
                raise UserError('El pedido debe estar en estado Pendiente.')
            rec.state = 'preparing'

    def action_send_on_way(self):
        for rec in self:
            if rec.state != 'preparing':
                raise UserError('El pedido debe estar En preparación.')
            if not rec.delivery_person_id:
                raise UserError('Asigne un domiciliario antes de enviar.')
            rec.state = 'on_way'
            rec.pickup_date = fields.Datetime.now()

    def action_mark_delivered(self):
        for rec in self:
            if rec.state != 'on_way':
                raise UserError('El pedido debe estar En camino.')
            rec.state = 'delivered'
            rec.delivery_date = fields.Datetime.now()

    def action_cancel(self):
        for rec in self:
            if rec.state == 'delivered':
                raise UserError('No se puede cancelar un pedido ya entregado.')
            rec.state = 'cancelled'

    # ── URL de seguimiento público ─────────────────────────────────────────────
    def get_tracking_url(self):
        self.ensure_one()
        base = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
        return f'{base}/qpro/delivery/track/{self.tracking_token}'
