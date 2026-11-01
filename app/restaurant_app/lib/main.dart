import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'models/usuario.dart';
import 'providers/auth_provider.dart';
import 'providers/domiciliario_provider.dart';
import 'providers/notificacion_provider.dart';
import 'providers/salon_provider.dart';
import 'screens/domiciliario/entregas_screen.dart';
import 'screens/login_screen.dart';
import 'screens/mesero/mesa_screen.dart';
import 'screens/mesero/salon_screen.dart';
import 'services/notification_service.dart';
import 'theme/qpro_theme.dart';
import 'widgets/q.dart';

final navigatorKey = GlobalKey<NavigatorState>();
final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final auth = AuthProvider();
  final avisos = NotificacionProvider();
  await Future.wait([auth.cargarUsuario(), avisos.cargar()]);

  runApp(QproApp(auth: auth, avisos: avisos));

  // El push no retrasa el arranque y es opcional (iOS sin GoogleService-Info.plist).
  final push = NotificationService();
  push.onAviso = (a) => _alLlegarAviso(avisos, a);
  push.onAbrir = (a) => _abrirMesa(a.mesaNumero);
  push.initialize();
}

AudioPlayer? _reproductor;

/// "Pedido listo" con la app abierta: sonido incluido, vibración y aviso en pantalla.
Future<void> _alLlegarAviso(NotificacionProvider avisos, AvisoPush aviso) async {
  HapticFeedback.heavyImpact();
  try {
    await (_reproductor ??= AudioPlayer()).play(AssetSource('sounds/listo.wav'));
  } catch (_) {
    SystemSound.play(SystemSoundType.alert);
  }
  await avisos.agregar(pedidoId: aviso.pedidoId, mesaNumero: aviso.mesaNumero, titulo: aviso.titulo, mensaje: aviso.mensaje);
  final contexto = scaffoldMessengerKey.currentContext;
  if (contexto != null && contexto.mounted) {
    avisar(contexto, aviso.mesaNumero > 0 ? 'Mesa ${aviso.mesaNumero}: pedido listo para servir' : aviso.titulo);
  }
}

void _abrirMesa(int numero) {
  final contexto = navigatorKey.currentContext;
  if (contexto == null || numero <= 0) return;
  final mesa = contexto.read<SalonProvider?>()?.mesaPorNumero(numero);
  if (mesa != null) navigatorKey.currentState?.push(MaterialPageRoute(builder: (_) => MesaScreen(mesaId: mesa.id)));
}

class QproApp extends StatelessWidget {
  const QproApp({super.key, required this.auth, required this.avisos});

  final AuthProvider auth;
  final NotificacionProvider avisos;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
        ChangeNotifierProvider.value(value: avisos),
      ],
      child: Consumer<AuthProvider>(builder: (_, auth, __) {
        final usuario = auth.usuario;
        // Los datos del rol viven mientras dura la sesión: al salir se descartan.
        return switch (usuario?.rol) {
          RolUsuario.mesero => ChangeNotifierProvider(
              key: ValueKey('salon-${usuario!.id}'),
              create: (_) => SalonProvider()..cargar(),
              child: const _App(inicio: SalonScreen()),
            ),
          RolUsuario.domiciliario => ChangeNotifierProvider(
              key: ValueKey('domicilios-${usuario!.id}'),
              create: (_) => DomiciliarioProvider(domiciliarioId: usuario.id)..cargar(),
              child: const _App(inicio: EntregasScreen()),
            ),
          _ => _App(inicio: auth.iniciando ? const _Arranque() : const LoginScreen()),
        };
      }),
    );
  }
}

class _App extends StatelessWidget {
  const _App({required this.inicio});

  final Widget inicio;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Qpro',
      debugShowCheckedModeBanner: false,
      navigatorKey: navigatorKey,
      scaffoldMessengerKey: scaffoldMessengerKey,
      theme: qproTheme(),
      locale: const Locale('es', 'CO'),
      supportedLocales: const [Locale('es', 'CO'), Locale('es')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: _AlVolver(child: inicio),
    );
  }
}

/// Al volver a la app (estuvo en segundo plano), recarga lo que pudo cambiar.
class _AlVolver extends StatefulWidget {
  const _AlVolver({required this.child});

  final Widget child;

  @override
  State<_AlVolver> createState() => _AlVolverState();
}

class _AlVolverState extends State<_AlVolver> {
  late final AppLifecycleListener _ciclo;

  @override
  void initState() {
    super.initState();
    _ciclo = AppLifecycleListener(onResume: () {
      context.read<NotificacionProvider>().cargar();
      context.read<SalonProvider?>()?.cargar(silencioso: true);
      context.read<DomiciliarioProvider?>()?.cargar(silencioso: true);
    });
  }

  @override
  void dispose() {
    _ciclo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _Arranque extends StatelessWidget {
  const _Arranque();

  @override
  Widget build(BuildContext context) => const Scaffold(
        backgroundColor: QColors.white,
        body: Center(child: LogoQpro(tamano: 96)),
      );
}
