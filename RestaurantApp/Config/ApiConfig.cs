namespace RestaurantApp.Config
{
    public static class ApiConfig
    {
        private static string _baseUrl;

        public static string BaseUrl
        {
            get
            {
                // Si ya hay una URL guardada, usarla
                if (!string.IsNullOrEmpty(_baseUrl))
                    return _baseUrl;

                // Intentar cargar desde Preferences
                var savedUrl = Preferences.Get("ApiBaseUrl", string.Empty);
                if (!string.IsNullOrEmpty(savedUrl))
                {
                    _baseUrl = savedUrl;
                    return _baseUrl;
                }

                _baseUrl = GetDefaultUrl();
                return _baseUrl;
            }
            set
            {
                _baseUrl = value?.TrimEnd('/') + "/";
                Preferences.Set("ApiBaseUrl", _baseUrl);
            }
        }

        private static string GetDefaultUrl()
        {
#if DEBUG

            return "https://a8e95eb8cec7.ngrok-free.app/";

            // NOTA: Si ngrok no está disponible, detectar automáticamente:
            /*
            bool isEmulator = DeviceInfo.DeviceType == DeviceType.Virtual;
            
            if (isEmulator)
            {
                System.Diagnostics.Debug.WriteLine("[ApiConfig] 🖥️ EMULADOR detectado - usando 10.0.2.2");
                return "http://10.0.2.2:5176/";
            }
            else
            {
                System.Diagnostics.Debug.WriteLine("[ApiConfig] 📱 DISPOSITIVO FÍSICO detectado - usando ngrok");
                return "https://a8e95eb8cec7.ngrok-free.app/";
            }
            */
#else
            // Para producción, usar URL de servidor real
            return "https://tu-api-produccion.com/";
#endif
        }

        /// <summary>
        /// Resetea la URL a la configuración por defecto
        /// </summary>
        public static void ResetToDefault()
        {
            _baseUrl = GetDefaultUrl();
            Preferences.Set("ApiBaseUrl", _baseUrl);
        }

        /// <summary>
        /// Verifica si la URL actual es la por defecto
        /// </summary>
        public static bool IsDefaultUrl()
        {
            return BaseUrl == GetDefaultUrl();
        }
    }
}