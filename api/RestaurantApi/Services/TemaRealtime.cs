namespace RestaurantApi.Services
{
    /// <summary>
    /// Traduce la ruta de una petición que modificó datos al tema que se avisa por SignalR.
    /// Los clientes vuelven a pedir por REST lo que corresponda a ese tema.
    /// </summary>
    public static class TemaRealtime
    {
        public const string Pedidos = "pedidos";
        public const string Mesas = "mesas";
        public const string Domicilios = "domicilios";

        public static string? Desde(string? path)
        {
            if (string.IsNullOrEmpty(path)) return null;

            var segmentos = path.ToLowerInvariant().Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segmentos.Length < 2 || segmentos[0] != "api" || segmentos.Contains("login")) return null;

            // api/admin/domiciliarios y api/publico/domicilios: el recurso va en el segundo segmento.
            var recurso = segmentos[1] is "admin" or "publico" && segmentos.Length > 2 ? segmentos[2] : segmentos[1];

            return recurso switch
            {
                "pedidos" or "pedidodetalles" or "pagos" or "facturas" => Pedidos,
                "mesas" => Mesas,
                "domicilios" or "domiciliarios" => Domicilios,
                _ => null
            };
        }
    }
}
