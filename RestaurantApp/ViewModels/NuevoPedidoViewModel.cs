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
        public bool PuedeConfirmarPedido => MesaSeleccionada != null && ItemsPedidoActual.Count > 0 && !IsBusy;
        public DateTime FechaHora => DateTime.Now;
        public string ResumenPedido => $"{TotalItems} items • ${TotalPedido:N0}";
        public bool TienePedidoActual => ItemsPedidoActual.Count > 0;

        // Comandos
        public ICommand SeleccionarCategoriaCommand { get; private set; }
        public ICommand SeleccionarMesaCommand { get; private set; }
        public ICommand AumentarCantidadCommand { get; private set; }
        public ICommand DisminuirCantidadCommand { get; private set; }
        public ICommand AgregarProductoCommand { get; private set; }
        public ICommand EliminarItemCommand { get; private set; }
        public ICommand LimpiarPedidoCommand { get; private set; }
        public ICommand ConfirmarPedidoCommand { get; private set; }
        public ICommand BuscarProductoCommand { get; private set; }

        private void InicializarComandos()
        {
            SeleccionarCategoriaCommand = new Command<Categoria>(SeleccionarCategoria);
            SeleccionarMesaCommand = new Command<Mesa>(SeleccionarMesa);
            AumentarCantidadCommand = new Command<Platillo>(AumentarCantidad);
            DisminuirCantidadCommand = new Command<Platillo>(DisminuirCantidad);
            AgregarProductoCommand = new Command<Platillo>(AgregarProducto);
            EliminarItemCommand = new Command<ItemPedido>(EliminarItem);
            LimpiarPedidoCommand = new Command(LimpiarPedido);
            ConfirmarPedidoCommand = new AsyncCommand(ConfirmarPedido, () => PuedeConfirmarPedido);
            BuscarProductoCommand = new Command(FiltrarProductos);
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
                foreach (var mesa in mesas.Where(m => m.Estado == EstadoMesa.Disponible || m.Estado == EstadoMesa.Ocupada))
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

                // Asignar categorías a los platillos
                foreach (var platillo in _todosLosPlatillos)
                {
                    if (platillo.CategoriaId == 0)
                    {
                        platillo.CategoriaId = ObtenerCategoriaIdPorNombre(platillo.Nombre);
                    }
                }

                FiltrarProductos();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error cargando productos: {ex.Message}");
            }
        }

        private int ObtenerCategoriaIdPorNombre(string nombreProducto)
        {
            var nombre = nombreProducto.ToLower();
            if (nombre.Contains("ensalada") || nombre.Contains("bruschetta"))
                return 1; // Entradas
            else if (nombre.Contains("hamburguesa") || nombre.Contains("pizza") || nombre.Contains("pasta"))
                return 2; // Platos Principales
            else if (nombre.Contains("coca") || nombre.Contains("jugo") || nombre.Contains("cerveza"))
                return 3; // Bebidas
            else if (nombre.Contains("tiramisu") || nombre.Contains("cheesecake"))
                return 4; // Postres
            else
                return 5; // Adicionales
        }

        // Métodos de interacción
        private void SeleccionarCategoria(Categoria categoria)
        {
            if (categoria != null)
            {
                CategoriaSeleccionada = categoria;
            }
        }

        private void SeleccionarMesa(Mesa mesa)
        {
            if (mesa == null) return;

            // Solo permitir seleccionar mesas disponibles u ocupadas (para agregar más pedidos)
            if (mesa.Estado != EstadoMesa.Disponible && mesa.Estado != EstadoMesa.Ocupada)
            {
                MainThread.BeginInvokeOnMainThread(async () =>
                {
                    await Application.Current.MainPage.DisplayAlert("Mesa no disponible",
                        $"La mesa {mesa.Numero} no está disponible en este momento", "OK");
                });
                return;
            }

            // Deseleccionar la mesa anterior
            if (MesaSeleccionada != null)
            {
                MesaSeleccionada.EstaSeleccionada = false;
            }

            // Seleccionar la nueva mesa
            mesa.EstaSeleccionada = true;
            MesaSeleccionada = mesa;

            System.Diagnostics.Debug.WriteLine($"Mesa {mesa.Numero} seleccionada");
        }

        private void FiltrarProductos()
        {
            if (_todosLosPlatillos == null || !_todosLosPlatillos.Any())
                return;

            var productosFiltrados = _todosLosPlatillos.AsEnumerable();

            // Filtrar por categoría
            if (CategoriaSeleccionada != null)
            {
                productosFiltrados = productosFiltrados.Where(p => p.CategoriaId == CategoriaSeleccionada.Id);
            }

            // Filtrar por búsqueda
            if (!string.IsNullOrWhiteSpace(BusquedaTexto))
            {
                productosFiltrados = productosFiltrados.Where(p =>
                    p.Nombre.Contains(BusquedaTexto, StringComparison.OrdinalIgnoreCase) ||
                    (p.Descripcion != null && p.Descripcion.Contains(BusquedaTexto, StringComparison.OrdinalIgnoreCase)));
            }

            PlatillosFiltrados.Clear();
            foreach (var producto in productosFiltrados)
            {
                PlatillosFiltrados.Add(producto);
            }
        }

        private void AumentarCantidad(Platillo platillo)
        {
            if (platillo != null)
            {
                platillo.CantidadTemporal++;
                ActualizarItemEnPedido(platillo);
            }
        }

        private void DisminuirCantidad(Platillo platillo)
        {
            if (platillo != null && platillo.CantidadTemporal > 0)
            {
                platillo.CantidadTemporal--;
                ActualizarItemEnPedido(platillo);
            }
        }

        private void AgregarProducto(Platillo platillo)
        {
            if (platillo != null)
            {
                platillo.CantidadTemporal = Math.Max(1, platillo.CantidadTemporal);
                ActualizarItemEnPedido(platillo);
            }
        }

        private void ActualizarItemEnPedido(Platillo platillo)
        {
            var itemExistente = ItemsPedidoActual.FirstOrDefault(x => x.PlatilloId == platillo.Id);

            if (platillo.CantidadTemporal == 0)
            {
                if (itemExistente != null)
                {
                    ItemsPedidoActual.Remove(itemExistente);
                }
            }
            else if (itemExistente != null)
            {
                itemExistente.Cantidad = platillo.CantidadTemporal;
                itemExistente.CalcularSubtotal();
            }
            else
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
                    System.Diagnostics.Debug.WriteLine($"InnerException Type: {ex.InnerException.GetType().FullName}");
                    System.Diagnostics.Debug.WriteLine($"InnerException Message: {ex.InnerException.Message}");
                    System.Diagnostics.Debug.WriteLine($"InnerException StackTrace: {ex.InnerException.StackTrace}");
                }
                System.Diagnostics.Debug.WriteLine($"===========================");

                // Mostrar el error en pantalla también
                await Application.Current.MainPage.DisplayAlert("ERROR",
                    $"{ex.GetType().Name}\n\n{ex.Message}\n\n{ex.InnerException?.Message}",
                    "OK");
            }
        }

        // Métodos de persistencia temporal
        public void GuardarEstadoTemporal()
        {
            try
            {
                if (ItemsPedidoActual.Any() || MesaSeleccionada != null)
                {
                    var estadoTemporal = new
                    {
                        MesaId = MesaSeleccionada?.Id,
                        Items = ItemsPedidoActual.Select(i => new { i.PlatilloId, i.Cantidad, i.PrecioUnitario }).ToList(),
                        Notas = NotasEspeciales,
                        Fecha = DateTime.Now
                    };

                    var json = System.Text.Json.JsonSerializer.Serialize(estadoTemporal);
                    Preferences.Set("PedidoTemporal", json);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error guardando estado temporal: {ex.Message}");
            }
        }

        public void CargarPedidoTemporal()
        {
            try
            {
                var json = Preferences.Get("PedidoTemporal", string.Empty);
                if (!string.IsNullOrEmpty(json))
                {
                    // En implementación real, deserializar y restaurar estado
                    // Por ahora solo limpiamos el temporal
                    Preferences.Remove("PedidoTemporal");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error cargando estado temporal: {ex.Message}");
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
    }
}