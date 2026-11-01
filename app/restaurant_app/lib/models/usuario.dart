// Mismos roles que la API. Un rol desconocido NO se convierte en uno con permisos.
enum RolUsuario { administrador, mesero, cocina, caja, domiciliario, desconocido }

class Usuario {
  const Usuario({
    required this.id,
    required this.nombre,
    required this.nombreUsuario,
    required this.rol,
  });

  final int id;
  final String nombre;
  final String nombreUsuario;
  final RolUsuario rol;

  factory Usuario.fromJson(Map<String, dynamic> json) => Usuario(
        id: json['id'],
        nombre: json['nombre'] ?? '',
        nombreUsuario: json['nombreUsuario'] ?? '',
        rol: rolDe(json['rol'] ?? ''),
      );

  Map<String, dynamic> toJson() => {'id': id, 'nombre': nombre, 'nombreUsuario': nombreUsuario, 'rol': rol.name};

  String get primerNombre => nombre.trim().split(' ').first;

  String get iniciales {
    final partes = nombre.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (partes.isEmpty) return '?';
    return (partes.first[0] + (partes.length > 1 ? partes[1][0] : '')).toUpperCase();
  }

  static RolUsuario rolDe(String rol) {
    switch (rol.toLowerCase()) {
      case 'administrador':
        return RolUsuario.administrador;
      case 'mesero':
        return RolUsuario.mesero;
      case 'cocina':
        return RolUsuario.cocina;
      case 'caja':
        return RolUsuario.caja;
      case 'domiciliario':
        return RolUsuario.domiciliario;
      default:
        return RolUsuario.desconocido;
    }
  }
}
