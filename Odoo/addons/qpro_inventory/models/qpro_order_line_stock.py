# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import UserError


class StockMoveQproExt(models.Model):
    """Agrega la FK inversa en stock.move para el consumo desde líneas de pedido."""

    _inherit = 'stock.move'

    qpro_order_line_id = fields.Many2one(
        comodel_name='qpro.order.line',
        string='Línea de pedido QPro',
        ondelete='set null',
        index=True,
    )


class QproOrderLineStock(models.Model):
    """Extiende qpro.order.line para consumir stock FIFO al preparar.

    Reemplaza el trigger `trg_pedidodetalle_after_update` de MySQL:
      - EnPreparacion → consume ingredientes FIFO via stock.move
      - Cancelado → restaura stock via stock.move reverso

    PREREQUISITO: El módulo `stock` debe estar instalado y los productos
    del menú deben tener rutas FIFO configuradas en su almacén.
    """

    _inherit = 'qpro.order.line'

    stock_move_ids = fields.One2many(
        comodel_name='stock.move',
        inverse_name='qpro_order_line_id',
        string='Movimientos de stock',
        readonly=True,
    )

    @api.model
    def _get_stock_location(self):
        """Retorna la ubicación de stock principal del restaurante."""
        warehouse = self.env['stock.warehouse'].search([], limit=1)
        return warehouse.lot_stock_id if warehouse else False

    @api.model
    def _get_customer_location(self):
        return self.env.ref('stock.stock_location_customers', raise_if_not_found=False)

    def _consume_stock_fifo(self):
        """Genera un stock.move de consumo al entrar en preparación."""
        stock_location = self._get_stock_location()
        customer_location = self._get_customer_location()
        if not stock_location or not customer_location:
            return

        for line in self:
            if not line.product_id:
                continue
            move = self.env['stock.move'].create({
                'name': f'Consumo: {line.order_id.name} - {line.product_id.name}',
                'product_id': line.product_id.id,
                'product_uom_qty': line.quantity,
                'product_uom': line.product_id.uom_id.id,
                'location_id': stock_location.id,
                'location_dest_id': customer_location.id,
                'qpro_order_line_id': line.id,
                'origin': line.order_id.name,
            })
            move._action_confirm()
            move._action_assign()
            # FIFO: Odoo asigna los lotes más antiguos automáticamente
            if move.state == 'assigned':
                move.with_context(force_period_date=fields.Datetime.now())._action_done()

    def _restore_stock(self):
        """Revierte los stock.moves al cancelar la línea."""
        for line in self:
            moves = line.stock_move_ids.filtered(lambda m: m.state == 'done')
            if moves:
                moves._do_unreserve()

    def write(self, vals):
        result = super().write(vals)
        if 'state' in vals:
            if vals['state'] == 'preparing':
                self._consume_stock_fifo()
            elif vals['state'] == 'cancelled':
                self._restore_stock()
        return result
