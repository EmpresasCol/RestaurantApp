import 'package:shared_preferences/shared_preferences.dart';

/// Token JWT de la sesión actual (mesero o domiciliario), compartido por
/// todos los servicios HTTP. La API lo exige en todo endpoint no público.
class Sesion {
  static const _clave = 'token';
  static String? token;

  static Future<void> cargar() async {
    final prefs = await SharedPreferences.getInstance();
    token = prefs.getString(_clave);
  }

  static Future<void> guardar(String nuevo) async {
    token = nuevo;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_clave, nuevo);
  }

  static Future<void> cerrar() async {
    token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_clave);
  }

  static Map<String, String> encabezados() => {
        'Content-Type': 'application/json; charset=UTF-8',
        'ngrok-skip-browser-warning': '69420',
        if (token != null) 'Authorization': 'Bearer $token',
      };
}
