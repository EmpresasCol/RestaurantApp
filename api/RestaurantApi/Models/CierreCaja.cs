namespace RestaurantApi.Models
{
    /// <summary>
    /// Caja de un día: la base con que se abrió y, al cerrar, el arqueo (lo contado frente a lo que
    /// dice el sistema). Lo calculado se guarda como foto del momento del cierre.
    /// </summary>
    public class CierreCaja
    {
        public int Id { get; set; }
        /// <summary>Día de calendario de Colombia (columna DATE).</summary>
        public DateTime FechaCaja { get; set; }
        public decimal Base { get; set; }
        public int? UsuarioAperturaId { get; set; }
        public DateTime? FechaApertura { get; set; }

        /// <summary>Propinas que se pagaron al equipo con efectivo del cajón.</summary>
        public decimal PropinasPagadas { get; set; }
        /// <summary>Gastos o retiros pagados con efectivo del cajón.</summary>
        public decimal Retiros { get; set; }

        public decimal? EfectivoEsperado { get; set; }
        public decimal? EfectivoContado { get; set; }
        /// <summary>Total del cierre del datáfono, para compararlo con las ventas con tarjeta.</summary>
        public decimal? TarjetaDatafono { get; set; }
        /// <summary>Lo que muestra la cuenta del banco o Nequi, para compararlo con las transferencias.</summary>
        public decimal? TransferenciasBanco { get; set; }
        public string? Observaciones { get; set; }
        public int? UsuarioCierreId { get; set; }
        public DateTime? FechaCierre { get; set; }
    }
}
