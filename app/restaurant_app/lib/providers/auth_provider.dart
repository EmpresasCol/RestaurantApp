import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/usuario.dart';
import '../services/api.dart';
import '../services/notification_service.dart';
import '../services/realtime.dart';
import '../services/sesion.dart';

/// Sesión de la app: un solo login para meseros y domiciliarios.
/// La API tiene un login por rol; se prueba el del mesero y, si el usuario
/// es de otro rol, el del domiciliario. Ningún otro rol entra a la app.
class AuthProvider with ChangeNotifier {
  AuthProvider({Api? api}) : _api = api ?? Api.instancia {
    _api.onSesionVencida = () => cerrarSesion(vencida: true);
  }

  static const _claveUsuario = 'usuario';

  final Api _api;
  Usuario? _usuario;
  bool _iniciando = true;
  bool _cargando = false;
  bool _vencida = false;

  Usuario? get usuario => _usuario;
  bool get iniciando => _iniciando;
  bool get cargando => _cargando;
  bool get estaAutenticado => _usuario != null;
  bool get esMesero => _usuario?.rol == RolUsuario.mesero;
  bool get esDomiciliario => _usuario?.rol == RolUsuario.domiciliario;
  /// Se cerró sola por token vencido: el login lo explica.
  bool get sesionVencida => _vencida;

  Future<void> cargarUsuario() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await Sesion.cargar();
      final guardado = prefs.getString(_claveUsuario);
      // Sin token no hay sesión: la API rechazaría todas las peticiones.
      if (guardado != null && Sesion.token != null) {
        final usuario = Usuario.fromJson(json.decode(guardado));
        if (usuario.rol == RolUsuario.mesero || usuario.rol == RolUsuario.domiciliario) {
          _usuario = usuario;
          Realtime.instancia.iniciar();
        }
      }
    } catch (_) {
      // Datos guardados de una versión anterior: se pide login de nuevo.
    }
    _iniciando = false;
    notifyListeners();
  }

  Future<void> login(String usuario, String clave) async {
    _cargando = true;
    _vencida = false;
    notifyListeners();
    try {
      final credenciales = {'usuario': usuario.trim(), 'clave': clave};
      Map<String, dynamic> datos;
      RolUsuario rol;
      try {
        datos = await _api.post('usuarios/login-mobile', credenciales) as Map<String, dynamic>;
        rol = RolUsuario.mesero;
      } on ApiException catch (e) {
        // La clave es correcta pero el usuario no es mesero: puede ser domiciliario.
        if (e.status != 401 || !e.mensaje.contains('Mesero')) rethrow;
        try {
          datos = await _api.post('domiciliarios/login', credenciales) as Map<String, dynamic>;
          rol = RolUsuario.domiciliario;
        } on ApiException catch (d) {
          if (d.status == 401 && d.mensaje.contains('omiciliario')) {
            throw ApiException('Esta app es para meseros y domiciliarios. Tu usuario entra por la web.', 401);
          }
          rethrow;
        }
      }

      final token = datos['token'] as String?;
      if (token == null || token.isEmpty) throw ApiException('El servidor no devolvió una sesión válida');
      await Sesion.guardar(token);

      _usuario = Usuario(
        id: datos['id'],
        nombre: datos['nombre'] ?? '',
        nombreUsuario: datos['nombreUsuario'] ?? usuario,
        rol: rol,
      );
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_claveUsuario, json.encode(_usuario!.toJson()));
      Realtime.instancia.iniciar();
      if (rol == RolUsuario.mesero) _registrarPush(_usuario!.id);
    } finally {
      _cargando = false;
      notifyListeners();
    }
  }

  /// Avisos de "pedido listo" en este celular. Si falla, el login sigue igual.
  Future<void> _registrarPush(int usuarioId) async {
    final token = await NotificationService().getToken();
    if (token == null) return;
    try {
      await _api.post('usuarios/$usuarioId/fcm-token', {'fcmToken': token});
    } catch (e) {
      debugPrint('No se registró el token de notificaciones: $e');
    }
  }

  Future<void> cerrarSesion({bool vencida = false}) async {
    if (_usuario == null && !vencida) return;
    Realtime.instancia.detener();
    _usuario = null;
    _vencida = vencida;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_claveUsuario);
    await Sesion.cerrar();
    notifyListeners();
  }
}
