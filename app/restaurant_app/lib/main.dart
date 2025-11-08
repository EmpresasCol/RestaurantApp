import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:audioplayers/audioplayers.dart';
import 'providers/auth_provider.dart';
import 'providers/pedido_provider.dart';
import 'providers/notificacion_provider.dart';
import 'services/notification_service.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

final GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey = 
    GlobalKey<ScaffoldMessengerState>();

late NotificacionProvider notificacionProviderGlobal;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Firebase.initializeApp();
  await NotificationService().initialize();
  
  final audioPlayer = AudioPlayer();
  
  NotificationService().onMessageReceived = (RemoteMessage message) async {
    debugPrint('🔊 Reproduciendo sonido y vibración...');
    
    for (int i = 0; i < 5; i++) {
      HapticFeedback.heavyImpact();
      await Future.delayed(const Duration(milliseconds: 100));
    }
    
    try {
      await audioPlayer.play(UrlSource(
        'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3'
      ));
    } catch (e) {
      SystemSound.play(SystemSoundType.alert);
    }

    try {
      final pedidoId = int.tryParse(message.data['pedidoId'] ?? '0') ?? 0;
      final mesaNumero = int.tryParse(message.data['mesaNumero'] ?? '0') ?? 0;
      final platillos = message.data['platillos'];
      final totalItems = int.tryParse(message.data['totalItems'] ?? '0');
      
      await notificacionProviderGlobal.agregarNotificacion(
        pedidoId: pedidoId,
        mesaNumero: mesaNumero,
        titulo: message.notification?.title ?? 'Notificación',
        mensaje: message.notification?.body ?? '',
        platillos: platillos,
        totalItems: totalItems,
      );
    } catch (e) {
      debugPrint('Error guardando notificación: $e');
    }
    
    scaffoldMessengerKey.currentState?.showSnackBar(
      SnackBar(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.notifications_active, color: Colors.white, size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    message.notification?.title ?? 'Notificación',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              message.notification?.body ?? '',
              style: const TextStyle(fontSize: 15),
            ),
          ],
        ),
        backgroundColor: const Color(0xFFE28D41),
        duration: const Duration(seconds: 6),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        action: SnackBarAction(
          label: 'VER',
          textColor: Colors.white,
          onPressed: () {},
        ),
      ),
    );
  };
  
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..cargarUsuario()),
        ChangeNotifierProvider(create: (_) => PedidoProvider()),
        ChangeNotifierProvider(create: (context) {
          final provider = NotificacionProvider();
          notificacionProviderGlobal = provider;
          provider.cargarNotificaciones();
          return provider;
        }),
      ],
      child: MaterialApp(
        title: 'Qpro',
        debugShowCheckedModeBanner: false,
        scaffoldMessengerKey: scaffoldMessengerKey,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFFC79B64),
            primary: const Color(0xFFC79B64),
            secondary: const Color(0xFF93704E),
            tertiary: const Color(0xFFE28D41),
            surface: Colors.white,
            error: const Color(0xFFD32F2F),
            onPrimary: Colors.white,
            onSecondary: Colors.white,
            onSurface: const Color(0xFF3F291A), // ✅ Cambio de onBackground a onSurface
            brightness: Brightness.light,
          ),
          
          textTheme: GoogleFonts.merriweatherSansTextTheme().copyWith(
            bodyLarge: const TextStyle(color: Color(0xFF3F291A)),
            bodyMedium: const TextStyle(color: Color(0xFF3F291A)),
            bodySmall: const TextStyle(color: Color(0xFF73563D)),
            titleLarge: const TextStyle(
              color: Color(0xFF3F291A),
              fontWeight: FontWeight.bold,
            ),
            titleMedium: const TextStyle(
              color: Color(0xFF3F291A),
              fontWeight: FontWeight.bold,
            ),
          ),
          
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFFC79B64),
            foregroundColor: Colors.white,
            elevation: 0,
            centerTitle: false,
          ),
          
          cardTheme: CardThemeData( // ✅ Cambio de CardTheme a CardThemeData
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            color: Colors.white,
          ),
          
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFC79B64),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
          
          floatingActionButtonTheme: const FloatingActionButtonThemeData(
            backgroundColor: Color(0xFFE28D41),
            foregroundColor: Colors.white,
          ),
          
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.grey.shade50,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFFC79B64), width: 2),
            ),
            labelStyle: const TextStyle(color: Color(0xFF73563D)),
          ),
          
          useMaterial3: true,
        ),
        home: Consumer<AuthProvider>(
          builder: (context, auth, _) {
            if (auth.cargando) {
              return const Scaffold(
                backgroundColor: Color(0xFF3F291A),
                body: Center(
                  child: CircularProgressIndicator(
                    color: Color(0xFFC79B64),
                  ),
                ),
              );
            }
            return auth.estaAutenticado ? const HomeScreen() : const LoginScreen();
          },
        ),
      ),
    );
  }
}