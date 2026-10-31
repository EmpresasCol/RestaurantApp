namespace RestaurantApi.Dtos
{
    public class PagoDto
    {
        public int Id { get; set; }
        public int PedidoId { get; set; }
        public decimal Monto { get; set; }
        public decimal MontoPropina { get; set; }
        public string MetodoPago { get; set; } = string.Empty;
        public DateTime Fecha { get; set; }
    }

    public class CrearPagoDto
    {
        public int PedidoId { get; set; }
        public decimal Monto { get; set; }
        public decimal MontoPropina { get; set; } = 0;
        public string MetodoPago { get; set; } = "Efectivo";
    }

    /// <summary>
    /// Cobro de la cuenta de una mesa: uno o varios pedidos abiertos de esa mesa en una sola
    /// factura. Elegir solo algunos pedidos sirve para dividir la cuenta.
    /// </summary>
    public class CrearCobroDto
    {
        public List<int> PedidoIds { get; set; } = new();
        public string MetodoPago { get; set; } = "Efectivo";
        public decimal Propina { get; set; }
        /// <summary>Solo en efectivo: lo que entregó el cliente, para calcular el cambio.</summary>
        public decimal? Recibido { get; set; }
        public string? NitCliente { get; set; }
        public string? NombreCliente { get; set; }
    }

    public class CobroDto
    {
        public FacturaDto Factura { get; set; } = null!;
        public decimal? Recibido { get; set; }
        public decimal Cambio { get; set; }
    }
}