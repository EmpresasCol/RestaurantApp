namespace RestaurantApi.Dtos
{
    /// <summary>
    /// Cuenta pedida por el mesero y, si ya pagó la mesa, cómo pagó (uno o varios pagos).
    /// Las fotos se piden aparte para no cargarlas en cada lista.
    /// </summary>
    public class SolicitudCuentaDto
    {
        public int Id { get; set; }
        public int MesaId { get; set; }
        public int MesaNumero { get; set; }
        public string MeseroNombre { get; set; } = string.Empty;
        public DateTime Fecha { get; set; }
        /// <summary>Resumen: el método si es uno solo, "Mixto" si son varios; null si solo pidió la cuenta.</summary>
        public string? MetodoPago { get; set; }
        public DateTime? FechaPago { get; set; }
        public bool TieneComprobante { get; set; }
        public decimal Propina { get; set; }
        /// <summary>Pagos avisados que la caja todavía no ha usado.</summary>
        public List<PagoAvisadoDto> Pagos { get; set; } = new();
        public decimal TotalAvisado { get; set; }
        /// <summary>Lo que debe la mesa ahora (sin propina).</summary>
        public decimal PorCobrar { get; set; }
        /// <summary>
        /// Los pagos avisados cubren exacto la cuenta más la propina: la mesa ya pagó y la caja
        /// solo confirma (no cambia valores, métodos ni propina).
        /// </summary>
        public bool Cuadra { get; set; }
    }

    public class PagoAvisadoDto
    {
        public int Id { get; set; }
        public string MetodoPago { get; set; } = string.Empty;
        public decimal Monto { get; set; }
        public bool TieneComprobante { get; set; }
    }

    /// <summary>
    /// Pedir la cuenta (sin pagos) o avisar cómo pagó la mesa. Cada aviso reemplaza el anterior.
    /// Una transferencia (QR) necesita la foto de su comprobante.
    /// </summary>
    public class SolicitarCuentaDto
    {
        public int MesaId { get; set; }
        public decimal? Propina { get; set; }
        public List<AvisarPagoDto>? Pagos { get; set; }
        /// <summary>Versión anterior de la app: un solo método por toda la cuenta.</summary>
        public string? MetodoPago { get; set; }
        public string? Comprobante { get; set; }
    }

    public class AvisarPagoDto
    {
        public string MetodoPago { get; set; } = string.Empty;
        public decimal Monto { get; set; }
        public string? Comprobante { get; set; }
    }
}
