using System.Net.Http.Json;
using System.Text.Json;
using System.Text;

namespace RestaurantApp.Services
{
    public class HttpService
    {
        private readonly HttpClient _httpClient;
        private readonly JsonSerializerOptions _jsonOptions;

        public HttpService()
        {
            _httpClient = new HttpClient
            {
                Timeout = ApiConfig.RequestTimeout
            };

            _jsonOptions = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };
        }

        public async Task<T> GetAsync<T>(string url)
        {
            try
            {
                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<T>(json, _jsonOptions);
            }
            catch (HttpRequestException ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error GET: {ex.Message}");
                throw new Exception($"Error de conexión: {ex.Message}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error: {ex.Message}");
                throw;
            }
        }

        public async Task<T> PostAsync<T>(string url, object data)
        {
            try
            {
                var json = JsonSerializer.Serialize(data, _jsonOptions);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync(url, content);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<T>(responseJson, _jsonOptions);
            }
            catch (HttpRequestException ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error POST: {ex.Message}");
                throw new Exception($"Error de conexión: {ex.Message}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error: {ex.Message}");
                throw;
            }
        }

        public async Task<T> PutAsync<T>(string url, object data)
        {
            try
            {
                var json = JsonSerializer.Serialize(data, _jsonOptions);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PutAsync(url, content);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<T>(responseJson, _jsonOptions);
            }
            catch (HttpRequestException ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error PUT: {ex.Message}");
                throw new Exception($"Error de conexión: {ex.Message}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error: {ex.Message}");
                throw;
            }
        }

        public async Task<bool> DeleteAsync(string url)
        {
            try
            {
                var response = await _httpClient.DeleteAsync(url);
                return response.IsSuccessStatusCode;
            }
            catch (HttpRequestException ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error DELETE: {ex.Message}");
                throw new Exception($"Error de conexión: {ex.Message}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error: {ex.Message}");
                throw;
            }
        }

        public async Task<bool> CheckConnectionAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync(ApiConfig.Endpoints.Health);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }
    }
}