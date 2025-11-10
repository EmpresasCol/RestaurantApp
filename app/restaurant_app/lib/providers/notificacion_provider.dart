import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../models/notificacion.dart';

class NotificacionProvider with ChangeNotifier {
  List<Notificacion> _notificaciones = [];
  
  List<Notificacion> get notificaciones => _notificaciones;
  
  int get notificacionesNoLeidas => 
      _notificaciones.where((n) => !n.leida).length;

  Future<void> cargarNotificaciones() async {
    final prefs = await SharedPreferences.getInstance();
    final notificacionesJson = prefs.getString('notificaciones');
    
    if (notificacionesJson != null) {
      final List<dynamic> decoded = json.decode(notificacionesJson);
      _notificaciones = decoded
          .map((item) => Notificacion.fromJson(item))
          .toList();
      
      // Ordenar por fecha descendente
      _notificaciones.sort((a, b) => b.fecha.compareTo(a.fecha));
      notifyListeners();
    }
  }

  Future<void> agregarNotificacion({
    required int pedidoId,
    required int mesaNumero,
    required String titulo,
    required String mensaje,
    String? platillos,     
    int? totalItems,
  }) async {
    final notificacion = Notificacion(
      id: DateTime.now().millisecondsSinceEpoch,
      pedidoId: pedidoId,
      mesaNumero: mesaNumero,
      titulo: titulo,
      mensaje: mensaje,
      fecha: DateTime.now(),
    );

    _notificaciones.insert(0, notificacion);
    
    // Mantener solo las últimas 50 notificaciones
    if (_notificaciones.length > 50) {
      _notificaciones = _notificaciones.take(50).toList();
    }

    await _guardarNotificaciones();
    notifyListeners();
  }

  Future<void> marcarComoLeida(int id) async {
    final index = _notificaciones.indexWhere((n) => n.id == id);
    if (index != -1) {
      _notificaciones[index] = Notificacion(
        id: _notificaciones[index].id,
        pedidoId: _notificaciones[index].pedidoId,
        mesaNumero: _notificaciones[index].mesaNumero,
        titulo: _notificaciones[index].titulo,
        mensaje: _notificaciones[index].mensaje,
        fecha: _notificaciones[index].fecha,
        leida: true,
      );
      
      await _guardarNotificaciones();
      notifyListeners();
    }
  }

  Future<void> marcarTodasComoLeidas() async {
    _notificaciones = _notificaciones.map((n) => Notificacion(
      id: n.id,
      pedidoId: n.pedidoId,
      mesaNumero: n.mesaNumero,
      titulo: n.titulo,
      mensaje: n.mensaje,
      fecha: n.fecha,
      leida: true,
    )).toList();
    
    await _guardarNotificaciones();
    notifyListeners();
  }

  Future<void> eliminarNotificacion(int id) async {
    _notificaciones.removeWhere((n) => n.id == id);
    await _guardarNotificaciones();
    notifyListeners();
  }

  Future<void> limpiarNotificaciones() async {
    _notificaciones.clear();
    await _guardarNotificaciones();
    notifyListeners();
  }

  Future<void> _guardarNotificaciones() async {
    final prefs = await SharedPreferences.getInstance();
    final notificacionesJson = json.encode(
      _notificaciones.map((n) => n.toJson()).toList()
    );
    await prefs.setString('notificaciones', notificacionesJson);
  }
}