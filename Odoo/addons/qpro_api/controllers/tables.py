# -*- coding: utf-8 -*-
"""
Reemplaza: MesasController.cs

  .NET                          → Odoo
  GET    /api/Mesas             → GET  /api/qpro/tables
  GET    /api/Mesas/{id}        → GET  /api/qpro/tables/{id}
  PUT    /api/Mesas/{id}/estado → PUT  /api/qpro/tables/{id}/state
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


def _table_to_dict(table):
    return {
        'id': table.id,
        'number': table.number,
        'name': table.name,
        'restaurantId': table.restaurant_id.id,
        'restaurantName': table.restaurant_id.name,
        'state': table.state,
        'capacity': table.capacity,
        'active': table.active,
    }


class QproTablesController(http.Controller):

    @http.route('/api/qpro/tables', type='http', auth='user',
                methods=['GET'], csrf=False, cors='*')
    def get_tables(self, **kwargs):
        restaurant_id = kwargs.get('restaurantId')
        domain = [('active', '=', True)]
        if restaurant_id:
            domain.append(('restaurant_id', '=', int(restaurant_id)))
        tables = request.env['qpro.table'].search(domain, order='number asc')
        return _json_response([_table_to_dict(t) for t in tables])

    @http.route('/api/qpro/tables/<int:table_id>', type='http', auth='user',
                methods=['GET'], csrf=False, cors='*')
    def get_table(self, table_id, **kwargs):
        table = request.env['qpro.table'].browse(table_id)
        if not table.exists():
            return _json_response({'error': 'Mesa no encontrada'}, 404)
        return _json_response(_table_to_dict(table))

    @http.route('/api/qpro/tables/<int:table_id>/state', type='json',
                auth='user', methods=['PUT'], csrf=False, cors='*')
    def update_table_state(self, table_id, **kwargs):
        """
        Body: {"estado": "Disponible" | "Ocupada" | "EsperandoPago"}
        Mapea enums .NET a selection Odoo.
        """
        data = request.get_json_data()
        state_map = {
            'Disponible': 'free',
            'Ocupada': 'occupied',
            'EsperandoPago': 'awaiting_payment',
        }
        new_state = state_map.get(data.get('estado'))
        if not new_state:
            return {'error': f'Estado inválido: {data.get("estado")}'}

        table = request.env['qpro.table'].browse(table_id)
        if not table.exists():
            return {'error': 'Mesa no encontrada'}

        table.state = new_state
        return _table_to_dict(table)
