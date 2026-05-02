# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError


class QproPayment(models.Model):
    """Registro de pago para un pedido de restaurante.

    Equivalente a la tabla `Pagos` de MySQL.
    MetodoPago: Efectivo / Tarjeta / QR
    """

    _name = 'qpro.payment'
    _description = 'Pago QPro'
    _order = 'date desc, id desc'
    _rec_name = 'name'

    name = fields.Char(
        string='Referencia',
        required=True,
        copy=False,
        readonly=True,
        default=lambda self: self.env['ir.sequence'].next_by_code('qpro.payment'),
    )

    # ── Relaciones ──────────────────────────────────────────────────────────
    order_id = fields.Many2one(
        comodel_name='qpro.order',
        string='Pedido',
        required=True,
        ondelete='restrict',
        index=True,
    )
    restaurant_id = fields.Many2one(
        related='order_id.restaurant_id',
        store=True,
        readonly=True,
    )

    # ── Montos ───────────────────────────────────────────────────────────────
    currency_id = fields.Many2one(
        related='order_id.currency_id',
        readonly=True,
    )
    amount = fields.Monetary(
        string='Monto',
        required=True,
        currency_field='currency_id',
    )
    tip_amount = fields.Monetary(
        string='Propina',
        default=0.0,
        currency_field='currency_id',
    )
    total_amount = fields.Monetary(
        string='Total cobrado',
        compute='_compute_total_amount',
        store=True,
        currency_field='currency_id',
    )

    # ── Método de pago ───────────────────────────────────────────────────────
    payment_method = fields.Selection(
        selection=[
            ('cash', 'Efectivo'),
            ('card', 'Tarjeta'),
            ('qr', 'QR'),
        ],
        string='Método de pago',
        required=True,
        default='cash',
    )

    date = fields.Datetime(
        string='Fecha de pago',
        default=fields.Datetime.now,
        required=True,
    )

    # ── Factura relacionada ──────────────────────────────────────────────────
    invoice_ids = fields.One2many(
        comodel_name='qpro.invoice',
        inverse_name='payment_id',
        string='Facturas',
    )
    invoice_count = fields.Integer(
        compute='_compute_invoice_count',
        string='# Facturas',
    )

    # ── Computed ─────────────────────────────────────────────────────────────
    @api.depends('amount', 'tip_amount')
    def _compute_total_amount(self):
        for rec in self:
            rec.total_amount = rec.amount + rec.tip_amount

    @api.depends('invoice_ids')
    def _compute_invoice_count(self):
        for rec in self:
            rec.invoice_count = len(rec.invoice_ids)

    # ── Validaciones ─────────────────────────────────────────────────────────
    @api.constrains('amount')
    def _check_amount(self):
        for rec in self:
            if rec.amount <= 0:
                raise ValidationError('El monto del pago debe ser mayor a cero.')

    @api.constrains('order_id')
    def _check_order_state(self):
        for rec in self:
            if rec.order_id.state not in ('served', 'paid'):
                raise ValidationError(
                    'Solo se puede registrar un pago para pedidos en estado '
                    '"Entregado" o "Pagado".'
                )

    # ── Acción: generar factura ───────────────────────────────────────────────
    def action_create_invoice(self):
        self.ensure_one()
        invoice = self.env['qpro.invoice'].create({
            'payment_id': self.id,
            'subtotal': self.amount,
            'tip': self.tip_amount,
            'total': self.total_amount,
        })
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'qpro.invoice',
            'res_id': invoice.id,
            'view_mode': 'form',
        }

    def action_view_invoices(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'qpro.invoice',
            'domain': [('payment_id', '=', self.id)],
            'view_mode': 'tree,form',
            'name': f'Facturas de {self.name}',
        }

    # ── Método legacy: parsear MetodoPago de la API .NET ─────────────────────
    @api.model
    def _payment_method_from_legacy(self, value: str) -> str:
        """Convierte el enum de .NET al selection de Odoo."""
        mapping = {
            'Efectivo': 'cash',
            'Tarjeta': 'card',
            'QR': 'qr',
        }
        return mapping.get(value, 'cash')
