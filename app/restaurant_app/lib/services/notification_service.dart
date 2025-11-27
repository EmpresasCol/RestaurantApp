import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

// ✅ Handler para notificaciones en background (app cerrada/minimizada)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('📬 Mensaje en background: ${message.notification?.title}');
  
  // ✅ GUARDAR NOTIFICACIÓN INCLUSO CUANDO LA APP ESTÁ CERRADA
  try {
    final prefs = await SharedPreferences.getInstance();
    final notificacionesJson = prefs.getString('notificaciones');
    
    List<dynamic> notificaciones = [];
    if (notificacionesJson != null) {
      notificaciones = json.decode(notificacionesJson);
    }
    
    final nuevaNotificacion = {
      'id': DateTime.now().millisecondsSinceEpoch,
      'pedidoId': int.tryParse(message.data['pedidoId'] ?? '0') ?? 0,
      'mesaNumero': int.tryParse(message.data['mesaNumero'] ?? '0') ?? 0,
      'titulo': message.notification?.title ?? 'Notificación',
      'mensaje': message.notification?.body ?? '',
      'fecha': DateTime.now().toIso8601String(),
      'leida': false,
      'platillos': message.data['platillos'],
      'totalItems': int.tryParse(message.data['totalItems'] ?? '0'),
    };
    
    notificaciones.insert(0, nuevaNotificacion);
    
    // Mantener solo las últimas 50
    if (notificaciones.length > 50) {
      notificaciones = notificaciones.take(50).toList();
    }
    
    await prefs.setString('notificaciones', json.encode(notificaciones));
    debugPrint('✅ Notificación guardada en background');
  } catch (e) {
    debugPrint('❌ Error guardando notificación en background: $e');
  }
}

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  
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

      // ✅ Handler para background/cerrada
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      // Cuando llega mensaje con app abierta
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint('========================================');
        debugPrint('📬 NOTIFICACIÓN EN FOREGROUND');
        debugPrint('Título: ${message.notification?.title}');
        debugPrint('Cuerpo: ${message.notification?.body}');
        debugPrint('========================================');
        
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