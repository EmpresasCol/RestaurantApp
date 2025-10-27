import '../models/pedido.dart';
import 'http_service.dart';

class PedidoService {
  final HttpService _http = HttpService();

  Future<List<Pedido>> obtenerTodos() async {
    return await _http.get(
      'pedidos',
      (json) => (json as List).map((p) => Pedido.fromJson(p)).toList(),
    );
  }

  Future<Pedido> crear(Map<String, dynamic> data) async {
    return await _http.post('pedidos', data, (json) => Pedido.fromJson(json));
  }

  Future<Pedido> actualizar(int id, Map<String, dynamic> data) async {
    return await _http.put('pedidos/$id/actualizar', data, (json) => Pedido.fromJson(json));
  }

  Future<Pedido> actualizarEstado(int id, String estado) async {
    return await _http.put('pedidos/$id/estado', {'estado': estado}, (json) => Pedido.fromJson(json));
  }

  Future<bool> cancelar(int id) async {
    return await _http.delete('pedidos/$id');
  }
}