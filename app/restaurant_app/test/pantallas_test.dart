// Pantallas con la API simulada: lo que ve y puede hacer cada rol.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:restaurant_app/models/cuenta.dart';
import 'package:restaurant_app/models/mesa.dart';
import 'package:restaurant_app/models/pedido.dart';
import 'package:restaurant_app/providers/auth_provider.dart';
import 'package:restaurant_app/providers/salon_provider.dart';
import 'package:restaurant_app/screens/login_screen.dart';
import 'package:restaurant_app/screens/mesero/carta_screen.dart';
import 'package:restaurant_app/screens/mesero/mesa_screen.dart';
import 'package:restaurant_app/screens/mesero/pago_sheet.dart';
import 'package:restaurant_app/theme/qpro_theme.dart';
import 'package:restaurant_app/widgets/q.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fixtures.dart';
import 'servidor_falso.dart';

Widget _app(Widget pantalla, {SalonProvider? salon, AuthProvider? auth}) => MultiProvider(
      providers: [
        if (salon != null) ChangeNotifierProvider.value(value: salon),
        if (auth != null) ChangeNotifierProvider.value(value: auth),
      ],
      child: MaterialApp(theme: qproTheme(), home: pantalla),
    );

ServidorFalso _salon({List<Map<String, dynamic>>? pedidos, List<Map<String, dynamic>> solicitudes = const []}) => ServidorFalso()
  ..responder('GET mesas', [mesaJson(3, estado: 'Ocupada')])
  ..responder('GET pedidos/activos', pedidos ?? [pedidoJson(cocinaEmpezo: false)])
  ..responder('GET cuentas/solicitudes', solicitudes)
  ..responder('GET platillos', [
    platilloJson(porciones: 2),
    platilloJson(id: 2, nombre: 'Limonada', categoria: 'Bebidas'),
    platilloJson(id: 3, nombre: 'Ceviche', disponible: false),
  ]);

Future<SalonProvider> _cargado(ServidorFalso servidor) async {
  final p = SalonProvider(api: servidor.api(), cambios: const Stream.empty(), recargaPeriodica: false);
  await p.cargar();
  return p;
}

