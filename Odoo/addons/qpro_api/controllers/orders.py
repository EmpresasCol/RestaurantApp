# -*- coding: utf-8 -*-
"""
Reemplaza: PedidosController.cs y PedidoDetallesController.cs

Mapa de endpoints:
  .NET                                    → Odoo
  GET    /api/Pedidos                     → GET  /api/qpro/orders
  GET    /api/Pedidos/{id}                → GET  /api/qpro/orders/{id}
  POST   /api/Pedidos                     → POST /api/qpro/orders
  PUT    /api/Pedidos/{id}/estado         → PUT  /api/qpro/orders/{id}/state
  DELETE /api/Pedidos/{id}               → DELETE /api/qpro/orders/{id}  (cancel)
  POST   /api/Pedidos/{id}/enviarCocina  → POST /api/qpro/orders/{id}/send_to_kitchen
  POST   /api/Pedidos/{id}/marcarListo   → POST /api/qpro/orders/{id}/mark_ready
  POST   /api/Pedidos/{id}/marcarPagado  → POST /api/qpro/orders/{id}/mark_paid
"""
import json
import logging
from odoo import http
from odoo.http import request, Response

_logger = logging.getLogger(__name__)

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}


def _json_response(data, status=200):
    return Response(
        json.dumps(data, default=str),
        status=status,
        mimetype='application/json',
        headers=CORS,
    )


def _order_to_dict(order):
    return {
        'id': order.id,
        'name': order.name,
        'tableId': order.table_id.id,
        'tableNumber': order.table_id.number,
        'restaurantId': order.restaurant_id.id,
        'state': order.state,
        'waiterId': order.waiter_id.id,
        'waiterName': order.waiter_id.name,
        'dateOrder': order.date_order.isoformat() if order.date_order else None,
        'amountTotal': order.amount_total,
        'note': order.note or '',
        'lines': [_line_to_dict(l) for l in order.order_line_ids],
    }


def _line_to_dict(line):
    return {
        'id': line.id,
        'productId': line.product_id.id,
        'productName': line.product_id.name,
        'quantity': line.quantity,
        'priceUnit': line.price_unit,
        'priceSubtotal': line.price_subtotal,
        'note': line.note or '',
        'state': line.state,
    }


