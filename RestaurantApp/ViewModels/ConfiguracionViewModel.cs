using RestaurantApp.Helpers;
using System.Windows.Input;
using RestaurantApp.Services;
using RestaurantApp.Config;

namespace RestaurantApp.ViewModels
{
    public class ConfiguracionViewModel : BaseViewModel
    {
        private readonly SincronizacionService _sincronizacionService;
        private readonly HttpService _httpService;

        // Propiedades de información personal
        private string _nombreMesero;

        // Propiedades de configuración de la app
        private bool _modoOffline;
        private bool _notificacionesActivas;
        private bool _sonidosActivos;
        private bool _modoOscuro;

        // Propiedades de estadísticas
        private int _pedidosTomados;
        private int _mesasAtendidas;

        // Propiedades del sistema
        private string _versionApp;
        private DateTime _ultimaSincronizacion;
        private string _estadoConexion;
        private Color _colorConexion;
        private string _infoDispositivo;

        public ConfiguracionViewModel()
        {
            Title = "Configuración";

            _httpService = new HttpService();
            _sincronizacionService = new SincronizacionService();

            // Inicializar comandos
            InicializarComandos();

            // Cargar configuración por defecto
            CargarConfiguracionPorDefecto();
        }

        // ==================== PROPIEDADES ====================

        // Información personal
        public string NombreMesero
        {
            get => _nombreMesero;
            set => SetProperty(ref _nombreMesero, value);
        }

        // Configuración de la app
        public string UrlServidor
        {
            get => ApiConfig.BaseUrl;
            set
            {
                if (string.IsNullOrWhiteSpace(value))
                {
                    ApiConfig.ResetToDefault();
                }
                else
                {
                    ApiConfig.BaseUrl = value;
                }
                OnPropertyChanged();
                OnPropertyChanged(nameof(TextoUrlServidor));
                _ = VerificarConexion(); // Verificar automáticamente
            }
        }

        public bool ModoOffline
        {
            get => _modoOffline;
            set => SetProperty(ref _modoOffline, value, onChanged: () => OnPropertyChanged(nameof(TextoModoOffline)));
        }

        public bool NotificacionesActivas
        {
            get => _notificacionesActivas;
            set => SetProperty(ref _notificacionesActivas, value);
        }

        public bool SonidosActivos
        {
            get => _sonidosActivos;
            set => SetProperty(ref _sonidosActivos, value);
        }

        public bool ModoOscuro
        {
            get => _modoOscuro;
            set => SetProperty(ref _modoOscuro, value, onChanged: CambiarTema);
        }

        // Estadísticas
        public int PedidosTomados
        {
            get => _pedidosTomados;
            set => SetProperty(ref _pedidosTomados, value);
        }

        public int MesasAtendidas
        {
            get => _mesasAtendidas;
            set => SetProperty(ref _mesasAtendidas, value);
        }

        // Sistema
        public string VersionApp
        {
            get => _versionApp;
            set => SetProperty(ref _versionApp, value);
        }

        public DateTime UltimaSincronizacion
        {
            get => _ultimaSincronizacion;
            set => SetProperty(ref _ultimaSincronizacion, value);
        }

        public string EstadoConexion
        {
            get => _estadoConexion;
            set => SetProperty(ref _estadoConexion, value);
        }

        public Color ColorConexion
        {
            get => _colorConexion;
            set => SetProperty(ref _colorConexion, value);
        }

        public string InfoDispositivo
        {
            get => _infoDispositivo;
            set => SetProperty(ref _infoDispositivo, value);
        }

        // Propiedades calculadas
        public string TextoModoOffline => ModoOffline ? "Modo sin conexión activado" : "Conectado al servidor";
        public string TextoUrlServidor => $"URL actual: {ApiConfig.BaseUrl}";
        public string TipoDispositivo => DeviceInfo.DeviceType == DeviceType.Virtual ? "🖥️ Emulador" : "📱 Dispositivo Físico";
        public string IpSugerida => DeviceInfo.DeviceType == DeviceType.Virtual ? "10.0.2.2:5176" : "192.168.x.x:5176";

