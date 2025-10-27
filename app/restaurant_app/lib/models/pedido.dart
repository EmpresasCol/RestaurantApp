enum EstadoPedido { enProceso, listo, entregado, pagado, cancelado }

class Pedido {
  final int id;
  final int mesaId;
  final int mesaNumero;
  final DateTime fecha;
  final EstadoPedido estado;
  final List<ItemPedido> detalles;
  
  Pedido({
    required this.id,
    required this.mesaId,
    required this.mesaNumero,
    required this.fecha,
    required this.estado,
    required this.detalles,
  });

  factory Pedido.fromJson(Map<String, dynamic> json) {
    return Pedido(
      id: json['id'],
      mesaId: json['mesaId'],
      mesaNumero: json['mesaNumero'] ?? json['mesaId'],
      fecha: DateTime.parse(json['fecha']),
      estado: _estadoFromString(json['estado']),
      detalles: (json['detalles'] as List)
          .map((d) => ItemPedido.fromJson(d))
          .toList(),
    );
  }

  double get total => detalles.fold(0, (sum, item) => sum + (item.precio * item.cantidad));

  bool get puedeEditar {
    if (estado != EstadoPedido.enProceso) return false;
    final diff = DateTime.now().difference(fecha);
    return diff.inMinutes <= 5;
  }

  bool get puedeEntregar {
    if (estado != EstadoPedido.enProceso) return false;
    final diff = DateTime.now().difference(fecha);
    return diff.inMinutes > 5;
  }

  static EstadoPedido _estadoFromString(String estado) {
    switch (estado.toLowerCase()) {
      case 'enproceso': return EstadoPedido.enProceso;
      case 'listo': return EstadoPedido.listo;
      case 'entregado': return EstadoPedido.entregado;
      case 'pagado': return EstadoPedido.pagado;
      case 'cancelado': return EstadoPedido.cancelado;
      default: return EstadoPedido.enProceso;
    }
  }
}

class ItemPedido {
  final int? id;
  final int platilloId;
  final String platilloNombre;
  int cantidad;
  final double precio;
  String? nota;

  ItemPedido({
    this.id,
    required this.platilloId,
    required this.platilloNombre,
    required this.cantidad,
    required this.precio,
    this.nota,
  });

  factory ItemPedido.fromJson(Map<String, dynamic> json) {
    return ItemPedido(
      id: json['id'],
      platilloId: json['platilloId'],
      platilloNombre: json['platilloNombre'],
      cantidad: json['cantidad'],
      precio: (json['precio'] as num).toDouble(),
      nota: json['nota'],
    );
  }

  Map<String, dynamic> toJson() => {
    if (id != null) 'id': id,
    'platilloId': platilloId,
    'cantidad': cantidad,
    'nota': nota,
  };
}