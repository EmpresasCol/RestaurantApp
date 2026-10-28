class ApiConfig {
  // URL de la API por compilación: flutter run --dart-define=API_BASE_URL=https://mi-api.onrender.com
  // El valor por defecto es el túnel de desarrollo; no debe usarse en producción.
  static String baseUrl = const String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://pulingly-unpromising-gracie.ngrok-free.dev',
  );

  static void setBaseUrl(String url) {
    baseUrl = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }

  static String get apiUrl => '$baseUrl/api';
}
