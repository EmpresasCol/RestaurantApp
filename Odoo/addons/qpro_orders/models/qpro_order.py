# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError


class QproOrder(models.Model):
    """Pedido de un cliente en una mesa de restaurante.

    Flujo de estados:
        draft → sent → preparing → ready → served → paid
                                                  ↓
                                            (en cualquier momento → cancelled)
    """

    _name = 'qpro.order'
    _description = 'Pedido QPro'
    _order = 'date_order desc, id desc'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _rec_name = 'name'

    # =====================================================================
    # IDENTIFICACIÓN Y FOLIO
    # =====================================================================
    name = fields.Char(
        string='Folio',
        required=True,
        copy=False,
        readonly=True,
        default=lambda self: _('Nuevo'),
        help='Folio único generado automáticamente al crear el pedido.',
    )

    # =====================================================================
    # RELACIONES
    # =====================================================================
    table_id = fields.Many2one(
        comodel_name='qpro.table',
        string='Mesa',
        required=True,
        ondelete='restrict',
        tracking=True,
        index=True,
    )
    restaurant_id = fields.Many2one(
        related='table_id.restaurant_id',
        store=True,
        readonly=True,
        index=True,
    )
    waiter_id = fields.Many2one(
        comodel_name='res.users',
        string='Mesero',
        required=True,
        ondelete='restrict',
        default=lambda self: self.env.user,
        tracking=True,
        index=True,
    )
    partner_id = fields.Many2one(
        comodel_name='res.partner',
        string='Cliente',
        ondelete='set null',
        help='Cliente del pedido. Opcional; útil para domicilios y facturación.',
    )

    # =====================================================================
    # FECHA Y ESTADO
    # =====================================================================
    date_order = fields.Datetime(
        string='Fecha del pedido',
        default=fields.Datetime.now,
        required=True,
        tracking=True,
    )
    state = fields.Selection(
        selection=[
            ('draft', 'Borrador'),
            ('sent', 'Enviado a cocina'),
            ('preparing', 'En preparación'),
            ('ready', 'Listo'),
            ('served', 'Entregado'),
            ('paid', 'Pagado'),
            ('cancelled', 'Cancelado'),
        ],
        string='Estado',
        default='draft',
        required=True,
        tracking=True,
        index=True,
    )

    # =====================================================================
    # LÍNEAS Y TOTALES
    # =====================================================================
    order_line_ids = fields.One2many(
        comodel_name='qpro.order.line',
        inverse_name='order_id',
        string='Líneas',
    )
    currency_id = fields.Many2one(
        comodel_name='res.currency',
        string='Moneda',
        required=True,
        default=lambda self: self.env.company.currency_id,
    )
    amount_total = fields.Monetary(
        string='Total',
        compute='_compute_amount_total',
        store=True,
        tracking=True,
    )

    # =====================================================================
    # NOTAS
    # =====================================================================
    note = fields.Text(string='Notas generales')

    # =====================================================================
    # CREATE: GENERAR FOLIO AUTOMÁTICO
    # =====================================================================
    @api.model_create_multi
    def create(self, vals_list):
        """Asigna folio automático desde la secuencia ir.sequence."""
        for vals in vals_list:
            if vals.get('name', _('Nuevo')) == _('Nuevo'):
                vals['name'] = self.env['ir.sequence'].next_by_code(
                    'qpro.order'
                ) or _('Nuevo')
        return super().create(vals_list)

    # =====================================================================
    # COMPUTED
    # =====================================================================
    @api.depends('order_line_ids.price_subtotal')
    def _compute_amount_total(self):
        for order in self:
            order.amount_total = sum(
                line.price_subtotal for line in order.order_line_ids
            )

    # =====================================================================
    # VALIDACIONES
    # =====================================================================
    @api.constrains('table_id', 'state')
    def _check_table_state_consistency(self):
        """No permite pedidos en mesas archivadas."""
        for order in self:
            if order.state not in ('cancelled', 'paid') and not order.table_id.active:
                raise ValidationError(
                    'No se puede crear un pedido en una mesa archivada.'
                )

    # =====================================================================
    # TRANSICIONES DE ESTADO (BOTONES DE ACCIÓN)
    # =====================================================================
    def action_send_to_kitchen(self):
        """draft → sent. Envía el pedido a cocina."""
        for order in self:
            if order.state != 'draft':
                raise UserError(
                    'Solo se pueden enviar a cocina pedidos en estado Borrador.'
                )
            if not order.order_line_ids:
                raise UserError(
                    'No se puede enviar un pedido vacío a cocina.'
                )
            order.state = 'sent'
            # Marcar la mesa como ocupada si no lo estaba
            if order.table_id.state == 'free':
                order.table_id.state = 'occupied'

    def action_start_preparing(self):
        """sent → preparing. Cocina empieza a preparar."""
        for order in self:
            if order.state != 'sent':
                raise UserError(
                    'Solo se pueden empezar a preparar pedidos enviados a cocina.'
                )
            order.state = 'preparing'

    def action_mark_ready(self):
        """preparing → ready. Cocina marca el pedido como listo."""
        for order in self:
            if order.state != 'preparing':
                raise UserError(
                    'Solo se pueden marcar como listos pedidos en preparación.'
                )
            order.state = 'ready'
            # Marcar todas las líneas como listas
            order.order_line_ids.filtered(
                lambda l: l.state != 'cancelled'
            ).write({'state': 'ready'})

    def action_mark_served(self):
        """ready → served. Mesero entrega al cliente."""
        for order in self:
            if order.state != 'ready':
                raise UserError(
                    'Solo se pueden entregar pedidos en estado Listo.'
                )
            order.state = 'served'
            order.table_id.state = 'awaiting_payment'

    def action_mark_paid(self):
        """served → paid. Cajero registra el pago."""
        for order in self:
            if order.state != 'served':
                raise UserError(
                    'Solo se pueden marcar como pagados pedidos entregados.'
                )
            order.state = 'paid'
            # Liberar la mesa
            order.table_id.state = 'free'

    def action_cancel(self):
        """cualquier estado → cancelled (excepto paid)."""
        for order in self:
            if order.state == 'paid':
                raise UserError(
                    'No se puede cancelar un pedido ya pagado.'
                )
            order.state = 'cancelled'
            order.order_line_ids.write({'state': 'cancelled'})
            # Liberar mesa si era el único pedido activo
            active_orders = self.search([
                ('table_id', '=', order.table_id.id),
                ('state', 'not in', ('paid', 'cancelled')),
                ('id', '!=', order.id),
            ])
            if not active_orders and order.table_id.state != 'free':
                order.table_id.state = 'free'

    def action_reset_to_draft(self):
        """cancelled → draft. Permite reabrir un pedido cancelado."""
        for order in self:
            if order.state != 'cancelled':
                raise UserError(
                    'Solo se pueden reabrir pedidos cancelados.'
                )
            order.state = 'draft'
            order.order_line_ids.write({'state': 'pending'})