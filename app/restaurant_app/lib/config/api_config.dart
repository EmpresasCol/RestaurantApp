class ApiConfig {
  static String baseUrl = 'https://21ef6a54f660.ngrok-free.app';
  
  static void setBaseUrl(String url) {
    baseUrl = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }
  
  static String get apiUrl => '$baseUrl/api';
}