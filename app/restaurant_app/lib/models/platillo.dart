class Platillo {
  final int id;
  final String nombre;
  final String descripcion;
  final double precio;
  final String? imagenUrl;
  final String categoria;
  int cantidad;

  Platillo({
    required this.id,
    required this.nombre,
    required this.descripcion,
    required this.precio,
    this.imagenUrl,
    required this.categoria,
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
    );
  }
}