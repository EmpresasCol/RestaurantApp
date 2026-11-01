class ApiConfig {
  // URL de la API por compilación: flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000
  // Por defecto, la API publicada en Render (la misma que usa la web).
  static String baseUrl = const String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://qpro-api-oi8l.onrender.com',
  );

  static void setBaseUrl(String url) {
    baseUrl = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }

  static String get apiUrl => '$baseUrl/api';

  /// Hub de SignalR (mismo canal de tiempo real que la web).
  static String get hubUrl => '${baseUrl.replaceFirst(RegExp('^http'), 'ws')}/api/hubs/qpro';
}
