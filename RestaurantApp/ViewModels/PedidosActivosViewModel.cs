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

        // ✅ MÉTODOS DE ACCIÓN ACTUALIZADOS

        // EDITAR: Solo primeros 5 minutos en estado EnProceso
        private async Task EditarPedido(Pedido pedido)
        {
            if (pedido == null) return;

            // Verificar que se pueda editar
            if (!pedido.PuedeEditar)
            {
                await Application.Current.MainPage.DisplayAlert("No permitido",
                    "Solo se pueden editar pedidos en los primeros 5 minutos después de creados", "OK");
                return;
            }

            // TODO: Implementar navegación a edición
            await Application.Current.MainPage.DisplayAlert("Editar",
                $"Función de edición para pedido #{pedido.Id}\n(Por implementar)", "OK");
        }

        // ENTREGAR: Después de 5 minutos de EnProceso
        private async Task EntregarPedido(Pedido pedido)
        {
            if (pedido == null) return;

            System.Diagnostics.Debug.WriteLine($"[ENTREGAR] Pedido ID: {pedido.Id}, Estado: {pedido.Estado}");

            // Verificar que se pueda entregar
            if (!pedido.PuedeEntregar)
            {
                await Application.Current.MainPage.DisplayAlert("No disponible",
                    "El pedido debe estar en proceso y haber pasado al menos 5 minutos desde su creación", "OK");
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
                $"¿Confirmar que el pedido de la mesa {numeroMesa} fue entregado al cliente?",
                "Sí, entregar", "No");

            if (confirmar)
            {
                try
                {
                    System.Diagnostics.Debug.WriteLine($"[ENTREGAR] Cambiando estado a Entregado");

                    // Actualizar estado en la API
                    var pedidoActualizado = await _pedidoService.ActualizarEstadoAsync(pedido.Id, "Entregado");

                    if (pedidoActualizado != null)
                    {
                        pedido.Entregar();

                        System.Diagnostics.Debug.WriteLine($"[ENTREGAR] Éxito. Ahora puede proceder al cobro");

                        await Application.Current.MainPage.DisplayAlert("✅ Entregado",
                            $"Pedido de la mesa {numeroMesa} marcado como entregado.\nAhora puedes proceder al cobro.", "OK");

                        // Actualizar vista
                        AplicarFiltro();
                    }
                    else
                    {
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

        // COBRAR: De Entregado a Pagado
        private async Task CompletarPedido(Pedido pedido)
        {
            if (pedido == null) return;

            // Verificar que pueda cobrarse
            if (!pedido.PuedeCobrar)
            {
                await Application.Current.MainPage.DisplayAlert("No disponible",
                    "Solo se pueden cobrar pedidos que ya fueron entregados", "OK");
                return;
            }

            try
            {
                // ✅ PASO 1: Seleccionar método de pago
                string metodoPago = await Application.Current.MainPage.DisplayActionSheet(
                    $"Selecciona el método de pago\n\nTotal a cobrar: ${pedido.Total:N0}",
                    "Cancelar",
                    null,
                    "💵 Efectivo",
                    "💳 Tarjeta",
                    "📱 QR / Transferencia",
                    "🔹 Otro"
                );

                if (metodoPago == "Cancelar" || string.IsNullOrEmpty(metodoPago))
                    return;

                // Mapear la selección al enum
                string metodoPagoEnum = metodoPago switch
                {
                    "💵 Efectivo" => "Efectivo",
                    "💳 Tarjeta" => "Tarjeta",
                    "📱 QR / Transferencia" => "QR",
                    "🔹 Otro" => "Otro",
                    _ => "Efectivo"
                };

                // ✅ PASO 2: Preguntar por propina (opcional)
                string propinaStr = await Application.Current.MainPage.DisplayPromptAsync(
                    "Propina (Opcional)",
                    "¿El cliente dejó propina?",
                    "Continuar",
                    "Sin propina",
                    "0",
                    keyboard: Keyboard.Numeric);

                decimal montoPropina = 0;
                if (!string.IsNullOrEmpty(propinaStr) && decimal.TryParse(propinaStr, out decimal propina))
                {
                    montoPropina = propina;
                }

                // ✅ PASO 3: Confirmar el cobro
                string mensajeConfirmacion = $"Resumen del cobro:\n\n" +
                    $"Subtotal: ${pedido.Total:N0}\n" +
                    $"Propina: ${montoPropina:N0}\n" +
                    $"Total: ${(pedido.Total + montoPropina):N0}\n\n" +
                    $"Método de pago: {metodoPagoEnum}\n\n" +
                    $"¿Confirmar cobro?";

                bool confirmar = await Application.Current.MainPage.DisplayAlert(
                    "Confirmar Cobro",
                    mensajeConfirmacion,
                    "Sí, cobrar",
                    "Cancelar");

                if (!confirmar)
                    return;

                System.Diagnostics.Debug.WriteLine($"[COBRAR] Procesando pago...");

                // ✅ PASO 4: Registrar el pago en la API
                var pagoService = new PagoService();
                var pagoRequest = new CrearPagoRequest
                {
                    PedidoId = pedido.Id,
                    Monto = pedido.Total,
                    MontoPropina = montoPropina,
                    MetodoPago = metodoPagoEnum
                };

                var pagoCreado = await pagoService.CrearPagoAsync(pagoRequest);

                // ✅ PASO 5: Actualizar estado del pedido a Pagado
                await _pedidoService.ActualizarEstadoAsync(pedido.Id, "Pagado");
                pedido.Completar();

                // ✅ PASO 6: Liberar la mesa
                await _mesaService.ActualizarEstadoAsync(pedido.Mesa.Id, "Disponible");

                // ✅ PASO 7: Remover de la lista de activos
                _todosPedidos.Remove(pedido);
                AplicarFiltro();
                CantidadPedidosActivos--;

                // ✅ PASO 8: Mostrar confirmación
                await Application.Current.MainPage.DisplayAlert(
                    "✅ Cobro Exitoso",
                    $"Pedido #{pedido.Id} cobrado correctamente\n\n" +
                    $"Total cobrado: ${(pedido.Total + montoPropina):N0}\n" +
                    $"Método: {metodoPagoEnum}\n\n" +
                    $"La mesa {pedido.Mesa.Numero} está disponible nuevamente.",
                    "OK");

                System.Diagnostics.Debug.WriteLine($"[COBRAR] Éxito - Pago ID: {pagoCreado.Id}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[COBRAR] Error: {ex.Message}");
                await Application.Current.MainPage.DisplayAlert("Error",
                    $"Error al procesar el cobro: {ex.Message}", "OK");
            }
        }

        // CANCELAR: EnProceso o Entregado
        private async Task CancelarPedido(Pedido pedido)
        {
            if (pedido == null) return;

            // Verificar que se pueda cancelar
            if (!pedido.PuedeCancelar)
            {
                await Application.Current.MainPage.DisplayAlert("No permitido",
                    "Este pedido ya no puede ser cancelado", "OK");
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
                    System.Diagnostics.Debug.WriteLine($"[CANCELAR] Pedido {pedido.Id}. Motivo: {motivo}");

                    // Actualizar estado en la API
                    await _pedidoService.ActualizarEstadoAsync(pedido.Id, "Cancelado");

                    pedido.Cancelar();

                    // Remover de la lista
                    _todosPedidos.Remove(pedido);
                    AplicarFiltro();
                    CantidadPedidosActivos--;

                    // Liberar la mesa
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