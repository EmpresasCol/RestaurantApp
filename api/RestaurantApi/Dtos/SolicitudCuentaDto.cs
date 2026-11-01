namespace RestaurantApi.Dtos
{
    /// <summary>Solicitud de cuenta pendiente; la foto se pide aparte para no cargarla en cada lista.</summary>
    public class SolicitudCuentaDto
    {
        public int Id { get; set; }
        public int MesaId { get; set; }
        public int MesaNumero { get; set; }
        public string MeseroNombre { get; set; } = string.Empty;
        public DateTime Fecha { get; set; }
        public string? MetodoPago { get; set; }
        public DateTime? FechaPago { get; set; }
        public bool TieneComprobante { get; set; }
    }

    /// <summary>
    /// Pedir la cuenta (sin método) o avisar cómo pagó el cliente.
    /// Con QR (transferencia) la foto del comprobante es obligatoria.
    /// </summary>
    public class SolicitarCuentaDto
    {
        public int MesaId { get; set; }
        public string? MetodoPago { get; set; }
        public string? Comprobante { get; set; }
    }
}
