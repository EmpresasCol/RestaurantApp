using RestaurantApp.ViewModels;

namespace RestaurantApp.Views;

public partial class ConfiguracionView : ContentPage
{
    private ConfiguracionViewModel _viewModel;

    public ConfiguracionView()
    {
        InitializeComponent();
        _viewModel = new ConfiguracionViewModel();
        BindingContext = _viewModel;
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();

        // Cargar configuración actual
        _viewModel?.CargarConfiguracion();

        // Actualizar información del sistema
        ActualizarInfoSistema();
    }

    private void ActualizarInfoSistema()
    {
        if (_viewModel != null)
        {
            // Actualizar información del dispositivo
            _viewModel.InfoDispositivo = $"{DeviceInfo.Current.Manufacturer} {DeviceInfo.Current.Model}";
            _viewModel.VersionApp = AppInfo.Current.VersionString;

            // Verificar estado de conexión
            VerificarConexion();
        }
    }

    private async void VerificarConexion()
    {
        try
        {
            var connectivity = Connectivity.Current;
            if (connectivity.NetworkAccess == NetworkAccess.Internet)
            {
                _viewModel.EstadoConexion = "Conectado";
                _viewModel.ColorConexion = Colors.Green;

                // Opcional: Hacer ping al servidor
                await VerificarConexionServidor();
            }
            else
            {
                _viewModel.EstadoConexion = "Sin conexión";
                _viewModel.ColorConexion = Colors.Red;
            }
        }
        catch (Exception ex)
        {
            _viewModel.EstadoConexion = "Error";
            _viewModel.ColorConexion = Colors.Orange;
            System.Diagnostics.Debug.WriteLine($"Error verificando conexión: {ex.Message}");
        }
    }

    private async Task VerificarConexionServidor()
    {
        try
        {
            using var httpClient = new HttpClient();
            httpClient.Timeout = TimeSpan.FromSeconds(5);

            var response = await httpClient.GetAsync(_viewModel.UrlServidor + "/health");
            if (response.IsSuccessStatusCode)
            {
                _viewModel.EstadoConexion = "Servidor OK";
                _viewModel.ColorConexion = Colors.Green;
            }
        }
        catch
        {
            _viewModel.EstadoConexion = "Servidor no disponible";
            _viewModel.ColorConexion = Colors.Orange;
        }
    }

    // Evento cuando cambia el switch de modo oscuro
    private void OnModoOscuroChanged(object sender, ToggledEventArgs e)
    {
        if (e.Value)
        {
            Application.Current.UserAppTheme = AppTheme.Dark;
        }
        else
        {
            Application.Current.UserAppTheme = AppTheme.Light;
        }
    }

    // Evento cuando cambia la URL del servidor
    private void OnUrlServidorCompleted(object sender, EventArgs e)
    {
        if (sender is Entry entry)
        {
            _viewModel.UrlServidor = entry.Text;
            // Verificar nueva conexión
            VerificarConexion();
        }
    }

    // Manejar cambios en configuración crítica
    private async void OnModoOfflineChanged(object sender, ToggledEventArgs e)
    {
        if (e.Value)
        {
            bool confirmar = await DisplayAlert("Modo Offline",
                "¿Activar modo offline? Los cambios no se sincronizarán hasta conectarse.",
                "Sí", "No");

            if (!confirmar)
            {
                // Revertir el switch
                if (sender is Switch switchControl)
                {
                    switchControl.IsToggled = false;
                }
            }
        }
    }

    protected override bool OnBackButtonPressed()
    {
        // Preguntar si quiere guardar cambios antes de salir
        Task.Run(async () =>
        {
            bool guardar = await DisplayAlert("Guardar cambios",
                "¿Desea guardar los cambios antes de salir?",
                "Sí", "No");

            if (guardar)
            {
                await MainThread.InvokeOnMainThreadAsync(() =>
                {
                    _viewModel?.GuardarConfiguracionCommand.Execute(null);
                });
            }

            await MainThread.InvokeOnMainThreadAsync(async () =>
            {
                await Shell.Current.GoToAsync("//inicio");
            });
        });

        return true; // Prevent default back behavior
    }
}