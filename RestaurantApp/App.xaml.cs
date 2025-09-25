namespace RestaurantApp
{
    public partial class App : Application
    {
        public App()
        {
            InitializeComponent();

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
    }
}