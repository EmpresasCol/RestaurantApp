using RestaurantApp.ViewModels;

namespace RestaurantApp.Views;

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

        // Actualizar pedidos cuando la página aparece
        _viewModel?.ActualizarCommand.Execute(null);

        // Configurar timer para actualización automática cada 30 segundos
        StartAutoRefresh();
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();

        // Detener timer de actualización
        StopAutoRefresh();
    }

    private Timer _refreshTimer;

    private void StartAutoRefresh()
    {
        _refreshTimer?.Dispose();
        _refreshTimer = new Timer(async _ =>
        {
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                _viewModel?.ActualizarCommand.Execute(null);
            });
        }, null, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(30));
    }

    private void StopAutoRefresh()
    {
        _refreshTimer?.Dispose();
        _refreshTimer = null;
    }

    // Método para manejar pull-to-refresh si se agrega
    private async void OnRefreshing(object sender, EventArgs e)
    {
        if (sender is RefreshView refreshView)
        {
            _viewModel?.ActualizarCommand.Execute(null);

            // Simular delay de red
            await Task.Delay(1000);

            refreshView.IsRefreshing = false;
        }
    }
}