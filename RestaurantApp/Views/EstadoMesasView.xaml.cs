using RestaurantApp.ViewModels;

namespace RestaurantApp.Views;

public partial class EstadoMesasView : ContentPage
{
    private EstadoMesasViewModel _viewModel;

    public EstadoMesasView()
    {
        InitializeComponent();
        _viewModel = new EstadoMesasViewModel();
        BindingContext = _viewModel;
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();

        // Actualizar estado de mesas cuando la página aparece
        _viewModel?.ActualizarEstadoCommand.Execute(null);

        // Iniciar actualización periódica
        StartPeriodicUpdate();
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();

        // Detener actualización periódica
        StopPeriodicUpdate();
    }

    private Timer _updateTimer;

    private void StartPeriodicUpdate()
    {
        _updateTimer?.Dispose();
        _updateTimer = new Timer(async _ =>
        {
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                _viewModel?.ActualizarEstadoCommand.Execute(null);
            });
        }, null, TimeSpan.FromSeconds(15), TimeSpan.FromSeconds(15));
    }

    private void StopPeriodicUpdate()
    {
        _updateTimer?.Dispose();
        _updateTimer = null;
    }

    // Método para manejar tap largo en mesa (funcionalidad futura)
    private async void OnMesaLongPressed(object sender, EventArgs e)
    {
        if (sender is Frame frame && frame.BindingContext is Models.Mesa mesa)
        {
            string action = await DisplayActionSheet(
                $"Mesa {mesa.Numero}",
                "Cancelar",
                null,
                "Ver detalles",
                "Cambiar estado",
                "Historial",
                "Limpiar mesa");

            switch (action)
            {
                case "Ver detalles":
                    await MostrarDetallesMesa(mesa);
                    break;
                case "Cambiar estado":
                    await CambiarEstadoMesa(mesa);
                    break;
                case "Historial":
                    await MostrarHistorialMesa(mesa);
                    break;
                case "Limpiar mesa":
                    await LimpiarMesa(mesa);
                    break;
            }
        }
    }

    private async Task MostrarDetallesMesa(Models.Mesa mesa)
    {
        var detalles = $"Mesa {mesa.Numero}\n\n" +
                      $"Estado: {mesa.Estado}\n" +
                      $"Capacidad: {mesa.Capacidad} personas\n" +
                      $"Tiempo ocupada: {mesa.TiempoOcupada ?? "N/A"}\n";

        if (mesa.TienePedidosPendientes)
        {
            detalles += $"Pedidos pendientes: {mesa.CantidadPedidosPendientes}";
        }

        await DisplayAlert("Detalles de Mesa", detalles, "OK");
    }

    private async Task CambiarEstadoMesa(Models.Mesa mesa)
    {
        var estados = new[] { "Disponible", "Ocupada", "Esperando Pago", "Limpieza" };
        var nuevoEstado = await DisplayActionSheet(
            "Cambiar estado de mesa",
            "Cancelar",
            null,
            estados);

        if (!string.IsNullOrEmpty(nuevoEstado) && nuevoEstado != "Cancelar")
        {
            // Aquí implementarías la lógica para cambiar el estado
            await DisplayAlert("Éxito", $"Estado cambiado a: {nuevoEstado}", "OK");
            _viewModel?.ActualizarEstadoCommand.Execute(null);
        }
    }

    private async Task MostrarHistorialMesa(Models.Mesa mesa)
    {
        await DisplayAlert("Historial",
            $"Historial de la mesa {mesa.Numero}\n\n" +
            "• 14:30 - Mesa ocupada\n" +
            "• 14:45 - Pedido tomado\n" +
            "• 15:15 - Comida servida\n" +
            "• 15:45 - Cuenta solicitada", "OK");
    }

    private async Task LimpiarMesa(Models.Mesa mesa)
    {
        bool confirmar = await DisplayAlert("Confirmar",
            $"¿Marcar mesa {mesa.Numero} como lista para limpieza?",
            "Sí", "No");

        if (confirmar)
        {
            // Implementar lógica de limpieza
            await DisplayAlert("Éxito", "Mesa marcada para limpieza", "OK");
            _viewModel?.ActualizarEstadoCommand.Execute(null);
        }
    }
}   