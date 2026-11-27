// api/RestaurantApi/Services/IntentosLogin.cs
// Bloqueo temporal por cuenta tras varias claves erradas. El cupo por IP del login no basta:
// quien prueba claves desde muchas IP no lo agota, pero sí choca con este tope por usuario.
using Microsoft.Extensions.Caching.Memory;

namespace RestaurantApi.Services
{
    public class IntentosLogin
    {
        /// <summary>Claves erradas que admite una cuenta antes del bloqueo.</summary>
        public const int MaximoFallos = 5;
        /// <summary>Ventana que cuenta desde el primer fallo; al vencer, la cuenta vuelve a entrar.</summary>
        public static readonly TimeSpan Bloqueo = TimeSpan.FromMinutes(15);

        public const string MensajeBloqueo = "Demasiados intentos fallidos con este usuario. Espera 15 minutos o pide al administrador que revise la clave.";

        // shortcut: en memoria del proceso (una sola instancia de la API); con varias instancias, pasar a la base o a Redis.
        private readonly MemoryCache _fallos = new(new MemoryCacheOptions());
        private sealed class Contador { public int Cuenta; }

        private static string Llave(string? usuario) => (usuario ?? "").Trim().ToLowerInvariant();

        public bool EstaBloqueado(string? usuario)
            => _fallos.TryGetValue(Llave(usuario), out Contador? c) && c!.Cuenta >= MaximoFallos;

        /// <summary>Suma un fallo y devuelve cuántos lleva la cuenta en la ventana.</summary>
        public int RegistrarFallo(string? usuario)
        {
            var c = _fallos.GetOrCreate(Llave(usuario), e =>
            {
                e.AbsoluteExpirationRelativeToNow = Bloqueo; // no se renueva con cada intento
                return new Contador();
            })!;
            return Interlocked.Increment(ref c.Cuenta);
        }

        public void Limpiar(string? usuario) => _fallos.Remove(Llave(usuario));
    }

    /// <summary>
    /// Usuarios técnicos que solo firman pedidos anónimos (FK obligatoria). Nunca inician sesión,
    /// aunque la base los traiga con una clave conocida de la semilla.
    /// </summary>
    public static class UsuariosSistema
    {
        public const string ClienteQR = "cliente_qr";
        public const string ClientePublico = "cliente_publico";

        public static bool Es(string? nombreUsuario)
            => string.Equals(nombreUsuario?.Trim(), ClienteQR, StringComparison.OrdinalIgnoreCase)
            || string.Equals(nombreUsuario?.Trim(), ClientePublico, StringComparison.OrdinalIgnoreCase);

        /// <summary>Hash de una clave aleatoria que nadie conoce.</summary>
        public static string ClaveInutilizable() => ClaveHasher.Hash(Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"));
    }
}
