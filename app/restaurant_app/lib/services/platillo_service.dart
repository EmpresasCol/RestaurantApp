import '../models/platillo.dart';
import 'http_service.dart';

class PlatilloService {
  final HttpService _http = HttpService();

  Future<List<Platillo>> obtenerTodos() async {
    return await _http.get(
      'platillos',
      (json) => (json as List).map((p) => Platillo.fromJson(p)).toList(),
    );
  }
}