// app/restaurant_app/lib/models/domicilio_domiciliario.dart
// Modelo del domicilio visto desde la perspectiva del domiciliario.
// Mantiene equivalencia 1:1 con DomicilioDomiciliarioDto (backend).

class DomicilioItem {
  final int id;
  final int platilloId;
  final String platilloNombre;
  final int cantidad;
  final double precioUnitario;
  final double subtotal;
  final String nota;

  DomicilioItem({
    required this.id,
    required this.platilloId,
    required this.platilloNombre,
    required this.cantidad,
    required this.precioUnitario,
    required this.subtotal,
    required this.nota,
  });

  factory DomicilioItem.fromJson(Map<String, dynamic> json) => DomicilioItem(
        id: json['id'] ?? 0,
        platilloId: json['platilloId'] ?? 0,
        platilloNombre: json['platilloNombre'] ?? '',
        cantidad: json['cantidad'] ?? 0,
        precioUnitario: (json['precioUnitario'] ?? 0).toDouble(),
        subtotal: (json['subtotal'] ?? 0).toDouble(),
        nota: json['nota'] ?? '',
      );
}

/// Representación inmutable de un pedido a domicilio para el rol domiciliario.
class DomicilioDomiciliario {
  final int id;
  final String estado;
  final DateTime fechaPedido;
  final DateTime? fechaRecogida;
  final DateTime? fechaEntrega;

  final String clienteNombre;
  final String clienteTelefono;

  final String direccionCompleta;
  final String? barrio;
  final String? referenciasAdicionales;

  final double subtotal;
  final double costoEnvio;
  final double total;
  final String metodoPago;
  final bool pagadoAnticipado;

  final String? notasCliente;

  final int? domiciliarioId;
  final String? domiciliarioNombre;

  final List<DomicilioItem> detalles;

  DomicilioDomiciliario({
    required this.id,
    required this.estado,
    required this.fechaPedido,
    this.fechaRecogida,
    this.fechaEntrega,
    required this.clienteNombre,
    required this.clienteTelefono,
    required this.direccionCompleta,
    this.barrio,
    this.referenciasAdicionales,
    required this.subtotal,
    required this.costoEnvio,
    required this.total,
    required this.metodoPago,
    required this.pagadoAnticipado,
    this.notasCliente,
    this.domiciliarioId,
    this.domiciliarioNombre,
    required this.detalles,
  });

  factory DomicilioDomiciliario.fromJson(Map<String, dynamic> json) => DomicilioDomiciliario(
        id: json['id'],
        estado: json['estado'] ?? 'EnPreparacion',
        fechaPedido: DateTime.parse(json['fechaPedido']),
        fechaRecogida: json['fechaRecogida'] != null ? DateTime.tryParse(json['fechaRecogida']) : null,
        fechaEntrega: json['fechaEntrega'] != null ? DateTime.tryParse(json['fechaEntrega']) : null,
        clienteNombre: json['clienteNombre'] ?? '',
        clienteTelefono: json['clienteTelefono'] ?? '',
        direccionCompleta: json['direccionCompleta'] ?? '',
        barrio: json['barrio'],
        referenciasAdicionales: json['referenciasAdicionales'],
        subtotal: (json['subtotal'] ?? 0).toDouble(),
        costoEnvio: (json['costoEnvio'] ?? 0).toDouble(),
        total: (json['total'] ?? 0).toDouble(),
        metodoPago: json['metodoPago'] ?? 'Efectivo',
        pagadoAnticipado: json['pagadoAnticipado'] ?? false,
        notasCliente: json['notasCliente'],
        domiciliarioId: json['domiciliarioId'],
        domiciliarioNombre: json['domiciliarioNombre'],
        detalles: (json['detalles'] as List? ?? [])
            .map((e) => DomicilioItem.fromJson(e))
            .toList(),
      );

  bool get estaLibre => domiciliarioId == null && estado == 'Listo';
  bool get esMio => domiciliarioId != null;
  bool get puedeRecoger => estado == 'Listo';
  bool get puedeEntregar => estado == 'Recogido' || estado == 'EnCamino';
}
