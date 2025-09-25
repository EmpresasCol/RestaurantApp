// ViewModels/EstadoMesasViewModel.cs
using RestaurantApp.Models;
using RestaurantApp.Helpers;
using System.Collections.ObjectModel;
using System.Windows.Input;

namespace RestaurantApp.ViewModels
{
    public class EstadoMesasViewModel : BaseViewModel
    {
        private int _mesasDisponibles;
        private int _mesasOcupadas;
        private int _mesasEsperandoPago;
        private int _totalMesas;
        private double _porcentajeOcupacion;
        private string _resumenMesas;

        public EstadoMesasViewModel()
        {
            Title = "Estado de Mesas";

            // Inicializar colecciones
            Mesas = new ObservableCollection<Mesa>();

            // Inicializar comandos
            InicializarComandos();

            // Cargar datos iniciales
            _ = CargarMesas();
        }

        // Propiedades principales
        public ObservableCollection<Mesa> Mesas { get; }

        public int MesasDisponibles
        {
            get => _mesasDisponibles;
            set => SetProperty(ref _mesasDisponibles, value);
        }

        public int MesasOcupadas
        {
            get => _mesasOcupadas;
            set => SetProperty(ref _mesasOcupadas, value);
        }

        public int MesasEsperandoPago
        {
            get => _mesasEsperandoPago;
            set => SetProperty(ref _mesasEsperandoPago, value);
        }

        public int TotalMesas
        {
            get => _totalMesas;
            set => SetProperty(ref _totalMesas, value);
        }

        public double PorcentajeOcupacion
        {
            get => _porcentajeOcupacion;
            set => SetProperty(ref _porcentajeOcupacion, value);
        }

        public string ResumenMesas
        {
            get => _resumenMesas;
            set => SetProperty(ref _resumenMesas, value);
        }

        // Comandos
        public ICommand SeleccionarMesaCommand { get; private set; }
        public ICommand ActualizarEstadoCommand { get; private set; }
        public ICommand VerDetallesCommand { get; private set; }

        private void InicializarComandos()
        {
            SeleccionarMesaCommand = new RelayCommand<object>(OnSeleccionarMesa);
            ActualizarEstadoCommand = new RelayCommand(OnActualizarEstado);
            VerDetallesCommand = new RelayCommand(OnVerDetalles);
        }

        // Event handlers para comandos
        private void OnSeleccionarMesa(object parameter)
        {
            if (parameter is Mesa mesa)
            {
                _ = Task.Run(() => SeleccionarMesa(mesa));
            }
        }

        private void OnActualizarEstado()
        {
            _ = Task.Run(() => ActualizarEstado());
        }

        private void OnVerDetalles()
        {
            _ = Task.Run(() => VerDetalles());
        }

        // Métodos de carga
        private async Task CargarMesas()
        {
            try
            {
                IsBusy = true;

                var mesas = await ObtenerMesasDesdeFuente();

                Mesas.Clear();
                foreach (var mesa in mesas)
                {
                    // Actualizar tiempo ocupada si está ocupada
                    if (mesa.EstaOcupada)
                    {
                        mesa.ActualizarTiempoOcupada();
                    }

                    Mesas.Add(mesa);
                }

                ActualizarEstadisticas();
            }
            catch (Exception ex)
            {
                await Application.Current.MainPage.DisplayAlert("Error",
                    $"Error cargando mesas: {ex.Message}", "OK");
                System.Diagnostics.Debug.WriteLine($"Error cargando mesas: {ex}");
            }
            finally
            {
                IsBusy = false;
            }
        }

        private async Task<List<Mesa>> ObtenerMesasDesdeFuente()
        {
            // Simular delay de red
            await Task.Delay(300);

            return GenerarMesasPrueba();
        }

