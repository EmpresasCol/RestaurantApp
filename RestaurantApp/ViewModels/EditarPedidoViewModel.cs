// RestaurantApp/ViewModels/EditarPedidoViewModel.cs
using RestaurantApp.Models;
using RestaurantApp.Services;
using System.Collections.ObjectModel;
using System.Windows.Input;
using RestaurantApp.Helpers;

namespace RestaurantApp.ViewModels
{
    [QueryProperty(nameof(PedidoId), "id")]
    public class EditarPedidoViewModel : BaseViewModel
    {
        private readonly PedidoService _pedidoService;
        private readonly PlatilloService _platilloService;
        private readonly MesaService _mesaService;

        private int _pedidoId;
        private Mesa _mesa;
        private Pedido _pedidoOriginal;
        private Categoria _categoriaSeleccionada;
        private string _notasEspeciales;
        private decimal _totalPedido;
        private int _totalItems;

        public EditarPedidoViewModel()
        {
            Title = "Editar Pedido";

            _pedidoService = new PedidoService();
            _platilloService = new PlatilloService();
            _mesaService = new MesaService();

            Categorias = new ObservableCollection<Categoria>();
            PlatillosFiltrados = new ObservableCollection<Platillo>();
            ItemsPedido = new ObservableCollection<ItemPedido>();

            // Cargar categorías y platillos al iniciar
            _ = CargarCategorias();
            _ = CargarPlatillos();

            InicializarComandos();

            ItemsPedido.CollectionChanged += (s, e) => ActualizarTotales();
        }

        // Propiedades
        public int PedidoId
        {
            get => _pedidoId;
            set
            {
                if (int.TryParse(value.ToString(), out var id))
                {
                    _pedidoId = id;
                    System.Diagnostics.Debug.WriteLine($"[EDITAR] PedidoId recibido: {id}");
                    if (id > 0)
                    {
                        Task.Run(async () => await CargarPedido(id));
                    }
                }
            }
        }
        public Mesa Mesa
        {
            get => _mesa;
            set => SetProperty(ref _mesa, value);
        }

        public Categoria CategoriaSeleccionada
        {
            get => _categoriaSeleccionada;
            set => SetProperty(ref _categoriaSeleccionada, value, onChanged: FiltrarPlatillos);
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

        public ObservableCollection<Categoria> Categorias { get; }
        public ObservableCollection<Platillo> PlatillosFiltrados { get; }
        public ObservableCollection<ItemPedido> ItemsPedido { get; }

        // Propiedades calculadas
        public string NumeroPedido => $"Pedido #{PedidoId}";
        public string MesaInfo => Mesa != null ? $"Mesa {Mesa.Numero}" : "Cargando...";
        public string ResumenPedido => $"{TotalItems} items • ${TotalPedido:N0}";
        public bool PuedeGuardar => ItemsPedido.Count > 0 && !IsBusy;

        // Comandos
        public ICommand SeleccionarCategoriaCommand { get; private set; }
        public ICommand AgregarPlatilloCommand { get; private set; }
        public ICommand AumentarCantidadCommand { get; private set; }
        public ICommand DisminuirCantidadCommand { get; private set; }
        public ICommand EliminarItemCommand { get; private set; }
        public ICommand GuardarCommand { get; private set; }
        public ICommand CancelarCommand { get; private set; }

        private void InicializarComandos()
        {
            SeleccionarCategoriaCommand = new Command<Categoria>(SeleccionarCategoria);
            AgregarPlatilloCommand = new Command<Platillo>(AgregarPlatillo);
            AumentarCantidadCommand = new Command<ItemPedido>(AumentarCantidad);
            DisminuirCantidadCommand = new Command<ItemPedido>(DisminuirCantidad);
            EliminarItemCommand = new Command<ItemPedido>(EliminarItem);
            GuardarCommand = new AsyncCommand(GuardarCambios);
            CancelarCommand = new Command(async () => await Shell.Current.GoToAsync("//pedidosactivos"));
        }

        private async Task CargarPedido(int pedidoId)
        {
            try
            {
                IsBusy = true;
                System.Diagnostics.Debug.WriteLine($"[EDITAR] Cargando pedido {pedidoId}");

                // Cargar el pedido
                _pedidoOriginal = await _pedidoService.ObtenerPorIdAsync(pedidoId);

                if (_pedidoOriginal == null)
                {
                    await MainThread.InvokeOnMainThreadAsync(async () =>
                    {
                        await Application.Current.MainPage.DisplayAlert("Error",
                            "No se encontró el pedido", "OK");
                        await Shell.Current.GoToAsync("//pedidosactivos");
                    });
                    return;
                }

                // Establecer la mesa
                Mesa = _pedidoOriginal.Mesa;

                // Cargar categorías y platillos si no están cargados
                if (!Categorias.Any())
                {
                    await CargarCategorias();
                }

                if (!PlatillosFiltrados.Any())
                {
                    await CargarPlatillos();
                }

                // Cargar items del pedido
                await MainThread.InvokeOnMainThreadAsync(() =>
                {
                    ItemsPedido.Clear();
                    foreach (var item in _pedidoOriginal.Items)
                    {
                        ItemsPedido.Add(new ItemPedido
                        {
                            Id = item.Id,
                            PedidoId = pedidoId,
                            PlatilloId = item.PlatilloId,
                            Platillo = item.Platillo,
                            Cantidad = item.Cantidad,
                            PrecioUnitario = item.PrecioUnitario,
                            AdicionesEspeciales = item.AdicionesEspeciales
                        });
                    }

                    NotasEspeciales = _pedidoOriginal.NotasEspeciales;
                    ActualizarTotales();
                });

                System.Diagnostics.Debug.WriteLine($"[EDITAR] Pedido cargado: Mesa {Mesa.Numero}, {ItemsPedido.Count} items");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[EDITAR] Error: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"[EDITAR] StackTrace: {ex.StackTrace}");

                await MainThread.InvokeOnMainThreadAsync(async () =>
                {
                    await Application.Current.MainPage.DisplayAlert("Error",
                        $"No se pudo cargar el pedido: {ex.Message}", "OK");
                    await Shell.Current.GoToAsync("//pedidosactivos");
                });
            }
            finally
            {
                IsBusy = false;
            }
        }

