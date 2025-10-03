// RestaurantApp/ViewModels/MeseroMainViewModel.cs
using RestaurantApp.Models;
using RestaurantApp.Services;
using System.Collections.ObjectModel;

namespace RestaurantApp.ViewModels
{
    public class MeseroMainViewModel : BaseViewModel
    {
        private readonly PedidoService _pedidoService;
        private readonly MesaService _mesaService;
        private readonly UsuarioService _usuarioService;

        private int _pedidosActivos;
        private int _mesasAsignadas;
        private decimal _ventasHoy;
        private string _nombreMesero;
        private DateTime _fechaActual;

        public MeseroMainViewModel()
        {
            Title = "Inicio - Mesero";

            // Inicializar servicios
            _pedidoService = new PedidoService();
            _mesaService = new MesaService();
            _usuarioService = new UsuarioService();

            NombreMesero = Preferences.Get("NombreMesero", "Mesero");
            FechaActual = DateTime.Now;
            UltimosPedidos = new ObservableCollection<PedidoResumen>();

            // Inicializar datos
            _ = ActualizarDatos();

            // Configurar timer para actualización automática
            IniciarActualizacionAutomatica();
        }

        // Propiedades principales
        public int PedidosActivos
        {
            get => _pedidosActivos;
            set => SetProperty(ref _pedidosActivos, value);
        }

        public int MesasAsignadas
        {
            get => _mesasAsignadas;
            set => SetProperty(ref _mesasAsignadas, value);
        }

        public decimal VentasHoy
        {
            get => _ventasHoy;
            set => SetProperty(ref _ventasHoy, value);
        }

        public string NombreMesero
        {
            get => _nombreMesero;
            set => SetProperty(ref _nombreMesero, value);
        }

        public DateTime FechaActual
        {
            get => _fechaActual;
            set => SetProperty(ref _fechaActual, value);
        }

        public ObservableCollection<PedidoResumen> UltimosPedidos { get; }

        // Propiedades calculadas
        public string SaludoMesero => $"¡Hola, {NombreMesero.Split(' ')[0]}!";
        public string FechaFormateada => FechaActual.ToString("dddd, dd 'de' MMMM");
        public bool TienePedidosActivos => PedidosActivos > 0;
        public string EstadisticasTexto => $"{PedidosActivos} pedidos • {MesasAsignadas} mesas • ${VentasHoy:N0}";

        // Métodos
        public async Task ActualizarDatos()
        {
            await ExecuteAsync(async () =>
            {
                await ActualizarEstadisticas();
                await CargarUltimosPedidos();
                FechaActual = DateTime.Now;
            });
        }

        private async Task ActualizarEstadisticas()
        {
            try
            {
                // Obtener pedidos activos
                var pedidos = await _pedidoService.ObtenerTodosAsync();
                var pedidosHoy = pedidos.Where(p => p.FechaHora.Date == DateTime.Today).ToList();

                PedidosActivos = pedidosHoy.Count(p =>
                    p.Estado == EstadoPedido.EnProceso ||
                    p.Estado == EstadoPedido.Listo);

                // Obtener mesas ocupadas
                var mesas = await _mesaService.ObtenerTodasAsync();
                MesasAsignadas = mesas.Count(m =>
                    m.Estado == EstadoMesa.Ocupada ||
                    m.Estado == EstadoMesa.EsperandoPago);

                // Calcular ventas del día
                VentasHoy = pedidosHoy.Where(p => p.Estado == EstadoPedido.Pagado)
                                      .Sum(p => p.Total);

                // Guardar estadísticas del día
                var fechaHoy = DateTime.Today.ToString("yyyyMMdd");
                Preferences.Set($"PedidosActivos_{fechaHoy}", PedidosActivos);
                Preferences.Set($"MesasAsignadas_{fechaHoy}", MesasAsignadas);
                Preferences.Set($"VentasHoy_{fechaHoy}", VentasHoy.ToString());
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error actualizando estadísticas: {ex.Message}");
                // En caso de error, usar datos locales
                CargarEstadisticasLocales();
            }
        }

        private void CargarEstadisticasLocales()
        {
            var fechaHoy = DateTime.Today.ToString("yyyyMMdd");
            PedidosActivos = Preferences.Get($"PedidosActivos_{fechaHoy}", 0);
            MesasAsignadas = Preferences.Get($"MesasAsignadas_{fechaHoy}", 0);

            if (decimal.TryParse(Preferences.Get($"VentasHoy_{fechaHoy}", "0"), out var ventas))
            {
                VentasHoy = ventas;
            }
        }

        private async Task CargarUltimosPedidos()
        {
            try
            {
                UltimosPedidos.Clear();

                // Obtener últimos pedidos de la API
                var pedidos = await _pedidoService.ObtenerTodosAsync();
                var ultimosPedidos = pedidos
                    .OrderByDescending(p => p.FechaHora)
                    .Take(5)
                    .Select(p => new PedidoResumen
                    {
                        Id = p.Id,
                        NumeroMesa = p.Mesa?.Numero ?? 0,
                        FechaHora = p.FechaHora,
                        CantidadItems = p.CantidadItems,
                        Total = p.Total,
                        Estado = p.EstadoTexto,
                        EstadoColor = p.EstadoColor,
                        TiempoTranscurrido = p.TiempoTranscurrido
                    });

                foreach (var pedido in ultimosPedidos)
                {
                    UltimosPedidos.Add(pedido);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error cargando últimos pedidos: {ex.Message}");
            }
        }

        private Timer _timerActualizacion;

        private void IniciarActualizacionAutomatica()
        {
            _timerActualizacion = new Timer(async _ =>
            {
                await MainThread.InvokeOnMainThreadAsync(async () =>
                {
                    await ActualizarDatos();
                });
            }, null, TimeSpan.FromMinutes(2), TimeSpan.FromMinutes(2));
        }

        public void DetenerActualizacionAutomatica()
        {
            _timerActualizacion?.Dispose();
        }

        // Métodos para navegación específica
        public async Task IrANuevoPedido()
        {
            await Shell.Current.GoToAsync("//nuevopedido");
        }

        public async Task IrAPedidosActivos()
        {
            await Shell.Current.GoToAsync("//pedidosactivos");
        }

        public async Task IrAConfiguracion()
        {
            await Shell.Current.GoToAsync("//configuracion");
        }

        // Cleanup
        ~MeseroMainViewModel()
        {
            DetenerActualizacionAutomatica();
        }
    }
}