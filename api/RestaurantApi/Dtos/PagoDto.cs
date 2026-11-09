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
    /// Cobro de la cuenta de una mesa en una sola factura. Qué se cobra: los pedidos completos de
    /// <see cref="PedidoIds"/> o, para dividir la cuenta por consumo, solo las <see cref="Lineas"/>
    /// (platos y cuántos de cada uno). Cómo se paga: uno o varios <see cref="Pagos"/> (pago mixto o
    /// partes iguales); sin ellos, un solo pago con <see cref="MetodoPago"/> por el total.
    /// </summary>
    public class CrearCobroDto
    {
        public List<int> PedidoIds { get; set; } = new();
        public List<LineaCobroDto> Lineas { get; set; } = new();
        public List<PagoCobroDto> Pagos { get; set; } = new();
        public string MetodoPago { get; set; } = "Efectivo";
        public decimal Propina { get; set; }
        /// <summary>Solo en efectivo y con un solo pago: lo que entregó el cliente, para calcular el cambio.</summary>
        public decimal? Recibido { get; set; }
        public string? NitCliente { get; set; }
        public string? NombreCliente { get; set; }
    }

    /// <summary>Un plato de la cuenta y cuántas unidades paga esta persona (1 de 2 cervezas, por ejemplo).</summary>
    public class LineaCobroDto
    {
        public int DetalleId { get; set; }
        public int Cantidad { get; set; }
    }

    /// <summary>Un pago de la cuenta. Con <see cref="AvisoId"/> es el que avisó el mesero y no se puede cambiar.</summary>
    public class PagoCobroDto
    {
        public string MetodoPago { get; set; } = "Efectivo";
        /// <summary>Lo que cubre este pago, propina incluida.</summary>
        public decimal Monto { get; set; }
        /// <summary>Solo en efectivo: billete que entregó el cliente.</summary>
        public decimal? Recibido { get; set; }
        public int? AvisoId { get; set; }
    }

    public class CobroDto
    {
        public FacturaDto Factura { get; set; } = null!;
        public decimal? Recibido { get; set; }
        public decimal Cambio { get; set; }
        /// <summary>La mesa no debe nada más: queda libre.</summary>
        public bool CuentaSaldada { get; set; }
        /// <summary>Lo que sigue pendiente en la mesa después de este cobro.</summary>
        public decimal Pendiente { get; set; }
    }
}
