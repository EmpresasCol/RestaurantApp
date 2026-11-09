// Datos con la forma real que devuelve la API (.NET serializa en camelCase).

Map<String, dynamic> detalleJson({
  int id = 1,
  int platilloId = 1,
  String nombre = 'Hamburguesa',
  int cantidad = 2,
  num precio = 25000,
  String? nota,
  String estado = 'Pendiente',
}) =>
    {'id': id, 'platilloId': platilloId, 'platilloNombre': nombre, 'cantidad': cantidad, 'precio': precio, 'nota': nota, 'estado': estado};

Map<String, dynamic> pedidoJson({
  int id = 15,
  int mesaId = 3,
  int mesaNumero = 3,
  String estado = 'EnProceso',
  String fecha = '2026-11-03T18:00:00Z',
  bool? cocinaEmpezo,
  List<Map<String, dynamic>>? detalles,
}) =>
    {
      'id': id,
      'mesaId': mesaId,
      'mesaNumero': mesaNumero,
      'estado': estado,
      'fecha': fecha,
      'usuarioId': 2,
      'meseroNombre': 'Juan Pérez',
      if (cocinaEmpezo != null) 'cocinaEmpezo': cocinaEmpezo,
      'detalles': detalles ?? [detalleJson(nota: 'sin cebolla'), detalleJson(id: 2, platilloId: 9, nombre: 'Limonada', cantidad: 1, precio: 6500)],
    };

Map<String, dynamic> mesaJson(int id, {String estado = 'Disponible'}) => {'id': id, 'numero': id, 'estado': estado};

Map<String, dynamic> platilloJson({
  int id = 1,
  String nombre = 'Hamburguesa',
  num precio = 25000,
  String categoria = 'Platos',
  bool disponible = true,
  int? porciones,
}) =>
    {
      'id': id,
      'nombre': nombre,
      'descripcion': 'Con papas',
      'precio': precio,
      'imagenUrl': '',
      'categoria': categoria,
      'disponible': disponible,
      'porcionesDisponibles': porciones,
      'activo': true,
    };

Map<String, dynamic> solicitudJson({int id = 7, int mesaId = 3, String? metodo, bool foto = false}) => {
      'id': id,
      'mesaId': mesaId,
      'mesaNumero': mesaId,
      'meseroNombre': 'Juan Pérez',
      'fecha': '2026-11-03T19:00:00Z',
      'metodoPago': metodo,
      'fechaPago': metodo == null ? null : '2026-11-03T19:10:00Z',
      'tieneComprobante': foto,
    };