class QproOrdersController(http.Controller):

    # ── GET /api/qpro/orders ──────────────────────────────────────────────────
    @http.route('/api/qpro/orders', type='http', auth='user',
                methods=['GET', 'OPTIONS'], csrf=False, cors='*')
    def get_orders(self, **kwargs):
        state = kwargs.get('state')
        restaurant_id = kwargs.get('restaurantId')

        domain = []
        if state:
            domain.append(('state', '=', state))
        if restaurant_id:
            domain.append(('restaurant_id', '=', int(restaurant_id)))

        orders = request.env['qpro.order'].search(
            domain, order='date_order desc', limit=200
        )
        return _json_response([_order_to_dict(o) for o in orders])

    # ── GET /api/qpro/orders/{id} ─────────────────────────────────────────────
    @http.route('/api/qpro/orders/<int:order_id>', type='http', auth='user',
                methods=['GET'], csrf=False, cors='*')
    def get_order(self, order_id, **kwargs):
        order = request.env['qpro.order'].browse(order_id)
        if not order.exists():
            return _json_response({'error': 'Pedido no encontrado'}, 404)
        return _json_response(_order_to_dict(order))

    # ── POST /api/qpro/orders ─────────────────────────────────────────────────
    @http.route('/api/qpro/orders', type='json', auth='user',
                methods=['POST'], csrf=False, cors='*')
    def create_order(self, **kwargs):
        """
        Body esperado (igual al CrearPedidoDto de .NET):
        {
            "mesaId": 3,
            "usuarioId": 1,          // opcional; usa el usuario autenticado si omite
            "detalles": [
                {"platilloId": 5, "cantidad": 2, "nota": "sin cebolla"},
                {"platilloId": 8, "cantidad": 1, "nota": ""}
            ]
        }
        """
        data = request.get_json_data()
        mesa_id = data.get('mesaId')
        usuario_id = data.get('usuarioId') or request.env.user.id
        detalles = data.get('detalles', [])

        if not mesa_id:
            return {'error': 'mesaId es requerido'}

        table = request.env['qpro.table'].browse(int(mesa_id))
        if not table.exists():
            return {'error': f'Mesa {mesa_id} no existe'}

        lines = []
        for d in detalles:
            product = request.env['product.product'].browse(int(d['platilloId']))
            if not product.exists():
                return {'error': f'Platillo {d["platilloId"]} no existe'}
            lines.append((0, 0, {
                'product_id': product.id,
                'quantity': d.get('cantidad', 1),
                'price_unit': product.lst_price,
                'note': d.get('nota', ''),
            }))

        order = request.env['qpro.order'].create({
            'table_id': table.id,
            'waiter_id': int(usuario_id),
            'order_line_ids': lines,
        })
        return _order_to_dict(order)

    # ── POST /api/qpro/orders/{id}/send_to_kitchen ────────────────────────────
    @http.route('/api/qpro/orders/<int:order_id>/send_to_kitchen',
                type='json', auth='user', methods=['POST'], csrf=False, cors='*')
    def send_to_kitchen(self, order_id, **kwargs):
        order = request.env['qpro.order'].browse(order_id)
        if not order.exists():
            return {'error': 'Pedido no encontrado'}
        try:
            order.action_send_to_kitchen()
        except Exception as e:
            return {'error': str(e)}
        return _order_to_dict(order)

    # ── POST /api/qpro/orders/{id}/start_preparing ────────────────────────────
    @http.route('/api/qpro/orders/<int:order_id>/start_preparing',
                type='json', auth='user', methods=['POST'], csrf=False, cors='*')
    def start_preparing(self, order_id, **kwargs):
        order = request.env['qpro.order'].browse(order_id)
        if not order.exists():
            return {'error': 'Pedido no encontrado'}
        try:
            order.action_start_preparing()
        except Exception as e:
            return {'error': str(e)}
        return _order_to_dict(order)

    # ── POST /api/qpro/orders/{id}/mark_ready ────────────────────────────────
    @http.route('/api/qpro/orders/<int:order_id>/mark_ready',
                type='json', auth='user', methods=['POST'], csrf=False, cors='*')
    def mark_ready(self, order_id, **kwargs):
        order = request.env['qpro.order'].browse(order_id)
        if not order.exists():
            return {'error': 'Pedido no encontrado'}
        try:
            order.action_mark_ready()
        except Exception as e:
            return {'error': str(e)}
        return _order_to_dict(order)

    # ── POST /api/qpro/orders/{id}/mark_served ───────────────────────────────
    @http.route('/api/qpro/orders/<int:order_id>/mark_served',
                type='json', auth='user', methods=['POST'], csrf=False, cors='*')
    def mark_served(self, order_id, **kwargs):
        order = request.env['qpro.order'].browse(order_id)
        if not order.exists():
            return {'error': 'Pedido no encontrado'}
        try:
            order.action_mark_served()
        except Exception as e:
            return {'error': str(e)}
        return _order_to_dict(order)

    # ── POST /api/qpro/orders/{id}/cancel ────────────────────────────────────
    @http.route('/api/qpro/orders/<int:order_id>/cancel',
                type='json', auth='user', methods=['POST'], csrf=False, cors='*')
    def cancel_order(self, order_id, **kwargs):
        order = request.env['qpro.order'].browse(order_id)
        if not order.exists():
            return {'error': 'Pedido no encontrado'}
        try:
            order.action_cancel()
        except Exception as e:
            return {'error': str(e)}
        return _order_to_dict(order)

    # ── GET /api/qpro/orders/kitchen — vista de cocina ──────────────────────
    @http.route('/api/qpro/orders/kitchen', type='http', auth='user',
                methods=['GET'], csrf=False, cors='*')
    def kitchen_view(self, **kwargs):
        """Devuelve pedidos en estados sent/preparing para la pantalla de cocina."""
        orders = request.env['qpro.order'].search([
            ('state', 'in', ['sent', 'preparing']),
        ], order='date_order asc')
        return _json_response([_order_to_dict(o) for o in orders])
