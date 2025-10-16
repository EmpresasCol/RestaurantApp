using RestaurantApp.Models;
using RestaurantApp.Services;
using System.Collections.ObjectModel;
using System.Windows.Input;
using RestaurantApp.Helpers;

namespace RestaurantApp.ViewModels
{
    public class PedidosActivosViewModel : BaseViewModel
    {
        private readonly PedidoService _pedidoService;
        private readonly MesaService _mesaService;

        private int _cantidadPedidosActivos;
        private FiltroEstado _filtroSeleccionado;
        private DateTime _ultimaActualizacion;
        private List<Pedido> _todosPedidos;

        public PedidosActivosViewModel()
        {
            Title = "Pedidos Activos";

            _pedidoService = new PedidoService();
            _mesaService = new MesaService();

            PedidosFiltrados = new ObservableCollection<Pedido>();
            FiltrosEstado = new ObservableCollection<FiltroEstado>();
            _todosPedidos = new List<Pedido>();

            InicializarComandos();

            CargarFiltros();
            _ = CargarPedidos();

            IniciarActualizacionAutomatica();
        }

        public ObservableCollection<Pedido> PedidosFiltrados { get; }
        public ObservableCollection<FiltroEstado> FiltrosEstado { get; }

        public int CantidadPedidosActivos
        {
            get => _cantidadPedidosActivos;
            set => SetProperty(ref _cantidadPedidosActivos, value);
        }

        public FiltroEstado FiltroSeleccionado
        {
            get => _filtroSeleccionado;
            set => SetProperty(ref _filtroSeleccionado, value, onChanged: AplicarFiltro);
        }

        public DateTime UltimaActualizacion
        {
            get => _ultimaActualizacion;
            set => SetProperty(ref _ultimaActualizacion, value);
        }

        // Propiedades calculadas
        public string ResumenPedidos => $"{CantidadPedidosActivos} pedidos activos";
        public bool TienePedidos => PedidosFiltrados.Count > 0;

        // Comandos
        public ICommand SeleccionarFiltroCommand { get; private set; }
        public ICommand EditarPedidoCommand { get; private set; }
        public ICommand CompletarPedidoCommand { get; private set; }
        public ICommand CancelarPedidoCommand { get; private set; }
        public ICommand ActualizarCommand { get; private set; }
        public ICommand NuevoPedidoCommand { get; private set; }
        public ICommand EntregarPedidoCommand { get; private set; }

        private void InicializarComandos()
        {
            SeleccionarFiltroCommand = new Command<FiltroEstado>(SeleccionarFiltro);
            EditarPedidoCommand = new AsyncCommand<Pedido>(EditarPedido);
            EntregarPedidoCommand = new AsyncCommand<Pedido>(EntregarPedido);
            CompletarPedidoCommand = new AsyncCommand<Pedido>(CompletarPedido);
            CancelarPedidoCommand = new AsyncCommand<Pedido>(CancelarPedido);
            ActualizarCommand = new AsyncCommand(Actualizar);
            NuevoPedidoCommand = new Command(async () => await Shell.Current.GoToAsync("//nuevopedido"));
        }

        // Métodos de carga
        private void CargarFiltros()
        {
            var filtros = FiltroEstado.ObtenerFiltrosPedidos();

            FiltrosEstado.Clear();
            foreach (var filtro in filtros)
            {
                FiltrosEstado.Add(filtro);
            }

            FiltroSeleccionado = FiltrosEstado.FirstOrDefault();
        }

        public async Task CargarPedidos()
        {
            await ExecuteAsync(async () =>
            {
                try
                {
                    // Obtener pedidos desde la API
                    _todosPedidos = await _pedidoService.ObtenerTodosAsync();

                    CantidadPedidosActivos = _todosPedidos.Count(p =>
                        p.Estado != EstadoPedido.Pagado &&
                        p.Estado != EstadoPedido.Cancelado);

                    UltimaActualizacion = DateTime.Now;

                    AplicarFiltro();

                    // Actualizar tiempos transcurridos
                    ActualizarTiemposTranscurridos();
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Error cargando pedidos: {ex.Message}");
                    await Application.Current.MainPage.DisplayAlert("Error",
                        "No se pudieron cargar los pedidos. Verifica tu conexión.", "OK");
                }
            });
        }

        // Métodos de filtrado
        private void SeleccionarFiltro(FiltroEstado filtro)
        {
            if (filtro != null)
            {
                // Actualizar selección visual
                foreach (var f in FiltrosEstado)
                {
                    f.EstaSeleccionado = f == filtro;
                }

                FiltroSeleccionado = filtro;
            }
        }

