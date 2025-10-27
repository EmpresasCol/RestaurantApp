import '../models/mesa.dart';
import 'http_service.dart';

class MesaService {
  final HttpService _http = HttpService();

  Future<List<Mesa>> obtenerTodas() async {
    return await _http.get(
      'mesas',
      (json) => (json as List).map((m) => Mesa.fromJson(m)).toList(),
    );
  }

  Future<Mesa> obtenerPorId(int id) async {
    return await _http.get('mesas/$id', (json) => Mesa.fromJson(json));
  }
}