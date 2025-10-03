// RestaurantApp/Views/ConfiguracionView.xaml.cs
using RestaurantApp.ViewModels;

namespace RestaurantApp.Views
{
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
            _viewModel.CargarConfiguracion();
        }
    }
}