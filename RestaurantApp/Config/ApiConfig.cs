namespace RestaurantApp.Config
{
    public static class ApiConfig
    {
        // URL base fija, sin guardar nada en preferencias
        public static string BaseUrl => GetDefaultUrl();

        private static string GetDefaultUrl()
        {
#if DEBUG
            // 💡 Aquí defines tu endpoint ngrok o local
            return "https://705e32771f5f.ngrok-free.app/";
#else
            // 💡 Aquí defines el dominio real en producción
            return "https://mi-servidor-produccion.com/";
#endif
        }
    }
}
