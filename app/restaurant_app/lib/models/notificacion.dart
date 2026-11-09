class Notificacion {
  const Notificacion({
    required this.id,
    required this.pedidoId,
    required this.mesaNumero,
    required this.titulo,
    required this.mensaje,
    required this.fecha,
    this.leida = false,
  });

  final int id;
  final int pedidoId;
  final int mesaNumero;
  final String titulo;
  final String mensaje;
  final DateTime fecha;
  final bool leida;

  factory Notificacion.fromJson(Map<String, dynamic> json) => Notificacion(
        id: json['id'] ?? 0,
        pedidoId: json['pedidoId'] ?? 0,
        mesaNumero: json['mesaNumero'] ?? 0,
        titulo: json['titulo'] ?? 'Aviso',
        mensaje: json['mensaje'] ?? '',
        fecha: DateTime.tryParse(json['fecha'] ?? '') ?? DateTime.now(),
        leida: json['leida'] ?? false,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'pedidoId': pedidoId,
        'mesaNumero': mesaNumero,
        'titulo': titulo,
        'mensaje': mensaje,
        'fecha': fecha.toIso8601String(),
        'leida': leida,
      };

  Notificacion leidaYa() => Notificacion(
        id: id, pedidoId: pedidoId, mesaNumero: mesaNumero, titulo: titulo, mensaje: mensaje, fecha: fecha, leida: true);
}
