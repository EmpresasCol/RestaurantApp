namespace RestaurantApi.Models
{
    public class Factura
    {
        public int Id { get; set; }
        public int PagoId { get; set; }
        public string NumeroFactura { get; set; } = null!;
        public string? NitCliente { get; set; }
        public string? NombreCliente { get; set; }
        public decimal Subtotal { get; set; }
        public decimal Propina { get; set; } = 0;
        public decimal Total { get; set; }
        public string? ArchivoUrl { get; set; }
        public DateTime FechaEmision { get; set; } = DateTime.Now;

        // Relación
        public Pago? Pago { get; set; }
    }
}