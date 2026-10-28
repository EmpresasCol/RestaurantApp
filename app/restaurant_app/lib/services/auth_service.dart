import '../models/usuario.dart';
import 'http_service.dart';
import 'sesion.dart';

class AuthService {
  final HttpService _http = HttpService();

  /// Inicia sesión del mesero y guarda el JWT que la API exige en las demás peticiones.
  Future<Usuario> login(String usuario, String clave) async {
    final datos = await _http.post(
      'usuarios/login-mobile',
      {'usuario': usuario, 'clave': clave},
      (json) => json as Map<String, dynamic>,
    );

    final token = datos['token'] as String?;
    if (token == null || token.isEmpty) {
      throw Exception('El servidor no devolvió una sesión válida');
    }
    await Sesion.guardar(token);
    return Usuario.fromJson(datos);
  }
}
