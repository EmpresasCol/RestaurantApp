// Mismos roles que la API. Un rol desconocido NO se convierte en uno con permisos.
enum RolUsuario { administrador, mesero, cocina, caja, domiciliario, desconocido }

class Usuario {
  final int id;
  final String nombre;
  final String nombreUsuario;
  final RolUsuario rol;

  Usuario({
    required this.id,
    required this.nombre,
    required this.nombreUsuario,
    required this.rol,
  });

  factory Usuario.fromJson(Map<String, dynamic> json) {
    return Usuario(
      id: json['id'],
      nombre: json['nombre'],
      nombreUsuario: json['nombreUsuario'],
      rol: _rolFromString(json['rol'] ?? ''),
    );
  }

  static RolUsuario _rolFromString(String rol) {
    switch (rol.toLowerCase()) {
      case 'administrador': return RolUsuario.administrador;
      case 'mesero': return RolUsuario.mesero;
      case 'cocina': return RolUsuario.cocina;
      case 'caja': return RolUsuario.caja;
      case 'domiciliario': return RolUsuario.domiciliario;
      default: return RolUsuario.desconocido;
    }
  }
}
