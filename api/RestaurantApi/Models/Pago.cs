namespace RestaurantApi.Models
{
    public enum MetodoPago
    {
        Efectivo,
        Tarjeta,
        QR,
        Otro
    }

    public class Pago
    {
        public int Id { get; set; }
        public int PedidoId { get; set; }
        public decimal Monto { get; set; }
        public MetodoPago MetodoPago { get; set; }
        public DateTime Fecha { get; set; }

        // Relación
        public Pedido? Pedido { get; set; }
    }
}
