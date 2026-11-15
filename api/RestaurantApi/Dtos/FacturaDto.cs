namespace RestaurantApi.Dtos
{
    public class FacturaDto
    {
        public int Id { get; set; }
        public int? PagoId { get; set; }
        public int? DomicilioId { get; set; }
        public string NumeroFactura { get; set; } = string.Empty;
        public string? NitCliente { get; set; }
        public string? NombreCliente { get; set; }
        public decimal Subtotal { get; set; }
        public decimal Propina { get; set; }
        public decimal Total { get; set; }
        public string? ArchivoUrl { get; set; }
        public DateTime FechaEmision { get; set; }

        // Detalle para mostrar y reimprimir la factura.
        public int? MesaNumero { get; set; }
        public string MetodoPago { get; set; } = string.Empty;
        public List<int> PedidoIds { get; set; } = new();
        public List<FacturaItemDto> Items { get; set; } = new();
        /// <summary>Cómo se pagó: uno o varios pagos (propina incluida).</summary>
        public List<FacturaPagoDto> Pagos { get; set; } = new();
        /// <summary>Solo domicilios: cliente y dirección para la tirilla.</summary>
        public string? Domicilio { get; set; }

        public string? TipoIdCliente { get; set; }
        public string? CorreoCliente { get; set; }
        public string? NombreImpuesto { get; set; }
        public decimal? TarifaImpuesto { get; set; }
        public decimal? BaseImpuesto { get; set; }
        public decimal? ValorImpuesto { get; set; }
        public bool Anulada { get; set; }
        public string? MotivoAnulacion { get; set; }
        public int? ReemplazaAId { get; set; }
        /// <summary>Documentos electrónicos de la factura: el de venta y, si se anuló, su nota.</summary>
        public List<DocumentoElectronicoDto> Documentos { get; set; } = new();
    }

    public class DocumentoElectronicoDto
    {
        public int Id { get; set; }
        public string Tipo { get; set; } = string.Empty;
        public string Numero { get; set; } = string.Empty;
        /// <summary>Pendiente, Validado o Rechazado.</summary>
        public string Estado { get; set; } = string.Empty;
        /// <summary>Lleva varios intentos sin respuesta del proveedor: se sigue reintentando.</summary>
        public bool EnContingencia { get; set; }
        public string? Cufe { get; set; }
        public string? Mensaje { get; set; }
        public string? UrlPdf { get; set; }
        public string? QrUrl { get; set; }
        public DateTime? FechaValidacion { get; set; }
    }

    public class AnularFacturaDto
    {
        public string? Motivo { get; set; }
        /// <summary>Con datos: la venta sigue en pie y se emite otra factura a nombre de este cliente.</summary>
        public ClienteFacturaDto? NuevoCliente { get; set; }
    }

    public class ClienteFacturaDto
    {
        public string? TipoId { get; set; }
        public string? Nit { get; set; }
        public string? Nombre { get; set; }
        public string? Correo { get; set; }
    }

    public class FacturaPagoDto
    {
        public string MetodoPago { get; set; } = string.Empty;
        public decimal Monto { get; set; }
    }

    public class FacturaItemDto
    {
        public string Nombre { get; set; } = string.Empty;
        public int Cantidad { get; set; }
        public decimal PrecioUnitario { get; set; }
        public decimal Total { get; set; }
    }

    public class CrearFacturaDto
    {
        public int PagoId { get; set; }
        public string? NitCliente { get; set; }
        public string? NombreCliente { get; set; }
    }
}