        // ==================== COMANDOS ====================
        public ICommand GuardarConfiguracionCommand { get; private set; }
        public ICommand SincronizarCommand { get; private set; }
        public ICommand CerrarSesionCommand { get; private set; }
        public ICommand ResetearEstadisticasCommand { get; private set; }
        public ICommand VerDiagnosticosCommand { get; private set; }
        public ICommand ResetearUrlCommand { get; private set; }
        public ICommand VerificarConexionCommand { get; private set; }

        private void InicializarComandos()
        {
            GuardarConfiguracionCommand = new AsyncCommand(GuardarConfiguracion);
            SincronizarCommand = new AsyncCommand(ForzarSincronizacion);
            CerrarSesionCommand = new AsyncCommand(CerrarSesion);
            ResetearEstadisticasCommand = new AsyncCommand(ResetearEstadisticas);
            VerDiagnosticosCommand = new AsyncCommand(VerDiagnosticos);
            ResetearUrlCommand = new AsyncCommand(ResetearUrl);
            VerificarConexionCommand = new AsyncCommand(VerificarConexion);
        }

        // ==================== MÉTODOS ====================

        public void CargarConfiguracionPorDefecto()
        {
            // Cargar configuración guardada
            NombreMesero = Preferences.Get("NombreMesero", "Mesero");
            ModoOffline = Preferences.Get("ModoOffline", false);
            NotificacionesActivas = Preferences.Get("NotificacionesActivas", true);
            SonidosActivos = Preferences.Get("SonidosActivos", true);
            ModoOscuro = Preferences.Get("ModoOscuro", false);

            // Cargar estadísticas
            PedidosTomados = Preferences.Get("PedidosTomados", 0);
            MesasAtendidas = Preferences.Get("MesasAtendidas", 0);

            // Información del sistema
            VersionApp = AppInfo.VersionString;
            UltimaSincronizacion = DateTime.Now;
            EstadoConexion = "Sin verificar";
            ColorConexion = Colors.Gray;
            InfoDispositivo = $"{DeviceInfo.Model} - {DeviceInfo.Platform} {DeviceInfo.VersionString}";

            // Verificar conexión inicial
            _ = VerificarConexion();
        }

        private async Task GuardarConfiguracion()
        {
            try
            {
                // Guardar preferencias localmente
                Preferences.Set("NombreMesero", NombreMesero);
                Preferences.Set("ModoOffline", ModoOffline);
                Preferences.Set("NotificacionesActivas", NotificacionesActivas);
                Preferences.Set("SonidosActivos", SonidosActivos);
                Preferences.Set("ModoOscuro", ModoOscuro);

                await Application.Current.MainPage.DisplayAlert("Éxito",
                    "Configuración guardada correctamente", "OK");
            }
            catch (Exception ex)
            {
                await Application.Current.MainPage.DisplayAlert("Error",
                    $"Error al guardar configuración: {ex.Message}", "OK");
            }
        }

        private async Task ForzarSincronizacion()
        {
            await ExecuteAsync(async () =>
            {
                try
                {
                    EstadoConexion = "Sincronizando...";
                    ColorConexion = Colors.Orange;

                    // ✅ USAR EL MÉTODO CORRECTO
                    bool resultado = await _sincronizacionService.SincronizarTodosLosDatosAsync();

                    if (resultado)
                    {
                        UltimaSincronizacion = DateTime.Now;
                        EstadoConexion = "✅ Sincronizado";
                        ColorConexion = Colors.Green;

                        await Application.Current.MainPage.DisplayAlert("Éxito",
                            "Sincronización completada correctamente", "OK");
                    }
                    else
                    {
                        EstadoConexion = "❌ Error";
                        ColorConexion = Colors.Red;

                        await Application.Current.MainPage.DisplayAlert("Error",
                            "No se pudo completar la sincronización. Verifica tu conexión.", "OK");
                    }
                }
                catch (Exception ex)
                {
                    EstadoConexion = "❌ Error";
                    ColorConexion = Colors.Red;

                    System.Diagnostics.Debug.WriteLine($"[SINCRONIZACION] Error: {ex.Message}");

                    await Application.Current.MainPage.DisplayAlert("Error",
                        $"Error durante la sincronización: {ex.Message}", "OK");
                }
            });
        }

