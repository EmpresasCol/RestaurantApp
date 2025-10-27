enum EstadoMesa { libre, ocupada, reservada }

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
      id: json['id'] ?? 0,  // ✅ Protección contra null
      numero: json['numero'] ?? 0,
      capacidad: json['capacidad'] ?? 4,
      estado: _estadoFromString(json['estado'] ?? 'libre'),
    );
  }

  static EstadoMesa _estadoFromString(String estado) {
    switch (estado.toLowerCase()) {
      case 'libre': return EstadoMesa.libre;
      case 'ocupada': return EstadoMesa.ocupada;
      case 'reservada': return EstadoMesa.reservada;
      default: return EstadoMesa.libre;
    }
  }
}