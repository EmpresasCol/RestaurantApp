import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../models/usuario.dart';
import '../services/auth_service.dart';

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
      
      _cargando = false;
      notifyListeners();
    } catch (e) {
      _cargando = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> logout() async {
    _usuario = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('usuario');
    notifyListeners();
  }
}