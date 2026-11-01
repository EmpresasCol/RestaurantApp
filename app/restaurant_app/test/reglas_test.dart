// Reglas de la app que deben coincidir con la API y la web.
// Ejecutar con:  flutter test
import 'package:flutter_test/flutter_test.dart';
import 'package:restaurant_app/models/cuenta.dart';
import 'package:restaurant_app/models/mesa.dart';
import 'package:restaurant_app/models/pedido.dart';
import 'package:restaurant_app/models/platillo.dart';
import 'package:restaurant_app/models/usuario.dart';
import 'package:restaurant_app/screens/domiciliario/entrega_detalle_screen.dart';
import 'package:restaurant_app/services/api.dart';
import 'package:restaurant_app/services/realtime.dart';
import 'package:restaurant_app/utils/formato.dart';

import 'fixtures.dart';

void main() {
  group('Pedido', () {
    test('se construye desde la API con el precio congelado de cada plato', () {
      final p = Pedido.fromJson(pedidoJson());
      expect(p.mesaNumero, 3);
      expect(p.meseroNombre, 'Juan Pérez');
      expect(p.detalles.first.nota, 'sin cebolla');
      expect(p.total, 25000 * 2 + 6500);
      expect(p.platos, 3);
    });

    test('se edita y cancela solo mientras la cocina no lo ha empezado', () {
      expect(Pedido.fromJson(pedidoJson(cocinaEmpezo: false)).editable, isTrue);
      expect(Pedido.fromJson(pedidoJson(cocinaEmpezo: true)).editable, isFalse);
      expect(Pedido.fromJson(pedidoJson(estado: 'Listo')).editable, isFalse);
    });

    test('sin el campo de la API, un plato en preparación cuenta como empezado', () {
      final p = Pedido.fromJson(pedidoJson(detalles: [detalleJson(estado: 'EnPreparacion')]));
      expect(p.cocinaEmpezo, isTrue);
      expect(p.etapa, 'Preparando');
    });

    test('la etapa habla como el salón', () {
      expect(Pedido.fromJson(pedidoJson(cocinaEmpezo: false)).etapa, 'Sin empezar');
      expect(Pedido.fromJson(pedidoJson(estado: 'Listo')).etapa, 'Listo para servir');
      expect(Pedido.fromJson(pedidoJson(estado: 'Entregado')).etapa, 'Servido');
    });

    test('solo lo listo se sirve y la caja no cobra lo que sigue en cocina', () {
      expect(Pedido.fromJson(pedidoJson(estado: 'Listo')).porServir, isTrue);
      expect(Pedido.fromJson(pedidoJson()).porServir, isFalse);
      expect(Pedido.fromJson(pedidoJson()).cobrable, isFalse);
      expect(Pedido.fromJson(pedidoJson(estado: 'Entregado')).cobrable, isTrue);
    });

    test('un estado desconocido no se interpreta como EnProceso', () {
      final p = Pedido.fromJson(pedidoJson(estado: 'Volando'));
      expect(p.estado, EstadoPedido.desconocido);
      expect(p.abierto, isFalse);
      expect(p.editable, isFalse);
    });
  });

  group('CuentaMesa', () {
    const mesa = Mesa(id: 3, numero: 3, estado: EstadoMesa.ocupada);

    test('una mesa con varios envíos es una sola cuenta, sin lo pagado ni lo cancelado', () {
      final cuenta = CuentaMesa(mesa: mesa, pedidos: [
        Pedido.fromJson(pedidoJson(id: 2, fecha: '2026-11-03T18:30:00Z', estado: 'Listo')),
        Pedido.fromJson(pedidoJson(id: 1)),
        Pedido.fromJson(pedidoJson(id: 3, estado: 'Pagado')),
        Pedido.fromJson(pedidoJson(id: 4, estado: 'Cancelado')),
        Pedido.fromJson(pedidoJson(id: 5, mesaId: 8)),
      ]);
      expect(cuenta.pedidos.map((p) => p.id), [1, 2]);
      expect(cuenta.total, 2 * (25000 * 2 + 6500));
      expect(cuenta.porServir, 1);
      expect(cuenta.resumen, 'Listo para servir');
    });

    test('lo listo para servir es lo más urgente; luego la cuenta pedida', () {
      final enCocina = [Pedido.fromJson(pedidoJson())];
      final pedida = SolicitudCuenta.fromJson(solicitudJson());
      expect(CuentaMesa(mesa: mesa, pedidos: const []).resumen, 'Libre');
      expect(CuentaMesa(mesa: mesa, pedidos: enCocina).resumen, 'En cocina');
      expect(CuentaMesa(mesa: mesa, pedidos: enCocina, solicitud: pedida).resumen, 'Cuenta pedida');
    });
  });

  group('Solicitud de cuenta', () {
    test('lee el método que avisó el mesero', () {
      final s = SolicitudCuenta.fromJson(solicitudJson(metodo: 'QR', foto: true));
      expect(s.metodo, MetodoPago.qr);
      expect(s.tieneComprobante, isTrue);
      expect(s.texto, 'Transferencia enviada a caja');
      expect(SolicitudCuenta.fromJson(solicitudJson()).texto, 'Cuenta pedida a caja');
    });

    test('los métodos usan los valores de la API', () {
      expect(MetodoPago.values.map((m) => m.api), ['Efectivo', 'Tarjeta', 'QR']);
      expect(MetodoPago.deApi('tarjeta'), MetodoPago.tarjeta);
      expect(MetodoPago.deApi('Otro'), isNull);
    });
  });

  group('Platillo', () {
    test('el tope es el de la web: porciones disponibles hasta 50', () {
      expect(Platillo.fromJson(platilloJson(porciones: 3)).tope, 3);
      expect(Platillo.fromJson(platilloJson()).tope, Platillo.maximoPorPlato);
      expect(Platillo.fromJson(platilloJson(porciones: 80)).tope, 50);
    });

    test('sin ingredientes no se pide y lo dice como la carta del comensal', () {
      final agotado = Platillo.fromJson(platilloJson(disponible: false));
      expect(agotado.tope, 0);
      expect(agotado.aviso, 'No disponible por el momento');
      expect(Platillo.fromJson(platilloJson(porciones: 2)).aviso, 'Quedan 2');
      expect(Platillo.fromJson(platilloJson(porciones: 20)).aviso, isNull);
    });

    test('la foto en Base64 se decodifica una vez; un texto roto no rompe la carta', () {
      final conFoto = Platillo(id: 1, nombre: 'x', precio: 1, imagenUrl: 'data:image/png;base64,iVBORw0KGgo=');
      expect(conFoto.bytesFoto, isNotNull);
      expect(identical(conFoto.bytesFoto, conFoto.bytesFoto), isTrue);
      expect(Platillo(id: 2, nombre: 'y', precio: 1, imagenUrl: 'data:image/png;base64,%%%').bytesFoto, isNull);
    });

    test('tolera campos nulos y categoría vacía', () {
      final p = Platillo.fromJson({'id': 4, 'nombre': null, 'precio': 7000, 'categoria': ''});
      expect(p.nombre, '');
      expect(p.categoria, 'General');
      expect(p.disponible, isTrue);
    });
  });

  group('Mesa y usuario', () {
    test('una mesa EsperandoPago o desconocida no aparece libre', () {
      expect(Mesa.fromJson(mesaJson(1)).estado, EstadoMesa.libre);
      expect(Mesa.fromJson(mesaJson(1, estado: 'EsperandoPago')).estado, EstadoMesa.esperandoPago);
      expect(Mesa.fromJson(mesaJson(1, estado: '???')).estado, EstadoMesa.ocupada);
    });

    test('un rol desconocido no se convierte en uno con permisos', () {
      expect(Usuario.rolDe('Mesero'), RolUsuario.mesero);
      expect(Usuario.rolDe('Superusuario'), RolUsuario.desconocido);
      expect(const Usuario(id: 1, nombre: 'Ana María Ruiz', nombreUsuario: 'ana', rol: RolUsuario.mesero).iniciales, 'AM');
    });
  });

  group('Formato y utilidades', () {
    test('pesos colombianos sin decimales', () {
      expect(pesos(56000).replaceAll(' ', ' '), r'$ 56.000');
      expect(pesos(6500.4).replaceAll(' ', ' '), r'$ 6.500');
    });

    test('hora corta en formato colombiano', () {
      expect(hora(DateTime(2026, 11, 3, 19, 5)), '7:05 p. m.');
      expect(hora(DateTime(2026, 11, 3, 0, 30)), '12:30 a. m.');
    });

    test('teléfono de WhatsApp con indicativo de Colombia', () {
      expect(EntregaDetalleScreen.telefonoWhatsApp('311 234 5678'), '573112345678');
      expect(EntregaDetalleScreen.telefonoWhatsApp('+57 311 234 5678'), '573112345678');
    });

    test('el tiempo real solo reacciona al evento cambio del hub', () {
      expect(Realtime.temaDe('{"type":1,"target":"cambio","arguments":["pedidos"]}'), 'pedidos');
      expect(Realtime.temaDe('{"type":6}'), isNull);
      expect(Realtime.temaDe('{}'), isNull);
      expect(Realtime.temaDe('basura'), isNull);
    });

    test('los errores de la API llegan legibles', () {
      expect(Api.mensajeDe('{"message":"La cocina ya empezó"}', 409), 'La cocina ya empezó');
      expect(Api.mensajeDe('"Mesa 9 no existe"', 400), 'Mesa 9 no existe');
      expect(Api.mensajeDe('{"errors":{"Clave":["La clave es obligatoria"]},"title":"x"}', 400), 'La clave es obligatoria');
      expect(Api.mensajeDe('', 500), 'El servidor tuvo un problema. Inténtalo de nuevo.');
    });
  });
}
