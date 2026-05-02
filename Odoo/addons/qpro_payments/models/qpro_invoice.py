# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError


class QproInvoice(models.Model):
    """Factura emitida a partir de un pago de restaurante.

    Equivalente a la tabla `Facturas` de MySQL.
    NumeroFactura se genera desde ir.sequence.
    """

    _name = 'qpro.invoice'
    _description = 'Factura QPro'
    _order = 'issue_date desc, id desc'
    _rec_name = 'number'

    number = fields.Char(
        string='Número de factura',
        required=True,
        copy=False,
        readonly=True,
        default=lambda self: self.env['ir.sequence'].next_by_code('qpro.invoice'),
    )

    # ── Relaciones ──────────────────────────────────────────────────────────
    payment_id = fields.Many2one(
        comodel_name='qpro.payment',
        string='Pago',
        required=True,
        ondelete='restrict',
        index=True,
    )
    order_id = fields.Many2one(
        related='payment_id.order_id',
        store=True,
        readonly=True,
    )

    # ── Datos del cliente (facturación) ──────────────────────────────────────
    customer_nit = fields.Char(string='NIT / CC cliente')
    customer_name = fields.Char(string='Nombre cliente')

    # ── Montos ───────────────────────────────────────────────────────────────
    currency_id = fields.Many2one(
        related='payment_id.currency_id',
        readonly=True,
    )
    subtotal = fields.Monetary(
        string='Subtotal',
        required=True,
        currency_field='currency_id',
    )
    tip = fields.Monetary(
        string='Propina',
        default=0.0,
        currency_field='currency_id',
    )
    total = fields.Monetary(
        string='Total',
        compute='_compute_total',
        store=True,
        currency_field='currency_id',
    )

    # ── Archivo PDF (equivalente a ArchivoUrl) ────────────────────────────────
    file_url = fields.Char(string='URL del archivo')

    issue_date = fields.Datetime(
        string='Fecha de emisión',
        default=fields.Datetime.now,
        required=True,
    )

    # ── Computed ─────────────────────────────────────────────────────────────
    @api.depends('subtotal', 'tip')
    def _compute_total(self):
        for rec in self:
            rec.total = rec.subtotal + rec.tip

    # ── Validaciones ─────────────────────────────────────────────────────────
    @api.constrains('subtotal')
    def _check_subtotal(self):
        for rec in self:
            if rec.subtotal < 0:
                raise ValidationError('El subtotal no puede ser negativo.')