        private async Task CerrarSesion()
        {
            bool confirmar = await Application.Current.MainPage.DisplayAlert(
                "Cerrar Sesión",
                "¿Estás seguro de que deseas cerrar sesión?",
                "Sí, cerrar", "Cancelar");

            if (confirmar)
            {
                try
                {
                    System.Diagnostics.Debug.WriteLine("[CERRAR_SESION] Cerrando sesión...");

                    var usuarioService = new UsuarioService();
                    usuarioService.CerrarSesion();

                    Preferences.Remove("PedidoTemporal");

                    System.Diagnostics.Debug.WriteLine("[CERRAR_SESION] Sesión cerrada correctamente");

                    await Shell.Current.GoToAsync("//login");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[CERRAR_SESION] Error: {ex.Message}");
                    await Application.Current.MainPage.DisplayAlert("Error",
                        $"Error al cerrar sesión: {ex.Message}", "OK");
                }
            }
        }

        private async Task ResetearEstadisticas()
        {
            bool confirmar = await Application.Current.MainPage.DisplayAlert("Resetear Estadísticas",
                "¿Desea resetear las estadísticas del día?\nEsta acción no se puede deshacer.",
                "Sí, resetear", "Cancelar");

            if (confirmar)
            {
                PedidosTomados = 0;
                MesasAtendidas = 0;

                Preferences.Set("PedidosTomados", 0);
                Preferences.Set("MesasAtendidas", 0);

                await Application.Current.MainPage.DisplayAlert("Éxito",
                    "Estadísticas reseteadas correctamente", "OK");
            }
        }

        private async Task VerDiagnosticos()
        {
            var diagnostico = $"📱 DIAGNÓSTICO DEL SISTEMA\n\n" +
                $"Dispositivo: {InfoDispositivo}\n" +
                $"Tipo: {TipoDispositivo}\n" +
                $"Versión App: {VersionApp}\n" +
                $"URL Servidor: {ApiConfig.BaseUrl}\n" +
                $"Estado: {EstadoConexion}\n" +
                $"Modo Offline: {(ModoOffline ? "Activado" : "Desactivado")}\n" +
                $"Última Sync: {UltimaSincronizacion:dd/MM/yyyy HH:mm}";

            await Application.Current.MainPage.DisplayAlert("Diagnósticos", diagnostico, "OK");
        }

        private async Task ResetearUrl()
        {
            bool confirmar = await Application.Current.MainPage.DisplayAlert(
                "Resetear URL",
                $"¿Deseas restaurar la URL por defecto?\n\nURL actual: {ApiConfig.BaseUrl}\nURL por defecto: {(DeviceInfo.DeviceType == DeviceType.Virtual ? "10.0.2.2:5176" : "IP de tu PC")}",
                "Sí, resetear",
                "Cancelar"
            );

            if (confirmar)
            {
                ApiConfig.ResetToDefault();
                OnPropertyChanged(nameof(UrlServidor));
                OnPropertyChanged(nameof(TextoUrlServidor));
                await Application.Current.MainPage.DisplayAlert("Éxito", "URL reseteada correctamente", "OK");
                await VerificarConexion();
            }
        }

        private async Task VerificarConexion()
        {
            try
            {
                EstadoConexion = "Verificando...";
                ColorConexion = Colors.Orange;

                bool conectado = await _httpService.CheckConnectionAsync();

                if (conectado)
                {
                    EstadoConexion = "✅ Conectado";
                    ColorConexion = Colors.Green;
                }
                else
                {
                    EstadoConexion = "❌ Sin conexión";
                    ColorConexion = Colors.Red;
                }
            }
            catch (Exception ex)
            {
                EstadoConexion = "❌ Error";
                ColorConexion = Colors.Red;
                System.Diagnostics.Debug.WriteLine($"[VERIFICAR_CONEXION] Error: {ex.Message}");
            }
        }

        private void CambiarTema()
        {
            Application.Current.UserAppTheme = ModoOscuro ? AppTheme.Dark : AppTheme.Light;
        }
    }
}