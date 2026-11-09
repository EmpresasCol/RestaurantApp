namespace RestaurantApi.Services
{
    /// <summary>
    /// La API guarda y responde fechas en UTC. Los cortes "de hoy / semana / mes"
    /// se calculan en la hora de Colombia (UTC-5, sin horario de verano).
    /// </summary>
    public static class HoraLocal
    {
        public static readonly TimeSpan OffsetColombia = TimeSpan.FromHours(-5);

        public static DateTime AhoraColombia() => DateTime.UtcNow + OffsetColombia;

        /// <summary>Convierte una fecha "de calendario" de Colombia a su instante UTC.</summary>
        public static DateTime AUtc(DateTime fechaColombia)
            => DateTime.SpecifyKind(fechaColombia - OffsetColombia, DateTimeKind.Utc);

        public static DateTime InicioDeHoyUtc() => AUtc(AhoraColombia().Date);
    }
}
