// Estados de la API: Disponible, Ocupada, EsperandoPago.
enum EstadoMesa { libre, ocupada, esperandoPago }

class Mesa {
  const Mesa({required this.id, required this.numero, required this.estado});

  final int id;
  final int numero;
  final EstadoMesa estado;

  factory Mesa.fromJson(Map<String, dynamic> json) => Mesa(
        id: json['id'] ?? 0,
        numero: json['numero'] ?? 0,
        estado: _estadoFromString(json['estado'] ?? ''),
      );

  static EstadoMesa _estadoFromString(String estado) {
    switch (estado.toLowerCase()) {
      case 'disponible':
      case 'libre':
        return EstadoMesa.libre;
      case 'esperandopago':
        return EstadoMesa.esperandoPago;
      // Un estado desconocido nunca debe ofrecer la mesa como libre.
      default:
        return EstadoMesa.ocupada;
    }
  }
}
