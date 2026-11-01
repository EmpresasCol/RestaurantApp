import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/cuenta.dart';
import '../models/mesa.dart';
import '../models/pedido.dart';
import '../models/platillo.dart';
import '../services/api.dart';
import '../services/realtime.dart';

/// Línea del pedido que arma el mesero antes de enviarlo a cocina.
class LineaPedido {
  LineaPedido({required this.platillo, this.cantidad = 1, this.nota = ''});

  final Platillo platillo;
  int cantidad;
  String nota;

  double get subtotal => platillo.precio * cantidad;

  Map<String, dynamic> toJson() => {
        'platilloId': platillo.id,
        'cantidad': cantidad,
        'nota': nota.trim().isEmpty ? null : nota.trim(),
      };
}

/// El salón del mesero: mesas, pedidos abiertos, cuentas pedidas y la carta.
/// Se actualiza con el tiempo real de la API y, de respaldo, cada 60 s.
class SalonProvider with ChangeNotifier {
  SalonProvider({Api? api, Stream<String>? cambios, bool recargaPeriodica = true}) : _api = api ?? Api.instancia {
    _suscripcion = (cambios ?? Realtime.instancia.cambios).listen((tema) {
      if (tema == 'pedidos' || tema == 'mesas' || tema == Realtime.reconectado) cargar(silencioso: true);
    });
    if (recargaPeriodica) _respaldo = Timer.periodic(const Duration(seconds: 60), (_) => cargar(silencioso: true));
  }

  final Api _api;
  StreamSubscription<String>? _suscripcion;
  Timer? _respaldo;

  List<Mesa> _mesas = [];
  List<Pedido> _pedidos = [];
  List<SolicitudCuenta> _solicitudes = [];
  List<Platillo> _carta = [];
  bool _cargando = false;
  bool _cargado = false;
  String? _error;
  Future<void>? _enCurso;

  List<Mesa> get mesas => _mesas;
  List<Pedido> get pedidos => _pedidos;
  List<Platillo> get carta => _carta;
  bool get cargando => _cargando;
  bool get cargado => _cargado;
  String? get error => _error;

  List<CuentaMesa> get cuentas => [
        for (final m in _mesas)
          CuentaMesa(mesa: m, pedidos: _pedidos, solicitud: _solicitudes.where((s) => s.mesaId == m.id).firstOrNull),
      ];

  CuentaMesa? cuenta(int mesaId) {
    final mesa = _mesas.where((m) => m.id == mesaId).firstOrNull;
    if (mesa == null) return null;
    return CuentaMesa(mesa: mesa, pedidos: _pedidos, solicitud: _solicitudes.where((s) => s.mesaId == mesaId).firstOrNull);
  }

  Mesa? mesaPorNumero(int numero) => _mesas.where((m) => m.numero == numero).firstOrNull;

  /// Pedidos que la cocina terminó y esperan ir a la mesa, del más antiguo al más nuevo.
  List<Pedido> get porServir => _pedidos.where((p) => p.porServir).toList()..sort((a, b) => a.fecha.compareTo(b.fecha));

  /// Categorías en el orden en que aparecen en la carta (igual que la web).
  List<String> get categorias {
    final vistas = <String>[];
    for (final p in _carta) {
      if (!vistas.contains(p.categoria)) vistas.add(p.categoria);
    }
    return vistas;
  }

  Platillo? platillo(int id) => _carta.where((p) => p.id == id).firstOrNull;

  /// Recarga mesas, pedidos abiertos y cuentas pedidas. Varias llamadas seguidas comparten una.
  Future<void> cargar({bool silencioso = false}) => _enCurso ??= _cargar(silencioso).whenComplete(() => _enCurso = null);

  Future<void> _cargar(bool silencioso) async {
    if (!silencioso) {
      _cargando = true;
      notifyListeners();
    }
    try {
      final r = await Future.wait([
        _api.get('mesas'),
        _api.get('pedidos/activos'),
        _api.get('cuentas/solicitudes'),
      ]);
      _mesas = (r[0] as List).map((m) => Mesa.fromJson(m)).toList()..sort((a, b) => a.numero.compareTo(b.numero));
      _pedidos = (r[1] as List).map((p) => Pedido.fromJson(p)).toList();
      _solicitudes = (r[2] as List).map((s) => SolicitudCuenta.fromJson(s)).toList();
      _error = null;
      _cargado = true;
    } on ApiException catch (e) {
      _error = e.mensaje;
    } finally {
      _cargando = false;
      notifyListeners();
    }
  }

  /// La carta trae disponibilidad por inventario; se pide al abrirla para que esté al día.
  Future<void> cargarCarta() async {
    final datos = await _api.get('platillos') as List;
    _carta = datos.map((p) => Platillo.fromJson(p)).toList();
    notifyListeners();
  }

  Future<void> crearPedido(int mesaId, List<LineaPedido> lineas) async {
    await _api.post('pedidos', {'mesaId': mesaId, 'detalles': lineas.map((l) => l.toJson()).toList()});
    await _despuesDeEscribir(carta: true);
  }

  /// Solo mientras la cocina no lo haya empezado; si ya empezó, la API responde 409.
  Future<void> editarPedido(int pedidoId, List<LineaPedido> lineas) async {
    await _api.put('pedidos/$pedidoId/actualizar', {'detalles': lineas.map((l) => l.toJson()).toList()});
    await _despuesDeEscribir(carta: true);
  }

  Future<void> servir(int pedidoId) async {
    await _api.put('pedidos/$pedidoId/estado', {'estado': 'Entregado'});
    await _despuesDeEscribir();
  }

  Future<void> cancelar(int pedidoId) async {
    await _api.put('pedidos/$pedidoId/estado', {'estado': 'Cancelado'});
    await _despuesDeEscribir(carta: true);
  }

  /// Pide la cuenta a caja (la imprime) o avisa cómo pagó el cliente.
  Future<void> pedirCuenta(int mesaId, {MetodoPago? metodo, String? comprobante}) async {
    await _api.post('cuentas/solicitudes', {
      'mesaId': mesaId,
      if (metodo != null) 'metodoPago': metodo.api,
      if (comprobante != null) 'comprobante': comprobante,
    });
    await _despuesDeEscribir();
  }

  Future<void> anularSolicitud(int solicitudId) async {
    await _api.delete('cuentas/solicitudes/$solicitudId');
    await _despuesDeEscribir();
  }

  Future<void> _despuesDeEscribir({bool carta = false}) async {
    await cargar(silencioso: true);
    if (carta) {
      try {
        await cargarCarta();
      } catch (_) {/* la disponibilidad se refresca al abrir la carta */}
    }
  }

  @override
  void dispose() {
    _suscripcion?.cancel();
    _respaldo?.cancel();
    super.dispose();
  }
}
