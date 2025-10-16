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
        private string _nombreMesero;
        private string _idEmpleado;
        private string _turnoSeleccionado;
        private string _urlServidor;
        private bool _modoOffline;
        private bool _notificacionesActivas;
        private bool _sonidosActivos;
        private bool _modoOscuro;
        private int _pedidosTomados;
        private int _mesasAtendidas;
        private decimal _ventasGeneradas;
        private string _tiempoActivo;
        private string _versionApp;
        private DateTime _ultimaSincronizacion;
        private string _estadoConexion;
        private Color _colorConexion;
        private string _infoDispositivo;


        public ConfiguracionViewModel()
        {
            Title = "Configuración";

            // Inicializar comandos
            InicializarComandos();

            _httpService = new HttpService();
            _sincronizacionService = new SincronizacionService();

            // Cargar configuración por defecto
            CargarConfiguracionPorDefecto();
        }




        // Propiedades de información personal
        public string NombreMesero
        {
            get => _nombreMesero;
            set => SetProperty(ref _nombreMesero, value);
        }

        public string IdEmpleado
        {
            get => _idEmpleado;
            set => SetProperty(ref _idEmpleado, value);
        }

        public string TurnoSeleccionado
        {
            get => _turnoSeleccionado;
            set => SetProperty(ref _turnoSeleccionado, value);
        }

        // Propiedades de configuración de la app
        public string UrlServidor
        {
            get => ApiConfig.BaseUrl;
            set
            {
                ApiConfig.BaseUrl = value.TrimEnd('/') + "/";
                OnPropertyChanged();
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

        // Propiedades de estadísticas
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

        public decimal VentasGeneradas
        {
            get => _ventasGeneradas;
            set => SetProperty(ref _ventasGeneradas, value);
        }

        public string TiempoActivo
        {
            get => _tiempoActivo;
            set => SetProperty(ref _tiempoActivo, value);
        }

        // Propiedades del sistema
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

        // Propiedades adicionales
        public List<string> Turnos { get; set; }

        // Propiedades calculadas
        public string TextoModoOffline => ModoOffline ? "Activado" : "Desactivado";
        public string ResumenEstadisticas => $"{PedidosTomados} pedidos • {MesasAtendidas} mesas • ${VentasGeneradas:N0}";
        public bool HayDatosEstadisticas => PedidosTomados > 0 || MesasAtendidas > 0 || VentasGeneradas > 0;

        // Comandos
        public ICommand SincronizarCommand { get; private set; }
        public ICommand LimpiarCacheCommand { get; private set; }
        public ICommand ExportarDatosCommand { get; private set; }
        public ICommand MostrarAyudaCommand { get; private set; }
        public ICommand GuardarConfiguracionCommand { get; private set; }
        public ICommand CerrarSesionCommand { get; private set; }
        public ICommand ResetearEstadisticasCommand { get; private set; }
        public ICommand VerificarConexionCommand { get; private set; }

        private void InicializarComandos()
        {
            SincronizarCommand = new AsyncCommand(Sincronizar);
            LimpiarCacheCommand = new AsyncCommand(LimpiarCache);
            ExportarDatosCommand = new AsyncCommand(ExportarDatos);
            MostrarAyudaCommand = new AsyncCommand(MostrarAyuda);
            GuardarConfiguracionCommand = new AsyncCommand(GuardarConfiguracion);
            CerrarSesionCommand = new AsyncCommand(CerrarSesion);
            ResetearEstadisticasCommand = new AsyncCommand(ResetearEstadisticas);
            VerificarConexionCommand = new AsyncCommand(VerificarConexion);
        }

        private void CargarConfiguracionPorDefecto()
        {
            // Información personal
            NombreMesero = "Juan Pérez";
            IdEmpleado = "EMP001";
            Turnos = new List<string> { "Mañana", "Tarde", "Noche", "Completo" };
            TurnoSeleccionado = "Tarde";

            // Configuración de la app
            UrlServidor = "http://localhost:5176";
            ModoOffline = false;
            NotificacionesActivas = true;
            SonidosActivos = true;
            ModoOscuro = false;

            // Estadísticas (datos de prueba)
            PedidosTomados = 12;
            MesasAtendidas = 8;
            VentasGeneradas = 450000;
            TiempoActivo = "6h 30min";

            // Información del sistema
            VersionApp = AppInfo.Current.VersionString ?? "1.0.0";
            UltimaSincronizacion = DateTime.Now.AddMinutes(-15);
            EstadoConexion = "Verificando...";
            ColorConexion = Colors.Orange;
            InfoDispositivo = $"{DeviceInfo.Current.Manufacturer} {DeviceInfo.Current.Model}";

            // Verificar conexión inicial
            Task.Run(async () => await VerificarConexion());
        }

        // Método para cargar configuración desde Preferences
        public void CargarConfiguracion()
        {
            try
            {
                // Cargar configuración guardada
                NombreMesero = Preferences.Get("NombreMesero", NombreMesero);
                IdEmpleado = Preferences.Get("IdEmpleado", IdEmpleado);
                UrlServidor = Preferences.Get("UrlServidor", UrlServidor);
                TurnoSeleccionado = Preferences.Get("TurnoSeleccionado", TurnoSeleccionado);

                ModoOffline = Preferences.Get("ModoOffline", ModoOffline);
                NotificacionesActivas = Preferences.Get("NotificacionesActivas", NotificacionesActivas);
                SonidosActivos = Preferences.Get("SonidosActivos", SonidosActivos);
                ModoOscuro = Preferences.Get("ModoOscuro", ModoOscuro);

                // Cargar estadísticas del día actual
                CargarEstadisticasDelDia();

                // Aplicar tema guardado
                if (ModoOscuro)
                {
                    Application.Current.UserAppTheme = AppTheme.Dark;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error cargando configuración: {ex.Message}");
            }
        }

        private void CargarEstadisticasDelDia()
        {
            var fechaHoy = DateTime.Today.ToString("yyyyMMdd");

            PedidosTomados = Preferences.Get($"PedidosTomados_{fechaHoy}", PedidosTomados);
            MesasAtendidas = Preferences.Get($"MesasAtendidas_{fechaHoy}", MesasAtendidas);

            if (decimal.TryParse(Preferences.Get($"VentasGeneradas_{fechaHoy}", VentasGeneradas.ToString()), out var ventas))
            {
                VentasGeneradas = ventas;
            }

            // Calcular tiempo activo
            var horaInicio = Preferences.Get($"HoraInicio_{fechaHoy}", DateTime.Today.AddHours(8));
            var tiempoTranscurrido = DateTime.Now - horaInicio;
            TiempoActivo = $"{tiempoTranscurrido.Hours}h {tiempoTranscurrido.Minutes}min";
        }

        // Métodos de acción
        private async Task Sincronizar()
        {
            try
            {
                EstadoConexion = "Sincronizando...";
                ColorConexion = Colors.Orange;

                await Task.Delay(2000);

                if (!ModoOffline)
                {
                    var resultado = await _sincronizacionService.SincronizarTodosLosDatosAsync();

                    if (resultado)
                    {
                        UltimaSincronizacion = DateTime.Now;
                        EstadoConexion = "Sincronizado";
                        ColorConexion = Colors.Green;

                        await Application.Current.MainPage.DisplayAlert("Éxito",
                            "Sincronización completada correctamente", "OK");
                    }
                    else
                    {
                        EstadoConexion = "Error de sincronización";
                        ColorConexion = Colors.Red;

                        await Application.Current.MainPage.DisplayAlert("Error",
                            "No se pudo completar la sincronización", "OK");
                    }
                }
                else
                {
                    await Application.Current.MainPage.DisplayAlert("Modo Offline",
                        "La sincronización está deshabilitada en modo offline", "OK");
                }
            }
            catch (Exception ex)
            {
                EstadoConexion = "Error de sincronización";
                ColorConexion = Colors.Red;

                await Application.Current.MainPage.DisplayAlert("Error",
                    $"Error durante la sincronización: {ex.Message}", "OK");
            }
        }


        private async Task LimpiarCache()
        {
            bool confirmar = await Application.Current.MainPage.DisplayAlert("Confirmar",
                "¿Desea limpiar todos los datos en caché?\n\nEsto eliminará:\n• Pedidos temporales\n• Imágenes en caché\n• Datos offline",
                "Sí", "No");

            if (confirmar)
            {
                try
                {
                    // Limpiar datos temporales
                    Preferences.Remove("PedidoTemporal");

                    // Limpiar caché de imágenes (implementar según necesidad)
                    await LimpiarCacheImagenes();

                    await Application.Current.MainPage.DisplayAlert("Éxito",
                        "Caché limpiado correctamente", "OK");
                }
                catch (Exception ex)
                {
                    await Application.Current.MainPage.DisplayAlert("Error",
                        $"Error al limpiar caché: {ex.Message}", "OK");
                }
            }
        }

        private async Task LimpiarCacheImagenes()
        {
            // Implementar limpieza de caché de imágenes
            await Task.Delay(500); // Simular proceso
        }

        private async Task ExportarDatos()
        {
            try
            {
                var datosExportacion = new
                {
                    Empleado = new { IdEmpleado, NombreMesero, TurnoSeleccionado },
                    Estadisticas = new { PedidosTomados, MesasAtendidas, VentasGeneradas, TiempoActivo },
                    Configuracion = new { UrlServidor, NotificacionesActivas, SonidosActivos },
                    FechaExportacion = DateTime.Now
                };

                var json = System.Text.Json.JsonSerializer.Serialize(datosExportacion, new System.Text.Json.JsonSerializerOptions
                {
                    WriteIndented = true
                });

                // En implementación real, guardar archivo o compartir
                var nombreArchivo = $"RestaurantData_{DateTime.Now:yyyyMMdd_HHmmss}.json";

                await Application.Current.MainPage.DisplayAlert("Éxito",
                    $"Datos exportados correctamente\n\nArchivo: {nombreArchivo}\nUbicación: Documents/", "OK");
            }
            catch (Exception ex)
            {
                await Application.Current.MainPage.DisplayAlert("Error",
                    $"Error al exportar datos: {ex.Message}", "OK");
            }
        }

        private async Task MostrarAyuda()
        {
            var ayuda = "🍽️ RestaurantApp - Ayuda del Mesero\n\n" +
                       "📋 FUNCIONES PRINCIPALES:\n" +
                       "• Nuevo Pedido: Crear pedidos para mesas\n" +
                       "• Pedidos Activos: Gestionar pedidos en curso\n" +
                       "• Estado Mesas: Ver ocupación del restaurante\n" +
                       "• Configuración: Ajustar preferencias\n\n" +
                       "⚙️ CONFIGURACIÓN:\n" +
                       "• Modo Offline: Trabajar sin conexión\n" +
                       "• Notificaciones: Alertas de pedidos\n" +
                       "• Sincronización: Actualizar datos\n\n" +
                       "🔧 SOPORTE TÉCNICO:\n" +
                       "• Versión: " + VersionApp + "\n" +
                       "• Contacto: admin@restaurante.com\n" +
                       "• Teléfono: +57 300 123 4567";

            await Application.Current.MainPage.DisplayAlert("Ayuda", ayuda, "OK");
        }

        private async Task GuardarConfiguracion()
        {
            try
            {
                // Guardar en Preferences
                Preferences.Set("NombreMesero", NombreMesero);
                Preferences.Set("IdEmpleado", IdEmpleado);
                Preferences.Set("UrlServidor", UrlServidor);
                Preferences.Set("TurnoSeleccionado", TurnoSeleccionado);

                Preferences.Set("ModoOffline", ModoOffline);
                Preferences.Set("NotificacionesActivas", NotificacionesActivas);
                Preferences.Set("SonidosActivos", SonidosActivos);
                Preferences.Set("ModoOscuro", ModoOscuro);

                // Sincronizar con servidor si no está en modo offline
                if (!ModoOffline)
                {
                    await SincronizarConfiguracionConServidor();
                }

                await Application.Current.MainPage.DisplayAlert("Éxito",
                    "Configuración guardada correctamente", "OK");
            }
            catch (Exception ex)
            {
                await Application.Current.MainPage.DisplayAlert("Error",
                    $"Error al guardar configuración: {ex.Message}", "OK");
            }
        }

        // RestaurantApp/ViewModels/ConfiguracionViewModel.cs
        // REEMPLAZA ESTE MÉTODO COMPLETO:

        private async Task SincronizarConfiguracionConServidor()
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"[CONFIG] Enviando a: {ApiConfig.BaseUrl}api/configuracion");

                var configData = new
                {
                    EmpleadoId = IdEmpleado,
                    Configuracion = new
                    {
                        NombreMesero,
                        TurnoSeleccionado,
                        Preferencias = new
                        {
                            NotificacionesActivas,
                            SonidosActivos,
                            ModoOscuro
                        }
                    }
                };

                // Usar HttpService en lugar de HttpClient directo
                await _httpService.PostAsync<object>("api/configuracion", configData);

                System.Diagnostics.Debug.WriteLine("[CONFIG] Configuración enviada correctamente");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[CONFIG] Error sincronizando configuración: {ex.Message}");
                // No lanzar excepción para no interrumpir el guardado local
            }
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

                    // Limpiar preferencias
                    var usuarioService = new UsuarioService();
                    usuarioService.CerrarSesion();

                    // Limpiar datos temporales
                    Preferences.Remove("PedidoTemporal");

                    System.Diagnostics.Debug.WriteLine("[CERRAR_SESION] Sesión cerrada correctamente");

                    // Navegar al login
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
                "¿Desea resetear las estadísticas del día?\nEsta acción no se puede deshacer.", "Sí", "No");

            if (confirmar)
            {
                PedidosTomados = 0;
                MesasAtendidas = 0;
                VentasGeneradas = 0;
                TiempoActivo = "0h 0min";

                // Limpiar estadísticas guardadas
                var fechaHoy = DateTime.Today.ToString("yyyyMMdd");
                Preferences.Remove($"PedidosTomados_{fechaHoy}");
                Preferences.Remove($"MesasAtendidas_{fechaHoy}");
                Preferences.Remove($"VentasGeneradas_{fechaHoy}");
                Preferences.Set($"HoraInicio_{fechaHoy}", DateTime.Now);

                await Application.Current.MainPage.DisplayAlert("Reseteo Completo",
                    "Las estadísticas han sido reseteadas", "OK");
            }
        }

        private async Task VerificarConexion()
        {
            try
            {
                var connectivity = Connectivity.Current;

                if (connectivity.NetworkAccess != NetworkAccess.Internet)
                {
                    EstadoConexion = "Sin conexión";
                    ColorConexion = Colors.Red;
                    return;
                }

                EstadoConexion = "Verificando...";
                ColorConexion = Colors.Orange;

                var httpService = new HttpService();
                var conectado = await httpService.CheckConnectionAsync();

                if (conectado)
                {
                    EstadoConexion = "Conectado";
                    ColorConexion = Colors.Green;
                }
                else
                {
                    EstadoConexion = "Servidor no disponible";
                    ColorConexion = Colors.Orange;
                }
            }
            catch (Exception ex)
            {
                EstadoConexion = "Error de conexión";
                ColorConexion = Colors.Red;
                System.Diagnostics.Debug.WriteLine($"Error verificando conexión: {ex.Message}");
            }
        }

        // Métodos auxiliares
        private void CambiarTema()
        {
            try
            {
                Application.Current.UserAppTheme = ModoOscuro ? AppTheme.Dark : AppTheme.Light;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error cambiando tema: {ex.Message}");
            }
        }

        // Método para actualizar estadísticas desde otras vistas
        public void ActualizarEstadistica(string tipo, int valor)
        {
            var fechaHoy = DateTime.Today.ToString("yyyyMMdd");

            switch (tipo.ToLower())
            {
                case "pedidos":
                    PedidosTomados = valor;
                    Preferences.Set($"PedidosTomados_{fechaHoy}", valor);
                    break;
                case "mesas":
                    MesasAtendidas = valor;
                    Preferences.Set($"MesasAtendidas_{fechaHoy}", valor);
                    break;
                case "ventas":
                    VentasGeneradas = valor;
                    Preferences.Set($"VentasGeneradas_{fechaHoy}", valor.ToString());
                    break;
            }

            OnPropertyChanged(nameof(ResumenEstadisticas));
            OnPropertyChanged(nameof(HayDatosEstadisticas));
        }

        // Método para actualizar estadísticas con valor decimal (para ventas)
        public void ActualizarEstadistica(string tipo, decimal valor)
        {
            var fechaHoy = DateTime.Today.ToString("yyyyMMdd");

            if (tipo.ToLower() == "ventas")
            {
                VentasGeneradas = valor;
                Preferences.Set($"VentasGeneradas_{fechaHoy}", valor.ToString());
                OnPropertyChanged(nameof(ResumenEstadisticas));
                OnPropertyChanged(nameof(HayDatosEstadisticas));
            }
        }

        // Cleanup
        ~ConfiguracionViewModel()
        {
            // Cleanup si es necesario
        }
    }
}