using RestaurantApp.Models;

namespace RestaurantApp.Services
{
    public class PagoService
    {
        private readonly HttpService _httpService;

        public PagoService()
        {
            _httpService = new HttpService();
        }

        public async Task<Pago> CrearPagoAsync(CrearPagoRequest request)
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"[PAGO] Creando pago para pedido {request.PedidoId}");
                System.Diagnostics.Debug.WriteLine($"[PAGO] Monto: ${request.Monto}, Propina: ${request.MontoPropina}, Método: {request.MetodoPago}");

                var response = await _httpService.PostAsync<Pago>("api/pagos", request);

                System.Diagnostics.Debug.WriteLine($"[PAGO] Pago creado con ID: {response.Id}");

                return response;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PAGO] Error: {ex.Message}");
                throw;
            }
        }
    }
}