import 'package:flutter/material.dart';
import '../models/pedido.dart';
import '../services/pedido_service.dart';

class PedidoProvider with ChangeNotifier {
  final PedidoService _pedidoService = PedidoService();
  List<Pedido> _pedidos = [];
  bool _cargando = false;

  List<Pedido> get pedidos => _pedidos;
  bool get cargando => _cargando;

  Future<void> cargarPedidos() async {
    _cargando = true;
    notifyListeners();

    try {
      _pedidos = await _pedidoService.obtenerTodos();
    } catch (e) {
      debugPrint('Error cargando pedidos: $e');
    } finally {
      _cargando = false;
      notifyListeners();
    }
  }

  Future<void> crearPedido(Map<String, dynamic> data) async {
    try {
      await _pedidoService.crear(data);
      await cargarPedidos();
    } catch (e) {
      rethrow;
    }
  }

  Future<void> actualizarPedido(int id, Map<String, dynamic> data) async {
    try {
      await _pedidoService.actualizar(id, data);
      await cargarPedidos();
    } catch (e) {
      rethrow;
    }
  }

  Future<void> cambiarEstado(int id, String estado) async {
    try {
      await _pedidoService.actualizarEstado(id, estado);
      await cargarPedidos();
    } catch (e) {
      rethrow;
    }
  }

  Future<void> cancelarPedido(int id) async {
    try {
      await _pedidoService.cancelar(id);
      await cargarPedidos();
    } catch (e) {
      rethrow;
    }
  }
}