import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/usuario.dart';
import '../services/auth_service.dart';
import '../services/notification_service.dart';
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
    final usuarioJson = prefs.getString('usuario');
    
    if (usuarioJson != null) {
      _usuario = Usuario.fromJson(json.decode(usuarioJson));
      notifyListeners();
    }
  }

  Future<void> login(String usuario, String clave) async {
    _cargando = true;
    notifyListeners();

    try {
      final user = await _authService.login(usuario, clave);
      
      if (user.rol != RolUsuario.mesero) {
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
      
      // ✅ ENVIAR TOKEN FCM AL BACKEND
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
      debugPrint('📤 Iniciando envío de token FCM...');
      
      final token = await NotificationService().getToken();
      
      if (token == null) {
        debugPrint('⚠️ No hay token FCM disponible');
        return;
      }
      
      debugPrint('📱 Token obtenido: ${token.substring(0, 20)}...');
      debugPrint('🌐 Enviando a: ${ApiConfig.apiUrl}/usuarios/$usuarioId/fcm-token');
      
      final response = await http.post(
        Uri.parse('${ApiConfig.apiUrl}/usuarios/$usuarioId/fcm-token'),
        headers: {'Content-Type': 'application/json; charset=UTF-8'},
        body: json.encode({'fcmToken': token}),
      );

      debugPrint('📥 Response status: ${response.statusCode}');
      debugPrint('📥 Response body: ${response.body}');

      if (response.statusCode == 200) {
        debugPrint('✅ Token FCM enviado al servidor exitosamente');
      } else {
        debugPrint('❌ Error al enviar token: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('❌ Error enviando token FCM: $e');
      // No lanzar error, el login debe continuar
    }
  }

  Future<void> logout() async {
    _usuario = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('usuario');
    notifyListeners();
  }
}