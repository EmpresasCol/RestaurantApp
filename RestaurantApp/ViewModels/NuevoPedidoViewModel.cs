using RestaurantApp.Models;
using RestaurantApp.Services;
using System.Collections.ObjectModel;
using System.Windows.Input;
using RestaurantApp.Helpers;


namespace RestaurantApp.ViewModels
{
    public class NuevoPedidoViewModel : BaseViewModel
    {
        private readonly MesaService _mesaService;
        private readonly PlatilloService _platilloService;
        private readonly PedidoService _pedidoService;
        private readonly UsuarioService _usuarioService;

        private Mesa _mesaSeleccionada;
        private Categoria _categoriaSeleccionada;
        private string _notasEspeciales;
        private decimal _totalPedido;
        private int _totalItems;
        private string _busquedaTexto;
        private string _notasPedido;

        public NuevoPedidoViewModel()
        {
            Title = "Nuevo Pedido";

            _mesaService = new MesaService();
            _platilloService = new PlatilloService();
            _pedidoService = new PedidoService();
            _usuarioService = new UsuarioService();

            MesasDisponibles = new ObservableCollection<Mesa>();
            Categorias = new ObservableCollection<Categoria>();
            PlatillosFiltrados = new ObservableCollection<Platillo>();
            ItemsPedidoActual = new ObservableCollection<ItemPedido>();

            InicializarComandos();
            CargarDatos();

            ItemsPedidoActual.CollectionChanged += (s, e) => ActualizarTotales();
        }

        // ==================== PROPIEDADES ====================
        public ObservableCollection<Mesa> MesasDisponibles { get; }
        public ObservableCollection<Categoria> Categorias { get; }
        public ObservableCollection<Platillo> PlatillosFiltrados { get; }
        public ObservableCollection<ItemPedido> ItemsPedidoActual { get; }

        public Mesa MesaSeleccionada
        {
            get => _mesaSeleccionada;
            set
            {
                if (SetProperty(ref _mesaSeleccionada, value))
                {
                    OnPropertyChanged(nameof(PuedeConfirmarPedido));
                }
            }
        }

        public Categoria CategoriaSeleccionada
        {
            get => _categoriaSeleccionada;
            set => SetProperty(ref _categoriaSeleccionada, value, onChanged: FiltrarProductos);
        }

        public string NotasEspeciales
        {
            get => _notasEspeciales;
            set => SetProperty(ref _notasEspeciales, value);
        }

        public string NotasPedido
        {
            get => _notasPedido;
            set => SetProperty(ref _notasPedido, value);
        }

        public decimal TotalPedido
        {
            get => _totalPedido;
            set => SetProperty(ref _totalPedido, value);
        }

        public int TotalItems
        {
            get => _totalItems;
            set => SetProperty(ref _totalItems, value);
        }

        public string BusquedaTexto
        {
            get => _busquedaTexto;
            set => SetProperty(ref _busquedaTexto, value, onChanged: FiltrarProductos);
        }

        // Propiedades calculadas
        public bool PuedeConfirmarPedido => MesaSeleccionada != null && ItemsPedidoActual.Count > 0;
        public bool TienePedidoActual => ItemsPedidoActual.Count > 0;
        public string ResumenPedido => $"{TotalItems} items • ${TotalPedido:N0}";
        public int CantidadItemsPedido => ItemsPedidoActual.Count;

        // ==================== COMANDOS ====================
        public ICommand SeleccionarMesaCommand { get; private set; }
        public ICommand SeleccionarCategoriaCommand { get; private set; }
        public ICommand AgregarProductoCommand { get; private set; }
        public ICommand AumentarCantidadCommand { get; private set; }
        public ICommand DisminuirCantidadCommand { get; private set; }
        public ICommand EliminarItemCommand { get; private set; }
        public ICommand LimpiarPedidoCommand { get; private set; }
        public ICommand ConfirmarPedidoCommand { get; private set; }
        public ICommand BuscarProductoCommand { get; private set; }
        public ICommand VolverInicioCommand { get; private set; }

        private void InicializarComandos()
        {
            SeleccionarMesaCommand = new Command<Mesa>(SeleccionarMesa);
            SeleccionarCategoriaCommand = new Command<Categoria>(categoria => CategoriaSeleccionada = categoria);
            AgregarProductoCommand = new Command<Platillo>(AgregarProducto);
            AumentarCantidadCommand = new Command<Platillo>(AumentarCantidad);
            DisminuirCantidadCommand = new Command<Platillo>(DisminuirCantidad);
            EliminarItemCommand = new Command<ItemPedido>(EliminarItem);
            LimpiarPedidoCommand = new Command(LimpiarPedido);
            ConfirmarPedidoCommand = new AsyncCommand(ConfirmarPedido, () => PuedeConfirmarPedido);
            BuscarProductoCommand = new Command(FiltrarProductos);
            VolverInicioCommand = new AsyncCommand(async () => await Shell.Current.GoToAsync("//inicio"));
        }

