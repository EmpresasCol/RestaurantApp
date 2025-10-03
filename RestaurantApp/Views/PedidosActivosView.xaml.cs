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
            _viewModel.IniciarActualizacionAutomatica();
        }

        protected override void OnDisappearing()
        {
            base.OnDisappearing();
            _viewModel.DetenerActualizacionAutomatica();
        }
    }
}