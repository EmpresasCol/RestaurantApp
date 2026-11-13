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
import 'services/api.dart';
import 'services/notification_service.dart';
import 'theme/qpro_theme.dart';
import 'widgets/q.dart';

// Navegador y avisos de la sesión en curso. Cada sesión estrena los suyos: si al salir se
// reutilizara el Navigator anterior, sus pantallas (que leen el provider del rol) seguirían
// vivas sin ese provider y fallarían con ProviderNotFoundException.
GlobalKey<NavigatorState>? _navegador;
GlobalKey<ScaffoldMessengerState>? _mensajero;

NavigatorState? get navegador => _navegador?.currentState;

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
  push.onToken = auth.registrarPush;
  push.initialize();
}

AudioPlayer? _reproductor;

/// "Pedido listo" o "la mesa te llama" con la app abierta: sonido, vibración y aviso en pantalla.
/// La llamada ya llegó también por tiempo real; recargar aquí cubre un socket caído.
Future<void> _alLlegarAviso(NotificacionProvider avisos, AvisoPush aviso) async {
  if (aviso.esLlamada) _navegador?.currentContext?.read<SalonProvider?>()?.cargar(silencioso: true);
  HapticFeedback.heavyImpact();
  try {
    await (_reproductor ??= AudioPlayer()).play(AssetSource('sounds/listo.wav'));
  } catch (_) {
    SystemSound.play(SystemSoundType.alert);
  }
  await avisos.agregar(pedidoId: aviso.pedidoId, mesaNumero: aviso.mesaNumero, titulo: aviso.titulo, mensaje: aviso.mensaje);
  final contexto = _mensajero?.currentContext;
  if (contexto != null && contexto.mounted) {
    avisar(
      contexto,
      aviso.mesaNumero <= 0
          ? aviso.titulo
          : aviso.esLlamada
              ? 'Mesa ${aviso.mesaNumero} te llama'
              : 'Mesa ${aviso.mesaNumero}: pedido listo para servir',
    );
  }
}

/// Al tocar un aviso: abre la mesa con su estado recién leído de la API. Con la app recién
/// abierta desde el aviso el salón puede no haber cargado todavía.
Future<void> _abrirMesa(int numero) async {
  final salon = _navegador?.currentContext?.read<SalonProvider?>();
  if (salon == null || numero <= 0) return;
  await salon.cargar(silencioso: true);
  final mesa = salon.mesaPorNumero(numero);
  if (mesa != null) navegador?.push(MaterialPageRoute(builder: (_) => MesaScreen(mesaId: mesa.id)));
}

class QproApp extends StatelessWidget {
  const QproApp({super.key, required this.auth, required this.avisos, this.api});

  final AuthProvider auth;
  final NotificacionProvider avisos;
  /// Para pruebas: la API simulada que usan los datos del rol.
  final Api? api;

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
              create: (_) => SalonProvider(api: api)..cargar(),
              child: _App(key: ValueKey('app-salon-${usuario.id}'), inicio: const SalonScreen()),
            ),
          RolUsuario.domiciliario => ChangeNotifierProvider(
              key: ValueKey('domicilios-${usuario!.id}'),
              create: (_) => DomiciliarioProvider(domiciliarioId: usuario.id, api: api)..cargar(),
              child: _App(key: ValueKey('app-domicilios-${usuario.id}'), inicio: const EntregasScreen()),
            ),
          _ => _App(key: const ValueKey('app-login'), inicio: auth.iniciando ? const _Arranque() : const LoginScreen()),
        };
      }),
    );
  }
}

class _App extends StatefulWidget {
  const _App({super.key, required this.inicio});

  final Widget inicio;

  @override
  State<_App> createState() => _AppState();
}

class _AppState extends State<_App> {
  final _navegadorPropio = GlobalKey<NavigatorState>();
  final _mensajeroPropio = GlobalKey<ScaffoldMessengerState>();

  @override
  void initState() {
    super.initState();
    _navegador = _navegadorPropio;
    _mensajero = _mensajeroPropio;
  }

  @override
  void dispose() {
    // La sesión nueva ya registró los suyos al montarse: solo se limpian si siguen siendo estos.
    if (identical(_navegador, _navegadorPropio)) _navegador = null;
    if (identical(_mensajero, _mensajeroPropio)) _mensajero = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Qpro',
      debugShowCheckedModeBanner: false,
      navigatorKey: _navegadorPropio,
      scaffoldMessengerKey: _mensajeroPropio,
      theme: qproTheme(),
      locale: const Locale('es', 'CO'),
      supportedLocales: const [Locale('es', 'CO'), Locale('es')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: _AlVolver(child: widget.inicio),
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
