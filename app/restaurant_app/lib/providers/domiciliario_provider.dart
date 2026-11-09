import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/domicilio_domiciliario.dart';
import '../services/api.dart';
import '../services/realtime.dart';

/// Domicilios del domiciliario en sesión: los libres para recoger y los suyos en curso.
/// Se actualiza con el tiempo real de la API y, de respaldo, cada 60 s.
class DomiciliarioProvider with ChangeNotifier {
  DomiciliarioProvider({required this.domiciliarioId, Api? api, Stream<String>? cambios, bool recargaPeriodica = true})
      : _api = api ?? Api.instancia {
    _suscripcion = (cambios ?? Realtime.instancia.cambios).listen((tema) {
      if (tema == 'domicilios' || tema == Realtime.reconectado) cargar(silencioso: true);
    });
    if (recargaPeriodica) _respaldo = Timer.periodic(const Duration(seconds: 60), (_) => cargar(silencioso: true));
  }

  final int domiciliarioId;
  final Api _api;
  StreamSubscription<String>? _suscripcion;
  Timer? _respaldo;

  List<DomicilioDomiciliario> _pedidos = [];
  bool _cargando = false;
  bool _cargado = false;
  String? _error;
  int _entregasHoy = 0;
  double _efectivoPorEntregar = 0;

  List<DomicilioDomiciliario> get pedidos => _pedidos;
  bool get cargando => _cargando;
  bool get cargado => _cargado;
  String? get error => _error;
  int get entregasHoy => _entregasHoy;
  /// Efectivo que cobró y todavía no entrega en caja.
  double get efectivoPorEntregar => _efectivoPorEntregar;

  List<DomicilioDomiciliario> get libres => _pedidos.where((p) => p.estaLibre).toList();

  /// Lo suyo: primero lo que ya lleva encima, luego lo listo para recoger y al final lo que sigue en cocina.
  List<DomicilioDomiciliario> get mios {
    int orden(DomicilioDomiciliario d) => switch (d.estado) { 'EnCamino' || 'Recogido' => 0, 'Listo' => 1, _ => 2 };
    return _pedidos.where((p) => p.esMio && p.estado != 'Entregado').toList()..sort((a, b) => orden(a).compareTo(orden(b)));
  }

  DomicilioDomiciliario? pedido(int id) => _pedidos.where((p) => p.id == id).firstOrNull;

  String get _base => 'domiciliarios/$domiciliarioId';

  Future<void> cargar({bool silencioso = false}) async {
    if (!silencioso) {
      _cargando = true;
      notifyListeners();
    }
    try {
      final datos = await _api.get('$_base/pedidos') as List;
      _pedidos = datos.map((e) => DomicilioDomiciliario.fromJson(e)).toList();
      _error = null;
      _cargado = true;
    } on ApiException catch (e) {
      _error = e.mensaje;
    } finally {
      _cargando = false;
      notifyListeners();
    }
    _refrescarEstadisticas();
  }

  Future<void> _refrescarEstadisticas() async {
    try {
      final stats = await _api.get('$_base/estadisticas') as Map<String, dynamic>;
      _entregasHoy = stats['entregadosHoy'] ?? _entregasHoy;
      _efectivoPorEntregar = (stats['efectivoPorEntregar'] as num?)?.toDouble() ?? _efectivoPorEntregar;
      notifyListeners();
    } catch (_) {/* el contador no bloquea la operación */}
  }

  Future<void> recoger(int domicilioId) => _accion('recoger', domicilioId);
  Future<void> salir(int domicilioId) => _accion('en-camino', domicilioId);
  /// Entregado y cobrado: el método con que pagó de verdad y, si fue transferencia, la foto.
  Future<void> entregar(int domicilioId, {String? metodoPago, String? comprobante}) => _accion('entregar', domicilioId, {
        if (metodoPago != null) 'metodoPago': metodoPago,
        if (comprobante != null) 'comprobante': comprobante,
      });

  Future<void> _accion(String accion, int domicilioId, [Map<String, dynamic>? cuerpo]) async {
    await _api.put('$_base/pedidos/$domicilioId/$accion', cuerpo);
    await cargar(silencioso: true);
  }

  @override
  void dispose() {
    _suscripcion?.cancel();
    _respaldo?.cancel();
    super.dispose();
  }
}
