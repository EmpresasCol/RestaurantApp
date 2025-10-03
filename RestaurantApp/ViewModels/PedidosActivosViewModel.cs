// RestaurantApp/ViewModels/PedidosActivosViewModel.cs
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

            // Inicializar servicios
            _pedidoService = new PedidoService();
            _mesaService = new MesaService();

            // Inicializar colecciones
            PedidosFiltrados = new ObservableCollection<Pedido>();
            FiltrosEstado = new ObservableCollection<FiltroEstado>();
            _todosPedidos = new List<Pedido>();

            // Inicializar comandos
            InicializarComandos();

            // Cargar datos iniciales
            CargarFiltros();
            _ = CargarPedidos();

            // Iniciar actualización automática
            IniciarActualizacionAutomatica();
        }

        // Propiedades principales
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
            CompletarPedidoCommand = new AsyncCommand<Pedido>(CompletarPedido);
            EntregarPedidoCommand = new AsyncCommand<Pedido>(EntregarPedido); // NUEVO
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

        private async Task CargarPedidos()
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

            var opciones = new[] { "Agregar item", "Modificar notas", "Cambiar mesa" };
            var accion = await Application.Current.MainPage.DisplayActionSheet(
                $"Editar pedido Mesa {pedido.Mesa.Numero}",
                "Cancelar",
                null,
                opciones);

            switch (accion)
            {
                case "Agregar item":
                    await AgregarItemAPedido(pedido);
                    break;
                case "Modificar notas":
                    await ModificarNotas(pedido);
                    break;
                case "Cambiar mesa":
                    await CambiarMesa(pedido);
                    break;
            }
        }

        private async Task AgregarItemAPedido(Pedido pedido)
        {
            await Application.Current.MainPage.DisplayAlert("Agregar Item",
                "Funcionalidad de agregar item pendiente de implementar", "OK");

            // En implementación real:
            // - Navegar a selección de productos
            // - Agregar items al pedido existente
            // - Actualizar total
        }

        private async Task ModificarNotas(Pedido pedido)
        {
            var nuevasNotas = await Application.Current.MainPage.DisplayPromptAsync(
                "Modificar Notas",
                "Ingrese las nuevas notas:",
                initialValue: pedido.NotasEspeciales ?? "");

            if (nuevasNotas != null)
            {
                pedido.NotasEspeciales = nuevasNotas;
                await GuardarCambiosPedido(pedido);
            }
        }

        private async Task CambiarMesa(Pedido pedido)
        {
            await Application.Current.MainPage.DisplayAlert("Cambiar Mesa",
                "Funcionalidad de cambio de mesa pendiente", "OK");
        }

        private async Task CompletarPedido(Pedido pedido)
        {
            if (pedido == null) return;

            bool confirmar = await Application.Current.MainPage.DisplayAlert(
                "Confirmar",
                $"¿Marcar como completado el pedido de la mesa {pedido.Mesa.Numero}?",
                "Sí", "No");

            if (confirmar)
            {
                try
                {
                    // Actualizar estado en la API
                    await _pedidoService.ActualizarEstadoAsync(pedido.Id, "Listo");

                    pedido.Completar();
                    await Actualizar();

                    await Application.Current.MainPage.DisplayAlert("Éxito",
                        "Pedido marcado como completado", "OK");
                }
                catch (Exception ex)
                {
                    await Application.Current.MainPage.DisplayAlert("Error",
                        $"Error al completar pedido: {ex.Message}", "OK");
                }
            }
        }
        private async Task EntregarPedido(Pedido pedido)
        {
            if (pedido == null) return;

            // Verificar que el pedido esté listo
            if (pedido.Estado != EstadoPedido.Listo)
            {
                await Application.Current.MainPage.DisplayAlert("No disponible",
                    "Solo se pueden entregar pedidos que estén listos", "OK");
                return;
            }

            bool confirmar = await Application.Current.MainPage.DisplayAlert(
                "Confirmar Entrega",
                $"¿Marcar como entregado el pedido de la mesa {pedido.Mesa.Numero}?",
                "Sí", "No");

            if (confirmar)
            {
                try
                {
                    // Actualizar estado en la API a "Entregado"
                    await _pedidoService.ActualizarEstadoAsync(pedido.Id, "Entregado");

                    pedido.Entregar();

                    // Remover de la lista de activos
                    _todosPedidos.Remove(pedido);
                    AplicarFiltro();
                    CantidadPedidosActivos--;

                    await Application.Current.MainPage.DisplayAlert("Entregado",
                        "Pedido marcado como entregado", "OK");
                }
                catch (Exception ex)
                {
                    await Application.Current.MainPage.DisplayAlert("Error",
                        $"Error al entregar pedido: {ex.Message}", "OK");
                }
            }
        }

        private async Task CancelarPedido(Pedido pedido)
        {
            if (pedido == null) return;

            bool confirmar = await Application.Current.MainPage.DisplayAlert(
                "Confirmar Cancelación",
                $"¿Está seguro de cancelar el pedido de la mesa {pedido.Mesa.Numero}?\nEsta acción no se puede deshacer.",
                "Sí, cancelar", "No");

            if (confirmar)
            {
                try
                {
                    // Cancelar en la API
                    var resultado = await _pedidoService.CancelarPedidoAsync(pedido.Id);

                    if (resultado)
                    {
                        // Actualizar estado de la mesa
                        await _mesaService.ActualizarEstadoAsync(pedido.Mesa.Id, "Disponible");

                        // Remover de la lista
                        _todosPedidos.Remove(pedido);
                        AplicarFiltro();
                        CantidadPedidosActivos--;

                        await Application.Current.MainPage.DisplayAlert("Cancelado",
                            "Pedido cancelado correctamente", "OK");
                    }
                }
                catch (Exception ex)
                {
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