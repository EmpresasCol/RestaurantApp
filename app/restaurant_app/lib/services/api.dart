import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'sesion.dart';

/// Error que se le puede mostrar al usuario tal cual.
class ApiException implements Exception {
  ApiException(this.mensaje, [this.status]);

  final String mensaje;
  final int? status;

  @override
  String toString() => mensaje;
}

/// Único cliente HTTP de la app: JWT de la sesión, UTF-8, tiempo límite y mensajes legibles.
/// Un 401 fuera del login cierra la sesión (`onSesionVencida`).
class Api {
  Api({http.Client? cliente}) : _cliente = cliente ?? http.Client();

  static Api instancia = Api();

  final http.Client _cliente;
  void Function()? onSesionVencida;

  // Render apaga la API sin tráfico y el primer arranque tarda; más que esto es una caída.
  static const tiempoLimite = Duration(seconds: 40);
  static const sinConexion = 'Sin conexión con el servidor. Revisa el internet e inténtalo de nuevo.';

  Future<dynamic> get(String ruta) => _enviar('GET', ruta);
  Future<dynamic> post(String ruta, [Object? cuerpo]) => _enviar('POST', ruta, cuerpo);
  Future<dynamic> put(String ruta, [Object? cuerpo]) => _enviar('PUT', ruta, cuerpo);
  Future<dynamic> delete(String ruta, [Object? cuerpo]) => _enviar('DELETE', ruta, cuerpo);

  Future<dynamic> _enviar(String metodo, String ruta, [Object? cuerpo]) async {
    final peticion = http.Request(metodo, Uri.parse('${ApiConfig.apiUrl}/$ruta'))
      ..headers.addAll(Sesion.encabezados());
    if (cuerpo != null) peticion.body = json.encode(cuerpo);

    final http.Response respuesta;
    try {
      respuesta = await http.Response.fromStream(await _cliente.send(peticion).timeout(tiempoLimite));
    } on TimeoutException {
      throw ApiException(sinConexion);
    } on http.ClientException {
      throw ApiException(sinConexion);
    } catch (e) {
      // SocketException y HandshakeException (dart:io) no existen en web; se tratan igual.
      if (e is ApiException) rethrow;
      throw ApiException(sinConexion);
    }

    final texto = utf8.decode(respuesta.bodyBytes);
    if (respuesta.statusCode >= 200 && respuesta.statusCode < 300) {
      return texto.isEmpty ? null : json.decode(texto);
    }

    if (respuesta.statusCode == 401 && !ruta.endsWith('login') && !ruta.endsWith('login-mobile')) {
      onSesionVencida?.call();
      throw ApiException('Tu sesión venció. Inicia sesión de nuevo.', 401);
    }
    throw ApiException(mensajeDe(texto, respuesta.statusCode), respuesta.statusCode);
  }

  /// La API responde { message }, un texto o un ProblemDetails de validación.
  static String mensajeDe(String texto, int status) {
    try {
      final datos = json.decode(texto);
      if (datos is String && datos.isNotEmpty) return datos;
      if (datos is Map) {
        if (datos['message'] != null) return datos['message'].toString();
        final errores = datos['errors'];
        if (errores is Map && errores.isNotEmpty) {
          final primero = errores.values.first;
          return (primero is List && primero.isNotEmpty ? primero.first : primero).toString();
        }
        if (datos['title'] != null) return datos['title'].toString();
      }
    } catch (_) {
      if (texto.isNotEmpty && texto.length < 200) return texto;
    }
    return switch (status) {
      403 => 'Tu usuario no tiene permiso para esto.',
      404 => 'No se encontró lo que buscabas. Actualiza la pantalla.',
      >= 500 => 'El servidor tuvo un problema. Inténtalo de nuevo.',
      _ => 'No se pudo completar la acción (error $status).',
    };
  }
}
