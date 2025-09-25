using RestaurantApp.ViewModels;

namespace RestaurantApp.Views;

public partial class NuevoPedidoView : ContentPage
{
    private NuevoPedidoViewModel _viewModel;

    public NuevoPedidoView()
    {
        InitializeComponent();
        _viewModel = new NuevoPedidoViewModel();
        BindingContext = _viewModel;
    }

    private async void OnVerCarritoClicked(object sender, EventArgs e)
    {
        // El carrito ya está visible en el panel derecho
        // Pero podríamos mostrar una modal en móviles
        var totalItems = _viewModel.TotalItems;
        var totalPedido = _viewModel.TotalPedido;

        if (totalItems > 0)
        {
            await DisplayAlert("Carrito",
                $"Items: {totalItems}\nTotal: ${totalPedido:N0}", "OK");
        }
        else
        {
            await DisplayAlert("Carrito", "El carrito está vacío", "OK");
        }
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();

        // Actualizar datos cuando la vista aparece
        _viewModel?.ActualizarDatos();
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();

        // Guardar estado temporal si es necesario
        _viewModel?.GuardarEstadoTemporal();
    }
}