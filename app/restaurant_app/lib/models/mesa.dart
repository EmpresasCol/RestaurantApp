// Estados de la API: Disponible, Ocupada, EsperandoPago.
enum EstadoMesa { libre, ocupada, esperandoPago, reservada }

class Mesa {
  final int id;
  final int numero;
  final int capacidad;
  EstadoMesa estado;
  bool estaSeleccionada;

  Mesa({
    required this.id,
    required this.numero,
    required this.capacidad,
    required this.estado,
    this.estaSeleccionada = false,
  });

  factory Mesa.fromJson(Map<String, dynamic> json) {
    return Mesa(
      id: json['id'] ?? 0,
      numero: json['numero'] ?? 0,
      capacidad: json['capacidad'] ?? 4,
      estado: _estadoFromString(json['estado'] ?? ''),
    );
  }

  static EstadoMesa _estadoFromString(String estado) {
    switch (estado.toLowerCase()) {
      case 'disponible':
      case 'libre':
        return EstadoMesa.libre;
      case 'ocupada':
        return EstadoMesa.ocupada;
      case 'esperandopago':
        return EstadoMesa.esperandoPago;
      case 'reservada':
        return EstadoMesa.reservada;
      // Un estado desconocido nunca debe ofrecer la mesa como libre.
      default:
        return EstadoMesa.ocupada;
    }
  }
}
