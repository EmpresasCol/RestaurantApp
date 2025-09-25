using RestaurantApp.Models;
using System.Collections.ObjectModel;
using System.Windows.Input;
using RestaurantApp.Helpers;

namespace RestaurantApp.ViewModels
{
    public class NuevoPedidoViewModel : BaseViewModel
    {
        private Mesa _mesaSeleccionada;
        private Categoria _categoriaSeleccionada;
        private string _notasEspeciales;
        private decimal _totalPedido;
        private int _totalItems;
        private string _busquedaTexto;

        public NuevoPedidoViewModel()
        {
            Title = "Nuevo Pedido";

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
            // En implementación real, consultar API
            var mesas = GenerarMesasPrueba();

            MesasDisponibles.Clear();
            foreach (var mesa in mesas)
            {
                MesasDisponibles.Add(mesa);
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

        private async Task CargarProductos()
        {
            var productos = GenerarProductosPrueba();

            PlatillosFiltrados.Clear();
            foreach (var producto in productos)
            {
                PlatillosFiltrados.Add(producto);
            }
        }

        private List<Mesa> GenerarMesasPrueba()
        {
            var mesas = new List<Mesa>();
            var random = new Random();

            for (int i = 1; i <= 12; i++)
            {
                var estado = random.Next(1, 5) == 1 ? EstadoMesa.Ocupada : EstadoMesa.Disponible;
                mesas.Add(new Mesa
                {
                    Id = i,
                    Numero = i,
                    Estado = estado,
                    Capacidad = random.Next(2, 7),
                    ColorEstado = estado == EstadoMesa.Disponible ? Colors.Green : Colors.Red
                });
            }

            return mesas;
        }

        private List<Platillo> GenerarProductosPrueba()
        {
            return new List<Platillo>
            {
                // Entradas
                new Platillo { Id = 1, Nombre = "Ensalada César", Descripcion = "Lechuga romana, pollo grillado, crutones", Precio = 12000, CategoriaId = 1, Categoria = CategoriaProducto.Entrada, ImagenUrl = "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=150", TiempoPreparacion = 10 },
                new Platillo { Id = 2, Nombre = "Bruschetta", Descripcion = "Pan tostado con tomate fresco y albahaca", Precio = 8000, CategoriaId = 1, Categoria = CategoriaProducto.Entrada, TiempoPreparacion = 8 },
                
                // Platos Principales
                new Platillo { Id = 3, Nombre = "Hamburguesa Clásica", Descripcion = "Carne de res, lechuga, tomate, cebolla", Precio = 15000, CategoriaId = 2, Categoria = CategoriaProducto.PlatoPrincipal, ImagenUrl = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=150", TiempoPreparacion = 15 },
                new Platillo { Id = 4, Nombre = "Pizza Margherita", Descripcion = "Salsa de tomate, mozzarella, albahaca", Precio = 22000, CategoriaId = 2, Categoria = CategoriaProducto.PlatoPrincipal, ImagenUrl = "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=150", TiempoPreparacion = 20 },
                new Platillo { Id = 5, Nombre = "Pasta Alfredo", Descripcion = "Fettuccine con salsa cremosa de queso", Precio = 18000, CategoriaId = 2, Categoria = CategoriaProducto.PlatoPrincipal, TiempoPreparacion = 18 },
                
                // Bebidas
                new Platillo { Id = 6, Nombre = "Coca Cola", Descripcion = "Bebida gaseosa 350ml", Precio = 3000, CategoriaId = 3, Categoria = CategoriaProducto.Bebida, TiempoPreparacion = 1 },
                new Platillo { Id = 7, Nombre = "Jugo Natural", Descripcion = "Jugo de fruta natural 400ml", Precio = 4500, CategoriaId = 3, Categoria = CategoriaProducto.Bebida, TiempoPreparacion = 3 },
                new Platillo { Id = 8, Nombre = "Cerveza", Descripcion = "Cerveza nacional 330ml", Precio = 5000, CategoriaId = 3, Categoria = CategoriaProducto.Bebida, TiempoPreparacion = 1 },
                
                // Postres
                new Platillo { Id = 9, Nombre = "Tiramisu", Descripcion = "Postre italiano con café y mascarpone", Precio = 8000, CategoriaId = 4, Categoria = CategoriaProducto.Postre, ImagenUrl = "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=150", TiempoPreparacion = 5 },
                new Platillo { Id = 10, Nombre = "Cheesecake", Descripcion = "Tarta de queso con frutos rojos", Precio = 7000, CategoriaId = 4, Categoria = CategoriaProducto.Postre, TiempoPreparacion = 5 }
            };
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
            if (mesa != null && mesa.Estado == EstadoMesa.Disponible)
            {
                MesaSeleccionada = mesa;
            }
        }

        private void FiltrarProductos()
        {
            var todosLosProductos = GenerarProductosPrueba();
            var productosFiltrados = todosLosProductos.AsEnumerable();

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
                    p.Descripcion.Contains(BusquedaTexto, StringComparison.OrdinalIgnoreCase));
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
                // Crear pedido
                var pedido = new Pedido
                {
                    Mesa = MesaSeleccionada,
                    FechaHora = DateTime.Now,
                    Estado = EstadoPedido.EnProceso,
                    NotasEspeciales = NotasEspeciales,
                    Items = ItemsPedidoActual.ToList()
                };

                pedido.CalcularTotal();

                // En implementación real, enviar a API
                await SimularEnvioPedido(pedido);

                // Marcar mesa como ocupada
                MesaSeleccionada.OcuparMesa();

                // Mostrar confirmación
                await Application.Current.MainPage.DisplayAlert("Éxito",
                    $"Pedido confirmado para mesa {MesaSeleccionada.Numero}\nTotal: ${pedido.Total:N0}", "OK");

                // Limpiar y volver al inicio
                LimpiarPedido();
                await Shell.Current.GoToAsync("//inicio");
            }
            catch (Exception ex)
            {
                await Application.Current.MainPage.DisplayAlert("Error",
                    $"Error al confirmar pedido: {ex.Message}", "OK");
            }
        }

        private async Task SimularEnvioPedido(Pedido pedido)
        {
            // Simular delay de red
            await Task.Delay(1000);

            // Guardar pedido localmente
            var pedidosGuardados = Preferences.Get("PedidosTemp", "[]");
            // En implementación real, serializar y guardar
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

        public void ActualizarDatos()
        {
            CargarDatos();
        }
    }
}