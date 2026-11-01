// Cerrar sesión desde cualquier pantalla vuelve al login sin errores (antes salía
// ProviderNotFoundException: el Navigator de la sesión anterior seguía vivo sin su provider).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:restaurant_app/main.dart';
import 'package:restaurant_app/providers/auth_provider.dart';
import 'package:restaurant_app/providers/notificacion_provider.dart';
import 'package:restaurant_app/screens/domiciliario/entrega_detalle_screen.dart';
import 'package:restaurant_app/screens/domiciliario/entregas_screen.dart';
import 'package:restaurant_app/screens/login_screen.dart';
import 'package:restaurant_app/screens/mesero/mesa_screen.dart';
import 'package:restaurant_app/screens/mesero/salon_screen.dart';
import 'package:restaurant_app/services/realtime.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fixtures.dart';
import 'servidor_falso.dart';

ServidorFalso _servidor() => ServidorFalso()
  ..responder('POST usuarios/login-mobile', {'message': 'Solo usuarios con rol Mesero pueden acceder a la aplicación móvil.'}, status: 401)
  ..responder('POST domiciliarios/login', {'id': 3, 'nombre': 'Pedro', 'nombreUsuario': 'pedro', 'token': 't2'})
  ..responder('GET domiciliarios/3/pedidos', [
    {
      'id': 6, 'estado': 'EnCamino', 'fechaPedido': '2026-11-03T18:00:00Z', 'clienteNombre': 'Ana', 'clienteTelefono': '3112345678',
      'direccionCompleta': 'Cra 1 # 2-3', 'barrio': 'Centro', 'subtotal': 25000, 'costoEnvio': 3000, 'total': 28000,
      'metodoPago': 'Efectivo', 'pagadoAnticipado': false, 'domiciliarioId': 3, 'detalles': [],
    },
  ])
  ..responder('GET domiciliarios/3/estadisticas', {'entregadosHoy': 0})
  ..responder('GET mesas', [mesaJson(3, estado: 'Ocupada')])
  ..responder('GET pedidos/activos', [pedidoJson()])
  ..responder('GET cuentas/solicitudes', []);

Future<AuthProvider> _sesion(ServidorFalso servidor, {required bool mesero}) async {
  if (mesero) {
    servidor.responder('POST usuarios/login-mobile', {'id': 2, 'nombre': 'Juan', 'nombreUsuario': 'juan', 'token': 't1'});
  }
  final auth = AuthProvider(api: servidor.api());
  await auth.cargarUsuario();
  await auth.login(mesero ? 'juan' : 'pedro', '123');
  // En pruebas no hay hub de SignalR al que conectarse.
  Realtime.instancia.detener();
  return auth;
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('el domiciliario cierra sesión con el detalle de una entrega abierto', (tester) async {
    final servidor = _servidor();
    final auth = await tester.runAsync(() => _sesion(servidor, mesero: false));
    await tester.pumpWidget(QproApp(auth: auth!, avisos: NotificacionProvider(), api: servidor.api()));
    await tester.pumpAndSettle();
    expect(find.byType(EntregasScreen), findsOneWidget);

    navegador!.push(MaterialPageRoute(builder: (_) => const EntregaDetalleScreen(domicilioId: 6)));
    await tester.pumpAndSettle();
    expect(find.text('Domicilio #6'), findsOneWidget);

    await tester.runAsync(auth.cerrarSesion);
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.byType(EntregaDetalleScreen), findsNothing);
  });

  testWidgets('el mesero cierra sesión con una mesa abierta y otro usuario entra limpio', (tester) async {
    final servidor = _servidor();
    final auth = await tester.runAsync(() => _sesion(servidor, mesero: true));
    await tester.pumpWidget(QproApp(auth: auth!, avisos: NotificacionProvider(), api: servidor.api()));
    await tester.pumpAndSettle();
    expect(find.byType(SalonScreen), findsOneWidget);

    navegador!.push(MaterialPageRoute(builder: (_) => const MesaScreen(mesaId: 3)));
    await tester.pumpAndSettle();

    await tester.runAsync(auth.cerrarSesion);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(LoginScreen), findsOneWidget);

    // El domiciliario entra después en el mismo celular: no ve nada de la sesión anterior.
    servidor.responder('POST usuarios/login-mobile', {'message': 'Solo usuarios con rol Mesero pueden acceder a la aplicación móvil.'}, status: 401);
    await tester.runAsync(() async {
      await auth.login('pedro', '123');
      Realtime.instancia.detener();
    });
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(EntregasScreen), findsOneWidget);
    expect(find.byType(MesaScreen), findsNothing);

    await tester.runAsync(auth.cerrarSesion);
    await tester.pumpAndSettle();
  });
}
