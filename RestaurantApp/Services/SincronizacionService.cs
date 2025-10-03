// RestaurantApp/Services/SincronizacionService.cs
namespace RestaurantApp.Services
{
    public class SincronizacionService
    {
        private readonly HttpService _httpService;
        private readonly PedidoService _pedidoService;
        private readonly MesaService _mesaService;

        public SincronizacionService()
        {
            _httpService = new HttpService();
            _pedidoService = new PedidoService();
            _mesaService = new MesaService();
        }

        public async Task<bool> SincronizarTodosLosDatosAsync()
        {
            try
            {
                // Verificar conexión
                var conectado = await _httpService.CheckConnectionAsync();
                if (!conectado)
                {
                    throw new Exception("No hay conexión con el servidor");
                }

                // Sincronizar pedidos pendientes locales (si los hay)
                await SincronizarPedidosPendientes();

                // Descargar datos actualizados
                await _pedidoService.ObtenerTodosAsync();
                await _mesaService.ObtenerTodasAsync();

                // Actualizar timestamp de última sincronización
                Preferences.Set("UltimaSincronizacion", DateTime.Now.ToString("o"));

                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error en sincronización: {ex.Message}");
                return false;
            }
        }

        private async Task SincronizarPedidosPendientes()
        {
            try
            {
                // Obtener pedidos pendientes guardados localmente
                var pedidosPendientes = ObtenerPedidosLocalesPendientes();

                foreach (var pedidoJson in pedidosPendientes)
                {
                    try
                    {
                        // Intentar enviar pedido pendiente
                        // Implementar según necesidad
                        await Task.Delay(100);
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"Error sincronizando pedido: {ex.Message}");
                    }
                }

                // Limpiar pedidos sincronizados
                LimpiarPedidosLocalesSincronizados();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error en sincronización de pedidos pendientes: {ex.Message}");
            }
        }

        private List<string> ObtenerPedidosLocalesPendientes()
        {
            var pedidosPendientesJson = Preferences.Get("PedidosPendientes", "[]");
            try
            {
                return System.Text.Json.JsonSerializer.Deserialize<List<string>>(pedidosPendientesJson)
                    ?? new List<string>();
            }
            catch
            {
                return new List<string>();
            }
        }

        private void LimpiarPedidosLocalesSincronizados()
        {
            Preferences.Set("PedidosPendientes", "[]");
        }

        public async Task<bool> VerificarConexionAsync()
        {
            return await _httpService.CheckConnectionAsync();
        }

        public DateTime ObtenerUltimaSincronizacion()
        {
            var ultimaSincStr = Preferences.Get("UltimaSincronizacion", DateTime.MinValue.ToString("o"));
            if (DateTime.TryParse(ultimaSincStr, out var fecha))
            {
                return fecha;
            }
            return DateTime.MinValue;
        }
    }
}