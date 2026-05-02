# -*- coding: utf-8 -*-
"""
Reemplaza: PagosController.cs + FacturasController.cs

  .NET                          → Odoo
  GET  /api/Pagos               → GET  /api/qpro/payments
  GET  /api/Pagos/{id}          → GET  /api/qpro/payments/{id}
  POST /api/Pagos               → POST /api/qpro/payments
  GET  /api/Facturas            → GET  /api/qpro/invoices
  POST /api/Facturas            → POST /api/qpro/invoices
"""
import json
from odoo import http
from odoo.http import request, Response


def _json_response(data, status=200):
    return Response(
        json.dumps(data, default=str),
        status=status,
        mimetype='application/json',
        headers={'Access-Control-Allow-Origin': '*'},
    )


def _payment_to_dict(p):
    return {
        'id': p.id,
        'name': p.name,
        'pedidoId': p.order_id.id,
        'monto': p.amount,
        'montoPropina': p.tip_amount,
        'totalCobrado': p.total_amount,
        'metodoPago': p.payment_method,
        'fecha': p.date.isoformat() if p.date else None,
    }


def _invoice_to_dict(inv):
    return {
        'id': inv.id,
        'numeroFactura': inv.number,
        'pagoId': inv.payment_id.id,
        'nitCliente': inv.customer_nit or '',
        'nombreCliente': inv.customer_name or '',
        'subtotal': inv.subtotal,
        'propina': inv.tip,
        'total': inv.total,
        'archivoUrl': inv.file_url or '',
        'fechaEmision': inv.issue_date.isoformat() if inv.issue_date else None,
    }


class QproPaymentsController(http.Controller):

    # ── GET /api/qpro/payments ────────────────────────────────────────────────
    @http.route('/api/qpro/payments', type='http', auth='user',
                methods=['GET'], csrf=False, cors='*')
    def get_payments(self, **kwargs):
        payments = request.env['qpro.payment'].search(
            [], order='date desc', limit=200
        )
        return _json_response([_payment_to_dict(p) for p in payments])

    # ── GET /api/qpro/payments/{id} ───────────────────────────────────────────
    @http.route('/api/qpro/payments/<int:payment_id>', type='http', auth='user',
                methods=['GET'], csrf=False, cors='*')
    def get_payment(self, payment_id, **kwargs):
        payment = request.env['qpro.payment'].browse(payment_id)
        if not payment.exists():
            return _json_response({'error': 'Pago no encontrado'}, 404)
        return _json_response(_payment_to_dict(payment))

    # ── POST /api/qpro/payments ───────────────────────────────────────────────
    @http.route('/api/qpro/payments', type='json', auth='user',
                methods=['POST'], csrf=False, cors='*')
    def create_payment(self, **kwargs):
        """
        Body (equiv. CrearPagoDto):
        {
            "pedidoId": 12,
            "monto": 45000,
            "montoPropina": 5000,
            "metodoPago": "Efectivo" | "Tarjeta" | "QR"
        }
        Tras registrar el pago, marca el pedido como pagado automáticamente.
        """
        data = request.get_json_data()
        order = request.env['qpro.order'].browse(int(data['pedidoId']))
        if not order.exists():
            return {'error': 'Pedido no encontrado'}

        method_map = {'Efectivo': 'cash', 'Tarjeta': 'card', 'QR': 'qr'}
        method = method_map.get(data.get('metodoPago', 'Efectivo'), 'cash')

        payment = request.env['qpro.payment'].create({
            'order_id': order.id,
            'amount': float(data.get('monto', 0)),
            'tip_amount': float(data.get('montoPropina', 0)),
            'payment_method': method,
        })

        # Transición automática: served → paid
        try:
            order.action_mark_paid()
        except Exception as e:
            return {'error': str(e)}

        return _payment_to_dict(payment)

    # ── GET /api/qpro/invoices ────────────────────────────────────────────────
    @http.route('/api/qpro/invoices', type='http', auth='user',
                methods=['GET'], csrf=False, cors='*')
    def get_invoices(self, **kwargs):
        invoices = request.env['qpro.invoice'].search(
            [], order='issue_date desc', limit=200
        )
        return _json_response([_invoice_to_dict(i) for i in invoices])

    # ── POST /api/qpro/invoices ───────────────────────────────────────────────
    @http.route('/api/qpro/invoices', type='json', auth='user',
                methods=['POST'], csrf=False, cors='*')
    def create_invoice(self, **kwargs):
        """
        Body (equiv. CrearFacturaDto):
        {
            "pagoId": 5,
            "nitCliente": "900123456-1",
            "nombreCliente": "Empresa S.A."
        }
        """
        data = request.get_json_data()
        payment = request.env['qpro.payment'].browse(int(data['pagoId']))
        if not payment.exists():
            return {'error': 'Pago no encontrado'}

        invoice = request.env['qpro.invoice'].create({
            'payment_id': payment.id,
            'customer_nit': data.get('nitCliente', ''),
            'customer_name': data.get('nombreCliente', ''),
            'subtotal': payment.amount,
            'tip': payment.tip_amount,
        })
        return _invoice_to_dict(invoice)
