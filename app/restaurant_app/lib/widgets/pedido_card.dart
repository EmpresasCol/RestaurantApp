import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/pedido.dart';

class PedidoCard extends StatelessWidget {
  final Pedido pedido;
  final VoidCallback? onEditar;
  final VoidCallback? onEntregar;
  final VoidCallback? onCobrar;
  final VoidCallback? onCancelar;

  const PedidoCard({
    super.key,
    required this.pedido,
    this.onEditar,
    this.onEntregar,
    this.onCobrar,
    this.onCancelar,
  });

  Color _getColorEstado() {
    switch (pedido.estado) {
      case EstadoPedido.enProceso:
        return Colors.blue;
      case EstadoPedido.listo:
        return Colors.orange;
      case EstadoPedido.entregado:
        return Colors.green;
      case EstadoPedido.pagado:
        return Colors.grey;
      case EstadoPedido.cancelado:
        return Colors.red;
    }
  }

  String _getTextoEstado() {
    switch (pedido.estado) {
      case EstadoPedido.enProceso:
        return 'En Proceso';
      case EstadoPedido.listo:
        return 'Listo';
      case EstadoPedido.entregado:
        return 'Entregado';
      case EstadoPedido.pagado:
        return 'Pagado';
      case EstadoPedido.cancelado:
        return 'Cancelado';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: _getColorEstado(), width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: _getColorEstado().withOpacity(0.1),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(10),
                topRight: Radius.circular(10),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Pedido #${pedido.id}',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.table_restaurant, size: 16),
                        const SizedBox(width: 4),
                        Text(
                          'Mesa ${pedido.mesaNumero}',
                          style: const TextStyle(fontSize: 14),
                        ),
                      ],
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: _getColorEstado(),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    _getTextoEstado(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  DateFormat('dd/MM/yyyy HH:mm').format(pedido.fecha),
                  style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                ),
                const SizedBox(height: 12),
                ...pedido.detalles.map((item) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              '${item.cantidad}x ${item.platilloNombre}',
                              style: const TextStyle(fontSize: 14),
                            ),
                          ),
                          Text(
                            NumberFormat.currency(symbol: '\$', decimalDigits: 0)
                                .format(item.precio * item.cantidad),
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    )),
                const Divider(),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Total:',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      NumberFormat.currency(symbol: '\$', decimalDigits: 0)
                          .format(pedido.total),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFFF6B35),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (onEditar != null || onEntregar != null || onCobrar != null || onCancelar != null)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(10),
                  bottomRight: Radius.circular(10),
                ),
              ),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (onEditar != null)
                    _ActionButton(
                      icon: Icons.edit,
                      label: 'Editar',
                      color: Colors.orange,
                      onPressed: onEditar!,
                    ),
                  if (onEntregar != null)
                    _ActionButton(
                      icon: Icons.restaurant,
                      label: 'Entregar',
                      color: const Color(0xFF17A2B8),
                      onPressed: onEntregar!,
                    ),
                  if (onCobrar != null)
                    _ActionButton(
                      icon: Icons.attach_money,
                      label: 'Cobrar',
                      color: const Color(0xFF28A745),
                      onPressed: onCobrar!,
                    ),
                  if (onCancelar != null)
                    _ActionButton(
                      icon: Icons.close,
                      label: 'Cancelar',
                      color: Colors.red,
                      onPressed: onCancelar!,
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onPressed;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }
}