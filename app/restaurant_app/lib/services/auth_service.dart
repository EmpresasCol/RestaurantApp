import '../models/usuario.dart';
import 'http_service.dart';

class AuthService {
  final HttpService _http = HttpService();

  Future<Usuario> login(String usuario, String clave) async {
    return await _http.post(
      'usuarios/login-mobile',
      {'usuario': usuario, 'clave': clave},
      (json) => Usuario.fromJson(json),
    );
  }
}