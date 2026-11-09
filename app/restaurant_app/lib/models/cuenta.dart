import '../utils/formato.dart';
import 'mesa.dart';
import 'pedido.dart';

/// Cómo pagó el cliente, en los valores de la API (`MetodoPago`).
enum MetodoPago {
  efectivo('Efectivo', 'Efectivo', 'Recibe el dinero y llévalo a caja'),
  tarjeta('Tarjeta', 'Tarjeta', 'El cliente pagó en el datáfono'),
  qr('QR', 'Transferencia', 'Toma la foto del comprobante');

  const MetodoPago(this.api, this.nombre, this.ayuda);
  final String api;
  final String nombre;
  final String ayuda;

  static MetodoPago? deApi(String? valor) {
    for (final m in values) {
      if (m.api.toLowerCase() == valor?.toLowerCase()) return m;
    }
    return null;
  }
}

/// Propina voluntaria sugerida (10 %), redondeada a centenas como en la web.
double propinaSugerida(double consumo) => ((consumo * 0.1) / 100).roundToDouble() * 100;

/// Un total en n partes iguales redondeadas a centenas; la última cuadra la suma exacta.
List<double> partesIguales(double total, int n) {
  if (n < 1 || total <= 0) return [];
  final parte = (total / n / 100).roundToDouble() * 100;
  final ultima = total - parte * (n - 1);
  if (ultima <= 0) return partesIguales(total, n - 1);
  return [...List.filled(n - 1, parte), ultima];
}

/// Un pago que el mesero avisó a caja (la mesa puede pagar con varios).
class PagoAvisado {
  const PagoAvisado({required this.id, required this.metodo, required this.monto, this.tieneComprobante = false});

  final int id;
  final MetodoPago? metodo;
  final double monto;
  final bool tieneComprobante;

  factory PagoAvisado.fromJson(Map<String, dynamic> json) => PagoAvisado(
        id: json['id'] ?? 0,
        metodo: MetodoPago.deApi(json['metodoPago']),
        monto: (json['monto'] as num?)?.toDouble() ?? 0,
        tieneComprobante: json['tieneComprobante'] == true,
      );
}

/// Un pago que el mesero va a avisar: método, valor y la foto si es transferencia.
class PagoNuevo {
  const PagoNuevo({required this.metodo, required this.monto, this.comprobante});

  final MetodoPago metodo;
  final double monto;
  final String? comprobante;

  Map<String, dynamic> toJson() => {
        'metodoPago': metodo.api,
        'monto': monto,
        if (comprobante != null) 'comprobante': comprobante,
      };
}

/// La cuenta que el mesero pidió a caja para una mesa y lo que avisó que pagaron.
class SolicitudCuenta {
  const SolicitudCuenta({
    required this.id,
    required this.mesaId,
    required this.fecha,
    this.mesaNumero = 0,
    this.metodo,
    this.fechaPago,
    this.tieneComprobante = false,
    this.propina = 0,
    this.pagos = const [],
    this.totalAvisado = 0,
    this.porCobrar = 0,
    this.cuadra = false,
  });

  final int id;
  final int mesaId;
  final int mesaNumero;
  final DateTime fecha;
  /// Resumen de la API: el método si es uno solo, null si es "Mixto" o si solo pidió la cuenta.
  final MetodoPago? metodo;
  final DateTime? fechaPago;
  final bool tieneComprobante;
  final double propina;
  final List<PagoAvisado> pagos;
  final double totalAvisado;
  final double porCobrar;
  /// Lo avisado cubre toda la cuenta y la propina: la caja solo confirma.
  final bool cuadra;

  factory SolicitudCuenta.fromJson(Map<String, dynamic> json) => SolicitudCuenta(
        id: json['id'] ?? 0,
        mesaId: json['mesaId'] ?? 0,
        mesaNumero: json['mesaNumero'] ?? 0,
        fecha: DateTime.parse(json['fecha']).toLocal(),
        metodo: MetodoPago.deApi(json['metodoPago']),
        fechaPago: json['fechaPago'] != null ? DateTime.tryParse(json['fechaPago'])?.toLocal() : null,
        tieneComprobante: json['tieneComprobante'] == true,
        propina: (json['propina'] as num?)?.toDouble() ?? 0,
        pagos: (json['pagos'] as List? ?? []).map((p) => PagoAvisado.fromJson(p as Map<String, dynamic>)).toList(),
        totalAvisado: (json['totalAvisado'] as num?)?.toDouble() ?? 0,
        porCobrar: (json['porCobrar'] as num?)?.toDouble() ?? 0,
        cuadra: json['cuadra'] == true,
      );

  /// Ya avisó cómo pagó la mesa (uno o varios pagos).
  bool get pagoAvisado => pagos.isNotEmpty || metodo != null;

  /// Lo que ve el mesero en la mesa.
  String get texto {
    if (cuadra) return 'Pago completo avisado a caja';
    if (pagos.isNotEmpty) return 'Pagaron ${pesos(totalAvisado)}: caja cobra el resto';
    return switch (metodo) {
      null => 'Cuenta pedida a caja',
      MetodoPago.efectivo => 'Paga en efectivo: lleva el dinero a caja',
      MetodoPago.tarjeta => 'Pagó con tarjeta: avisado a caja',
      MetodoPago.qr => 'Transferencia enviada a caja',
    };
  }
}

/// Una mesa con sus pedidos abiertos: lo que el mesero atiende y la caja cobra.
/// Cada envío (mesero o QR) es un pedido aparte, pero la mesa paga una sola cuenta.
class CuentaMesa {
  CuentaMesa({required this.mesa, required List<Pedido> pedidos, this.solicitud})
      : pedidos = (pedidos.where((p) => p.abierto && p.mesaId == mesa.id).toList()..sort((a, b) => a.fecha.compareTo(b.fecha)));

  final Mesa mesa;
  final List<Pedido> pedidos;
  final SolicitudCuenta? solicitud;

  bool get libre => pedidos.isEmpty;
  /// Lo que debe la mesa: lo ya cobrado en una cuenta dividida no cuenta.
  double get total => pedidos.fold(0, (t, p) => t + p.total);
  int get platos => pedidos.fold(0, (n, p) => n + p.platos);
  DateTime? get desde => pedidos.isEmpty ? null : pedidos.first.fecha;
  int get porServir => pedidos.where((p) => p.porServir).length;
  int get enCocina => pedidos.where((p) => p.estado == EstadoPedido.enProceso).length;

  /// Situación de la mesa en una frase, por orden de urgencia para el mesero.
  String get resumen {
    if (libre) return 'Libre';
    if (porServir > 0) return porServir == 1 ? 'Listo para servir' : '$porServir listos para servir';
    if (solicitud != null) return solicitud!.pagoAvisado ? 'Pago avisado' : 'Cuenta pedida';
    if (enCocina > 0) return 'En cocina';
    return 'Servida';
  }
}
