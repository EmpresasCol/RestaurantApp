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

        public Mesa()
        {
            Pedidos = new List<Pedido>();
            ActualizarColorEstado();
        }

        // Propiedades principales
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
                EstadoMesa.Ocupada => Colors.Red,
                EstadoMesa.EsperandoPago => Colors.Orange,
                EstadoMesa.Limpieza => Colors.Blue,
                EstadoMesa.Reservada => Colors.Purple,
                EstadoMesa.FueraDeServicio => Colors.Gray,
                _ => Colors.Gray
            };
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
    }
}