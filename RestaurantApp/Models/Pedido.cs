using System.ComponentModel;

namespace RestaurantApp.Models
{
    public class Pedido : INotifyPropertyChanged
    {
        private int _id;
        private Mesa _mesa;
        private Usuario _usuario;
        private DateTime _fechaHora;
        private EstadoPedido _estado;
        private decimal _total;
        private string _notasEspeciales;
        private string _tiempoTranscurrido;
        private Color _estadoColor;
        private bool _tieneNotas;
        private bool _puedeCompletar;

        public Pedido()
        {
            Items = new List<ItemPedido>();
            FechaHora = DateTime.Now;
            Estado = EstadoPedido.EnProceso;
            ActualizarEstadoColor();
        }

        // Propiedades principales
        public int Id
        {
            get => _id;
            set => SetProperty(ref _id, value);
        }

        public Mesa Mesa
        {
            get => _mesa;
            set => SetProperty(ref _mesa, value);
        }

        public Usuario Usuario
        {
            get => _usuario;
            set => SetProperty(ref _usuario, value);
        }

        public DateTime FechaHora
        {
            get => _fechaHora;
            set
            {
                if (SetProperty(ref _fechaHora, value))
                {
                    ActualizarTiempoTranscurrido();
                }
            }
        }

        public EstadoPedido Estado
        {
            get => _estado;
            set
            {
                if (SetProperty(ref _estado, value))
                {
                    ActualizarEstadoColor();
                    PuedeCompletar = value == EstadoPedido.EnProceso;
                }
            }
        }

        public decimal Total
        {
            get => _total;
            set => SetProperty(ref _total, value);
        }

        public string NotasEspeciales
        {
            get => _notasEspeciales;
            set
            {
                if (SetProperty(ref _notasEspeciales, value))
                {
                    TieneNotas = !string.IsNullOrWhiteSpace(value);
                }
            }
        }

        public string TiempoTranscurrido
        {
            get => _tiempoTranscurrido;
            set => SetProperty(ref _tiempoTranscurrido, value);
        }

        public Color EstadoColor
        {
            get => _estadoColor;
            set => SetProperty(ref _estadoColor, value);
        }

        public bool TieneNotas
        {
            get => _tieneNotas;
            set => SetProperty(ref _tieneNotas, value);
        }

        public bool PuedeCompletar
        {
            get => _puedeCompletar;
            set => SetProperty(ref _puedeCompletar, value);
        }

        // Relaciones
        public List<ItemPedido> Items { get; set; }

        // Propiedades calculadas
        public decimal Subtotal => Items.Sum(i => i.Subtotal);
        public decimal IVA => Subtotal * 0.19m;
        public int CantidadItems => Items.Sum(i => i.Cantidad);
        public string EstadoTexto => Estado.ToString();
        public bool PuedeEntregar => Estado == EstadoPedido.Listo;

        // Métodos
        private void ActualizarEstadoColor()
        {
            EstadoColor = Estado switch
            {
                EstadoPedido.EnProceso => Colors.Orange,
                EstadoPedido.Listo => Colors.Green,
                EstadoPedido.Entregado => Colors.Blue,  
                EstadoPedido.Pagado => Colors.Purple,
                EstadoPedido.Cancelado => Colors.Red,
                _ => Colors.Gray
            };
        }

        public void ActualizarTiempoTranscurrido()
        {
            var tiempo = DateTime.Now - FechaHora;
            TiempoTranscurrido = tiempo.TotalHours >= 1
                ? $"{tiempo.Hours}h {tiempo.Minutes}min"
                : $"{tiempo.Minutes}min";
        }

        public void CalcularTotal()
        {
            Total = Subtotal + IVA;
        }

        public void AgregarItem(ItemPedido item)
        {
            Items.Add(item);
            CalcularTotal();
        }

        public void RemoverItem(ItemPedido item)
        {
            Items.Remove(item);
            CalcularTotal();
        }

        public void Completar()
        {
            Estado = EstadoPedido.Listo;
        }

        public void Cancelar()
        {
            Estado = EstadoPedido.Cancelado;
        }
        public void Entregar()
        {
            Estado = EstadoPedido.Entregado;
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
