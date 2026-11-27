// api/RestaurantApi/Services/Personalizacion.cs
// Lectura y validación de la personalización del restaurante (ConfiguracionRestaurante).
using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;
using RestaurantApi.Models;

namespace RestaurantApi.Services
{
    public static class Personalizacion
    {
        /// <summary>El logo viaja como data URI: unos 300 kB de imagen como máximo.</summary>
        public const int LargoMaximoLogo = 400_000;
        /// <summary>Contraste mínimo del color de las acciones contra el blanco (WCAG AA, texto normal).</summary>
        public const double ContrasteMinimoAccion = 4.5;

        private static readonly Regex Hex = new("^#[0-9A-Fa-f]{6}$", RegexOptions.Compiled);

        /// <summary>
        /// La fila guardada o la de fábrica. Si la migración aún no se aplicó (tabla inexistente),
        /// también devuelve la de fábrica: pedir, cobrar y facturar no dependen de personalizar.
        /// </summary>
        public static async Task<ConfiguracionRestaurante> ObtenerAsync(RestauranteContext ctx)
        {
            try
            {
                return await ctx.ConfiguracionRestaurante.AsNoTracking().OrderBy(c => c.Id).FirstOrDefaultAsync()
                       ?? new ConfiguracionRestaurante();
            }
            catch (Exception ex) when (FaltaLaTabla(ex))
            {
                return new ConfiguracionRestaurante();
            }
        }

        /// <summary>La base aún no tiene la tabla (migración sin aplicar), directo o dentro de un error de EF.</summary>
        public static bool FaltaLaTabla(Exception ex)
            => (ex as MySqlException ?? ex.InnerException as MySqlException)?.ErrorCode == MySqlErrorCode.NoSuchTable;

        /// <summary>Contraste WCAG entre dos colores #RRGGBB (1 a 21).</summary>
        public static double Contraste(string a, string b)
        {
            var (la, lb) = (Luminancia(a), Luminancia(b));
            return (Math.Max(la, lb) + 0.05) / (Math.Min(la, lb) + 0.05);
        }

        private static double Luminancia(string hex)
        {
            double Canal(int i)
            {
                var c = int.Parse(hex.AsSpan(1 + i * 2, 2), NumberStyles.HexNumber) / 255.0;
                return c <= 0.03928 ? c / 12.92 : Math.Pow((c + 0.055) / 1.055, 2.4);
            }
            return 0.2126 * Canal(0) + 0.7152 * Canal(1) + 0.0722 * Canal(2);
        }

        private static string? Limpio(string? texto) => string.IsNullOrWhiteSpace(texto) ? null : texto.Trim();

        /// <summary>
        /// Normaliza lo que manda el administrador (recorta textos, colores en mayúscula, WhatsApp
        /// solo con números, Instagram sin @ ni enlace) y devuelve el primer error, o null si es válido.
        /// </summary>
        public static string? NormalizarYValidar(ConfiguracionRestaurante c)
        {
            c.Id = 1;
            c.Nombre = (c.Nombre ?? "").Trim();
            c.Eslogan = Limpio(c.Eslogan);
            c.MensajeBienvenida = Limpio(c.MensajeBienvenida);
            c.Horario = Limpio(c.Horario);
            c.PieFactura = Limpio(c.PieFactura);
            c.Logo = Limpio(c.Logo);
            c.Whatsapp = Limpio(new string((c.Whatsapp ?? "").Where(char.IsDigit).ToArray()));
            var ig = Limpio(c.Instagram);
            if (ig != null)
            {
                ig = Regex.Replace(ig, @"^(https?://)?(www\.)?instagram\.com/", "", RegexOptions.IgnoreCase).Trim('/', '@', ' ');
                ig = Limpio(ig);
            }
            c.Instagram = ig;

            if (c.Nombre.Length == 0) return "Escribe el nombre del restaurante";
            var largos = new[]
            {
                (c.Nombre, 60, "El nombre"), (c.Eslogan, 120, "El eslogan"), (c.MensajeBienvenida, 200, "El mensaje de bienvenida"),
                (c.Horario, 120, "El horario"), (c.PieFactura, 200, "El mensaje de la factura"), (c.Instagram, 60, "El usuario de Instagram")
            };
            foreach (var (texto, max, nombre) in largos)
                if (texto != null && texto.Length > max) return $"{nombre} admite hasta {max} caracteres";

            if (c.Whatsapp != null && c.Whatsapp.Length is < 7 or > 15)
                return "El WhatsApp lleva entre 7 y 15 números, con el indicativo si es de otro país";
            if (c.Instagram != null && !Regex.IsMatch(c.Instagram, @"^[A-Za-z0-9._]{1,30}$"))
                return "El usuario de Instagram solo lleva letras, números, puntos y guiones bajos";

            if (!Hex.IsMatch(c.ColorMarca ?? "") || !Hex.IsMatch(c.ColorAccion ?? ""))
                return "Los colores van en formato #RRGGBB";
            c.ColorMarca = c.ColorMarca!.ToUpperInvariant();
            c.ColorAccion = c.ColorAccion!.ToUpperInvariant();
            if (Contraste(c.ColorAccion, "#FFFFFF") < ContrasteMinimoAccion)
                return "El color de las acciones es muy claro: el texto blanco de los botones no se leería. Elige uno más oscuro";

            // HEIC no se ve en todos los navegadores: el logo va en un formato que todos pintan.
            if (c.Logo != null && (!ImagenDataUri.EsFoto(c.Logo, LargoMaximoLogo) || c.Logo.StartsWith("data:image/hei", StringComparison.OrdinalIgnoreCase)))
                return "El logo debe ser una imagen JPEG, PNG o WebP de menos de 300 kB";

            if (c.PropinaSugerida is < 0 or > 30) return "La propina sugerida va de 0 % a 30 %";
            if (c.CostoEnvio is < 0 or > 1_000_000) return "El costo del envío va de $0 a $1.000.000";
            if (c.MinutosAlerta is < 1 or > 180 || c.MinutosUrgente is < 1 or > 240)
                return "Los tiempos de cocina van de 1 a 240 minutos";
            if (c.MinutosUrgente <= c.MinutosAlerta)
                return "El tiempo de \"urgente\" debe ser mayor que el de \"demorado\"";
            return null;
        }
    }
}
