using System.Threading.Tasks;

namespace RestaurantApi.Services
{
    public class ResultadoInventarioDto
    {
        public bool Exitoso { get; set; }
        public string Mensaje { get; set; } = string.Empty;
        public int MovimientosGenerados { get; set; }
    }

    public interface IInventarioService
    {
        Task<ResultadoInventarioDto> DescontarStockPorPedidoAsync(int pedidoId);
        Task<ResultadoInventarioDto> RevertirStockPorPedidoAsync(int pedidoId);
        Task<ResultadoInventarioDto> DescontarStockPorDomicilioAsync(int domicilioId);
        Task<ResultadoInventarioDto> RevertirStockPorDomicilioAsync(int domicilioId);
        Task InicializarRecetasPredeterminadasAsync();
    }
}