        // ==================== MÉTODOS DE SELECCIÓN ====================

        private void SeleccionarMesa(Mesa mesa)
        {
            if (mesa == null) return;

            // ✅ PERMITIR SELECCIONAR CUALQUIER MESA (no importa el estado)

            // Deseleccionar la anterior
            if (MesaSeleccionada != null)
            {
                MesaSeleccionada.EstaSeleccionada = false;
            }

            // Seleccionar la nueva
            mesa.EstaSeleccionada = true;
            MesaSeleccionada = mesa;

            System.Diagnostics.Debug.WriteLine($"Mesa seleccionada: {mesa.Numero}");
        }

        // ==================== CARGA DE DATOS ====================

        private async void CargarDatos()
        {
            await ExecuteAsync(async () =>
            {
                await CargarMesas();
                await CargarCategorias();
                await CargarProductos();
                CargarPedidoTemporal();
            });
        }

        private async Task CargarMesas()
        {
            try
            {
                var mesas = await _mesaService.ObtenerTodasAsync();

                MesasDisponibles.Clear();
                foreach (var mesa in mesas.OrderBy(m => m.Numero))
                {
                    // ✅ AGREGAR TODAS LAS MESAS SIN FILTRAR
                    MesasDisponibles.Add(mesa);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error cargando mesas: {ex.Message}");
            }
        }

        private async Task CargarCategorias()
        {
            var categorias = Categoria.ObtenerCategoriasPorDefecto();

            Categorias.Clear();
            foreach (var categoria in categorias)
            {
                Categorias.Add(categoria);
            }

            if (Categorias.Any())
            {
                CategoriaSeleccionada = Categorias.First();
            }
        }

        private List<Platillo> _todosLosPlatillos;

        private async Task CargarProductos()
        {
            try
            {
                _todosLosPlatillos = await _platilloService.ObtenerTodosAsync();
                FiltrarProductos();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error cargando productos: {ex.Message}");
                await Application.Current.MainPage.DisplayAlert("Error",
                    "No se pudieron cargar los platillos. Verifica la conexión con el servidor.", "OK");
            }
        }

        private void CargarPedidoTemporal()
        {
            try
            {
                var mesaId = Preferences.Get("pedido_temporal_mesa_id", 0);
                var notas = Preferences.Get("pedido_temporal_notas", string.Empty);
                var itemsCount = Preferences.Get("pedido_temporal_items_count", 0);

                if (mesaId > 0 && itemsCount > 0)
                {
                    System.Diagnostics.Debug.WriteLine($"Pedido temporal encontrado: Mesa {mesaId}, {itemsCount} items");
                    MesaSeleccionada = MesasDisponibles.FirstOrDefault(m => m.Id == mesaId);
                    NotasEspeciales = notas;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error cargando pedido temporal: {ex.Message}");
            }
        }

        // ==================== FILTRADO ====================

        private void FiltrarProductos()
        {
            if (CategoriaSeleccionada == null || _todosLosPlatillos == null)
                return;

            var productosFiltrados = _todosLosPlatillos.AsEnumerable();

            if (CategoriaSeleccionada.Id != 0)
            {
                productosFiltrados = productosFiltrados
                    .Where(p => p.CategoriaNombre != null &&
                           p.CategoriaNombre.Equals(CategoriaSeleccionada.Nombre, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(BusquedaTexto))
            {
                productosFiltrados = productosFiltrados
                    .Where(p => p.Nombre.Contains(BusquedaTexto, StringComparison.OrdinalIgnoreCase));
            }

            PlatillosFiltrados.Clear();
            foreach (var platillo in productosFiltrados.OrderBy(p => p.Nombre))
            {
                PlatillosFiltrados.Add(platillo);
            }
        }

        // ==================== MANEJO DE PRODUCTOS ====================

        private void AgregarProducto(Platillo platillo)
        {
            if (platillo == null || !platillo.EstaDisponible)
                return;

            var itemExistente = ItemsPedidoActual.FirstOrDefault(x => x.PlatilloId == platillo.Id);

            if (itemExistente != null)
            {
                itemExistente.Cantidad++;
            }
            else
            {
                platillo.CantidadTemporal = 1;
                var nuevoItem = new ItemPedido
                {
                    PlatilloId = platillo.Id,
                    Platillo = platillo,
                    Cantidad = 1,
                    PrecioUnitario = platillo.Precio
                };
                nuevoItem.CalcularSubtotal();
                ItemsPedidoActual.Add(nuevoItem);
            }

            OnPropertyChanged(nameof(CantidadItemsPedido));
        }

        private void AumentarCantidad(Platillo platillo)
        {
            if (platillo == null) return;

            platillo.CantidadTemporal++;

            var itemExistente = ItemsPedidoActual.FirstOrDefault(x => x.PlatilloId == platillo.Id);
            if (itemExistente != null)
            {
                itemExistente.Cantidad = platillo.CantidadTemporal;
            }
            else if (platillo.CantidadTemporal > 0)
            {
                var nuevoItem = new ItemPedido
                {
                    PlatilloId = platillo.Id,
                    Platillo = platillo,
                    Cantidad = platillo.CantidadTemporal,
                    PrecioUnitario = platillo.Precio
                };
                nuevoItem.CalcularSubtotal();
                ItemsPedidoActual.Add(nuevoItem);
            }

            OnPropertyChanged(nameof(CantidadItemsPedido));
        }

        private void DisminuirCantidad(Platillo platillo)
        {
            if (platillo == null || platillo.CantidadTemporal <= 0) return;

            platillo.CantidadTemporal--;

            var itemExistente = ItemsPedidoActual.FirstOrDefault(x => x.PlatilloId == platillo.Id);
            if (itemExistente != null)
            {
                if (platillo.CantidadTemporal > 0)
                {
                    itemExistente.Cantidad = platillo.CantidadTemporal;
                }
                else
                {
                    ItemsPedidoActual.Remove(itemExistente);
                }
            }

            OnPropertyChanged(nameof(CantidadItemsPedido));
        }

        private void EliminarItem(ItemPedido item)
        {
            if (item != null)
            {
                ItemsPedidoActual.Remove(item);

                var platillo = PlatillosFiltrados.FirstOrDefault(p => p.Id == item.PlatilloId);
                if (platillo != null)
                {
                    platillo.CantidadTemporal = 0;
                }

                OnPropertyChanged(nameof(CantidadItemsPedido));
            }
        }

        private void LimpiarPedido()
        {
            ItemsPedidoActual.Clear();

            foreach (var platillo in PlatillosFiltrados)
            {
                platillo.CantidadTemporal = 0;
            }

            NotasEspeciales = string.Empty;
            NotasPedido = string.Empty;
            MesaSeleccionada = null;

            OnPropertyChanged(nameof(CantidadItemsPedido));
        }

        private void ActualizarTotales()
        {
            TotalPedido = ItemsPedidoActual.Sum(x => x.Subtotal);
            TotalItems = ItemsPedidoActual.Sum(x => x.Cantidad);
            OnPropertyChanged(nameof(PuedeConfirmarPedido));
            OnPropertyChanged(nameof(ResumenPedido));
            OnPropertyChanged(nameof(TienePedidoActual));
            OnPropertyChanged(nameof(CantidadItemsPedido));
        }

        // ==================== CONFIRMAR PEDIDO ====================

        private async Task ConfirmarPedido()
        {
            if (!PuedeConfirmarPedido)
                return;

            try
            {
                System.Diagnostics.Debug.WriteLine("=== INICIO CONFIRMACIÓN PEDIDO ===");
                System.Diagnostics.Debug.WriteLine($"Mesa: {MesaSeleccionada?.Numero}");
                System.Diagnostics.Debug.WriteLine($"Items: {ItemsPedidoActual.Count}");

                var usuarioId = _usuarioService.ObtenerUsuarioIdActual();
                if (usuarioId == 0)
                {
                    await Application.Current.MainPage.DisplayAlert("Error",
                        "No hay sesión activa", "OK");
                    return;
                }

                var request = new CrearPedidoRequest
                {
                    MesaId = MesaSeleccionada.Id,
                    UsuarioId = usuarioId,
                    Detalles = ItemsPedidoActual.Select(item => new CrearPedidoDetalleRequest
                    {
                        PlatilloId = item.PlatilloId,
                        Cantidad = item.Cantidad,
                        Nota = item.AdicionesEspeciales ?? NotasPedido
                    }).ToList()
                };

                var pedidoCreado = await _pedidoService.CrearPedidoAsync(request);

                await _mesaService.ActualizarEstadoAsync(MesaSeleccionada.Id, "Ocupada");

                await Application.Current.MainPage.DisplayAlert("Éxito",
                    $"Pedido #{pedidoCreado.Id} confirmado para mesa {MesaSeleccionada.Numero}\nTotal: ${pedidoCreado.Total:N0}", "OK");

                LimpiarPedido();
                await Shell.Current.GoToAsync("//inicio");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ERROR: {ex.Message}");
                await Application.Current.MainPage.DisplayAlert("Error",
                    $"No se pudo confirmar el pedido:\n{ex.Message}", "OK");
            }
        }

        public async Task ActualizarDatos()
        {
            await ExecuteAsync(async () =>
            {
                await CargarMesas();
                await CargarProductos();
            });
        }

        public void GuardarEstadoTemporal()
        {
            try
            {
                if (ItemsPedidoActual.Any())
                {
                    Preferences.Set("pedido_temporal_mesa_id", MesaSeleccionada?.Id ?? 0);
                    Preferences.Set("pedido_temporal_notas", NotasEspeciales ?? string.Empty);
                    Preferences.Set("pedido_temporal_items_count", ItemsPedidoActual.Count);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error guardando estado temporal: {ex.Message}");
            }
        }
    }
}