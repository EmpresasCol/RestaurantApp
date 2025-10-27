enum RolUsuario { administrador, mesero, cocina, caja }

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
      rol: _rolFromString(json['rol']),
    );
  }

  static RolUsuario _rolFromString(String rol) {
    switch (rol.toLowerCase()) {
      case 'administrador': return RolUsuario.administrador;
      case 'mesero': return RolUsuario.mesero;
      case 'cocina': return RolUsuario.cocina;
      case 'caja': return RolUsuario.caja;
      default: return RolUsuario.mesero;
    }
  }
}