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
        /// <summary>Foto de la transferencia como data URI (image/jpeg).</summary>
        public string? Comprobante { get; set; }
        public DateTime? FechaPago { get; set; }

        public string Estado { get; set; } = Pendiente;
        public int? FacturaId { get; set; }

        public Mesa? Mesa { get; set; }
        public Usuario? Usuario { get; set; }
    }
}
