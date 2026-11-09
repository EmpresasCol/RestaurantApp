namespace RestaurantApi.Models
{
    public class Factura
    {
        public int Id { get; set; }
        /// <summary>Primer pago de la cuenta de mesa; null en la factura de un domicilio.</summary>
        public int? PagoId { get; set; }
        /// <summary>Domicilio que cubre esta factura (se emite al entregarlo y cobrarlo).</summary>
        public int? DomicilioId { get; set; }
        public string NumeroFactura { get; set; } = null!;
        public string? NitCliente { get; set; }
        public string? NombreCliente { get; set; }
        public decimal Subtotal { get; set; }
        public decimal Propina { get; set; } = 0;
        public decimal Total { get; set; }
        public string? ArchivoUrl { get; set; }
        public DateTime FechaEmision { get; set; } = DateTime.UtcNow;

        // Relación
        public Pago? Pago { get; set; }
    }
}