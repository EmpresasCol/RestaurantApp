class ApiConfig {
  static String baseUrl = 'https://pulingly-unpromising-gracie.ngrok-free.dev';
  
  static void setBaseUrl(String url) {
    baseUrl = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }
  
  static String get apiUrl => '$baseUrl/api';
}