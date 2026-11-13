using System.Net;
using RestaurantApi.Controllers;

namespace RestaurantApi.Services
{
    /// <summary>
    /// Clave del límite de peticiones. Detrás de un proxy (Render) todas las conexiones llegan con
    /// la IP del proxy: sin esto el cupo de login o del QR sería uno solo para todo el mundo.
    /// No se usa X-Forwarded-For: Render conserva lo que manda el cliente y se podría falsificar.
    /// La cabecera de IP (Proxy:CabeceraIp) la pone el proxy y reemplaza la del cliente
    /// (en Render, Cloudflare con CF-Connecting-IP).
    /// </summary>
    public static class CupoPeticiones
    {
        public const string CabeceraRender = "CF-Connecting-IP";

        /// <summary>Cabecera con la IP real según la configuración; en Render, la de Cloudflare.</summary>
        public static string? CabeceraIp(IConfiguration config)
        {
            var configurada = config["Proxy:CabeceraIp"];
            if (!string.IsNullOrWhiteSpace(configurada)) return configurada.Trim();
            return string.IsNullOrEmpty(config["RENDER"]) ? null : CabeceraRender;
        }

        public static string Ip(HttpContext ctx, string? cabecera)
        {
            if (cabecera != null && IPAddress.TryParse(ctx.Request.Headers[cabecera].ToString().Trim(), out var real))
                return real.ToString();
            return ctx.Connection.RemoteIpAddress?.ToString() ?? "anon";
        }

        /// <summary>
        /// Comensal del QR: el cupo es por mesa (cabecera X-Mesa, ?mesa= del hub o el código de la
        /// ruta), así una mesa no agota el de las demás aunque todas salgan por la IP del local.
        /// </summary>
        public static string PorMesa(HttpContext ctx, string? cabecera)
        {
            var mesa = ctx.Request.Headers[ClienteMesaController.CabeceraMesa].ToString();
            if (mesa.Length == 0) mesa = ctx.Request.Query["mesa"].ToString();
            if (mesa.Length == 0) mesa = ctx.Request.RouteValues["codigo"]?.ToString() ?? string.Empty;
            return mesa.Length is >= 8 and <= 64 ? "m:" + mesa : "ip:" + Ip(ctx, cabecera);
        }
    }
}
