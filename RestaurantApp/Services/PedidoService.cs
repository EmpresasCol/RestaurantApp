// RestaurantApp/Services/PedidoService.cs
using RestaurantApp.Models;

namespace RestaurantApp.Services
{
    public class PedidoService
    {
        private readonly HttpService _httpService;

        public PedidoService()
        {
            _httpService = new HttpService();
        }

        public async Task<List<Pedido>> ObtenerTodosAsync()
        {
            try
            {
                var pedidos = await _httpService.GetAsync<List<PedidoDto>>("api/Pedidos");
                return pedidos.Select(dto => ConvertirDtoAModelo(dto)).ToList();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error obteniendo pedidos: {ex.Message}");
                return new List<Pedido>();
            }
        }

        public async Task<Pedido> ObtenerPorIdAsync(int id)
        {
            var pedido = await _httpService.GetAsync<PedidoDto>($"api/Pedidos/{id}");
            return ConvertirDtoAModelo(pedido);
        }

        public async Task<Pedido> CrearPedidoAsync(CrearPedidoRequest request)
        {
            var pedido = await _httpService.PostAsync<PedidoDto>("api/Pedidos", request);
            return ConvertirDtoAModelo(pedido);
        }

        public async Task<Pedido> ActualizarEstadoAsync(int id, string estado)
        {
            var data = new { Estado = estado };
            var pedido = await _httpService.PutAsync<PedidoDto>($"api/Pedidos/{id}/estado", data);
            return ConvertirDtoAModelo(pedido);
        }

        public async Task<bool> CancelarPedidoAsync(int id)
        {
            return await _httpService.DeleteAsync($"api/Pedidos/{id}");
        }

        private Pedido ConvertirDtoAModelo(PedidoDto dto)
        {
            var pedido = new Pedido
            {
                Id = dto.Id,
                FechaHora = dto.Fecha,
                NotasEspeciales = ""
            };

            if (Enum.TryParse<EstadoPedido>(dto.Estado, out var estadoEnum))
            {
                pedido.Estado = estadoEnum;
            }

            if (dto.Mesa != null)
            {
                pedido.Mesa = new Mesa
                {
                    Id = dto.Mesa.Id,
                    Numero = dto.Mesa.Numero
                };
            }

            if (dto.Detalles != null)
            {
                pedido.Items = dto.Detalles.Select(d => new ItemPedido
                {
                    Id = d.Id,
                    PedidoId = dto.Id,
                    Platillo = new Platillo
                    {
                        Id = d.PlatilloId,
                        Nombre = d.PlatilloNombre ?? "Producto",
                        Precio = d.PrecioUnitario
                    },
                    Cantidad = d.Cantidad,
                    PrecioUnitario = d.PrecioUnitario,
                    AdicionesEspeciales = d.Nota
                }).ToList();

                pedido.CalcularTotal();
            }

            pedido.ActualizarTiempoTranscurrido();
            return pedido;
        }
    }

    public class PedidoDto
    {
        public int Id { get; set; }
        public int MesaId { get; set; }
        public MesaDto Mesa { get; set; }
        public int UsuarioId { get; set; }
        public string Estado { get; set; }
        public DateTime Fecha { get; set; }
        public List<PedidoDetalleDto> Detalles { get; set; }
    }

    public class PedidoDetalleDto
    {
        public int Id { get; set; }
        public int PedidoId { get; set; }
        public int PlatilloId { get; set; }
        public string PlatilloNombre { get; set; }
        public int Cantidad { get; set; }
        public decimal PrecioUnitario { get; set; }
        public string Nota { get; set; }
        public string Estado { get; set; }
    }

    public class CrearPedidoRequest
    {
        public int MesaId { get; set; }
        public int UsuarioId { get; set; }
        public List<CrearPedidoDetalleRequest> Detalles { get; set; }
    }

    public class CrearPedidoDetalleRequest
    {
        public int PlatilloId { get; set; }
        public int Cantidad { get; set; }
        public string Nota { get; set; }
    }
}