// RestaurantApp/ViewModels/NuevoPedidoViewModel.cs
using RestaurantApp.Models;
using RestaurantApp.Services;
using System.Collections.ObjectModel;
using System.Windows.Input;
using RestaurantApp.Config;
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

        public NuevoPedidoViewModel()
        {
            Title = "Nuevo Pedido";

            // Inicializar servicios
            _mesaService = new MesaService();
            _platilloService = new PlatilloService();
            _pedidoService = new PedidoService();
            _usuarioService = new UsuarioService();

            // Inicializar colecciones
            MesasDisponibles = new ObservableCollection<Mesa>();
            Categorias = new ObservableCollection<Categoria>();
            PlatillosFiltrados = new ObservableCollection<Platillo>();
            ItemsPedidoActual = new ObservableCollection<ItemPedido>();

            // Cargar datos iniciales
            CargarDatos();

            // Inicializar comandos
            InicializarComandos();

            // Configurar eventos
            ItemsPedidoActual.CollectionChanged += (s, e) => ActualizarTotales();
        }

        // Propiedades principales
        public ObservableCollection<Mesa> MesasDisponibles { get; }
        public ObservableCollection<Categoria> Categorias { get; }
        public ObservableCollection<Platillo> PlatillosFiltrados { get; }
        public ObservableCollection<ItemPedido> ItemsPedidoActual { get; }

        public Mesa MesaSeleccionada
        {
            get => _mesaSeleccionada;
            set => SetProperty(ref _mesaSeleccionada, value, onChanged: () => OnPropertyChanged(nameof(PuedeConfirmarPedido)));
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

        // Comandos
        public ICommand SeleccionarCategoriaCommand { get; private set; }
        public ICommand AgregarItemCommand { get; private set; }
        public ICommand QuitarItemCommand { get; private set; }
        public ICommand EliminarItemCommand { get; private set; }
        public ICommand LimpiarPedidoCommand { get; private set; }
        public ICommand ConfirmarPedidoCommand { get; private set; }
        public ICommand BuscarProductoCommand { get; private set; }
        public ICommand VolverInicioCommand { get; private set; }

        private void InicializarComandos()
        {
            SeleccionarCategoriaCommand = new Command<Categoria>(categoria => CategoriaSeleccionada = categoria);
            AgregarItemCommand = new Command<Platillo>(AgregarItem);
            QuitarItemCommand = new Command<ItemPedido>(item => { if (item.Cantidad > 1) item.Cantidad--; });
            EliminarItemCommand = new Command<ItemPedido>(EliminarItem);
            LimpiarPedidoCommand = new Command(LimpiarPedido);
            ConfirmarPedidoCommand = new AsyncCommand(ConfirmarPedido, () => PuedeConfirmarPedido);
            BuscarProductoCommand = new Command(FiltrarProductos);
            VolverInicioCommand = new AsyncCommand(async () => await Shell.Current.GoToAsync("//inicio"));
        }

        // Métodos de carga de datos
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

            // Seleccionar primera categoría por defecto
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

                // ✅ YA NO necesitamos asignar categorías manualmente
                // Los platillos ya vienen con CategoriaTexto de la BD

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
                // Intentar cargar pedido temporal guardado
                var mesaId = Preferences.Get("pedido_temporal_mesa_id", 0);
                var notas = Preferences.Get("pedido_temporal_notas", string.Empty);
                var itemsCount = Preferences.Get("pedido_temporal_items_count", 0);

                if (mesaId > 0 && itemsCount > 0)
                {
                    System.Diagnostics.Debug.WriteLine($"Pedido temporal encontrado: Mesa {mesaId}, {itemsCount} items");

                    // Restaurar mesa seleccionada
                    MesaSeleccionada = MesasDisponibles.FirstOrDefault(m => m.Id == mesaId);

                    // Restaurar notas
                    NotasEspeciales = notas;

                    // Nota: Los items del pedido se perderán entre sesiones
                    // Si quieres persistirlos, necesitarás serializar la lista completa
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error cargando pedido temporal: {ex.Message}");
            }
        }

        // Métodos de filtrado
        private void FiltrarProductos()
        {
            if (CategoriaSeleccionada == null || _todosLosPlatillos == null)
                return;

            var productosFiltrados = _todosLosPlatillos.AsEnumerable();

            // Filtrar por categoría seleccionada
            if (CategoriaSeleccionada.Id != 0) // 0 = "Todos"
            {
                // ✅ USAR CategoriaNombre en lugar de comparar con enum
                productosFiltrados = productosFiltrados
                    .Where(p => p.CategoriaNombre != null &&
                           p.CategoriaNombre.Equals(CategoriaSeleccionada.Nombre, StringComparison.OrdinalIgnoreCase));
            }

            // Filtrar por búsqueda
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

        // Métodos de manipulación del pedido
        private void AgregarItem(Platillo platillo)
        {
            if (platillo == null || !platillo.EstaDisponible)
                return;

            // Buscar si ya existe en el pedido
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
                    Cantidad = platillo.CantidadTemporal,
                    PrecioUnitario = platillo.Precio
                };
                nuevoItem.CalcularSubtotal();
                ItemsPedidoActual.Add(nuevoItem);
            }
        }

        private void EliminarItem(ItemPedido item)
        {
            if (item != null)
            {
                ItemsPedidoActual.Remove(item);

                // Actualizar cantidad temporal del platillo
                var platillo = PlatillosFiltrados.FirstOrDefault(p => p.Id == item.PlatilloId);
                if (platillo != null)
                {
                    platillo.CantidadTemporal = 0;
                }
            }
        }

        private void LimpiarPedido()
        {
            ItemsPedidoActual.Clear();

            // Resetear cantidades temporales
            foreach (var platillo in PlatillosFiltrados)
            {
                platillo.CantidadTemporal = 0;
            }

            NotasEspeciales = string.Empty;
            MesaSeleccionada = null;
        }

        private void ActualizarTotales()
        {
            TotalPedido = ItemsPedidoActual.Sum(x => x.Subtotal);
            TotalItems = ItemsPedidoActual.Sum(x => x.Cantidad);
            OnPropertyChanged(nameof(PuedeConfirmarPedido));
            OnPropertyChanged(nameof(ResumenPedido));
            OnPropertyChanged(nameof(TienePedidoActual));
        }

        private async Task ConfirmarPedido()
        {
            if (!PuedeConfirmarPedido)
                return;

            try
            {
                System.Diagnostics.Debug.WriteLine("=== INICIO CONFIRMACIÓN PEDIDO ===");
                System.Diagnostics.Debug.WriteLine($"URL Base: {ApiConfig.BaseUrl}");
                System.Diagnostics.Debug.WriteLine($"Mesa Seleccionada: {MesaSeleccionada?.Id}");
                System.Diagnostics.Debug.WriteLine($"Cantidad de Items: {ItemsPedidoActual.Count}");

                // Verificar conexión primero
                System.Diagnostics.Debug.WriteLine("Verificando conexión...");
                var httpService = new HttpService();
                var conectado = await httpService.CheckConnectionAsync();

                System.Diagnostics.Debug.WriteLine($"Conexión: {(conectado ? "EXITOSA" : "FALLIDA")}");

                // Obtener usuario actual
                var usuarioId = _usuarioService.ObtenerUsuarioIdActual();
                System.Diagnostics.Debug.WriteLine($"Usuario ID: {usuarioId}");

                if (usuarioId == 0)
                {
                    System.Diagnostics.Debug.WriteLine("ERROR: No hay sesión activa");
                    return;
                }

                // Crear request para la API
                var request = new CrearPedidoRequest
                {
                    MesaId = MesaSeleccionada.Id,
                    UsuarioId = usuarioId,
                    Detalles = ItemsPedidoActual.Select(item => new CrearPedidoDetalleRequest
                    {
                        PlatilloId = item.PlatilloId,
                        Cantidad = item.Cantidad,
                        Nota = item.AdicionesEspeciales ?? NotasEspeciales
                    }).ToList()
                };

                System.Diagnostics.Debug.WriteLine($"Request JSON: {System.Text.Json.JsonSerializer.Serialize(request)}");
                System.Diagnostics.Debug.WriteLine("Enviando pedido...");

                // Enviar pedido a la API
                var pedidoCreado = await _pedidoService.CrearPedidoAsync(request);

                System.Diagnostics.Debug.WriteLine($"Pedido creado con ID: {pedidoCreado.Id}");

                // Actualizar estado de la mesa
                await _mesaService.ActualizarEstadoAsync(MesaSeleccionada.Id, "Ocupada");

                System.Diagnostics.Debug.WriteLine("=== PEDIDO CONFIRMADO EXITOSAMENTE ===");

                // Mostrar confirmación
                await Application.Current.MainPage.DisplayAlert("Éxito",
                    $"Pedido #{pedidoCreado.Id} confirmado para mesa {MesaSeleccionada.Numero}\nTotal: ${pedidoCreado.Total:N0}", "OK");

                // Limpiar y volver al inicio
                LimpiarPedido();
                await Shell.Current.GoToAsync("//inicio");
            }
            catch (Exception ex)
            {
                // Solo mostrar el error exacto del sistema
                System.Diagnostics.Debug.WriteLine($"========== ERROR ==========");
                System.Diagnostics.Debug.WriteLine($"Type: {ex.GetType().FullName}");
                System.Diagnostics.Debug.WriteLine($"Message: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"StackTrace: {ex.StackTrace}");

                if (ex.InnerException != null)
                {
                    System.Diagnostics.Debug.WriteLine($"InnerException: {ex.InnerException.Message}");
                }

                System.Diagnostics.Debug.WriteLine($"===========================");

                await Application.Current.MainPage.DisplayAlert("Error",
                    $"No se pudo confirmar el pedido:\n{ex.Message}\n\nVerifica la conexión con el servidor.", "OK");
            }
        }

        // ✅ MÉTODOS PÚBLICOS ADICIONALES
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
            // Guardar el estado temporal del pedido
            try
            {
                if (ItemsPedidoActual.Any())
                {
                    // Guardar información básica del pedido temporal
                    Preferences.Set("pedido_temporal_mesa_id", MesaSeleccionada?.Id ?? 0);
                    Preferences.Set("pedido_temporal_notas", NotasEspeciales ?? string.Empty);
                    Preferences.Set("pedido_temporal_items_count", ItemsPedidoActual.Count);

                    System.Diagnostics.Debug.WriteLine($"Estado temporal guardado: {ItemsPedidoActual.Count} items");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error guardando estado temporal: {ex.Message}");
            }
        }
    }
}