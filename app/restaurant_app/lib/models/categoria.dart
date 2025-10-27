class Categoria {
  final String nombre;
  final String icono;
  bool estaSeleccionada;

  Categoria({
    required this.nombre,
    required this.icono,
    this.estaSeleccionada = false,
  });

  static List<Categoria> obtenerCategorias() {
    return [
      Categoria(nombre: 'Todas', icono: '🍽️'),
      Categoria(nombre: 'Entradas', icono: '🥗'),
      Categoria(nombre: 'Platos Principales', icono: '🍖'),
      Categoria(nombre: 'Bebidas', icono: '🥤'),
      Categoria(nombre: 'Postres', icono: '🍰'),
    ];
  }
}