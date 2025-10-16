using System.ComponentModel;

namespace RestaurantApp.Models
{
    public class Mesa : INotifyPropertyChanged
    {
        private int _id;
        private int _numero;
        private EstadoMesa _estado;
        private int _capacidad;
        private bool _estaOcupada;
        private Color _colorEstado;
        private string _tiempoOcupada;
        private bool _tienePedidosPendientes;
        private int _cantidadPedidosPendientes;
        private DateTime? _horaOcupacion;
        private string _ubicacion;
        private bool _estaSeleccionada;
        private Color _borderColor;
        private double _opacidadMesa;

        public Mesa()
        {
            Pedidos = new List<Pedido>();
            BorderColor = Colors.Transparent;
            OpacidadMesa = 1.0;
            ActualizarColorEstado();
        }

        // Propiedades principales
        public bool EstaSeleccionada
        {
            get => _estaSeleccionada;
            set
            {
                if (SetProperty(ref _estaSeleccionada, value))
                {
                    ActualizarVisualizacionSeleccion();
                }
            }
        }

        public Color BorderColor
        {
            get => _borderColor;
            set => SetProperty(ref _borderColor, value);
        }

        public double OpacidadMesa
        {
            get => _opacidadMesa;
            set => SetProperty(ref _opacidadMesa, value);
        }
        public int Id
        {
            get => _id;
            set => SetProperty(ref _id, value);
        }

        public int Numero
        {
            get => _numero;
            set => SetProperty(ref _numero, value);
        }

        public EstadoMesa Estado
        {
            get => _estado;
            set
            {
                if (SetProperty(ref _estado, value))
                {
                    ActualizarColorEstado();
                    EstaOcupada = value == EstadoMesa.Ocupada || value == EstadoMesa.EsperandoPago;
                }
            }
        }

        public int Capacidad
        {
            get => _capacidad;
            set => SetProperty(ref _capacidad, value);
        }

        public bool EstaOcupada
        {
            get => _estaOcupada;
            set => SetProperty(ref _estaOcupada, value);
        }

        public Color ColorEstado
        {
            get => _colorEstado;
            set => SetProperty(ref _colorEstado, value);
        }

        public string TiempoOcupada
        {
            get => _tiempoOcupada;
            set => SetProperty(ref _tiempoOcupada, value);
        }

        public bool TienePedidosPendientes
        {
            get => _tienePedidosPendientes;
            set => SetProperty(ref _tienePedidosPendientes, value);
        }

        public int CantidadPedidosPendientes
        {
            get => _cantidadPedidosPendientes;
            set => SetProperty(ref _cantidadPedidosPendientes, value);
        }

        public DateTime? HoraOcupacion
        {
            get => _horaOcupacion;
            set
            {
                if (SetProperty(ref _horaOcupacion, value))
                {
                    ActualizarTiempoOcupada();
                }
            }
        }

        public string Ubicacion
        {
            get => _ubicacion;
            set => SetProperty(ref _ubicacion, value);
        }

        // Relaciones
        public List<Pedido> Pedidos { get; set; }

        // Propiedades calculadas
        public string EstadoTexto => Estado.ToString();
        public string CapacidadTexto => $"👥{Capacidad}";
        public bool PuedeTomarPedido => Estado == EstadoMesa.Disponible || Estado == EstadoMesa.Ocupada;

        // Métodos
        private void ActualizarColorEstado()
        {
            ColorEstado = Estado switch
            {
                EstadoMesa.Disponible => Colors.Green,
                EstadoMesa.Ocupada => Colors.Orange,
                EstadoMesa.EsperandoPago => Colors.Red,
                _ => Colors.Gray
            };

            ActualizarVisualizacionSeleccion();
        }

        public void ActualizarTiempoOcupada()
        {
            if (HoraOcupacion.HasValue && EstaOcupada)
            {
                var tiempo = DateTime.Now - HoraOcupacion.Value;
                TiempoOcupada = tiempo.TotalHours >= 1
                    ? $"{tiempo.Hours}h {tiempo.Minutes}min"
                    : $"{tiempo.Minutes}min";
            }
            else
            {
                TiempoOcupada = null;
            }
        }

        public void OcuparMesa()
        {
            Estado = EstadoMesa.Ocupada;
            HoraOcupacion = DateTime.Now;
        }

        public void LiberarMesa()
        {
            Estado = EstadoMesa.Disponible;
            HoraOcupacion = null;
            TiempoOcupada = null;
        }

        // INotifyPropertyChanged implementation
        public event PropertyChangedEventHandler PropertyChanged;

        protected virtual void OnPropertyChanged([System.Runtime.CompilerServices.CallerMemberName] string propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }

        protected bool SetProperty<T>(ref T backingStore, T value, [System.Runtime.CompilerServices.CallerMemberName] string propertyName = "")
        {
            if (EqualityComparer<T>.Default.Equals(backingStore, value))
                return false;

            backingStore = value;
            OnPropertyChanged(propertyName);
            return true;
        }
        private void ActualizarVisualizacionSeleccion()
        {
            if (EstaSeleccionada)
            {
                BorderColor = Colors.Blue;
                OpacidadMesa = 1.0;
            }
            else
            {
                BorderColor = Colors.Transparent;
                OpacidadMesa = Estado == EstadoMesa.Disponible ? 1.0 : 0.5;
            }
        }
    }
}