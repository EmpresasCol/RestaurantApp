using RestaurantApp.ViewModels;

namespace RestaurantApp.Views;

public partial class MeseroMainView : ContentPage
{
    public MeseroMainView()
    {
        InitializeComponent();
        BindingContext = new MeseroMainViewModel();
    }

    private async void OnNuevoPedidoClicked(object sender, EventArgs e)
    {
        try
        {
            await Shell.Current.GoToAsync("//nuevopedido");
        }
        catch (Exception ex)
        {
            await DisplayAlert("Error", $"No se pudo navegar: {ex.Message}", "OK");
        }
    }

    private async void OnPedidosActivosClicked(object sender, EventArgs e)
    {
        try
        {
            await Shell.Current.GoToAsync("//pedidosactivos");
        }
        catch (Exception ex)
        {
            await DisplayAlert("Error", $"No se pudo navegar: {ex.Message}", "OK");
        }
    }

    private async void OnEstadoMesasClicked(object sender, EventArgs e)
    {
        try
        {
            await Shell.Current.GoToAsync("//estadomesas");
        }
        catch (Exception ex)
        {
            await DisplayAlert("Error", $"No se pudo navegar: {ex.Message}", "OK");
        }
    }

    private async void OnConfiguracionClicked(object sender, EventArgs e)
    {
        try
        {
            await Shell.Current.GoToAsync("//configuracion");
        }
        catch (Exception ex)
        {
            await DisplayAlert("Error", $"No se pudo navegar: {ex.Message}", "OK");
        }
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();

        // Actualizar datos cuando la página aparece
        if (BindingContext is MeseroMainViewModel viewModel)
        {
            viewModel.ActualizarDatos();
        }
    }
}