        private void AplicarFiltro()
        {
            if (FiltroSeleccionado == null || !_todosPedidos.Any())
                return;

            var pedidosFiltrados = _todosPedidos.AsEnumerable();

            if (FiltroSeleccionado.Valor != "Todos")
            {
                if (Enum.TryParse<EstadoPedido>(FiltroSeleccionado.Valor, out var estado))
                {
                    pedidosFiltrados = pedidosFiltrados.Where(p => p.Estado == estado);
                }
            }

            PedidosFiltrados.Clear();
            foreach (var pedido in pedidosFiltrados.OrderByDescending(p => p.FechaHora))
            {
                PedidosFiltrados.Add(pedido);
            }

            OnPropertyChanged(nameof(TienePedidos));
        }

        // Métodos de acción
        private async Task EditarPedido(Pedido pedido)
        {
            if (pedido == null) return;


            var tiempoTranscurrido = DateTime.Now - pedido.FechaHora;
            if (tiempoTranscurrido.TotalMinutes > 5)
            {
                await Application.Current.MainPage.DisplayAlert("No permitido",
                    "No se puede editar un pedido después de 5 minutos de creado", "OK");
                return;
            }

            if (pedido.Estado != EstadoPedido.EnProceso)
            {
                await Application.Current.MainPage.DisplayAlert("No permitido",
                    "Solo se pueden editar pedidos en proceso", "OK");
                return;
            }

            await Application.Current.MainPage.DisplayAlert("Editar",
                $"Función de edición para pedido #{pedido.Id}\n(Por implementar)", "OK");


            await Shell.Current.GoToAsync($"editarpedido?id={pedido.Id}");
        }

        private async Task CompletarPedido(Pedido pedido)
        {
            if (pedido == null) return;

            // Verificar que el pedido esté entregado
            if (pedido.Estado != EstadoPedido.Entregado)
            {
                await Application.Current.MainPage.DisplayAlert("No disponible",
                    "Solo se pueden completar pedidos que ya fueron entregados", "OK");
                return;
            }

            bool confirmar = await Application.Current.MainPage.DisplayAlert(
                "Completar Pedido",
                $"¿El pago del pedido de la mesa {pedido.Mesa.Numero} fue realizado?\n\nTotal: ${pedido.Total:N0}",
                "Sí, cobrado", "No");

            if (confirmar)
            {
                try
                {
                    System.Diagnostics.Debug.WriteLine($"[COMPLETAR] Cambiando estado de pedido {pedido.Id} a Pagado");

                    // Actualizar estado en la API a "Pagado"
                    await _pedidoService.ActualizarEstadoAsync(pedido.Id, "Pagado");

                    pedido.Completar();

                    // Actualizar estado de la mesa a Disponible
                    await _mesaService.ActualizarEstadoAsync(pedido.Mesa.Id, "Disponible");

                    // Remover de la lista de activos
                    _todosPedidos.Remove(pedido);
                    AplicarFiltro();
                    CantidadPedidosActivos--;

                    await Application.Current.MainPage.DisplayAlert("✅ Completado",
                        $"Pedido de la mesa {pedido.Mesa.Numero} completado.\nLa mesa está disponible nuevamente.", "OK");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[COMPLETAR] Error: {ex.Message}");
                    await Application.Current.MainPage.DisplayAlert("Error",
                        $"Error al completar pedido: {ex.Message}", "OK");
                }
            }
        }

