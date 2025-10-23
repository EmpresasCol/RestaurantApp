// RestaurantApp/Services/PedidoRequests.cs
namespace RestaurantApp.Services
{
    public class CrearPedidoRequest
    {
        public int MesaId { get; set; }
        public int UsuarioId { get; set; }
        public List<CrearPedidoDetalleRequest> Detalles { get; set; } = new();
    }

    public class CrearPedidoDetalleRequest
    {
        public int PlatilloId { get; set; }
        public int Cantidad { get; set; }
        public string? Nota { get; set; }
    }
}