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

        /// <summary>Porciones que alcanzan para cada platillo; null = sin control de inventario.</summary>
        Task<Dictionary<int, int?>> PorcionesDisponiblesAsync();
        /// <summary>Mensaje de error si no hay insumos para las líneas; null si alcanza.</summary>
        Task<string?> VerificarStockPedidoAsync(int pedidoId, IEnumerable<(int PlatilloId, int Cantidad)> lineas);
        Task<string?> VerificarStockDomicilioAsync(int domicilioId, IEnumerable<(int PlatilloId, int Cantidad)> lineas);
    }
}