        private async Task EntregarPedido(Pedido pedido)
        {
            if (pedido == null) return;

            System.Diagnostics.Debug.WriteLine($"[ENTREGAR] Iniciando para pedido ID: {pedido.Id}");
            System.Diagnostics.Debug.WriteLine($"[ENTREGAR] Estado actual: {pedido.Estado}");

            // Verificar que el pedido esté en proceso
            if (pedido.Estado != EstadoPedido.EnProceso)
            {
                await Application.Current.MainPage.DisplayAlert("No disponible",
                    "Solo se pueden entregar pedidos en proceso", "OK");
                return;
            }

            // Si mesa es null, cargarla
            if (pedido.Mesa == null)
            {
                System.Diagnostics.Debug.WriteLine($"[ENTREGAR] Mesa es null, cargando desde servicio...");
                try
                {
                    pedido.Mesa = await _mesaService.ObtenerPorIdAsync(pedido.MesaId);
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[ENTREGAR] Error cargando mesa: {ex.Message}");
                }
            }

            var numeroMesa = pedido.Mesa?.Numero ?? pedido.MesaId;

            bool confirmar = await Application.Current.MainPage.DisplayAlert(
                "Confirmar Entrega",
                $"¿Confirmar que el pedido de la mesa {numeroMesa} fue entregado?",
                "Sí, entregar", "No");

            if (confirmar)
            {
                try
                {
                    System.Diagnostics.Debug.WriteLine($"[ENTREGAR] Cambiando estado de pedido {pedido.Id} a Entregado");

                    // Actualizar estado en la API a "Entregado"
                    var pedidoActualizado = await _pedidoService.ActualizarEstadoAsync(pedido.Id, "Entregado");

                    if (pedidoActualizado != null)
                    {
                        pedido.Entregar();

                        System.Diagnostics.Debug.WriteLine($"[ENTREGAR] Pedido {pedido.Id} actualizado exitosamente");

                        await Application.Current.MainPage.DisplayAlert("✅ Entregado",
                            $"Pedido de la mesa {numeroMesa} marcado como entregado.\nAhora puedes proceder al cobro.", "OK");

                        // Actualizar la vista
                        AplicarFiltro();
                    }
                    else
                    {
                        System.Diagnostics.Debug.WriteLine($"[ENTREGAR] Error: La API retornó null");
                        await Application.Current.MainPage.DisplayAlert("Error",
                            "No se pudo actualizar el pedido en el servidor", "OK");
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[ENTREGAR] Error: {ex.Message}");
                    await Application.Current.MainPage.DisplayAlert("Error",
                        $"Error al entregar pedido: {ex.Message}", "OK");
                }
            }
        }


        private async Task CancelarPedido(Pedido pedido)
        {
            if (pedido == null) return;

            // Verificar que se pueda cancelar (EnProceso o Entregado)
            if (pedido.Estado != EstadoPedido.EnProceso && pedido.Estado != EstadoPedido.Entregado)
            {
                await Application.Current.MainPage.DisplayAlert("No permitido",
                    "Solo se pueden cancelar pedidos en proceso o entregados", "OK");
                return;
            }
            // Pedir motivo de cancelación
            string motivo = await Application.Current.MainPage.DisplayPromptAsync(
                "Cancelar Pedido",
                "¿Por qué deseas cancelar este pedido?",
                "Cancelar Pedido",
                "Volver",
                "Escribe el motivo...",
                maxLength: 100);

            if (!string.IsNullOrEmpty(motivo))
            {
                try
                {
                    System.Diagnostics.Debug.WriteLine($"[CANCELAR] Cancelando pedido {pedido.Id}. Motivo: {motivo}");

                    // Actualizar estado en la API a "Cancelado"
                    await _pedidoService.ActualizarEstadoAsync(pedido.Id, "Cancelado");

                    pedido.Cancelar();

                    // Remover de la lista
                    _todosPedidos.Remove(pedido);
                    AplicarFiltro();
                    CantidadPedidosActivos--;

                    // Si la mesa no tiene más pedidos activos, liberarla
                    await _mesaService.ActualizarEstadoAsync(pedido.Mesa.Id, "Disponible");

                    await Application.Current.MainPage.DisplayAlert("Cancelado",
                        $"Pedido de la mesa {pedido.Mesa.Numero} cancelado.\nMotivo: {motivo}", "OK");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[CANCELAR] Error: {ex.Message}");
                    await Application.Current.MainPage.DisplayAlert("Error",
                        $"Error al cancelar pedido: {ex.Message}", "OK");
                }
            }
        }

        private async Task GuardarCambiosPedido(Pedido pedido)
        {
            try
            {
                // En implementación real, enviar cambios a API
                await Task.Delay(200); // Simular llamada a API
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error guardando cambios: {ex.Message}");
            }
        }

        private async Task Actualizar()
        {
            await CargarPedidos();
        }

        // Método para actualizar tiempos transcurridos
        private void ActualizarTiemposTranscurridos()
        {
            foreach (var pedido in _todosPedidos)
            {
                pedido.ActualizarTiempoTranscurrido();
            }
        }

        // Timer para actualización automática
        private Timer _timerActualizacion;

        public void IniciarActualizacionAutomatica()
        {
            _timerActualizacion = new Timer(async _ =>
            {
                await MainThread.InvokeOnMainThreadAsync(() =>
                {
                    ActualizarTiemposTranscurridos();
                });
            }, null, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(30));
        }

        public void DetenerActualizacionAutomatica()
        {
            _timerActualizacion?.Dispose();
        }

        ~PedidosActivosViewModel()
        {
            DetenerActualizacionAutomatica();
        }
    }
}