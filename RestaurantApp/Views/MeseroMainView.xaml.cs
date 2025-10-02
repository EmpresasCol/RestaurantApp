using RestaurantApp.ViewModels;

namespace RestaurantApp.Views
{
    public partial class MeseroMainView : ContentPage
    {
        public MeseroMainView()
        {
            InitializeComponent();
            BindingContext = new MeseroMainViewModel();
        }

        protected override void OnAppearing()
        {
            base.OnAppearing();
            if (BindingContext is MeseroMainViewModel viewModel)
            {
                viewModel.ActualizarDatos();
            }
        }

        private async void OnNuevoPedidoClicked(object sender, EventArgs e)
        {
            await Shell.Current.GoToAsync("//nuevopedido");
        }

        private async void OnPedidosActivosClicked(object sender, EventArgs e)
        {
            await Shell.Current.GoToAsync("//pedidosactivos");
        }

        private async void OnConfiguracionClicked(object sender, EventArgs e)
        {
            await Shell.Current.GoToAsync("//configuracion");
        }
    }
}