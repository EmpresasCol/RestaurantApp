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
                MesaId = dto.MesaId,  // ✅ AGREGAR MesaId
                FechaHora = dto.Fecha,
                NotasEspeciales = ""
            };

            if (Enum.TryParse<EstadoPedido>(dto.Estado, out var estadoEnum))
            {
                pedido.Estado = estadoEnum;
            }

            pedido.Mesa = new Mesa
            {
                Id = dto.MesaId,
                Numero = dto.MesaNumero > 0 ? dto.MesaNumero : dto.MesaId,
                Estado = EstadoMesa.Ocupada
            };

            // ✅ CONVERTIR DETALLES CON PRECIO CORRECTO
            if (dto.Detalles != null && dto.Detalles.Count > 0)
            {
                pedido.Items = dto.Detalles.Select(d => new ItemPedido
                {
                    Id = d.Id,
                    PedidoId = dto.Id,
                    PlatilloId = d.PlatilloId,
                    Platillo = new Platillo
                    {
                        Id = d.PlatilloId,
                        Nombre = d.PlatilloNombre ?? "Producto",
                        Precio = d.Precio  // ✅ USAR d.Precio en lugar de d.PrecioUnitario
                    },
                    Cantidad = d.Cantidad,
                    PrecioUnitario = d.Precio  // ✅ USAR d.Precio
                }).ToList();

                // ✅ CALCULAR SUBTOTALES DE CADA ITEM
                foreach (var item in pedido.Items)
                {
                    item.CalcularSubtotal();
                }

                // ✅ CALCULAR TOTAL DEL PEDIDO
                pedido.CalcularTotal();
            }

            pedido.ActualizarTiempoTranscurrido();

            // ✅ DEBUG: Imprimir total calculado
            System.Diagnostics.Debug.WriteLine($"[PEDIDO] ID: {pedido.Id}, Items: {pedido.Items.Count}, Total: ${pedido.Total}");

            return pedido;
        }
    }

    // ✅ DTOs ACTUALIZADOS
    public class PedidoDto
    {
        public int Id { get; set; }
        public int MesaId { get; set; }
        public int MesaNumero { get; set; }
        public MesaDto Mesa { get; set; }
        public int UsuarioId { get; set; }
        public string Estado { get; set; }
        public DateTime Fecha { get; set; }
        public List<PedidoDetalleDto> Detalles { get; set; }
    }

    public class PedidoDetalleDto
    {
        public int Id { get; set; }
        public int PlatilloId { get; set; }
        public string PlatilloNombre { get; set; }
        public int Cantidad { get; set; }
        public decimal Precio { get; set; }
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