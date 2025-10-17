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

        public async Task<PagoDto> CrearPagoAsync(int pedidoId, decimal monto, string metodoPago, decimal montoPropina = 0)
        {
            try
            {
                // Capitalizar la primera letra del método de pago
                var metodoPagoCapitalizado = char.ToUpper(metodoPago[0]) + metodoPago.Substring(1).ToLower();

                var crearPagoDto = new CrearPagoDto
                {
                    PedidoId = pedidoId,
                    Monto = monto,
                    MontoPropina = montoPropina,
                    MetodoPago = metodoPagoCapitalizado
                };

                var pago = await _httpService.PostAsync<PagoDto>("api/pagos", crearPagoDto);
                return pago;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error creando pago: {ex.Message}");
                throw;
            }
        }
    }

    public class PagoDto
    {
        public int Id { get; set; }
        public int PedidoId { get; set; }
        public decimal Monto { get; set; }
        public decimal MontoPropina { get; set; }
        public string MetodoPago { get; set; }
        public DateTime Fecha { get; set; }
    }

    public class CrearPagoDto
    {
        public int PedidoId { get; set; }
        public decimal Monto { get; set; }
        public decimal MontoPropina { get; set; }
        public string MetodoPago { get; set; }
    }
}