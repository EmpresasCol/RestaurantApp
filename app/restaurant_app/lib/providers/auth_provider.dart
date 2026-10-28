import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/usuario.dart';
import '../services/auth_service.dart';
import '../services/notification_service.dart';
import '../services/sesion.dart';
import '../config/api_config.dart';

class AuthProvider with ChangeNotifier {
  final AuthService _authService = AuthService();
  Usuario? _usuario;
  bool _cargando = false;

  Usuario? get usuario => _usuario;
  bool get estaAutenticado => _usuario != null;
  bool get cargando => _cargando;

  Future<void> cargarUsuario() async {
    final prefs = await SharedPreferences.getInstance();
    await Sesion.cargar();
    final usuarioJson = prefs.getString('usuario');

    // Sin token no hay sesión: la API rechazaría todas las peticiones.
    if (usuarioJson != null && Sesion.token != null) {
      final usuario = Usuario.fromJson(json.decode(usuarioJson));
      if (usuario.rol == RolUsuario.mesero) {
        _usuario = usuario;
        notifyListeners();
      }
    }
  }

  Future<void> login(String usuario, String clave) async {
    _cargando = true;
    notifyListeners();

    try {
      final user = await _authService.login(usuario, clave);

      if (user.rol != RolUsuario.mesero) {
        await Sesion.cerrar();
        throw Exception('Solo usuarios con rol Mesero pueden acceder');
      }

      _usuario = user;

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('usuario', json.encode({
        'id': user.id,
        'nombre': user.nombre,
        'nombreUsuario': user.nombreUsuario,
        'rol': user.rol.toString().split('.').last,
      }));

      await _enviarTokenFCM(user.id);

      _cargando = false;
      notifyListeners();
    } catch (e) {
      _cargando = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> _enviarTokenFCM(int usuarioId) async {
    try {
      final token = await NotificationService().getToken();
      if (token == null) {
        debugPrint('⚠️ No hay token FCM disponible');
        return;
      }

      final response = await http.post(
        Uri.parse('${ApiConfig.apiUrl}/usuarios/$usuarioId/fcm-token'),
        headers: Sesion.encabezados(),
        body: json.encode({'fcmToken': token}),
      );

      debugPrint(response.statusCode == 200
          ? '✅ Token FCM registrado en el servidor'
          : '❌ Error al registrar token FCM: ${response.statusCode}');
    } catch (e) {
      // No lanzar error: el login debe continuar
      debugPrint('❌ Error enviando token FCM: $e');
    }
  }

  Future<void> logout() async {
    _usuario = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('usuario');
    await Sesion.cerrar();
    notifyListeners();
  }
}
