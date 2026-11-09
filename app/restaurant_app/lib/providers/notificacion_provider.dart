import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/notificacion.dart';

/// Avisos de "pedido listo" que llegan por push. Se guardan en el celular (las últimas 50);
/// con la app cerrada los guarda el manejador en segundo plano de NotificationService.
class NotificacionProvider with ChangeNotifier {
  static const clave = 'notificaciones';
  static const maximo = 50;

  List<Notificacion> _notificaciones = [];

  List<Notificacion> get notificaciones => _notificaciones;
  int get noLeidas => _notificaciones.where((n) => !n.leida).length;

  Future<void> cargar() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload(); // el manejador en segundo plano escribe desde otro aislado
    final guardadas = prefs.getString(clave);
    if (guardadas == null) return;
    try {
      _notificaciones = (json.decode(guardadas) as List).map((n) => Notificacion.fromJson(n)).toList()
        ..sort((a, b) => b.fecha.compareTo(a.fecha));
    } catch (_) {
      _notificaciones = [];
    }
    notifyListeners();
  }

  Future<void> agregar({required int pedidoId, required int mesaNumero, required String titulo, required String mensaje}) async {
    _notificaciones = [
      Notificacion(
        id: DateTime.now().millisecondsSinceEpoch,
        pedidoId: pedidoId,
        mesaNumero: mesaNumero,
        titulo: titulo,
        mensaje: mensaje,
        fecha: DateTime.now(),
      ),
      ..._notificaciones,
    ].take(maximo).toList();
    await _guardar();
  }

  Future<void> marcarLeida(int id) async {
    _notificaciones = [for (final n in _notificaciones) n.id == id ? n.leidaYa() : n];
    await _guardar();
  }

  Future<void> marcarTodasLeidas() async {
    _notificaciones = [for (final n in _notificaciones) n.leidaYa()];
    await _guardar();
  }

  Future<void> limpiar() async {
    _notificaciones = [];
    await _guardar();
  }

  Future<void> _guardar() async {
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(clave, json.encode(_notificaciones.map((n) => n.toJson()).toList()));
  }
}
