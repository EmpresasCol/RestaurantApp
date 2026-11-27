import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/marca.dart';
import '../services/api.dart';
import '../services/realtime.dart';
import '../theme/qpro_theme.dart';

/// Marca del restaurante para toda la app. Arranca con la última guardada en el teléfono (sin
/// destello de la de fábrica), la confirma con la API y se actualiza cuando el administrador
/// guarda en la web (tema "configuracion" del tiempo real) o al volver a la app.
class MarcaProvider extends ChangeNotifier {
  MarcaProvider({Api? api, Stream<String>? cambios}) : _api = api ?? Api.instancia {
    _suscripcion = (cambios ?? Realtime.instancia.cambios).listen((tema) {
      if (tema == 'configuracion' || tema == Realtime.reconectado) actualizar();
    });
  }

  static const _clave = 'marca';

  /// La vigente, para el código que no tiene contexto (reglas de la cuenta, valores por defecto).
  static Marca actual = const Marca();

  final Api _api;
  late final StreamSubscription<String> _suscripcion;
  Marca _marca = actual;

  Marca get marca => _marca;

  void _usar(Marca m) {
    _marca = m;
    actual = m;
    QColors.aplicar(m);
    notifyListeners();
  }

  /// Lo último guardado en el teléfono. Se llama antes de pintar la primera pantalla.
  Future<void> cargarGuardada() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final texto = prefs.getString(_clave);
      if (texto != null) _usar(Marca.fromJson(json.decode(texto) as Map<String, dynamic>));
    } catch (e) {
      debugPrint('Marca guardada ilegible: $e');
    }
  }

  /// Pide la configuración a la API (pública). Sin conexión se queda con la que tiene.
  Future<void> actualizar() async {
    try {
      final datos = await _api.get('configuracion');
      if (datos is! Map<String, dynamic>) return;
      _usar(Marca.fromJson(datos));
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_clave, json.encode(datos));
    } catch (e) {
      debugPrint('No se pudo leer la configuración: $e');
    }
  }

  @override
  void dispose() {
    _suscripcion.cancel();
    super.dispose();
  }
}