        private List<Mesa> GenerarMesasPrueba()
        {
            var mesas = new List<Mesa>();
            var random = new Random();
            var estados = new[] { EstadoMesa.Disponible, EstadoMesa.Ocupada, EstadoMesa.EsperandoPago, EstadoMesa.Limpieza };

            for (int i = 1; i <= 12; i++)
            {
                var estado = random.Next(1, 10) <= 6 ? EstadoMesa.Disponible : estados[random.Next(1, estados.Length)];
                var mesa = new Mesa
                {
                    Id = i,
                    Numero = i,
                    Estado = estado,
                    Capacidad = random.Next(2, 7),
                    Ubicacion = i <= 6 ? "Planta Baja" : "Planta Alta"
                };

                // Si está ocupada, asignar tiempo de ocupación
                if (estado == EstadoMesa.Ocupada || estado == EstadoMesa.EsperandoPago)
                {
                    mesa.HoraOcupacion = DateTime.Now.AddMinutes(-random.Next(15, 180));
                    mesa.TienePedidosPendientes = random.Next(1, 3) == 1;
                    mesa.CantidadPedidosPendientes = mesa.TienePedidosPendientes ? random.Next(1, 4) : 0;
                }

                mesas.Add(mesa);
            }

            return mesas;
        }

        private void ActualizarEstadisticas()
        {
            TotalMesas = Mesas.Count;
            MesasDisponibles = Mesas.Count(m => m.Estado == EstadoMesa.Disponible);
            MesasOcupadas = Mesas.Count(m => m.Estado == EstadoMesa.Ocupada);
            MesasEsperandoPago = Mesas.Count(m => m.Estado == EstadoMesa.EsperandoPago);

            PorcentajeOcupacion = TotalMesas > 0 ?
                ((double)(MesasOcupadas + MesasEsperandoPago) / TotalMesas) * 100 : 0;

            ResumenMesas = $"{MesasDisponibles} disponibles • {MesasOcupadas} ocupadas • {MesasEsperandoPago} esperando pago";
        }

        // Métodos de interacción
        private async Task SeleccionarMesa(Mesa mesa)
        {
            if (mesa == null) return;

            try
            {
                var opciones = new List<string> { "Ver detalles", "Historial" };

                if (mesa.Estado == EstadoMesa.Disponible)
                {
                    opciones.Add("Tomar pedido");
                }

                if (mesa.Estado != EstadoMesa.Disponible)
                {
                    opciones.Add("Cambiar estado");
                }

                if (mesa.Estado == EstadoMesa.Ocupada)
                {
                    opciones.Add("Liberar mesa");
                }

                var accion = await Application.Current.MainPage.DisplayActionSheet(
                    $"Mesa {mesa.Numero} - {mesa.Estado}",
                    "Cancelar",
                    null,
                    opciones.ToArray());

                switch (accion)
                {
                    case "Ver detalles":
                        await MostrarDetallesMesa(mesa);
                        break;
                    case "Historial":
                        await MostrarHistorialMesa(mesa);
                        break;
                    case "Tomar pedido":
                        await TomarPedidoMesa(mesa);
                        break;
                    case "Cambiar estado":
                        await CambiarEstadoMesa(mesa);
                        break;
                    case "Liberar mesa":
                        await LiberarMesa(mesa);
                        break;
                }
            }
            catch (Exception ex)
            {
                await Application.Current.MainPage.DisplayAlert("Error",
                    $"Error procesando acción: {ex.Message}", "OK");
            }
        }

        private async Task MostrarDetallesMesa(Mesa mesa)
        {
            var detalles = $"Mesa {mesa.Numero}\n\n" +
                          $"Estado: {mesa.EstadoTexto}\n" +
                          $"Capacidad: {mesa.Capacidad} personas\n" +
                          $"Ubicación: {mesa.Ubicacion}\n";

            if (mesa.EstaOcupada)
            {
                detalles += $"Tiempo ocupada: {mesa.TiempoOcupada}\n";

                if (mesa.TienePedidosPendientes)
                {
                    detalles += $"Pedidos pendientes: {mesa.CantidadPedidosPendientes}";
                }
            }

            await Application.Current.MainPage.DisplayAlert("Detalles", detalles, "OK");
        }

        private async Task MostrarHistorialMesa(Mesa mesa)
        {
            var historial = $"Historial de Mesa {mesa.Numero}\n\n" +
                           "• 14:30 - Mesa ocupada\n" +
                           "• 14:45 - Pedido #1 tomado\n" +
                           "• 15:15 - Comida servida\n" +
                           "• 15:45 - Cuenta solicitada\n" +
                           "• 16:00 - Pago procesado";

            await Application.Current.MainPage.DisplayAlert("Historial", historial, "OK");
        }

        private async Task TomarPedidoMesa(Mesa mesa)
        {
            // Navegar a nuevo pedido con mesa preseleccionada
            await Shell.Current.GoToAsync($"//nuevopedido?mesaId={mesa.Id}");
        }

