// Providers con la API simulada: lo que la app envía y cómo reacciona.
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:restaurant_app/models/cuenta.dart';
import 'package:restaurant_app/models/platillo.dart';
import 'package:restaurant_app/models/usuario.dart';
import 'package:restaurant_app/providers/auth_provider.dart';
import 'package:restaurant_app/providers/domiciliario_provider.dart';
import 'package:restaurant_app/providers/salon_provider.dart';
import 'package:restaurant_app/services/api.dart';
import 'package:restaurant_app/services/sesion.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fixtures.dart';
import 'servidor_falso.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    Sesion.token = null;
  });

  group('Api', () {
    test('un 401 fuera del login cierra la sesión; en el login no', () async {
      final servidor = ServidorFalso()
        ..responder('GET mesas', {'message': 'x'}, status: 401)
        ..responder('POST usuarios/login-mobile', {'message': 'Credenciales inválidas'}, status: 401);
      final api = servidor.api();
      var vencida = 0;
      api.onSesionVencida = () => vencida++;

      await expectLater(api.get('mesas'), throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)));
      await expectLater(api.post('usuarios/login-mobile', {}), throwsA(isA<ApiException>().having((e) => e.mensaje, 'mensaje', 'Credenciales inválidas')));
      expect(vencida, 1);
    });

    test('sin red da un mensaje para el mesero, no una excepción técnica', () async {
      final api = Api(cliente: MockClient((_) async => throw http.ClientException('Connection refused')));
      await expectLater(api.get('mesas'), throwsA(isA<ApiException>().having((e) => e.mensaje, 'mensaje', Api.sinConexion)));
    });

    test('envía el token y responde null en un 204', () async {
      final servidor = ServidorFalso()..responder('PUT pedidos/1/estado', null, status: 204);
      Sesion.token = 'abc';
      expect(await servidor.api().put('pedidos/1/estado', {'estado': 'Entregado'}), isNull);
      expect(servidor.recibidas.single.headers['Authorization'], 'Bearer abc');
    });
  });

  group('AuthProvider', () {
    test('un mesero entra por el login de meseros', () async {
      final servidor = ServidorFalso()
        ..responder('POST usuarios/login-mobile', {'id': 2, 'nombre': 'Juan Pérez', 'nombreUsuario': 'juan', 'rol': 'Mesero', 'token': 't1'});
      final auth = AuthProvider(api: servidor.api());

      await auth.login(' juan ', '123');

      expect(auth.esMesero, isTrue);
      expect(Sesion.token, 't1');
      expect(servidor.cuerpo('POST usuarios/login-mobile')['usuario'], 'juan');
    });

    test('un domiciliario entra con el mismo formulario', () async {
      final servidor = ServidorFalso()
        ..responder('POST usuarios/login-mobile', {'message': 'Solo usuarios con rol Mesero pueden acceder a la aplicación móvil.'}, status: 401)
        ..responder('POST domiciliarios/login', {'id': 3, 'nombre': 'Pedro', 'nombreUsuario': 'pedro', 'token': 't2', 'entregasHoy': 1});
      final auth = AuthProvider(api: servidor.api());

      await auth.login('pedro', '123');

      expect(auth.usuario!.rol, RolUsuario.domiciliario);
      expect(Sesion.token, 't2');
    });

    test('la clave equivocada no intenta el otro login y cajeros no entran', () async {
      final servidor = ServidorFalso()..responder('POST usuarios/login-mobile', {'message': 'Credenciales inválidas'}, status: 401);
      final auth = AuthProvider(api: servidor.api());
      await expectLater(auth.login('juan', 'mala'), throwsA(isA<ApiException>()));
      expect(servidor.veces('POST domiciliarios/login'), 0);

      servidor
        ..responder('POST usuarios/login-mobile', {'message': 'Solo usuarios con rol Mesero pueden acceder a la aplicación móvil.'}, status: 401)
        ..responder('POST domiciliarios/login', {'message': 'Esta cuenta no tiene permisos de domiciliario.'}, status: 401);
      await expectLater(
        auth.login('caja', '123'),
        throwsA(isA<ApiException>().having((e) => e.mensaje, 'mensaje', contains('entra por la web'))),
      );
      expect(auth.estaAutenticado, isFalse);
    });

    test('la sesión guardada se recupera solo si hay token', () async {
      SharedPreferences.setMockInitialValues({'usuario': '{"id":2,"nombre":"Juan","nombreUsuario":"juan","rol":"mesero"}'});
      final sinToken = AuthProvider(api: ServidorFalso().api());
      await sinToken.cargarUsuario();
      expect(sinToken.estaAutenticado, isFalse);

      SharedPreferences.setMockInitialValues({'usuario': '{"id":2,"nombre":"Juan","nombreUsuario":"juan","rol":"mesero"}', 'token': 't'});
      final conToken = AuthProvider(api: ServidorFalso().api());
      await conToken.cargarUsuario();
      expect(conToken.esMesero, isTrue);
    });
  });

  group('SalonProvider', () {
    ServidorFalso salon() => ServidorFalso()
      ..responder('GET mesas', [mesaJson(3, estado: 'Ocupada'), mesaJson(1)])
      ..responder('GET pedidos/activos', [pedidoJson(estado: 'Listo'), pedidoJson(id: 16, cocinaEmpezo: false)])
      ..responder('GET cuentas/solicitudes', [solicitudJson(metodo: 'Efectivo')])
      ..responder('GET platillos', [platilloJson(porciones: 4), platilloJson(id: 2, nombre: 'Jugo', categoria: 'Bebidas')]);

    test('arma el salón por mesas, con lo listo para servir y la cuenta pedida', () async {
      final servidor = salon();
      final p = SalonProvider(api: servidor.api(), cambios: const Stream.empty(), recargaPeriodica: false);

      await p.cargar();

      expect(p.mesas.map((m) => m.numero), [1, 3]);
      final mesa3 = p.cuenta(3)!;
      expect(mesa3.pedidos, hasLength(2));
      expect(mesa3.solicitud!.metodo, MetodoPago.efectivo);
      expect(p.porServir.single.id, 15);
      expect(p.cuenta(1)!.libre, isTrue);
      p.dispose();
    });

    test('crea el pedido con las notas y recarga carta y salón', () async {
      final servidor = salon()..responder('POST pedidos', pedidoJson(id: 20), status: 201);
      final p = SalonProvider(api: servidor.api(), cambios: const Stream.empty(), recargaPeriodica: false);
      final plato = Platillo.fromJson(platilloJson());

      await p.crearPedido(3, [LineaPedido(platillo: plato, cantidad: 2, nota: ' sin sal '), LineaPedido(platillo: plato)]);

      expect(servidor.cuerpo('POST pedidos'), {
        'mesaId': 3,
        'detalles': [
          {'platilloId': 1, 'cantidad': 2, 'nota': 'sin sal'},
          {'platilloId': 1, 'cantidad': 1, 'nota': null},
        ],
      });
      expect(servidor.veces('GET pedidos/activos'), 1);
      expect(p.carta, hasLength(2));
      expect(p.categorias, ['Platos', 'Bebidas']);
      p.dispose();
    });

    test('si la cocina ya empezó, el error de la API llega al mesero', () async {
      final servidor = salon()
        ..responder('PUT pedidos/16/actualizar', {'message': 'La cocina ya empezó este pedido. Agrega los platos nuevos como otro pedido.'}, status: 409);
      final p = SalonProvider(api: servidor.api(), cambios: const Stream.empty(), recargaPeriodica: false);

      await expectLater(
        p.editarPedido(16, [LineaPedido(platillo: Platillo.fromJson(platilloJson()))]),
        throwsA(isA<ApiException>().having((e) => e.mensaje, 'mensaje', contains('otro pedido'))),
      );
      p.dispose();
    });

    test('pedir la cuenta y avisar el pago por transferencia con la foto', () async {
      final servidor = salon()..responder('POST cuentas/solicitudes', solicitudJson(metodo: 'QR', foto: true));
      final p = SalonProvider(api: servidor.api(), cambios: const Stream.empty(), recargaPeriodica: false);

      await p.pedirCuenta(3);
      expect(servidor.cuerpo('POST cuentas/solicitudes'), {'mesaId': 3});

      await p.pedirCuenta(3, propina: 5000, pagos: const [
        PagoNuevo(metodo: MetodoPago.qr, monto: 30000, comprobante: 'data:image/jpeg;base64,AAAA'),
        PagoNuevo(metodo: MetodoPago.efectivo, monto: 31500),
      ]);
      expect(servidor.cuerpo('POST cuentas/solicitudes'), {
        'mesaId': 3,
        'propina': 5000,
        'pagos': [
          {'metodoPago': 'QR', 'monto': 30000, 'comprobante': 'data:image/jpeg;base64,AAAA'},
          {'metodoPago': 'Efectivo', 'monto': 31500},
        ],
      });
      p.dispose();
    });

    test('servir y cancelar usan el estado del pedido, nunca Pagado', () async {
      final servidor = salon()
        ..responder('PUT pedidos/15/estado', {'id': 15})
        ..responder('PUT pedidos/16/estado', {'id': 16});
      final p = SalonProvider(api: servidor.api(), cambios: const Stream.empty(), recargaPeriodica: false);

      await p.servir(15);
      await p.cancelar(16);

      expect(servidor.cuerpo('PUT pedidos/15/estado'), {'estado': 'Entregado'});
      expect(servidor.cuerpo('PUT pedidos/16/estado'), {'estado': 'Cancelado'});
      expect(servidor.recibidas.where((r) => r.body.contains('Pagado')), isEmpty);
      p.dispose();
    });

    test('un aviso de tiempo real de pedidos recarga el salón; uno de domicilios no', () async {
      final servidor = salon();
      final cambios = StreamController<String>();
      final p = SalonProvider(api: servidor.api(), cambios: cambios.stream, recargaPeriodica: false);

      cambios.add('domicilios');
      await pumpEventQueue();
      expect(servidor.veces('GET mesas'), 0);

      cambios.add('pedidos');
      await pumpEventQueue();
      expect(servidor.veces('GET mesas'), 1);
      p.dispose();
      await cambios.close();
    });
  });

  group('DomiciliarioProvider', () {
    Map<String, dynamic> domicilio(int id, String estado, {int? domiciliarioId}) => {
          'id': id,
          'estado': estado,
          'fechaPedido': '2026-11-03T18:00:00Z',
          'clienteNombre': 'Ana',
          'clienteTelefono': '3112345678',
          'direccionCompleta': 'Cra 1 # 2-3',
          'barrio': 'Centro',
          'subtotal': 25000,
          'costoEnvio': 3000,
          'total': 28000,
          'metodoPago': 'Efectivo',
          'pagadoAnticipado': false,
          'domiciliarioId': domiciliarioId,
          'detalles': [],
        };

    test('separa lo libre de lo suyo y recoger llama al endpoint del domiciliario', () async {
      final servidor = ServidorFalso()
        ..responder('GET domiciliarios/3/pedidos', [domicilio(1, 'Listo'), domicilio(2, 'EnCamino', domiciliarioId: 3)])
        ..responder('GET domiciliarios/3/estadisticas', {'entregadosHoy': 4})
        ..responder('PUT domiciliarios/3/pedidos/1/recoger', null, status: 204);
      final p = DomiciliarioProvider(domiciliarioId: 3, api: servidor.api(), cambios: const Stream.empty(), recargaPeriodica: false);

      await p.cargar();
      await pumpEventQueue();
      expect(p.libres.single.id, 1);
      expect(p.mios.single.porCobrar, 28000);
      expect(p.entregasHoy, 4);

      await p.recoger(1);
      expect(servidor.veces('PUT domiciliarios/3/pedidos/1/recoger'), 1);
      p.dispose();
    });

    test('ve lo que le asignaron desde la cocina, primero lo que ya lleva, y el efectivo que debe entregar', () async {
      final servidor = ServidorFalso()
        ..responder('GET domiciliarios/3/pedidos', [
          {...domicilio(5, 'EnPreparacion', domiciliarioId: 3), 'cocinaEmpezo': true},
          domicilio(6, 'EnCamino', domiciliarioId: 3),
          domicilio(7, 'Listo', domiciliarioId: 3),
        ])
        ..responder('GET domiciliarios/3/estadisticas', {'entregadosHoy': 2, 'efectivoPorEntregar': 56000});
      final p = DomiciliarioProvider(domiciliarioId: 3, api: servidor.api(), cambios: const Stream.empty(), recargaPeriodica: false);

      await p.cargar();
      await pumpEventQueue();

      expect(p.mios.map((d) => d.id), [6, 7, 5]);
      expect(p.mios.last.etapa, 'En cocina');
      expect(p.libres, isEmpty);
      expect(p.efectivoPorEntregar, 56000);
      p.dispose();
    });

    test('entregar envía cómo pagó el cliente y la foto de la transferencia', () async {
      final servidor = ServidorFalso()
        ..responder('GET domiciliarios/3/pedidos', [])
        ..responder('GET domiciliarios/3/estadisticas', {'entregadosHoy': 1})
        ..responder('PUT domiciliarios/3/pedidos/6/entregar', null, status: 204);
      final p = DomiciliarioProvider(domiciliarioId: 3, api: servidor.api(), cambios: const Stream.empty(), recargaPeriodica: false);

      await p.entregar(6, metodoPago: 'Nequi', comprobante: 'data:image/jpeg;base64,AAAA');

      expect(servidor.cuerpo('PUT domiciliarios/3/pedidos/6/entregar'), {'metodoPago': 'Nequi', 'comprobante': 'data:image/jpeg;base64,AAAA'});
      p.dispose();
    });
  });
}
