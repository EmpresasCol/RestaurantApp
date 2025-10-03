namespace RestaurantApp.Services
{
    public static class ApiConfig
    {
        // URL base de la API - se puede cambiar desde Configuración
        public static string BaseUrl
        {
            get => Preferences.Get("UrlServidor", "https://localhost:7137");
            set => Preferences.Set("UrlServidor", value);
        }

        // Endpoints de la API
        public static class Endpoints
        {
            public static string Usuarios => $"{BaseUrl}/api/usuarios";
            public static string Mesas => $"{BaseUrl}/api/mesas";
            public static string Platillos => $"{BaseUrl}/api/platillos";
            public static string Pedidos => $"{BaseUrl}/api/pedidos";
            public static string PedidoDetalles => $"{BaseUrl}/api/pedidodetalles";
            public static string Pagos => $"{BaseUrl}/api/pagos";
            public static string Facturas => $"{BaseUrl}/api/facturas";
            public static string Health => $"{BaseUrl}/api/health";
        }

        // Timeout para las peticiones
        public static TimeSpan RequestTimeout => TimeSpan.FromSeconds(30);
    }
}