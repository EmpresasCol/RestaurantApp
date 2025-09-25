using RestaurantApp.Models;
using System.Collections.ObjectModel;

namespace RestaurantApp.ViewModels
{
    public class MeseroMainViewModel : BaseViewModel
    {
        private int _pedidosActivos;
        private int _mesasAsignadas;
        private decimal _ventasHoy;
        private string _nombreMesero;
        private DateTime _fechaActual;

        public MeseroMainViewModel()
        {
            Title = "Inicio - Mesero";
            NombreMesero = Preferences.Get("NombreMesero", "Juan Pérez");
            FechaActual = DateTime.Now;
            UltimosPedidos = new ObservableCollection<PedidoResumen>();

            // Inicializar datos
            ActualizarDatos();

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
        public void ActualizarDatos()
        {
            ActualizarEstadisticas();
            CargarUltimosPedidos();
            FechaActual = DateTime.Now;
        }

        private void ActualizarEstadisticas()
        {
            // En implementación real, consultar API
            try
            {
                // Simular datos del día
                var fechaHoy = DateTime.Today.ToString("yyyyMMdd");
                PedidosActivos = GenerarNumeroAleatorio(3, 8);
                MesasAsignadas = GenerarNumeroAleatorio(6, 12);
                VentasHoy = GenerarNumeroAleatorio(300000, 800000);

                // Guardar estadísticas del día
                Preferences.Set($"PedidosActivos_{fechaHoy}", PedidosActivos);
                Preferences.Set($"MesasAsignadas_{fechaHoy}", MesasAsignadas);
                Preferences.Set($"VentasHoy_{fechaHoy}", VentasHoy.ToString());
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error actualizando estadísticas: {ex.Message}");
            }
        }

        private void CargarUltimosPedidos()
        {
            try
            {
                UltimosPedidos.Clear();

                // Simular últimos pedidos
                var pedidos = GenerarPedidosPrueba();
                foreach (var pedido in pedidos.OrderByDescending(p => p.FechaHora).Take(5))
                {
                    UltimosPedidos.Add(pedido);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error cargando últimos pedidos: {ex.Message}");
            }
        }

        private List<PedidoResumen> GenerarPedidosPrueba()
        {
            var random = new Random();
            var pedidos = new List<PedidoResumen>();
            var estados = new[] { "En Proceso", "Listo", "Pagado" };
            var colores = new[] { Colors.Orange, Colors.Green, Colors.Blue };

            for (int i = 1; i <= 8; i++)
            {
                var estadoIndex = random.Next(estados.Length);
                pedidos.Add(new PedidoResumen
                {
                    Id = i,
                    NumeroMesa = random.Next(1, 13),
                    FechaHora = DateTime.Now.AddMinutes(-random.Next(5, 120)),
                    CantidadItems = random.Next(1, 6),
                    Total = random.Next(15000, 80000),
                    Estado = estados[estadoIndex],
                    EstadoColor = colores[estadoIndex]
                });
            }

            return pedidos;
        }

        private int GenerarNumeroAleatorio(int min, int max)
        {
            return new Random().Next(min, max + 1);
        }

        private Timer _timerActualizacion;

        private void IniciarActualizacionAutomatica()
        {
            _timerActualizacion = new Timer(async _ =>
            {
                await MainThread.InvokeOnMainThreadAsync(() =>
                {
                    ActualizarDatos();
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

        public async Task IrAEstadoMesas()
        {
            await Shell.Current.GoToAsync("//estadomesas");
        }

        // Cleanup
        ~MeseroMainViewModel()
        {
            DetenerActualizacionAutomatica();
        }
    }
}