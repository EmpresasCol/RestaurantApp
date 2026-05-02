# -*- coding: utf-8 -*-
"""
Reemplaza: DomiciliosController.cs + ClientesController.cs + DireccionesController.cs

  .NET                                  → Odoo
  GET  /api/Domicilios                  → GET  /api/qpro/deliveries
  GET  /api/Domicilios/activos          → GET  /api/qpro/deliveries?state=preparing,on_way
  GET  /api/Domicilios/{id}             → GET  /api/qpro/deliveries/{id}
  POST /api/Domicilios                  → POST /api/qpro/deliveries
  PUT  /api/Domicilios/{id}/estado      → POST /api/qpro/deliveries/{id}/{action}
  GET  /api/Domicilios/seguimiento/{t}  → GET  /api/qpro/deliveries/track/{token}  (público)
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


def _delivery_to_dict(d):
    return {
        'id': d.id,
        'folio': d.name,
        'clienteId': d.partner_id.id,
        'clienteNombre': d.partner_id.name,
        'clienteTelefono': d.partner_id.phone or '',
        'direccionId': d.address_id.id,
        'direccionCompleta': d.address_id.street,
        'barrio': d.address_id.neighborhood or '',
        'estado': d.state,
        'subtotal': d.subtotal,
        'costoEnvio': d.delivery_cost,
        'total': d.total,
        'metodoPago': d.payment_method,
        'pagadoAnticipado': d.prepaid,
        'domiciliarioId': d.delivery_person_id.id if d.delivery_person_id else None,
        'domiciliarioNombre': d.delivery_person_id.name if d.delivery_person_id else None,
        'tokenSeguimiento': d.tracking_token,
        'fechaPedido': d.order_date.isoformat() if d.order_date else None,
        'fechaEntregaEstimada': d.estimated_delivery_date.isoformat() if d.estimated_delivery_date else None,
        'fechaEntrega': d.delivery_date.isoformat() if d.delivery_date else None,
        'notasCliente': d.customer_notes or '',
        'detalles': [{
            'id': l.id,
            'platilloId': l.product_id.id,
            'platilloNombre': l.product_id.name,
            'cantidad': l.quantity,
            'precioUnitario': l.price_unit,
            'subtotal': l.subtotal,
            'nota': l.note or '',
        } for l in d.line_ids],
    }


class QproDeliveriesController(http.Controller):

    @http.route('/api/qpro/deliveries', type='http', auth='user',
                methods=['GET'], csrf=False, cors='*')
    def get_deliveries(self, **kwargs):
        state = kwargs.get('state')
        domain = []
        if state:
            states = [s.strip() for s in state.split(',')]
            domain.append(('state', 'in', states))
        deliveries = request.env['qpro.delivery'].search(
            domain, order='order_date desc', limit=200
        )
        return _json_response([_delivery_to_dict(d) for d in deliveries])

    @http.route('/api/qpro/deliveries/<int:delivery_id>', type='http', auth='user',
                methods=['GET'], csrf=False, cors='*')
    def get_delivery(self, delivery_id, **kwargs):
        delivery = request.env['qpro.delivery'].browse(delivery_id)
        if not delivery.exists():
            return _json_response({'error': 'Domicilio no encontrado'}, 404)
        return _json_response(_delivery_to_dict(delivery))

    @http.route('/api/qpro/deliveries', type='json', auth='user',
                methods=['POST'], csrf=False, cors='*')
    def create_delivery(self, **kwargs):
        """
        Body:
        {
            "clienteId": 5,
            "direccionId": 2,
            "restaurantId": 1,
            "costoEnvio": 3000,
            "metodoPago": "Efectivo",
            "notasCliente": "...",
            "detalles": [{"platilloId": 3, "cantidad": 2, "nota": ""}]
        }
        """
        data = request.get_json_data()
        method_map = {'Efectivo': 'cash', 'Tarjeta': 'card', 'QR': 'qr'}

        lines = []
        for d in data.get('detalles', []):
            product = request.env['product.product'].browse(int(d['platilloId']))
            lines.append((0, 0, {
                'product_id': product.id,
                'quantity': d.get('cantidad', 1),
                'price_unit': product.lst_price,
                'note': d.get('nota', ''),
            }))

        delivery = request.env['qpro.delivery'].create({
            'partner_id': int(data['clienteId']),
            'address_id': int(data['direccionId']),
            'restaurant_id': int(data['restaurantId']),
            'delivery_cost': float(data.get('costoEnvio', 0)),
            'payment_method': method_map.get(data.get('metodoPago', 'Efectivo'), 'cash'),
            'customer_notes': data.get('notasCliente', ''),
            'creator_id': request.env.user.id,
            'line_ids': lines,
        })
        return _delivery_to_dict(delivery)

    @http.route('/api/qpro/deliveries/<int:delivery_id>/preparing',
                type='json', auth='user', methods=['POST'], csrf=False, cors='*')
    def start_preparing(self, delivery_id, **kwargs):
        d = request.env['qpro.delivery'].browse(delivery_id)
        if not d.exists():
            return {'error': 'Domicilio no encontrado'}
        try:
            d.action_start_preparing()
        except Exception as e:
            return {'error': str(e)}
        return _delivery_to_dict(d)

    @http.route('/api/qpro/deliveries/<int:delivery_id>/on_way',
                type='json', auth='user', methods=['POST'], csrf=False, cors='*')
    def send_on_way(self, delivery_id, **kwargs):
        d = request.env['qpro.delivery'].browse(delivery_id)
        if not d.exists():
            return {'error': 'Domicilio no encontrado'}
        data = request.get_json_data() or {}
        if data.get('domiciliarioId'):
            d.delivery_person_id = int(data['domiciliarioId'])
        try:
            d.action_send_on_way()
        except Exception as e:
            return {'error': str(e)}
        return _delivery_to_dict(d)

    @http.route('/api/qpro/deliveries/<int:delivery_id>/delivered',
                type='json', auth='user', methods=['POST'], csrf=False, cors='*')
    def mark_delivered(self, delivery_id, **kwargs):
        d = request.env['qpro.delivery'].browse(delivery_id)
        if not d.exists():
            return {'error': 'Domicilio no encontrado'}
        try:
            d.action_mark_delivered()
        except Exception as e:
            return {'error': str(e)}
        return _delivery_to_dict(d)

    # ── Seguimiento público (sin auth) ────────────────────────────────────────
    @http.route('/api/qpro/deliveries/track/<string:token>', type='http',
                auth='public', methods=['GET'], csrf=False, cors='*')
    def track_delivery(self, token, **kwargs):
        """Endpoint público para que el cliente consulte su domicilio por token."""
        delivery = request.env['qpro.delivery'].sudo().search(
            [('tracking_token', '=', token)], limit=1
        )
        if not delivery:
            return _json_response({'error': 'Token inválido'}, 404)
        return _json_response({
            'folio': delivery.name,
            'estado': delivery.state,
            'domiciliario': delivery.delivery_person_id.name if delivery.delivery_person_id else None,
            'fechaEstimada': delivery.estimated_delivery_date.isoformat() if delivery.estimated_delivery_date else None,
            'fechaEntrega': delivery.delivery_date.isoformat() if delivery.delivery_date else None,
        })
