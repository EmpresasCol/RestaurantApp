// app/restaurant_app/lib/services/domiciliario_service.dart
// Capa de red para el rol Domiciliario. Usa http + ApiConfig existente.
// Devuelve excepciones con mensaje legible; no imprime datos sensibles.

import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../models/usuario.dart';
import '../models/domicilio_domiciliario.dart';

class DomiciliarioService {
  static const _timeout = Duration(seconds: 15);

  Map<String, String> get _headers => {
        'Content-Type': 'application/json; charset=UTF-8',
        'ngrok-skip-browser-warning': '69420',
      };

  // ── LOGIN ───────────────────────────────────────────────────────────────

  Future<LoginDomiciliarioResult> login(String usuario, String clave) async {
    final resp = await http
        .post(
          Uri.parse('${ApiConfig.apiUrl}/domiciliarios/login'),
          headers: _headers,
          body: json.encode({'usuario': usuario, 'clave': clave}),
        )
        .timeout(_timeout);

    if (resp.statusCode == 200) {
      final data = json.decode(resp.body);
      return LoginDomiciliarioResult(
        usuario: Usuario(
          id: data['id'],
          nombre: data['nombre'],
          nombreUsuario: data['nombreUsuario'],
          rol: RolUsuario.mesero, // el enum existente no tiene domiciliario; lo manejamos aparte
        ),
        entregasHoy: data['entregasHoy'] ?? 0,
        entregasTotales: data['entregasTotales'] ?? 0,
      );
    }

    final msg = _extraerMensaje(resp.body, defecto: 'Credenciales inválidas');
    throw Exception(msg);
  }

  // ── PEDIDOS ─────────────────────────────────────────────────────────────

  Future<List<DomicilioDomiciliario>> obtenerPedidos(int domiciliarioId) async {
    final resp = await http.get(
      Uri.parse('${ApiConfig.apiUrl}/domiciliarios/$domiciliarioId/pedidos'),
      headers: _headers,
    ).timeout(_timeout);

    if (resp.statusCode == 200) {
      final List data = json.decode(resp.body);
      return data.map((e) => DomicilioDomiciliario.fromJson(e)).toList();
    }
    throw Exception(_extraerMensaje(resp.body, defecto: 'Error al cargar pedidos'));
  }

  Future<void> marcarRecogido(int domiciliarioId, int domicilioId) =>
      _put('/domiciliarios/$domiciliarioId/pedidos/$domicilioId/recoger');

  Future<void> marcarEnCamino(int domiciliarioId, int domicilioId) =>
      _put('/domiciliarios/$domiciliarioId/pedidos/$domicilioId/en-camino');

  Future<void> marcarEntregado(int domiciliarioId, int domicilioId) =>
      _put('/domiciliarios/$domiciliarioId/pedidos/$domicilioId/entregar');

  Future<Map<String, dynamic>> obtenerEstadisticas(int domiciliarioId) async {
    final resp = await http.get(
      Uri.parse('${ApiConfig.apiUrl}/domiciliarios/$domiciliarioId/estadisticas'),
      headers: _headers,
    ).timeout(_timeout);

    if (resp.statusCode == 200) return json.decode(resp.body);
    throw Exception(_extraerMensaje(resp.body, defecto: 'Error al cargar estadísticas'));
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  Future<void> _put(String path) async {
    final resp = await http.put(
      Uri.parse('${ApiConfig.apiUrl}$path'),
      headers: _headers,
    ).timeout(_timeout);

    if (resp.statusCode == 204) return;
    throw Exception(_extraerMensaje(resp.body, defecto: 'Error al actualizar el pedido'));
  }

  String _extraerMensaje(String body, {required String defecto}) {
    try {
      final data = json.decode(body);
      if (data is Map && data['message'] != null) return data['message'].toString();
    } catch (_) {}
    return defecto;
  }
}

class LoginDomiciliarioResult {
  final Usuario usuario;
  final int entregasHoy;
  final int entregasTotales;

  LoginDomiciliarioResult({
    required this.usuario,
    required this.entregasHoy,
    required this.entregasTotales,
  });
}
