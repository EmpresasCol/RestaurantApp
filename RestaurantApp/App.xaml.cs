// RestaurantApp/App.xaml.cs
namespace RestaurantApp
{
    public partial class App : Application
    {
        public App()
        {
            InitializeComponent();

            // Verificar si hay sesión activa
            var sesionActiva = Preferences.Get("SesionActiva", false);

            if (!sesionActiva)
            {
                // Si no hay sesión, crear usuario por defecto
                CrearUsuarioPorDefecto();
            }

            // Configurar Shell como MainPage
            MainPage = new AppShell();
        }

        protected override Window CreateWindow(IActivationState activationState)
        {
            var window = base.CreateWindow(activationState);

            // Configurar tamaño de ventana para desktop
            window.Width = 1200;
            window.Height = 800;
            window.MinimumWidth = 800;
            window.MinimumHeight = 600;

            return window;
        }

        private void CrearUsuarioPorDefecto()
        {
            // Crear usuario por defecto para pruebas
            Preferences.Set("UsuarioId", 1);
            Preferences.Set("NombreMesero", "Juan Pérez");
            Preferences.Set("TipoUsuario", "Mesero");
            Preferences.Set("SesionActiva", true);
        }
    }
}