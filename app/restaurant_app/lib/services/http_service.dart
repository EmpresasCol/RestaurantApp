import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'sesion.dart';

class HttpService {
  Future<T> get<T>(String endpoint, T Function(dynamic) fromJson) async {
    try {
      final response = await http.get(
        Uri.parse('${ApiConfig.apiUrl}/$endpoint'),
        headers: Sesion.encabezados(),
      );

      if (response.statusCode == 200) {
        return fromJson(json.decode(utf8.decode(response.bodyBytes)));
      }
      throw Exception(_mensajeError(response));
    } catch (e) {
      throw Exception('Error de conexión: $e');
    }
  }

  Future<T> post<T>(String endpoint, Map<String, dynamic> data, T Function(dynamic) fromJson) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.apiUrl}/$endpoint'),
        headers: Sesion.encabezados(),
        body: json.encode(data),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return fromJson(json.decode(utf8.decode(response.bodyBytes)));
      }
      throw Exception(_mensajeError(response));
    } catch (e) {
      throw Exception('Error de conexión: $e');
    }
  }

  Future<T> put<T>(String endpoint, Map<String, dynamic> data, T Function(dynamic) fromJson) async {
    try {
      final response = await http.put(
        Uri.parse('${ApiConfig.apiUrl}/$endpoint'),
        headers: Sesion.encabezados(),
        body: json.encode(data),
      );

      if (response.statusCode == 200) {
        return fromJson(json.decode(utf8.decode(response.bodyBytes)));
      }
      throw Exception(_mensajeError(response));
    } catch (e) {
      throw Exception('Error de conexión: $e');
    }
  }

  Future<bool> delete(String endpoint) async {
    try {
      final response = await http.delete(
        Uri.parse('${ApiConfig.apiUrl}/$endpoint'),
        headers: Sesion.encabezados(),
      );
      return response.statusCode == 200 || response.statusCode == 204;
    } catch (e) {
      return false;
    }
  }

  /// Mensaje legible del servidor sin volcar el cuerpo completo (puede traer datos personales).
  String _mensajeError(http.Response response) {
    if (response.statusCode == 401) return 'Sesión expirada. Inicia sesión de nuevo.';
    try {
      final data = json.decode(utf8.decode(response.bodyBytes));
      if (data is Map && data['message'] != null) return data['message'].toString();
      if (data is String) return data;
    } catch (_) {}
    return 'Error ${response.statusCode}';
  }
}
