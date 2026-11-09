// `desconocido`: estado que la app aún no conoce; no se trata como EnProceso.
enum EstadoPedido { enProceso, listo, entregado, pagado, cancelado, desconocido }

class Pedido {
  const Pedido({
    required this.id,
    required this.mesaId,
    required this.mesaNumero,
    required this.fecha,
    required this.estado,
    required this.detalles,
    this.usuarioId = 0,
    this.meseroNombre = '',
    this.cocinaEmpezo = false,
  });

  final int id;
  final int mesaId;
  final int mesaNumero;
  final int usuarioId;
  final String meseroNombre;
  final DateTime fecha;
  final EstadoPedido estado;
  /// La cocina ya lo empezó o lo terminó (lo calcula la API).
  final bool cocinaEmpezo;
  final List<ItemPedido> detalles;

  factory Pedido.fromJson(Map<String, dynamic> json) {
    final estado = _estadoFromString(json['estado'] ?? '');
    final detalles = (json['detalles'] as List?)?.map((d) => ItemPedido.fromJson(d as Map<String, dynamic>)).toList() ?? [];
    return Pedido(
      id: json['id'] ?? 0,
      mesaId: json['mesaId'] ?? 0,
      mesaNumero: json['mesaNumero'] ?? json['mesaId'] ?? 0,
      usuarioId: json['usuarioId'] ?? 0,
      meseroNombre: json['meseroNombre'] ?? '',
      // La API envía UTC con "Z"; toLocal() deja la hora del dispositivo.
      fecha: DateTime.parse(json['fecha']).toLocal(),
      estado: estado,
      // Respaldo para una API anterior sin el campo: mismo criterio que el servidor.
      cocinaEmpezo: json['cocinaEmpezo'] ??
          (estado != EstadoPedido.enProceso || detalles.any((d) => d.estado == 'EnPreparacion' || d.estado == 'Listo')),
      detalles: detalles,
    );
  }

  /// Lo que falta cobrar: los platos ya pagados en una cuenta dividida no cuentan.
  double get total => detalles.where((d) => !d.pagado).fold(0, (sum, item) => sum + item.subtotal);
  int get platos => detalles.where((d) => !d.pagado).fold(0, (n, d) => n + d.cantidad);

  bool get abierto => estado == EstadoPedido.enProceso || estado == EstadoPedido.listo || estado == EstadoPedido.entregado;

  /// Misma regla que la API: se edita o cancela mientras la cocina no lo haya empezado.
  bool get editable => estado == EstadoPedido.enProceso && !cocinaEmpezo;

  /// Cocina lo terminó y falta llevarlo a la mesa.
  bool get porServir => estado == EstadoPedido.listo;

  /// La caja no cobra lo que sigue en cocina.
  bool get cobrable => estado == EstadoPedido.listo || estado == EstadoPedido.entregado;

  /// Etapa en palabras del salón.
  String get etapa => switch (estado) {
        EstadoPedido.enProceso => cocinaEmpezo ? 'Preparando' : 'Sin empezar',
        EstadoPedido.listo => 'Listo para servir',
        EstadoPedido.entregado => 'Servido',
        EstadoPedido.pagado => 'Pagado',
        EstadoPedido.cancelado => 'Cancelado',
        EstadoPedido.desconocido => 'Sin estado',
      };

  static EstadoPedido _estadoFromString(String estado) {
    switch (estado.toLowerCase()) {
      case 'enproceso':
        return EstadoPedido.enProceso;
      case 'listo':
        return EstadoPedido.listo;
      case 'entregado':
        return EstadoPedido.entregado;
      case 'pagado':
        return EstadoPedido.pagado;
      case 'cancelado':
        return EstadoPedido.cancelado;
      default:
        return EstadoPedido.desconocido;
    }
  }
}

class ItemPedido {
  const ItemPedido({
    this.id,
    required this.platilloId,
    required this.platilloNombre,
    required this.cantidad,
    required this.precio,
    this.nota,
    this.estado = 'Pendiente',
    this.pagado = false,
  });

  final int? id;
  final int platilloId;
  final String platilloNombre;
  final int cantidad;
  /// Precio con que se pidió (la API lo congela).
  final double precio;
  final String? nota;
  final String estado;
  /// Ya se cobró en una cuenta dividida.
  final bool pagado;

  double get subtotal => precio * cantidad;

  factory ItemPedido.fromJson(Map<String, dynamic> json) => ItemPedido(
        id: json['id'],
        platilloId: json['platilloId'] ?? 0,
        platilloNombre: json['platilloNombre'] ?? '',
        cantidad: json['cantidad'] ?? 0,
        precio: (json['precio'] as num?)?.toDouble() ?? 0.0,
        nota: json['nota'],
        estado: json['estado'] ?? 'Pendiente',
        pagado: json['pagado'] == true,
      );
}
