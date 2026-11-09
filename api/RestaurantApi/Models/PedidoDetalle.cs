namespace RestaurantApi.Models
{
    public enum EstadoDetalle
    {
        Pendiente,
        EnPreparacion,
        Listo,
        Cancelado   // existe en el ENUM de la BD
    }

    public class PedidoDetalle
    {
        public int Id { get; set; }
        public int PedidoId { get; set; }
        public int PlatilloId { get; set; }
        public int Cantidad { get; set; }
        public string? Nota { get; set; }  
        public EstadoDetalle Estado { get; set; }
        /// <summary>Precio de la carta cuando se pidió el plato; lo fija el contexto al guardar.</summary>
        public decimal? PrecioUnitario { get; set; }
        /// <summary>Factura en que se cobró el plato; null mientras sigue en la cuenta abierta.</summary>
        public int? FacturaId { get; set; }

        // Relaciones
        public Pedido? Pedido { get; set; }
        public Platillo? Platillo { get; set; }
    }
}