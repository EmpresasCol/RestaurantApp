import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../providers/notificacion_provider.dart';

/// Aviso de push en datos simples: lo que la API manda con "pedido listo".
typedef AvisoPush = ({String titulo, String mensaje, int pedidoId, int mesaNumero});

AvisoPush avisoDe(RemoteMessage m) => (
      titulo: m.notification?.title ?? 'Pedido listo',
      mensaje: m.notification?.body ?? '',
      pedidoId: int.tryParse(m.data['pedidoId']?.toString() ?? '') ?? 0,
      mesaNumero: int.tryParse(m.data['mesaNumero']?.toString() ?? '') ?? 0,
    );

/// Con la app cerrada o minimizada: guarda el aviso para mostrarlo al abrirla.
@pragma('vm:entry-point')
Future<void> _alRecibirEnSegundoPlano(RemoteMessage message) async {
  try {
    final aviso = avisoDe(message);
    final prefs = await SharedPreferences.getInstance();
    final lista = json.decode(prefs.getString(NotificacionProvider.clave) ?? '[]') as List;
    lista.insert(0, {
      'id': DateTime.now().millisecondsSinceEpoch,
      'pedidoId': aviso.pedidoId,
      'mesaNumero': aviso.mesaNumero,
      'titulo': aviso.titulo,
      'mensaje': aviso.mensaje,
      'fecha': DateTime.now().toIso8601String(),
      'leida': false,
    });
    await prefs.setString(NotificacionProvider.clave, json.encode(lista.take(NotificacionProvider.maximo).toList()));
  } catch (e) {
    debugPrint('No se guardó el aviso en segundo plano: $e');
  }
}

/// Push de Firebase. Es opcional: sin configuración de Firebase (iOS sin
/// GoogleService-Info.plist, vista previa web) la app funciona igual con el tiempo real.
class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  static const _claveToken = 'fcm_token';
  bool _activo = false;

  void Function(AvisoPush aviso)? onAviso;
  void Function(AvisoPush aviso)? onAbrir;

  Future<void> initialize() async {
    try {
      await Firebase.initializeApp();
    } catch (e) {
      debugPrint('Push desactivado (Firebase sin configurar): $e');
      return;
    }
    _activo = true;
    final fcm = FirebaseMessaging.instance;
    FirebaseMessaging.onBackgroundMessage(_alRecibirEnSegundoPlano);
    FirebaseMessaging.onMessage.listen((m) => onAviso?.call(avisoDe(m)));
    FirebaseMessaging.onMessageOpenedApp.listen((m) => onAbrir?.call(avisoDe(m)));

    final permiso = await fcm.requestPermission(alert: true, badge: true, sound: true);
    if (permiso.authorizationStatus == AuthorizationStatus.denied) return;

    try {
      // La API (FirebaseNotificationService) envía a tokens de registro; el envío por FID
      // (register/onRegistered) exigiría cambiarla. Se migra cuando el backend lo haga.
      // ignore: deprecated_member_use
      final token = await fcm.getToken();
      if (token != null) await _guardarToken(token);
      // ignore: deprecated_member_use
      fcm.onTokenRefresh.listen(_guardarToken);
      final inicial = await fcm.getInitialMessage();
      if (inicial != null) {
        // Se abre cuando la app ya pintó su primera pantalla.
        Future.delayed(const Duration(seconds: 1), () => onAbrir?.call(avisoDe(inicial)));
      }
    } catch (e) {
      debugPrint('No se obtuvo el token de notificaciones: $e');
    }
  }

  Future<void> _guardarToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_claveToken, token);
  }

  Future<String?> getToken() async {
    if (!_activo) return null;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_claveToken);
  }
}
