// api/RestaurantApi/Services/Auditoria.cs
// Eventos de seguridad con EventId fijo: el proveedor de logs (Render, Better Stack, Grafana...)
// filtra por "Qpro.Auditoria" o por estos Id para guardar el rastro y disparar alertas.
namespace RestaurantApi.Services
{
    public static class Auditoria
    {
        public const string Categoria = "Qpro.Auditoria";

        public static readonly EventId LoginCorrecto = new(9001, nameof(LoginCorrecto));
        public static readonly EventId LoginFallido = new(9002, nameof(LoginFallido));
        public static readonly EventId CuentaBloqueada = new(9003, nameof(CuentaBloqueada));
        public static readonly EventId CambioDeUsuario = new(9010, nameof(CambioDeUsuario));
        public static readonly EventId EscrituraPersonal = new(9020, nameof(EscrituraPersonal));
        public static readonly EventId AccesoDenegado = new(9030, nameof(AccesoDenegado));
        public static readonly EventId ClavesEnTextoPlano = new(9040, nameof(ClavesEnTextoPlano));

        /// <summary>Texto del cliente apto para el log: sin saltos de línea ni controles, y corto.</summary>
        public static string Limpio(string? texto)
        {
            var limpio = new string((texto ?? "").Where(c => !char.IsControl(c)).ToArray()).Trim();
            return limpio.Length > 60 ? limpio[..60] + "…" : limpio;
        }
    }
}
