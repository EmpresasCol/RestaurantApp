import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Handler para notificaciones en background
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('📬 Mensaje en background: ${message.notification?.title}');
}

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  
  // ✅ Callback para mostrar notificación en la UI
  Function(RemoteMessage)? onMessageReceived;

  Future<void> initialize() async {
    NotificationSettings settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      debugPrint('✅ Permisos de notificación concedidos');
      
      String? token = await _fcm.getToken();
      if (token != null) {
        debugPrint('📱 FCM Token: $token');
        await _guardarToken(token);
      }

      _fcm.onTokenRefresh.listen((newToken) async {
        debugPrint('🔄 Token actualizado: $newToken');
        await _guardarToken(newToken);
      });

      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      // ✅ Cuando llega mensaje con app abierta
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint('========================================');
        debugPrint('📬 NOTIFICACIÓN EN FOREGROUND');
        debugPrint('Título: ${message.notification?.title}');
        debugPrint('Cuerpo: ${message.notification?.body}');
        debugPrint('========================================');
        
        // Llamar al callback para mostrar en la UI
        if (onMessageReceived != null) {
          onMessageReceived!(message);
        }
      });

      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint('📱 App abierta desde notificación');
      });

      RemoteMessage? initialMessage = await _fcm.getInitialMessage();
      if (initialMessage != null) {
        debugPrint('🚀 App iniciada desde notificación');
      }
    }
  }

  Future<void> _guardarToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('fcm_token', token);
  }

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('fcm_token');
  }
}