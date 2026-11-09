import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../config/api_config.dart';
import 'realtime_canal_stub.dart' if (dart.library.io) 'realtime_canal_io.dart';
import 'sesion.dart';

/// Tiempo real con el hub de SignalR de la API (`cambio` con el tema: pedidos, mesas, domicilios).
/// Igual que la web, solo avisa qué cambió; los datos se recargan por REST.
///
/// Cliente mínimo del protocolo JSON de SignalR sobre WebSocket (sin negociación),
/// para no sumar un paquete por unas pocas líneas. Si se cae, reintenta y emite
/// [reconectado] para que las pantallas recarguen lo que se perdió.
class Realtime {
  Realtime._();
  static final instancia = Realtime._();

  static const reconectado = 'reconectado';
  static const _separador = '\u001e';

  final _cambios = StreamController<String>.broadcast();
  Stream<String> get cambios => _cambios.stream;

  CanalTiempoReal? _canal;
  Timer? _latido;
  Timer? _reintento;
  int _intentos = 0;
  bool _activo = false;

  void iniciar() {
    if (kIsWeb || _activo || Sesion.token == null) return;
    _activo = true;
    _conectar();
  }

  void detener() {
    _activo = false;
    _intentos = 0;
    _reintento?.cancel();
    _cerrarCanal();
  }

  Future<void> _conectar() async {
    final token = Sesion.token;
    if (!_activo || token == null) return;
    try {
      final canal = await abrirCanal('${ApiConfig.hubUrl}?access_token=${Uri.encodeQueryComponent(token)}');
      if (!_activo) return canal.cerrar();
      _canal = canal;
      canal.mensajes.listen(_alRecibir, onDone: _alCaer, onError: (_) => _alCaer(), cancelOnError: true);
      canal.enviar('{"protocol":"json","version":1}$_separador');
      // El servidor cierra a los 30 s sin noticias del cliente.
      _latido = Timer.periodic(const Duration(seconds: 15), (_) => _canal?.enviar('{"type":6}$_separador'));
      if (_intentos > 0) _cambios.add(reconectado);
      _intentos = 0;
    } catch (e) {
      debugPrint('Tiempo real sin conexión: $e');
      _alCaer();
    }
  }

  void _alRecibir(dynamic datos) {
    for (final parte in datos.toString().split(_separador)) {
      if (parte.isEmpty) continue;
      final tema = temaDe(parte);
      if (tema != null) _cambios.add(tema);
    }
  }

  /// Tema de un mensaje del hub, o null si no es un `cambio`.
  @visibleForTesting
  static String? temaDe(String mensaje) {
    try {
      final m = json.decode(mensaje);
      if (m is Map && m['type'] == 1 && m['target'] == 'cambio') {
        final args = m['arguments'];
        if (args is List && args.isNotEmpty) return args.first.toString();
      }
    } catch (_) {}
    return null;
  }

  void _alCaer() {
    _cerrarCanal();
    if (!_activo) return;
    _intentos++;
    final espera = Duration(seconds: [2, 5, 10, 30][(_intentos - 1).clamp(0, 3)]);
    _reintento?.cancel();
    _reintento = Timer(espera, _conectar);
  }

  void _cerrarCanal() {
    _latido?.cancel();
    _latido = null;
    _canal?.cerrar();
    _canal = null;
  }
}
