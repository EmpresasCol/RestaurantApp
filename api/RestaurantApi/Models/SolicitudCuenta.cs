namespace RestaurantApi.Models
{
    /// <summary>
    /// El mesero pide la cuenta de una mesa (la caja la imprime) y después avisa cómo pagó
    /// el cliente: efectivo que lleva a caja, tarjeta en el datáfono o transferencia al QR
    /// del negocio con la foto como comprobante. La caja hace el cobro real y la cierra.
    /// </summary>
    public class SolicitudCuenta
    {
        public const string Pendiente = "Pendiente";
        public const string Cobrada = "Cobrada";
        public const string Anulada = "Anulada";

        public int Id { get; set; }
        public int MesaId { get; set; }
        public int UsuarioId { get; set; }
        public DateTime Fecha { get; set; } = DateTime.UtcNow;

        /// <summary>Nombre de <see cref="Models.MetodoPago"/>; null mientras el cliente no ha pagado.</summary>
        public string? MetodoPago { get; set; }
        /// <summary>Foto de la transferencia como data URI (image/jpeg). Versión anterior: hoy va en <see cref="PagoAvisado"/>.</summary>
        public string? Comprobante { get; set; }
        public DateTime? FechaPago { get; set; }
        /// <summary>Propina que avisó el mesero junto con los pagos.</summary>
        public decimal? Propina { get; set; }

        public string Estado { get; set; } = Pendiente;
        public int? FacturaId { get; set; }

        public Mesa? Mesa { get; set; }
        public Usuario? Usuario { get; set; }
        public List<PagoAvisado> Pagos { get; set; } = new();
    }

    /// <summary>
    /// Un pago que avisó el mesero: la mesa puede pagar con varios (parte en efectivo, parte con
    /// tarjeta, una transferencia por persona). Cada transferencia trae la foto del comprobante.
    /// </summary>
    public class PagoAvisado
    {
        public int Id { get; set; }
        public int SolicitudId { get; set; }
        /// <summary>Nombre de <see cref="Models.MetodoPago"/>: Efectivo, Tarjeta o QR.</summary>
        public string MetodoPago { get; set; } = string.Empty;
        public decimal Monto { get; set; }
        public string? Comprobante { get; set; }
        public DateTime Fecha { get; set; } = DateTime.UtcNow;
        /// <summary>Factura en que la caja usó este pago; null mientras no se ha cobrado.</summary>
        public int? FacturaId { get; set; }

        public SolicitudCuenta? Solicitud { get; set; }
    }
}
