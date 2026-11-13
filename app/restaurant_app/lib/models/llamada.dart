/// Un comensal llamó al mesero desde el QR de su mesa (api/llamadas).
/// No hay asignación de mesas: la ven todos los meseros y el primero que la toma va.
class Llamada {
  const Llamada({
    required this.id,
    required this.mesaId,
    required this.mesaNumero,
    required this.fecha,
    required this.estado,
    this.meseroId,
    this.meseroNombre,
  });

  static const pendiente = 'Pendiente';
  static const enCamino = 'EnCamino';

  final int id;
  final int mesaId;
  final int mesaNumero;
  final DateTime fecha;
  final String estado;
  final int? meseroId;
  final String? meseroNombre;

  bool get tomada => estado == enCamino;

  factory Llamada.fromJson(Map<String, dynamic> json) => Llamada(
        id: json['id'] as int,
        mesaId: json['mesaId'] as int,
        mesaNumero: json['mesaNumero'] as int? ?? 0,
        fecha: DateTime.tryParse(json['fecha']?.toString() ?? '')?.toLocal() ?? DateTime.now(),
        estado: json['estado']?.toString() ?? pendiente,
        meseroId: json['meseroId'] as int?,
        meseroNombre: json['meseroNombre'] as String?,
      );
}
