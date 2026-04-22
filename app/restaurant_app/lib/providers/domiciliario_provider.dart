// app/restaurant_app/lib/providers/domiciliario_provider.dart
// Gestiona el estado del domiciliario autenticado y sus pedidos en curso.
// Patrón idéntico al usado por PedidoProvider / AuthProvider del proyecto.

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../models/domicilio_domiciliario.dart';
import '../services/domiciliario_service.dart';

class DomiciliarioProvider with ChangeNotifier {
  final DomiciliarioService _service = DomiciliarioService();

  // ── Identidad del domiciliario ──────────────────────────────────────────
  int? _domiciliarioId;
  String? _nombre;
  int _entregasHoy = 0;
  int _entregasTotales = 0;

  int? get domiciliarioId => _domiciliarioId;
  String? get nombre => _nombre;
  int get entregasHoy => _entregasHoy;
  int get entregasTotales => _entregasTotales;
  bool get estaAutenticado => _domiciliarioId != null;

  // ── Pedidos ─────────────────────────────────────────────────────────────
  List<DomicilioDomiciliario> _pedidos = [];
  bool _cargando = false;
  String? _error;

  List<DomicilioDomiciliario> get pedidos => _pedidos;
  bool get cargando => _cargando;
  String? get error => _error;

  List<DomicilioDomiciliario> get pedidosLibres =>
      _pedidos.where((p) => p.estaLibre).toList();
  List<DomicilioDomiciliario> get pedidosMios =>
      _pedidos.where((p) => p.esMio).toList();

  Timer? _polling;
  static const _intervaloRefresco = Duration(seconds: 10);

  // ── Persistencia local ──────────────────────────────────────────────────

  Future<void> cargarDesdePrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString('domiciliario_sesion');
    if (jsonStr == null) return;

    try {
      final data = json.decode(jsonStr);
      _domiciliarioId = data['id'];
      _nombre = data['nombre'];
      _entregasHoy = data['entregasHoy'] ?? 0;
      _entregasTotales = data['entregasTotales'] ?? 0;
      notifyListeners();
    } catch (_) {
      await prefs.remove('domiciliario_sesion');
    }
  }

  Future<void> _persistir() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('domiciliario_sesion', json.encode({
      'id': _domiciliarioId,
      'nombre': _nombre,
      'entregasHoy': _entregasHoy,
      'entregasTotales': _entregasTotales,
    }));
  }

  // ── Login / Logout ──────────────────────────────────────────────────────

  Future<void> login(String usuario, String clave) async {
    final result = await _service.login(usuario, clave);
    _domiciliarioId = result.usuario.id;
    _nombre = result.usuario.nombre;
    _entregasHoy = result.entregasHoy;
    _entregasTotales = result.entregasTotales;
    await _persistir();
    iniciarPolling();
    notifyListeners();
  }

  Future<void> logout() async {
    detenerPolling();
    _domiciliarioId = null;
    _nombre = null;
    _pedidos = [];
    _entregasHoy = 0;
    _entregasTotales = 0;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('domiciliario_sesion');
    notifyListeners();
  }

  // ── Carga y acciones ────────────────────────────────────────────────────

  Future<void> cargarPedidos({bool silencioso = false}) async {
    if (_domiciliarioId == null) return;
    if (!silencioso) {
      _cargando = true;
      _error = null;
      notifyListeners();
    }
    try {
      _pedidos = await _service.obtenerPedidos(_domiciliarioId!);
      _error = null;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _cargando = false;
      notifyListeners();
    }
  }

  Future<void> marcarRecogido(int domicilioId) async {
    await _service.marcarRecogido(_domiciliarioId!, domicilioId);
    await cargarPedidos(silencioso: true);
  }

  Future<void> marcarEnCamino(int domicilioId) async {
    await _service.marcarEnCamino(_domiciliarioId!, domicilioId);
    await cargarPedidos(silencioso: true);
  }

  Future<void> marcarEntregado(int domicilioId) async {
    await _service.marcarEntregado(_domiciliarioId!, domicilioId);
    await refrescarEstadisticas();
    await cargarPedidos(silencioso: true);
  }

  Future<void> refrescarEstadisticas() async {
    if (_domiciliarioId == null) return;
    try {
      final stats = await _service.obtenerEstadisticas(_domiciliarioId!);
      _entregasHoy = stats['entregadosHoy'] ?? _entregasHoy;
      _entregasTotales = stats['totalEntregados'] ?? _entregasTotales;
      await _persistir();
      notifyListeners();
    } catch (_) {/* no bloqueamos la UI por esto */}
  }

  // ── Polling (complementa al push de FCM) ────────────────────────────────

  void iniciarPolling() {
    _polling?.cancel();
    _polling = Timer.periodic(_intervaloRefresco, (_) => cargarPedidos(silencioso: true));
  }

  void detenerPolling() {
    _polling?.cancel();
    _polling = null;
  }

  @override
  void dispose() {
    detenerPolling();
    super.dispose();
  }
}
