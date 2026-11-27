// api/RestaurantApi/Services/ImagenDataUri.cs
// Fotos que llegan como data URI (comprobantes de transferencia y evidencia de recepciones).
// Se valida el contenido real, no solo el prefijo: un "data:image/png" con un script o un SVG
// dentro se rechaza. Las fotos se guardan en la base y se devuelven como JSON; nunca se sirven
// como archivo ni se ejecutan.

namespace RestaurantApi.Services
{
    public static class ImagenDataUri
    {
        private static readonly Dictionary<string, string> Familias = new(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = "jpeg",
            ["image/jpg"] = "jpeg", // algunos Android lo reportan así
            ["image/png"] = "png",
            ["image/webp"] = "webp",
            ["image/heic"] = "heif", // cámara del iPhone
            ["image/heif"] = "heif",
        };

        /// <summary>
        /// true si es "data:&lt;tipo&gt;;base64,..." de una foto JPEG, PNG, WebP o HEIC cuyo contenido
        /// coincide con el tipo declarado y no supera <paramref name="largoMaximo"/> caracteres.
        /// </summary>
        public static bool EsFoto(string? dataUri, int largoMaximo)
        {
            if (string.IsNullOrEmpty(dataUri) || dataUri.Length > largoMaximo) return false;
            if (!dataUri.StartsWith("data:", StringComparison.Ordinal)) return false;

            var coma = dataUri.IndexOf(',');
            if (coma < 0) return false;
            var cabecera = dataUri.AsSpan(5, coma - 5);
            const string sufijo = ";base64";
            if (!cabecera.EndsWith(sufijo, StringComparison.OrdinalIgnoreCase)) return false;
            if (!Familias.TryGetValue(cabecera[..^sufijo.Length].ToString(), out var familia)) return false;

            var datos = dataUri.AsSpan(coma + 1);
            var bytes = new byte[datos.Length / 4 * 3 + 3];
            if (!Convert.TryFromBase64Chars(datos, bytes, out var leidos)) return false;

            return Detectar(bytes.AsSpan(0, leidos)) == familia;
        }

        private static string? Detectar(ReadOnlySpan<byte> b)
        {
            if (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return "jpeg";
            if (b.Length >= 8 && b[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return "png";
            if (b.Length < 12) return null;
            if (b[..4].SequenceEqual("RIFF"u8) && b[8..12].SequenceEqual("WEBP"u8)) return "webp";
            // ISO BMFF: caja "ftyp" en el byte 4 con una marca HEIF (heic, heix, mif1, msf1...).
            if (b[4..8].SequenceEqual("ftyp"u8))
            {
                var marca = System.Text.Encoding.ASCII.GetString(b[8..12]);
                if (marca is "heic" or "heix" or "hevc" or "hevx" or "heim" or "heis" or "mif1" or "msf1") return "heif";
            }
            return null;
        }
    }
}
