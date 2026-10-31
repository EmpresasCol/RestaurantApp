namespace RestaurantApi.Dtos
{
    public class FacturaDto
    {
        public int Id { get; set; }
        public int PagoId { get; set; }
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