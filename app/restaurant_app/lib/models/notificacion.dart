class Notificacion {
  final int id;
  final int pedidoId;
  final int mesaNumero;
  final String titulo;
  final String mensaje;
  final DateTime fecha;
  final bool leida;
  final String? platillos;
  final int? totalItems;     

  Notificacion({
    required this.id,
    required this.pedidoId,
    required this.mesaNumero,
    required this.titulo,
    required this.mensaje,
    required this.fecha,
    this.leida = false,
    this.platillos,
    this.totalItems,
  });

  factory Notificacion.fromJson(Map<String, dynamic> json) {
    return Notificacion(
      id: json['id'],
      pedidoId: json['pedidoId'],
      mesaNumero: json['mesaNumero'],
      titulo: json['titulo'],
      mensaje: json['mensaje'],
      fecha: DateTime.parse(json['fecha']),
      leida: json['leida'] ?? false,
      platillos: json['platillos'],
      totalItems: json['totalItems'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'pedidoId': pedidoId,
      'mesaNumero': mesaNumero,
      'titulo': titulo,
      'mensaje': mensaje,
      'fecha': fecha.toIso8601String(),
      'leida': leida,
      'platillos': platillos,
      'totalItems': totalItems,
    };
  }
}