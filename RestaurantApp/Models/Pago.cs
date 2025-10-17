namespace RestaurantApp.Models
{
    public class Pago
    {
        public int Id { get; set; }
        public int PedidoId { get; set; }
        public decimal Monto { get; set; }
        public decimal MontoPropina { get; set; }
        public MetodoPago MetodoPago { get; set; }
        public DateTime Fecha { get; set; }
    }

    public class CrearPagoRequest
    {
        public int PedidoId { get; set; }
        public decimal Monto { get; set; }
        public decimal MontoPropina { get; set; }
        public string MetodoPago { get; set; } = "Efectivo";
    }
}