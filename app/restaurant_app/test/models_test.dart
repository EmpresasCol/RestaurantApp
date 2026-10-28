// Pruebas de funcionamiento de los modelos de la app del mesero.
// Ejecutar con:  flutter test test/models_test.dart
//
// Las pruebas con "[AUDITORÍA]" documentan defectos: fallan con el código actual
// y deben pasar una vez se corrijan.
import 'package:flutter_test/flutter_test.dart';
import 'package:restaurant_app/models/mesa.dart';
import 'package:restaurant_app/models/pedido.dart';
import 'package:restaurant_app/models/platillo.dart';
import 'package:restaurant_app/models/usuario.dart';

// Formato real que devuelve la API (.NET serializa en camelCase)
Map<String, dynamic> pedidoJson({
  String estado = 'EnProceso',
  required String fecha,
}) =>
    {
      'id': 15,
      'mesaId': 3,
      'mesaNumero': 3,
      'estado': estado,
      'fecha': fecha,
      'usuarioId': 2,
      'meseroNombre': 'Juan Pérez',
      'detalles': [
        {'id': 1, 'platilloId': 1, 'platilloNombre': 'Hamburguesa', 'cantidad': 2, 'precio': 25000, 'nota': 'sin cebolla', 'estado': 'Pendiente'},
        {'id': 2, 'platilloId': 9, 'platilloNombre': 'Limonada', 'cantidad': 1, 'precio': 6500.5, 'nota': null, 'estado': 'Pendiente'},
      ],
    };

String haceMinutos(int m) =>
    DateTime.now().subtract(Duration(minutes: m)).toIso8601String();

void main() {
  group('Pedido', () {
    test('se construye desde el JSON de la API', () {
      final p = Pedido.fromJson(pedidoJson(fecha: haceMinutos(1)));
      expect(p.id, 15);
      expect(p.mesaNumero, 3);
      expect(p.estado, EstadoPedido.enProceso);
      expect(p.detalles.length, 2);
      expect(p.detalles.first.nota, 'sin cebolla');
    });

    test('el total suma precio x cantidad de cada ítem', () {
      final p = Pedido.fromJson(pedidoJson(fecha: haceMinutos(1)));
      expect(p.total, 2 * 25000 + 6500.5);
    });

    test('se puede editar durante los primeros 5 minutos', () {
      expect(Pedido.fromJson(pedidoJson(fecha: haceMinutos(2))).puedeEditar, true);
      expect(Pedido.fromJson(pedidoJson(fecha: haceMinutos(10))).puedeEditar, false);
    });

    test('no se puede editar si ya está Listo', () {
      expect(Pedido.fromJson(pedidoJson(estado: 'Listo', fecha: haceMinutos(1))).puedeEditar, false);
    });

    test('el botón Entregar solo aparece cuando cocina lo marca Listo', () {
      expect(Pedido.fromJson(pedidoJson(estado: 'Listo', fecha: haceMinutos(1))).mostrarBotonEntregar, true);
      expect(Pedido.fromJson(pedidoJson(estado: 'EnProceso', fecha: haceMinutos(1))).mostrarBotonEntregar, false);
    });

    test('toJson de un ítem nuevo no envía id', () {
      final item = ItemPedido(platilloId: 4, platilloNombre: 'Pasta', cantidad: 1, precio: 30000);
      expect(item.toJson().containsKey('id'), false);
      expect(item.toJson()['platilloId'], 4);
    });

    // La API usa DateTime.Now del servidor y lo envía SIN zona horaria. Desplegada en
    // Render (UTC) y usada en Colombia (UTC-5), la app interpreta la hora como local:
    // el pedido parece creado 5 h en el futuro y queda editable durante 5 horas.
    test('[AUDITORÍA] un pedido con fecha "en el futuro" (desfase de zona) no es editable indefinidamente', () {
      final enUtcSinZona = DateTime.now().add(const Duration(hours: 5)).toIso8601String();
      expect(Pedido.fromJson(pedidoJson(fecha: enUtcSinZona)).puedeEditar, false);
    });

    test('[AUDITORÍA] un estado desconocido no se interpreta como EnProceso', () {
      // p. ej. si el backend añade "EnPreparacion" o "Recogido"
      final p = Pedido.fromJson(pedidoJson(estado: 'Recogido', fecha: haceMinutos(1)));
      expect(p.estado == EstadoPedido.enProceso, false);
    });
  });

  group('Mesa', () {
    test('Disponible se muestra libre y Ocupada como ocupada', () {
      expect(Mesa.fromJson({'id': 1, 'numero': 1, 'estado': 'Disponible'}).estado, EstadoMesa.libre);
      expect(Mesa.fromJson({'id': 2, 'numero': 2, 'estado': 'Ocupada'}).estado, EstadoMesa.ocupada);
    });

    // La API usa {Disponible, Ocupada, EsperandoPago}; la app {libre, ocupada, reservada}.
    // "EsperandoPago" cae en el default y la mesa aparece LIBRE en el mapa del mesero.
    test('[AUDITORÍA] una mesa EsperandoPago no aparece como libre', () {
      final m = Mesa.fromJson({'id': 3, 'numero': 3, 'estado': 'EsperandoPago'});
      expect(m.estado == EstadoMesa.libre, false);
    });
  });

  group('Platillo', () {
    test('acepta precios enteros o decimales', () {
      expect(Platillo.fromJson({'id': 1, 'nombre': 'A', 'precio': 12000}).precio, 12000.0);
      expect(Platillo.fromJson({'id': 2, 'nombre': 'B', 'precio': 12000.5}).precio, 12000.5);
    });

    test('tolera campos nulos', () {
      final p = Platillo.fromJson({'id': 3, 'nombre': null, 'precio': null, 'categoria': null});
      expect(p.nombre, '');
      expect(p.precio, 0.0);
      expect(p.categoria, 'General');
    });
  });

  group('Usuario', () {
    test('lee el rol Mesero', () {
      final u = Usuario.fromJson({'id': 2, 'nombre': 'Juan', 'nombreUsuario': 'juan', 'rol': 'Mesero'});
      expect(u.rol, RolUsuario.mesero);
    });

    // Cualquier rol desconocido (p. ej. "Domiciliario") se convierte en MESERO:
    // un fallo de mapeo termina concediendo permisos en vez de negarlos.
    test('[AUDITORÍA] un rol desconocido no se convierte en Mesero', () {
      final u = Usuario.fromJson({'id': 9, 'nombre': 'D', 'nombreUsuario': 'd', 'rol': 'Domiciliario'});
      expect(u.rol == RolUsuario.mesero, false);
    });
  });
}
