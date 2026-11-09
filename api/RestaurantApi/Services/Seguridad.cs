// api/RestaurantApi/Services/Seguridad.cs
// Hash de contraseñas (BCrypt) y emisión de JWT para los tres logins.
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using RestaurantApi.Models;

namespace RestaurantApi.Services
{
    public static class ClaveHasher
    {
        // Hash fijo para igualar el tiempo de respuesta cuando el usuario no existe.
        private static readonly string HashFicticio = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N"));

        public static string Hash(string clave) => BCrypt.Net.BCrypt.HashPassword(clave);

        public static bool EsHash(string? almacenada) => almacenada is not null && almacenada.StartsWith("$2");

        /// <summary>
        /// Verifica la clave contra un hash BCrypt. Las claves heredadas en texto plano
        /// (BD sembrada antes de la migración) se aceptan una vez y se marcan para re-hash.
        /// </summary>
        public static bool Verificar(string clave, string? almacenada, out bool requiereMigracion)
        {
            requiereMigracion = false;
            if (string.IsNullOrEmpty(almacenada))
            {
                BCrypt.Net.BCrypt.Verify(clave, HashFicticio);
                return false;
            }

            if (EsHash(almacenada))
            {
                try { return BCrypt.Net.BCrypt.Verify(clave, almacenada); }
                catch (BCrypt.Net.SaltParseException) { return false; }
            }

            var ok = CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(clave), Encoding.UTF8.GetBytes(almacenada));
            requiereMigracion = ok;
            return ok;
        }

        /// <summary>Consume el mismo tiempo que una verificación real (usuario inexistente).</summary>
        public static void VerificarFicticio(string clave) => BCrypt.Net.BCrypt.Verify(clave, HashFicticio);
    }

    public class JwtOptions
    {
        public string Key { get; set; } = string.Empty;
        public string Issuer { get; set; } = "Qpro";
        public string Audience { get; set; } = "Qpro";
        public int HorasValidez { get; set; } = 12;

        public SymmetricSecurityKey ClaveFirma() => new(Encoding.UTF8.GetBytes(Key));

        /// <summary>Clave aleatoria para cuando no se configura Jwt:Key (los tokens mueren al reiniciar).</summary>
        public static string ClaveAleatoria() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    }

    public static class QproClaims
    {
        public const string Id = "sub";
        public const string Usuario = "unique_name";
        public const string Rol = "role";

        public static int? IdUsuario(ClaimsPrincipal? user)
            => int.TryParse(user?.FindFirst(Id)?.Value, out var id) ? id : null;

        public static bool EsAdministrador(ClaimsPrincipal? user)
            => user?.IsInRole(nameof(RolUsuario.Administrador)) == true;
    }

    public class JwtTokenService
    {
        private readonly JwtOptions _opciones;

        public JwtTokenService(JwtOptions opciones)
        {
            if (string.IsNullOrEmpty(opciones.Key)) opciones.Key = JwtOptions.ClaveAleatoria();
            _opciones = opciones;
        }

        public string Crear(Usuario usuario)
        {
            var claims = new[]
            {
                new Claim(QproClaims.Id, usuario.Id.ToString()),
                new Claim(QproClaims.Usuario, usuario.NombreUsuario),
                new Claim(QproClaims.Rol, usuario.Rol.ToString()),
            };

            var token = new JwtSecurityToken(
                issuer: _opciones.Issuer,
                audience: _opciones.Audience,
                claims: claims,
                expires: DateTime.UtcNow.AddHours(_opciones.HorasValidez),
                signingCredentials: new SigningCredentials(_opciones.ClaveFirma(), SecurityAlgorithms.HmacSha256));

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
