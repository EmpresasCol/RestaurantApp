import 'package:flutter/material.dart';
import '../models/mesa.dart';

class MesaCard extends StatelessWidget {
  final Mesa mesa;
  final VoidCallback onTap;

  const MesaCard({
    super.key,
    required this.mesa,
    required this.onTap,
  });

  Color _getColorEstado() {
    switch (mesa.estado) {
      case EstadoMesa.libre:
        return Colors.green;
      case EstadoMesa.ocupada:
        return Colors.red;
      case EstadoMesa.reservada:
        return Colors.orange;
    }
  }

  IconData _getIconoEstado() {
    switch (mesa.estado) {
      case EstadoMesa.libre:
        return Icons.check_circle;
      case EstadoMesa.ocupada:
        return Icons.person;
      case EstadoMesa.reservada:
        return Icons.access_time;
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 100,
        decoration: BoxDecoration(
          color: mesa.estaSeleccionada
              ? const Color(0xFFFF6B35)
              : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: mesa.estaSeleccionada
                ? const Color(0xFFFF6B35)
                : _getColorEstado(),
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.table_restaurant,
              size: 32,
              color: mesa.estaSeleccionada ? Colors.white : _getColorEstado(),
            ),
            const SizedBox(height: 4),
            Text(
              'Mesa ${mesa.numero}',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: mesa.estaSeleccionada ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 2),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  _getIconoEstado(),
                  size: 14,
                  color: mesa.estaSeleccionada ? Colors.white : _getColorEstado(),
                ),
                const SizedBox(width: 4),
                Text(
                  '${mesa.capacidad} pers',
                  style: TextStyle(
                    fontSize: 12,
                    color: mesa.estaSeleccionada
                        ? Colors.white.withOpacity(0.9)
                        : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}