using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace RestaurantApi.Services
{
    /// <summary>Claves VAPID (Push:ClavePublica y Push:ClavePrivada en base64url). Sin ellas no hay Web Push.</summary>
    public class PushOptions
    {
        public string ClavePublica { get; set; } = string.Empty;
        public string ClavePrivada { get; set; } = string.Empty;
        /// <summary>Contacto que exige VAPID (mailto: o https:) para que el servicio de push avise de problemas.</summary>
        public string Contacto { get; set; } = "mailto:soporte@qpro.app";
    }

    /// <summary>
    /// Web Push sin contenido (RFC 8030 + VAPID, RFC 8292): el aviso solo despierta al navegador
    /// y el service worker pide el estado actual a la API. Así no viajan datos del pedido por el
    /// servicio de push y un aviso viejo o repetido nunca muestra un estado atrasado.
    /// </summary>
    public class PushWeb
    {
        public enum Resultado { Enviado, Caducada, Fallo }

        // El endpoint lo entrega el navegador del comensal: solo se llama a servicios de push conocidos.
        private static readonly string[] ServiciosPermitidos =
        {
            "fcm.googleapis.com", "updates.push.services.mozilla.com", ".push.apple.com", ".notify.windows.com"
        };

        private readonly PushOptions _opciones;
        private readonly HttpClient _http;
        private readonly ILogger<PushWeb> _logger;

        public PushWeb(PushOptions opciones, HttpClient http, ILogger<PushWeb> logger)
        {
            _opciones = opciones;
            _http = http;
            _logger = logger;
        }

        public bool Configurado => _opciones.ClavePublica.Length > 0 && _opciones.ClavePrivada.Length > 0;

        public string ClavePublica => _opciones.ClavePublica;

        public static bool EndpointValido(string? endpoint)
        {
            if (string.IsNullOrWhiteSpace(endpoint) || endpoint.Length > 1000) return false;
            if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) return false;
            return ServiciosPermitidos.Any(s => s[0] == '.' ? uri.Host.EndsWith(s, StringComparison.OrdinalIgnoreCase) : uri.Host.Equals(s, StringComparison.OrdinalIgnoreCase));
        }

        public static string Huella(string endpoint)
            => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(endpoint))).ToLowerInvariant();

        /// <summary>Cabecera Authorization de VAPID: un JWT ES256 firmado con la clave privada, válido 12 horas.</summary>
        public string Autorizacion(Uri endpoint, DateTime ahora)
        {
            var publica = DeBase64Url(_opciones.ClavePublica);
            using var ecdsa = ECDsa.Create(new ECParameters
            {
                Curve = ECCurve.NamedCurves.nistP256,
                D = DeBase64Url(_opciones.ClavePrivada),
                Q = new ECPoint { X = publica[1..33], Y = publica[33..65] }
            });

            var cabecera = ABase64Url(Encoding.UTF8.GetBytes("{\"typ\":\"JWT\",\"alg\":\"ES256\"}"));
            var datos = ABase64Url(JsonSerializer.SerializeToUtf8Bytes(new
            {
                aud = $"{endpoint.Scheme}://{endpoint.Authority}",
                exp = new DateTimeOffset(ahora.AddHours(12)).ToUnixTimeSeconds(),
                sub = _opciones.Contacto
            }));
            var firma = ecdsa.SignData(Encoding.ASCII.GetBytes($"{cabecera}.{datos}"), HashAlgorithmName.SHA256,
                DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
            return $"vapid t={cabecera}.{datos}.{ABase64Url(firma)}, k={_opciones.ClavePublica}";
        }

        /// <summary>Envía el aviso. Caducada = el navegador ya no tiene esa suscripción (404/410): hay que borrarla.</summary>
        public async Task<Resultado> EnviarAsync(string endpoint)
        {
            if (!Configurado || !EndpointValido(endpoint)) return Resultado.Caducada;
            try
            {
                var uri = new Uri(endpoint);
                using var peticion = new HttpRequestMessage(HttpMethod.Post, uri) { Content = new ByteArrayContent(Array.Empty<byte>()) };
                peticion.Headers.TryAddWithoutValidation("Authorization", Autorizacion(uri, DateTime.UtcNow));
                // Si el teléfono está apagado más de una hora el aviso se descarta: al abrir la página se lee el estado real.
                peticion.Headers.TryAddWithoutValidation("TTL", "3600");
                peticion.Headers.TryAddWithoutValidation("Urgency", "high");

                using var respuesta = await _http.SendAsync(peticion);
                if (respuesta.IsSuccessStatusCode) return Resultado.Enviado;
                if ((int)respuesta.StatusCode is 404 or 410) return Resultado.Caducada;
                _logger.LogWarning("Web Push rechazado por {Host}: {Codigo}", uri.Host, (int)respuesta.StatusCode);
                return Resultado.Fallo;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo enviar el Web Push");
                return Resultado.Fallo;
            }
        }

        public static string ABase64Url(byte[] datos)
            => Convert.ToBase64String(datos).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        public static byte[] DeBase64Url(string texto)
        {
            var b64 = texto.Replace('-', '+').Replace('_', '/');
            return Convert.FromBase64String(b64.PadRight(b64.Length + (4 - b64.Length % 4) % 4, '='));
        }
    }
}