        private async Task CargarCategorias()
        {
            try
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

                await Task.CompletedTask; // Para mantener el método async
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error cargando categorías: {ex.Message}");
            }
        }

        private async Task CargarPlatillos()
        {
            try
            {
                var platillos = await _platilloService.ObtenerTodosAsync();

                PlatillosFiltrados.Clear();
                foreach (var platillo in platillos)
                {
                    PlatillosFiltrados.Add(platillo);
                }

                FiltrarPlatillos();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error cargando platillos: {ex.Message}");
            }
        }

        private void SeleccionarCategoria(Categoria categoria)
        {
            if (categoria != null)
            {
                CategoriaSeleccionada = categoria;
            }
        }

        private void FiltrarPlatillos()
        {
            if (CategoriaSeleccionada == null) return;

            var platillosFiltrados = PlatillosFiltrados
                .Where(p => p.CategoriaId == CategoriaSeleccionada.Id)
                .ToList();

            PlatillosFiltrados.Clear();
            foreach (var platillo in platillosFiltrados)
            {
                PlatillosFiltrados.Add(platillo);
            }
        }

        private void AgregarPlatillo(Platillo platillo)
        {
            if (platillo == null) return;

            var itemExistente = ItemsPedido.FirstOrDefault(i => i.PlatilloId == platillo.Id);

            if (itemExistente != null)
            {
                itemExistente.Cantidad++;
            }
            else
            {
                ItemsPedido.Add(new ItemPedido
                {
                    PlatilloId = platillo.Id,
                    Platillo = platillo,
                    Cantidad = 1,
                    PrecioUnitario = platillo.Precio
                });
            }

            ActualizarTotales();
        }

        private void AumentarCantidad(ItemPedido item)
        {
            if (item != null)
            {
                item.Cantidad++;
                ActualizarTotales();
            }
        }

        private void DisminuirCantidad(ItemPedido item)
        {
            if (item != null && item.Cantidad > 1)
            {
                item.Cantidad--;
                ActualizarTotales();
            }
        }

        private void EliminarItem(ItemPedido item)
        {
            if (item != null)
            {
                ItemsPedido.Remove(item);
                ActualizarTotales();
            }
        }

        private void ActualizarTotales()
        {
            TotalItems = ItemsPedido.Sum(i => i.Cantidad);
            TotalPedido = ItemsPedido.Sum(i => i.Subtotal);
            OnPropertyChanged(nameof(ResumenPedido));
            OnPropertyChanged(nameof(PuedeGuardar));
        }

        private async Task GuardarCambios()
        {
            try
            {
                IsBusy = true;

                if (ItemsPedido.Count == 0)
                {
                    await Application.Current.MainPage.DisplayAlert("Atención",
                        "Debe tener al menos un item en el pedido", "OK");
                    return;
                }

                bool confirmar = await Application.Current.MainPage.DisplayAlert(
                    "Guardar Cambios",
                    $"¿Desea guardar los cambios del pedido #{PedidoId}?\n\nTotal: ${TotalPedido:N0}",
                    "Sí, guardar", "Cancelar");

                if (!confirmar) return;

                System.Diagnostics.Debug.WriteLine($"[EDITAR] Actualizando pedido {PedidoId}");

                // Actualizar el pedido existente
                var request = new CrearPedidoRequest
                {
                    MesaId = Mesa.Id,
                    UsuarioId = 1,
                    Detalles = ItemsPedido.Select(item => new CrearPedidoDetalleRequest
                    {
                        PlatilloId = item.PlatilloId,
                        Cantidad = item.Cantidad,
                        Nota = item.AdicionesEspeciales ?? NotasEspeciales
                    }).ToList()
                };

                var pedidoActualizado = await _pedidoService.ActualizarPedidoCompletoAsync(PedidoId, request);

                await Application.Current.MainPage.DisplayAlert("✅ Éxito",
                    $"Pedido #{pedidoActualizado.Id} actualizado correctamente\nTotal: ${pedidoActualizado.Total:N0}",
                    "OK");

                await Shell.Current.GoToAsync("//pedidosactivos");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[EDITAR] Error: {ex.Message}");
                await Application.Current.MainPage.DisplayAlert("Error",
                    $"No se pudieron guardar los cambios:\n{ex.Message}", "OK");
            }
            finally
            {
                IsBusy = false;
            }
        }
    }
}