        private async Task CambiarEstadoMesa(Mesa mesa)
        {
            try
            {
                var estados = new[] { "Disponible", "Ocupada", "Esperando Pago", "Limpieza", "Fuera de Servicio" };
                var estadoActual = mesa.EstadoTexto;
                var estadosDisponibles = estados.Where(e => e != estadoActual).ToArray();

                var nuevoEstado = await Application.Current.MainPage.DisplayActionSheet(
                    "Cambiar estado",
                    "Cancelar",
                    null,
                    estadosDisponibles);

                if (!string.IsNullOrEmpty(nuevoEstado) && nuevoEstado != "Cancelar")
                {
                    if (Enum.TryParse<EstadoMesa>(nuevoEstado.Replace(" ", ""), out var estado))
                    {
                        mesa.Estado = estado;

                        if (estado == EstadoMesa.Ocupada)
                        {
                            mesa.HoraOcupacion = DateTime.Now;
                        }
                        else if (estado == EstadoMesa.Disponible)
                        {
                            mesa.LiberarMesa();
                        }

                        await GuardarCambiosMesa(mesa);
                        ActualizarEstadisticas();

                        await Application.Current.MainPage.DisplayAlert("Éxito",
                            $"Estado de mesa {mesa.Numero} cambiado a: {nuevoEstado}", "OK");
                    }
                }
            }
            catch (Exception ex)
            {
                await Application.Current.MainPage.DisplayAlert("Error",
                    $"Error cambiando estado: {ex.Message}", "OK");
            }
        }

        private async Task LiberarMesa(Mesa mesa)
        {
            try
            {
                bool confirmar = await Application.Current.MainPage.DisplayAlert(
                    "Confirmar",
                    $"¿Liberar la mesa {mesa.Numero}?",
                    "Sí", "No");

                if (confirmar)
                {
                    mesa.LiberarMesa();
                    await GuardarCambiosMesa(mesa);
                    ActualizarEstadisticas();

                    await Application.Current.MainPage.DisplayAlert("Éxito",
                        $"Mesa {mesa.Numero} liberada correctamente", "OK");
                }
            }
            catch (Exception ex)
            {
                await Application.Current.MainPage.DisplayAlert("Error",
                    $"Error liberando mesa: {ex.Message}", "OK");
            }
        }

        private async Task GuardarCambiosMesa(Mesa mesa)
        {
            // En implementación real, enviar cambios a API
            await Task.Delay(200);
        }

        private async Task ActualizarEstado()
        {
            await CargarMesas();
        }

        private async Task VerDetalles()
        {
            try
            {
                var detalles = $"Estadísticas Generales\n\n" +
                              $"Total de mesas: {TotalMesas}\n" +
                              $"Disponibles: {MesasDisponibles}\n" +
                              $"Ocupadas: {MesasOcupadas}\n" +
                              $"Esperando pago: {MesasEsperandoPago}\n" +
                              $"Porcentaje de ocupación: {PorcentajeOcupacion:F1}%\n\n" +
                              $"Última actualización: {DateTime.Now:HH:mm:ss}";

                await Application.Current.MainPage.DisplayAlert("Estadísticas", detalles, "OK");
            }
            catch (Exception ex)
            {
                await Application.Current.MainPage.DisplayAlert("Error",
                    $"Error mostrando detalles: {ex.Message}", "OK");
            }
        }

        // Timer para actualización periódica
        private Timer _timerActualizacion;

        public void IniciarActualizacionPeriodica()
        {
            _timerActualizacion = new Timer(async _ =>
            {
                try
                {
                    await MainThread.InvokeOnMainThreadAsync(() =>
                    {
                        // Solo actualizar tiempos, no recargar todo
                        foreach (var mesa in Mesas.Where(m => m.EstaOcupada))
                        {
                            mesa.ActualizarTiempoOcupada();
                        }
                    });
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Error en timer de actualización: {ex}");
                }
            }, null, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1));
        }

        public void DetenerActualizacionPeriodica()
        {
            _timerActualizacion?.Dispose();
            _timerActualizacion = null;
        }

        // Cleanup
        ~EstadoMesasViewModel()
        {
            DetenerActualizacionPeriodica();
        }
    }
}