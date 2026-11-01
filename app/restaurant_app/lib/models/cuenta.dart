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

/// La cuenta que el mesero pidió a caja para una mesa.
class SolicitudCuenta {
  const SolicitudCuenta({
    required this.id,
    required this.mesaId,
    required this.fecha,
    this.mesaNumero = 0,
    this.metodo,
    this.fechaPago,
    this.tieneComprobante = false,
  });

  final int id;
  final int mesaId;
  final int mesaNumero;
  final DateTime fecha;
  final MetodoPago? metodo;
  final DateTime? fechaPago;
  final bool tieneComprobante;

  factory SolicitudCuenta.fromJson(Map<String, dynamic> json) => SolicitudCuenta(
        id: json['id'] ?? 0,
        mesaId: json['mesaId'] ?? 0,
        mesaNumero: json['mesaNumero'] ?? 0,
        fecha: DateTime.parse(json['fecha']).toLocal(),
        metodo: MetodoPago.deApi(json['metodoPago']),
        fechaPago: json['fechaPago'] != null ? DateTime.tryParse(json['fechaPago'])?.toLocal() : null,
        tieneComprobante: json['tieneComprobante'] == true,
      );

  /// Lo que ve el mesero en la mesa.
  String get texto => switch (metodo) {
        null => 'Cuenta pedida a caja',
        MetodoPago.efectivo => 'Paga en efectivo: lleva el dinero a caja',
        MetodoPago.tarjeta => 'Pagó con tarjeta: avisado a caja',
        MetodoPago.qr => 'Transferencia enviada a caja',
      };
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
  double get total => pedidos.fold(0, (t, p) => t + p.total);
  int get platos => pedidos.fold(0, (n, p) => n + p.platos);
  DateTime? get desde => pedidos.isEmpty ? null : pedidos.first.fecha;
  int get porServir => pedidos.where((p) => p.porServir).length;
  int get enCocina => pedidos.where((p) => p.estado == EstadoPedido.enProceso).length;

  /// Situación de la mesa en una frase, por orden de urgencia para el mesero.
  String get resumen {
    if (libre) return 'Libre';
    if (porServir > 0) return porServir == 1 ? 'Listo para servir' : '$porServir listos para servir';
    if (solicitud != null) return solicitud!.metodo == null ? 'Cuenta pedida' : 'Pago avisado';
    if (enCocina > 0) return 'En cocina';
    return 'Servida';
  }
}
