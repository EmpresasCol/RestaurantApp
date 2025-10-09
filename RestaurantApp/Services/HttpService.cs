// RestaurantApp/Services/HttpService.cs
using System.Net.Http.Json;
using System.Text.Json;
using System.Text;
using RestaurantApp.Config;

namespace RestaurantApp.Services
{
    public class HttpService
    {
        private readonly HttpClient _httpClient;
        private readonly JsonSerializerOptions _jsonOptions;

        public HttpService()
        {
            var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (message, cert, chain, errors) => true
            };

            _httpClient = new HttpClient(handler)
            {
                Timeout = TimeSpan.FromSeconds(30)
            };

            // NO usar BaseAddress, construir URLs completas
            _jsonOptions = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            System.Diagnostics.Debug.WriteLine($"[HttpService] Inicializado con BaseUrl: {ApiConfig.BaseUrl}");
        }

        public async Task<T> GetAsync<T>(string endpoint)
        {
            try
            {
                // Construir URL completa
                var url = $"{ApiConfig.BaseUrl}{endpoint}";
                System.Diagnostics.Debug.WriteLine($"[GET] URL COMPLETA: {url}");

                var response = await _httpClient.GetAsync(url);

                System.Diagnostics.Debug.WriteLine($"[GET] StatusCode: {response.StatusCode}");
                System.Diagnostics.Debug.WriteLine($"[GET] IsSuccessStatusCode: {response.IsSuccessStatusCode}");

                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                System.Diagnostics.Debug.WriteLine($"[GET] Response recibida");

                return JsonSerializer.Deserialize<T>(json, _jsonOptions);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[GET] ERROR: {ex.Message}");
                throw;
            }
        }

        public async Task<T> PostAsync<T>(string endpoint, object data)
        {
            try
            {
                // Construir URL completa
                var url = $"{ApiConfig.BaseUrl}{endpoint}";
                System.Diagnostics.Debug.WriteLine($"[POST] URL COMPLETA: {url}");

                var json = JsonSerializer.Serialize(data, _jsonOptions);
                System.Diagnostics.Debug.WriteLine($"[POST] Request JSON: {json.Substring(0, Math.Min(200, json.Length))}...");

                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync(url, content);

                System.Diagnostics.Debug.WriteLine($"[POST] StatusCode: {response.StatusCode}");

                var responseContent = await response.Content.ReadAsStringAsync();
                System.Diagnostics.Debug.WriteLine($"[POST] Response recibida");

                response.EnsureSuccessStatusCode();

                return JsonSerializer.Deserialize<T>(responseContent, _jsonOptions);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[POST] ERROR: {ex.Message}");
                throw;
            }
        }

        public async Task<T> PutAsync<T>(string endpoint, object data)
        {
            try
            {
                // Construir URL completa
                var url = $"{ApiConfig.BaseUrl}{endpoint}";
                System.Diagnostics.Debug.WriteLine($"[PUT] URL COMPLETA: {url}");

                var json = JsonSerializer.Serialize(data, _jsonOptions);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PutAsync(url, content);

                System.Diagnostics.Debug.WriteLine($"[PUT] StatusCode: {response.StatusCode}");

                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<T>(responseJson, _jsonOptions);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PUT] ERROR: {ex.Message}");
                throw;
            }
        }

        public async Task<bool> DeleteAsync(string endpoint)
        {
            try
            {
                // Construir URL completa
                var url = $"{ApiConfig.BaseUrl}{endpoint}";
                System.Diagnostics.Debug.WriteLine($"[DELETE] URL COMPLETA: {url}");

                var response = await _httpClient.DeleteAsync(url);

                System.Diagnostics.Debug.WriteLine($"[DELETE] StatusCode: {response.StatusCode}");

                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[DELETE] ERROR: {ex.Message}");
                return false;
            }
        }

        public async Task<bool> CheckConnectionAsync()
        {
            try
            {
                // Construir URL completa
                var url = $"{ApiConfig.BaseUrl}api/health";
                System.Diagnostics.Debug.WriteLine($"[CHECK] URL COMPLETA: {url}");

                var response = await _httpClient.GetAsync(url);

                System.Diagnostics.Debug.WriteLine($"[CHECK] StatusCode: {response.StatusCode}");
                System.Diagnostics.Debug.WriteLine($"[CHECK] Resultado: {(response.IsSuccessStatusCode ? "CONECTADO" : "NO CONECTADO")}");

                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[CHECK] ERROR: {ex.GetType().Name}");
                System.Diagnostics.Debug.WriteLine($"[CHECK] Message: {ex.Message}");
                return false;
            }
        }
    }
}