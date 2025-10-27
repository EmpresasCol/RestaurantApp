import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

class HttpService {
  Future<T> get<T>(String endpoint, T Function(dynamic) fromJson) async {
    try {
      print('🌐 GET: ${ApiConfig.apiUrl}/$endpoint');
      
      final response = await http.get(
        Uri.parse('${ApiConfig.apiUrl}/$endpoint'),
        headers: {'Content-Type': 'application/json; charset=UTF-8'},
      ).timeout(const Duration(seconds: 10));  // ✅ Timeout

      print('📥 Response status: ${response.statusCode}');
      print('📥 Response body: ${response.body}');

      if (response.statusCode == 200) {
        final decoded = json.decode(utf8.decode(response.bodyBytes));
        return fromJson(decoded);
      }
      throw Exception('Error HTTP ${response.statusCode}: ${response.body}');
    } catch (e) {
      print('❌ Error en GET $endpoint: $e');
      throw Exception('Error de conexión: $e');
    }
  }

  Future<T> post<T>(String endpoint, Map<String, dynamic> data, T Function(dynamic) fromJson) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.apiUrl}/$endpoint'),
        headers: {'Content-Type': 'application/json; charset=UTF-8'},
        body: json.encode(data),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return fromJson(json.decode(utf8.decode(response.bodyBytes)));
      }
      throw Exception('Error: ${response.statusCode}');
    } catch (e) {
      throw Exception('Error de conexión: $e');
    }
  }

  Future<T> put<T>(String endpoint, Map<String, dynamic> data, T Function(dynamic) fromJson) async {
    try {
      final response = await http.put(
        Uri.parse('${ApiConfig.apiUrl}/$endpoint'),
        headers: {'Content-Type': 'application/json; charset=UTF-8'},
        body: json.encode(data),
      );

      if (response.statusCode == 200) {
        return fromJson(json.decode(utf8.decode(response.bodyBytes)));
      }
      throw Exception('Error: ${response.statusCode}');
    } catch (e) {
      throw Exception('Error de conexión: $e');
    }
  }

  Future<bool> delete(String endpoint) async {
    try {
      final response = await http.delete(
        Uri.parse('${ApiConfig.apiUrl}/$endpoint'),
        headers: {'Content-Type': 'application/json; charset=UTF-8'},
      );
      return response.statusCode == 200 || response.statusCode == 204;
    } catch (e) {
      return false;
    }
  }
}