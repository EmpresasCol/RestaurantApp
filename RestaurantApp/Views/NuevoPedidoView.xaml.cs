// RestaurantApp/Views/NuevoPedidoView.xaml.cs
using RestaurantApp.ViewModels;

namespace RestaurantApp.Views
{
    public partial class NuevoPedidoView : ContentPage
    {
        private NuevoPedidoViewModel _viewModel;

        public NuevoPedidoView()
        {
            InitializeComponent();
            _viewModel = new NuevoPedidoViewModel();
            BindingContext = _viewModel;
        }

        protected override void OnAppearing()
        {
            base.OnAppearing();
            _ = _viewModel.ActualizarDatos();
        }

        protected override void OnDisappearing()
        {
            base.OnDisappearing();
            _viewModel.GuardarEstadoTemporal();
        }
    }
}