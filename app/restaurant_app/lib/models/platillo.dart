class Platillo {
  final int id;
  final String nombre;
  final String descripcion;
  final double precio;
  final String? imagenUrl;
  final String categoria;
  /// false cuando la API indica que no hay ingredientes para una porción.
  final bool disponible;
  int cantidad;

  Platillo({
    required this.id,
    required this.nombre,
    required this.descripcion,
    required this.precio,
    this.imagenUrl,
    required this.categoria,
    this.disponible = true,
    this.cantidad = 0,
  });

  factory Platillo.fromJson(Map<String, dynamic> json) {
    return Platillo(
      id: json['id'] ?? 0,  // ✅ Protección contra null
      nombre: json['nombre'] ?? '',
      descripcion: json['descripcion'] ?? '',
      precio: (json['precio'] as num?)?.toDouble() ?? 0.0,  // ✅ Manejo seguro
      imagenUrl: json['imagenUrl'],
      categoria: json['categoria'] ?? 'General',
      disponible: json['disponible'] != false,
    );
  }
}