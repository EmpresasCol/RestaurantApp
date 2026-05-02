# -*- coding: utf-8 -*-
"""
Reemplaza: PlatillosController.cs

  .NET                         → Odoo
  GET  /api/Platillos          → GET  /api/qpro/products
  GET  /api/Platillos/{id}     → GET  /api/qpro/products/{id}
  POST /api/Platillos          → POST /api/qpro/products
  PUT  /api/Platillos/{id}     → PUT  /api/qpro/products/{id}
"""
import json
import base64
from odoo import http
from odoo.http import request, Response


def _json_response(data, status=200):
    return Response(
        json.dumps(data, default=str),
        status=status,
        mimetype='application/json',
        headers={'Access-Control-Allow-Origin': '*'},
    )


def _product_to_dict(p):
    image_b64 = ''
    if p.image_1920:
        image_b64 = p.image_1920.decode('utf-8') if isinstance(p.image_1920, bytes) else p.image_1920
    return {
        'id': p.id,
        'nombre': p.name,
        'descripcion': p.description_sale or '',
        'precio': p.list_price,
        'categoria': p.categ_id.name if p.categ_id else '',
        'categoriaId': p.categ_id.id if p.categ_id else None,
        'imagenUrl': image_b64,
        'activo': p.active,
    }


class QproProductsController(http.Controller):

    # ── GET /api/qpro/products ────────────────────────────────────────────────
    @http.route('/api/qpro/products', type='http', auth='user',
                methods=['GET'], csrf=False, cors='*')
    def get_products(self, **kwargs):
        """Devuelve solo los productos marcados como platillos (qpro_is_dish=True)."""
        products = request.env['product.product'].search([
            ('active', '=', True),
            ('product_tmpl_id.qpro_is_dish', '=', True),
        ], order='name asc')
        return _json_response([_product_to_dict(p) for p in products])

    # ── GET /api/qpro/products/{id} ───────────────────────────────────────────
    @http.route('/api/qpro/products/<int:product_id>', type='http', auth='user',
                methods=['GET'], csrf=False, cors='*')
    def get_product(self, product_id, **kwargs):
        product = request.env['product.product'].browse(product_id)
        if not product.exists():
            return _json_response({'error': 'Platillo no encontrado'}, 404)
        return _json_response(_product_to_dict(product))

    # ── POST /api/qpro/products ───────────────────────────────────────────────
    @http.route('/api/qpro/products', type='json', auth='user',
                methods=['POST'], csrf=False, cors='*')
    def create_product(self, **kwargs):
        """
        Body (equiv. CrearPlatilloDto):
        {
            "nombre": "Bandeja Paisa",
            "descripcion": "...",
            "precio": 25000,
            "categoriaId": 3,
            "imagenUrl": "<base64>"    // opcional
        }
        """
        data = request.get_json_data()
        vals = {
            'name': data['nombre'],
            'description_sale': data.get('descripcion', ''),
            'list_price': data.get('precio', 0),
            'type': 'consu',
            'qpro_is_dish': True,
        }
        if data.get('categoriaId'):
            vals['categ_id'] = int(data['categoriaId'])
        if data.get('imagenUrl'):
            raw = data['imagenUrl']
            if ',' in raw:
                raw = raw.split(',')[1]
            vals['image_1920'] = raw.encode() if isinstance(raw, str) else raw

        tmpl = request.env['product.template'].create(vals)
        return _product_to_dict(tmpl.product_variant_ids[0])

    # ── PUT /api/qpro/products/{id} ───────────────────────────────────────────
    @http.route('/api/qpro/products/<int:product_id>', type='json', auth='user',
                methods=['PUT'], csrf=False, cors='*')
    def update_product(self, product_id, **kwargs):
        data = request.get_json_data()
        product = request.env['product.product'].browse(product_id)
        if not product.exists():
            return {'error': 'Platillo no encontrado'}

        vals = {}
        if 'nombre' in data:
            vals['name'] = data['nombre']
        if 'descripcion' in data:
            vals['description_sale'] = data['descripcion']
        if 'precio' in data:
            vals['list_price'] = data['precio']
        if 'categoriaId' in data:
            vals['categ_id'] = int(data['categoriaId'])
        if data.get('imagenUrl'):
            raw = data['imagenUrl']
            if ',' in raw:
                raw = raw.split(',')[1]
            vals['image_1920'] = raw.encode() if isinstance(raw, str) else raw

        if vals:
            product.product_tmpl_id.write(vals)
        return _product_to_dict(product)
