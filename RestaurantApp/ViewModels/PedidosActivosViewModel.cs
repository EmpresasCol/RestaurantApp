using RestaurantApp.Models;
using System.Collections.ObjectModel;
using System.Windows.Input;
using RestaurantApp.Helpers;

namespace RestaurantApp.ViewModels
{
    public class PedidosActivosViewModel : BaseViewModel
    {
        private int _cantidadPedidosActivos;
        private FiltroEstado _filtroSeleccionado;
        private DateTime _ultimaActualizacion;
        private List<Pedido> _todosPedidos;

        public PedidosActivosViewModel()
        {
            Title = "Pedidos Activos";

            // Inicializar colecciones
            PedidosFiltrados = new ObservableCollection<Pedido>();
            FiltrosEstado = new ObservableCollection<FiltroEstado>();
            _todosPedidos = new List<Pedido>();

            // Inicializar comandos
            InicializarComandos();

            // Cargar datos iniciales
            CargarFiltros();
            CargarPedidos();
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

        private void InicializarComandos()
        {
            SeleccionarFiltroCommand = new Command<FiltroEstado>(SeleccionarFiltro);
            EditarPedidoCommand = new AsyncCommand<Pedido>(EditarPedido);
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

        private async Task CargarPedidos()
        {
            await ExecuteAsync(async () =>
            {
                // En implementación real, consultar API
                _todosPedidos = await ObtenerPedidosDesdeFuente();
                CantidadPedidosActivos = _todosPedidos.Count(p => p.Estado != EstadoPedido.Pagado && p.Estado != EstadoPedido.Cancelado);
                UltimaActualizacion = DateTime.Now;

                AplicarFiltro();

                // Actualizar tiempos transcurridos
                ActualizarTiemposTranscurridos();
            });
        }

        private async Task<List<Pedido>> ObtenerPedidosDesdeFuente()
        {
            // Simular delay de red
            await Task.Delay(500);

            return GenerarPedidosPrueba();
        }

        private List<Pedido> GenerarPedidosPrueba()
        {
            var pedidos = new List<Pedido>();
            var random = new Random();
            var estados = new[] { EstadoPedido.EnProceso, EstadoPedido.Listo, EstadoPedido.Pagado };

            for (int i = 1; i <= 6; i++)
            {
                var estado = estados[random.Next(estados.Length)];
                var fechaHora = DateTime.Now.AddMinutes(-random.Next(5, 180));

                var pedido = new Pedido
                {
                    Id = i,
                    Mesa = new Mesa { Id = i, Numero = random.Next(1, 13) },
                    FechaHora = fechaHora,
                    Estado = estado,
                    NotasEspeciales = i % 3 == 0 ? "Sin cebolla, extra salsa" : null,
                    Items = GenerarItemsPedidoPrueba(random.Next(1, 5))
                };

                pedido.CalcularTotal();
                pedido.ActualizarTiempoTranscurrido();

                pedidos.Add(pedido);
            }

            return pedidos.Where(p => p.Estado != EstadoPedido.Pagado).ToList();
        }

        private List<ItemPedido> GenerarItemsPedidoPrueba(int cantidad)
        {
            var items = new List<ItemPedido>();
            var platillos = new[]
            {
                new { Nombre = "Hamburguesa", Precio = 15000m },
                new { Nombre = "Pizza", Precio = 22000m },
                new { Nombre = "Ensalada", Precio = 12000m },
                new { Nombre = "Pasta", Precio = 18000m },
                new { Nombre = "Coca Cola", Precio = 3000m }
            };

            var random = new Random();

            for (int i = 0; i < cantidad; i++)
            {
                var platillo = platillos[random.Next(platillos.Length)];
                items.Add(new ItemPedido
                {
                    Id = i + 1,
                    Platillo = new Platillo { Nombre = platillo.Nombre, Precio = platillo.Precio },
                    Cantidad = random.Next(1, 4),
                    PrecioUnitario = platillo.Precio,
                    EstadoItem = i == 0 ? EstadoItemPedido.EnPreparacion : EstadoItemPedido.Pendiente
                });
            }

            foreach (var item in items)
            {
                item.CalcularSubtotal();
            }

            return items;
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
            // Implementar selector de mesa
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
                pedido.Completar();
                await GuardarCambiosPedido(pedido);
                await Actualizar();

                await Application.Current.MainPage.DisplayAlert("Éxito",
                    "Pedido marcado como completado", "OK");
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
                pedido.Cancelar();
                await GuardarCambiosPedido(pedido);

                // Remover de la lista
                _todosPedidos.Remove(pedido);
                AplicarFiltro();
                CantidadPedidosActivos--;

                await Application.Current.MainPage.DisplayAlert("Cancelado",
                    "Pedido cancelado correctamente", "OK");
            }
        }

        private async Task GuardarCambiosPedido(Pedido pedido)
        {
            // En implementación real, enviar cambios a API
            await Task.Delay(200); // Simular llamada a API
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

    // Comando async genérico con parámetro
    public class AsyncCommand<T> : ICommand
    {
        private readonly Func<T, Task> _execute;
        private readonly Func<T, bool> _canExecute;
        private bool _isExecuting;

        public AsyncCommand(Func<T, Task> execute, Func<T, bool> canExecute = null)
        {
            _execute = execute;
            _canExecute = canExecute;
        }

        public bool CanExecute(object parameter)
        {
            return !_isExecuting && (_canExecute?.Invoke((T)parameter) ?? true);
        }

        public async void Execute(object parameter)
        {
            if (CanExecute(parameter))
            {
                try
                {
                    _isExecuting = true;
                    await _execute((T)parameter);
                }
                finally
                {
                    _isExecuting = false;
                }
            }

            RaiseCanExecuteChanged();
        }

        public event EventHandler CanExecuteChanged;

        public void RaiseCanExecuteChanged()
        {
            CanExecuteChanged?.Invoke(this, EventArgs.Empty);
        }
    }
}