namespace RestaurantApi.Models
{
    public enum EstadoDetalle
    {
        Pendiente,
        EnPreparacion,
        Listo
    }

    public class PedidoDetalle
    {
        public int Id { get; set; }
        public int PedidoId { get; set; }
        public int PlatilloId { get; set; }
        public int Cantidad { get; set; }
        public string? Nota { get; set; }  
        public EstadoDetalle Estado { get; set; }

        // Relaciones
        public Pedido? Pedido { get; set; }
        public Platillo? Platillo { get; set; }
    }
}