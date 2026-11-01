import 'dart:convert';
import 'dart:typed_data';

class Platillo {
  Platillo({
    required this.id,
    required this.nombre,
    required this.precio,
    this.descripcion = '',
    this.categoria = 'General',
    this.imagenUrl,
    this.disponible = true,
    this.porcionesDisponibles,
  });

  /// Tope por línea de la carta web (MenuQR.js): el mismo en la app.
  static const maximoPorPlato = 50;
  static const noDisponible = 'No disponible por el momento';

  final int id;
  final String nombre;
  final String descripcion;
  final double precio;
  final String categoria;
  final String? imagenUrl;
  /// false cuando la API indica que no hay ingredientes para una porción.
  final bool disponible;
  /// Porciones que alcanzan con el stock; null = sin control de inventario.
  final int? porcionesDisponibles;

  factory Platillo.fromJson(Map<String, dynamic> json) => Platillo(
        id: json['id'] ?? 0,
        nombre: json['nombre'] ?? '',
        descripcion: json['descripcion'] ?? '',
        precio: (json['precio'] as num?)?.toDouble() ?? 0.0,
        imagenUrl: json['imagenUrl'],
        categoria: (json['categoria'] as String?)?.trim().isNotEmpty == true ? json['categoria'] : 'General',
        disponible: json['disponible'] != false,
        porcionesDisponibles: json['porcionesDisponibles'],
      );

  bool get agotado => !disponible || porcionesDisponibles == 0;

  /// Cuántas porciones se pueden pedir (mismo cálculo que `topePorciones` de la web).
  int get tope => agotado ? 0 : (porcionesDisponibles ?? maximoPorPlato).clamp(0, maximoPorPlato);

  /// "Quedan 3" cuando el inventario está por acabarse.
  String? get aviso {
    if (agotado) return noDisponible;
    final p = porcionesDisponibles;
    return p != null && p <= 5 ? 'Quedan $p' : null;
  }

  bool get tieneFoto => imagenUrl != null && imagenUrl!.isNotEmpty;
  bool get fotoEnRed => tieneFoto && imagenUrl!.startsWith('http');

  Uint8List? _bytes;
  bool _bytesLeidos = false;

  /// La foto viene en Base64 dentro de la carta; se decodifica una sola vez.
  Uint8List? get bytesFoto {
    if (!_bytesLeidos) {
      _bytesLeidos = true;
      final url = imagenUrl;
      if (url != null && url.startsWith('data:')) {
        final coma = url.indexOf(',');
        try {
          _bytes = base64Decode(url.substring(coma + 1));
        } catch (_) {}
      }
    }
    return _bytes;
  }
}
