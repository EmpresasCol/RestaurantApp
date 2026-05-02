# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import UserError


class QproOrderPaymentExt(models.Model):
    """Extensión de qpro.order para soportar pagos.

    Reemplaza el action_mark_paid() básico con uno que crea
    un qpro.payment atómicamente, igual que el flujo de .NET:
      POST /api/Pagos → luego PUT /api/Pedidos/{id}/estado → Pagado
    """

    _inherit = 'qpro.order'

    payment_ids = fields.One2many(
        comodel_name='qpro.payment',
        inverse_name='order_id',
        string='Pagos',
        readonly=True,
    )
    payment_count = fields.Integer(
        compute='_compute_payment_count',
        string='# Pagos',
    )
    is_paid = fields.Boolean(
        compute='_compute_is_paid',
        store=True,
    )

    @api.depends('payment_ids')
    def _compute_payment_count(self):
        for order in self:
            order.payment_count = len(order.payment_ids)

    @api.depends('state')
    def _compute_is_paid(self):
        for order in self:
            order.is_paid = order.state == 'paid'

    # ── Sobreescribir action_mark_paid para exigir pago ───────────────────────
    def action_mark_paid(self):
        """served → paid. Requiere al menos un qpro.payment registrado."""
        for order in self:
            if order.state != 'served':
                raise UserError('Solo se pueden marcar como pagados pedidos entregados.')
            if not order.payment_ids:
                raise UserError(
                    'Debe registrar un pago antes de cerrar el pedido. '
                    'Use el botón "Registrar Pago".'
                )
            order.state = 'paid'
            order.table_id.state = 'free'

    # ── Acción rápida: abrir wizard de pago ──────────────────────────────────
    def action_register_payment(self):
        self.ensure_one()
        if self.state != 'served':
            raise UserError('El pedido debe estar en estado "Entregado" para registrar pago.')
        return {
            'type': 'ir.actions.act_window',
            'name': 'Registrar Pago',
            'res_model': 'qpro.payment',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_order_id': self.id,
                'default_amount': self.amount_total,
            },
        }

    def action_view_payments(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'qpro.payment',
            'domain': [('order_id', '=', self.id)],
            'view_mode': 'tree,form',
            'name': f'Pagos de {self.name}',
        }
