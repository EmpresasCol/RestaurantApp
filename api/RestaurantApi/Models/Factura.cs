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

        /// <summary>Tipo de identificación de quien pidió factura a su nombre: CC, NIT, CE, PA, TI.</summary>
        public string? TipoIdCliente { get; set; }
        public string? CorreoCliente { get; set; }

        // Impuesto discriminado al emitir (el precio de la carta ya lo incluye; la propina queda fuera).
        public string? NombreImpuesto { get; set; }
        public decimal? TarifaImpuesto { get; set; }
        public decimal? BaseImpuesto { get; set; }
        public decimal? ValorImpuesto { get; set; }

        public bool Anulada { get; set; }
        public DateTime? FechaAnulacion { get; set; }
        public string? MotivoAnulacion { get; set; }
        public int? UsuarioAnulaId { get; set; }
        /// <summary>Factura anulada a la que esta reemplaza (se corrigieron los datos del cliente).</summary>
        public int? ReemplazaAId { get; set; }

        // Relación
        public Pago? Pago { get; set; }
    }
}