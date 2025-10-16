// RestaurantApp/Views/PedidosActivosView.xaml.cs
using RestaurantApp.ViewModels;

namespace RestaurantApp.Views
{
    public partial class PedidosActivosView : ContentPage
    {
        private PedidosActivosViewModel _viewModel;

        public PedidosActivosView()
        {
            InitializeComponent();
            _viewModel = new PedidosActivosViewModel();
            BindingContext = _viewModel;
        }

        protected override void OnAppearing()
        {
            base.OnAppearing();

            _ = _viewModel.CargarPedidos();

            // Iniciar actualización automática
            _viewModel.IniciarActualizacionAutomatica();

            System.Diagnostics.Debug.WriteLine("[PedidosActivosView] Vista apareció - Recargando pedidos");
        }

        protected override void OnDisappearing()
        {
            base.OnDisappearing();
            _viewModel.DetenerActualizacionAutomatica();
        }
    }
}