// PNG de 1 × 1 px: una foto real para que el widget la pueda pintar.
const _png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('login: pide usuario y clave y muestra el error de la API en palabras claras', (tester) async {
    final servidor = ServidorFalso()..responder('POST usuarios/login-mobile', {'message': 'Credenciales inválidas'}, status: 401);
    await tester.pumpWidget(_app(const LoginScreen(), auth: AuthProvider(api: servidor.api())));

    await tester.tap(find.text('Entrar'));
    await tester.pump();
    expect(find.text('Escribe tu usuario'), findsOneWidget);
    expect(servidor.recibidas, isEmpty);

    await tester.enterText(find.widgetWithText(TextFormField, 'Usuario'), 'juan');
    await tester.enterText(find.widgetWithText(TextFormField, 'Clave'), 'mala');
    await tester.tap(find.text('Entrar'));
    await tester.pumpAndSettle();
    expect(find.text('Usuario o clave incorrectos'), findsOneWidget);
  });

  testWidgets('botón de doble toque: el primero pide confirmar y se cancela solo', (tester) async {
    var veces = 0;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: BotonConfirmar(texto: 'Servido', confirmar: '¿Servido?', onConfirmar: () async => veces++)),
    ));

    await tester.tap(find.text('Servido'));
    await tester.pump();
    expect(find.text('¿Servido?'), findsOneWidget);
    await tester.pump(const Duration(seconds: 4));
    expect(find.text('Servido'), findsOneWidget);
    expect(veces, 0);

    await tester.tap(find.text('Servido'));
    await tester.pump();
    await tester.tap(find.text('¿Servido?'));
    await tester.pump();
    expect(veces, 1);
  });

  testWidgets('mesa: un pedido sin empezar se edita o cancela; uno empezado no', (tester) async {
    // La letra de pruebas es el doble de ancha que Manrope: se prueba a 540 px lógicos.
    tester.view.physicalSize = const Size(1080, 3000);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final salon = await _cargado(_salon(pedidos: [
      pedidoJson(id: 1, cocinaEmpezo: false),
      pedidoJson(id: 2, cocinaEmpezo: true, fecha: '2026-11-03T18:10:00Z'),
      pedidoJson(id: 3, estado: 'Listo', fecha: '2026-11-03T18:20:00Z'),
    ]));
    await tester.pumpWidget(_app(const MesaScreen(mesaId: 3), salon: salon));

    expect(find.text('Editar'), findsOneWidget);
    expect(find.text('Cancelar'), findsOneWidget);
    expect(find.textContaining('La cocina ya lo está preparando'), findsOneWidget);
    expect(find.text('Marcar servido'), findsOneWidget);
    expect(find.text('Pedir la cuenta'), findsOneWidget);
    // El mesero nunca cobra: no hay botón para marcar pagado.
    expect(find.textContaining('Cobrar'), findsNothing);
    salon.dispose();
  });

  testWidgets('mesa: pedir la cuenta la envía a caja y luego se registra el pago', (tester) async {
    final servidor = _salon()..responder('POST cuentas/solicitudes', solicitudJson());
    final salon = await _cargado(servidor);
    await tester.pumpWidget(_app(const MesaScreen(mesaId: 3), salon: salon));

    servidor.responder('GET cuentas/solicitudes', [solicitudJson()]);
    await tester.tap(find.text('Pedir la cuenta'));
    await tester.pumpAndSettle();

    expect(servidor.cuerpo('POST cuentas/solicitudes'), {'mesaId': 3});
    expect(find.text('Cuenta pedida a caja'), findsOneWidget);
    expect(find.text('Registrar pago'), findsOneWidget);
    salon.dispose();
  });

  testWidgets('pago por transferencia: sin foto no se envía; con foto va a caja', (tester) async {
    final servidor = _salon(solicitudes: [solicitudJson()])..responder('POST cuentas/solicitudes', solicitudJson(metodo: 'QR', foto: true));
    final salon = await _cargado(servidor);
    final cuenta = salon.cuenta(3)!;
    await tester.pumpWidget(_app(
      Scaffold(
        body: PagoSheet(
          cuenta: cuenta,
          selector: (_) async => XFile.fromData(base64Decode(_png), name: 'pago.png', mimeType: 'image/png'),
        ),
      ),
      salon: salon,
    ));

    await tester.tap(find.text('Transferencia'));
    await tester.pump();
    final avisar = find.widgetWithText(FilledButton, 'Avisar a caja');
    expect(tester.widget<FilledButton>(avisar).onPressed, isNull);

    await tester.tap(find.text('Tomar foto'));
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(avisar).onPressed, isNotNull);

    await tester.ensureVisible(avisar);
    await tester.pumpAndSettle();
    await tester.tap(avisar);
    await tester.pumpAndSettle();
    final cuerpo = servidor.cuerpo('POST cuentas/solicitudes');
    expect(cuerpo['metodoPago'], 'QR');
    expect(cuerpo['comprobante'], 'data:image/png;base64,$_png');
    salon.dispose();
  });

  testWidgets('carta: lo agotado no se pide y la cantidad no pasa de las porciones', (tester) async {
    final servidor = _salon()..responder('POST pedidos', pedidoJson(id: 30), status: 201);
    final salon = await _cargado(servidor);
    await tester.pumpWidget(_app(const CartaScreen(mesa: Mesa(id: 3, numero: 3, estado: EstadoMesa.ocupada)), salon: salon));
    await tester.pumpAndSettle();

    expect(find.text('No disponible por el momento'), findsOneWidget);
    expect(tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.add_rounded).at(2)).onPressed, isNull);

    await tester.tap(find.byTooltip('Agregar Hamburguesa'));
    await tester.pump();
    await tester.tap(find.byTooltip('Agregar uno'));
    await tester.pump();
    expect(find.text('Quedan 2'), findsOneWidget);
    // Con 2 porciones, el + se apaga.
    expect(tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.add_rounded).first).onPressed, isNull);

    await tester.pumpAndSettle(); // la barra del carrito entra deslizándose
    await tester.tap(find.text('Ver pedido'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enviar a cocina'));
    await tester.pumpAndSettle();
    expect(servidor.cuerpo('POST pedidos'), {
      'mesaId': 3,
      'detalles': [
        {'platilloId': 1, 'cantidad': 2, 'nota': null},
      ],
    });
    salon.dispose();
  });

  testWidgets('carta: al editar, las porciones del mismo pedido cuentan como disponibles', (tester) async {
    final salon = await _cargado(_salon());
    final pedido = Pedido.fromJson(pedidoJson(cocinaEmpezo: false, detalles: [detalleJson(cantidad: 3)]));
    await tester.pumpWidget(_app(CartaScreen(mesa: const Mesa(id: 3, numero: 3, estado: EstadoMesa.ocupada), editar: pedido), salon: salon));
    await tester.pumpAndSettle();

    // 2 porciones en bodega + 3 ya descontadas para este pedido = puede subir a 5.
    expect(find.text('3'), findsWidgets);
    final mas = find.byTooltip('Agregar uno');
    await tester.tap(mas.first);
    await tester.pump();
    await tester.tap(mas.first);
    await tester.pump();
    expect(find.text('5'), findsNWidgets(2)); // selector y barra del carrito
    expect(tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.add_rounded).first).onPressed, isNull);
    expect(find.text('Editar pedido #15'), findsOneWidget);
    salon.dispose();
  });

  test('la cuenta del mesero nunca expone un método fuera de la API', () {
    expect(MetodoPago.values.map((m) => m.api).toSet(), {'Efectivo', 'Tarjeta', 'QR'});
  });
}
