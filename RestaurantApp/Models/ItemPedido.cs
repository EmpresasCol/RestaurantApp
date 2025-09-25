using System.ComponentModel;

namespace RestaurantApp.Models
{
    public class ItemPedido : INotifyPropertyChanged
    {
        private int _id;
        private int _pedidoId;
        private Pedido _pedido;
        private int _platilloId;
        private Platillo _platillo;
        private int _cantidad;
        private decimal _precioUnitario;
        private decimal _subtotal;
        private string _adicionesEspeciales;
        private EstadoItemPedido _estadoItem;
        private Color _estadoItemColor;

        public ItemPedido()
        {
            EstadoItem = EstadoItemPedido.Pendiente;
            ActualizarEstadoItemColor();
        }

        // Propiedades principales
        public int Id
        {
            get => _id;
            set => SetProperty(ref _id, value);
        }

        public int PedidoId
        {
            get => _pedidoId;
            set => SetProperty(ref _pedidoId, value);
        }

        public Pedido Pedido
        {
            get => _pedido;
            set => SetProperty(ref _pedido, value);
        }

        public int PlatilloId
        {
            get => _platilloId;
            set => SetProperty(ref _platilloId, value);
        }

        public Platillo Platillo
        {
            get => _platillo;
            set => SetProperty(ref _platillo, value);
        }

        public int Cantidad
        {
            get => _cantidad;
            set
            {
                if (SetProperty(ref _cantidad, value))
                {
                    CalcularSubtotal();
                }
            }
        }

        public decimal PrecioUnitario
        {
            get => _precioUnitario;
            set
            {
                if (SetProperty(ref _precioUnitario, value))
                {
                    CalcularSubtotal();
                }
            }
        }

        public decimal Subtotal
        {
            get => _subtotal;
            set => SetProperty(ref _subtotal, value);
        }

        public string AdicionesEspeciales
        {
            get => _adicionesEspeciales;
            set => SetProperty(ref _adicionesEspeciales, value);
        }

        public EstadoItemPedido EstadoItem
        {
            get => _estadoItem;
            set
            {
                if (SetProperty(ref _estadoItem, value))
                {
                    ActualizarEstadoItemColor();
                }
            }
        }

        public Color EstadoItemColor
        {
            get => _estadoItemColor;
            set => SetProperty(ref _estadoItemColor, value);
        }

        // Propiedades calculadas
        public string EstadoItemTexto => EstadoItem.ToString();
        public bool TieneAdiciones => !string.IsNullOrWhiteSpace(AdicionesEspeciales);

        // Métodos
        public void CalcularSubtotal() // Cambiar de private a public
        {
            Subtotal = Cantidad * PrecioUnitario;
            OnPropertyChanged(nameof(Subtotal));
        }

        private void ActualizarEstadoItemColor()
        {
            EstadoItemColor = EstadoItem switch
            {
                EstadoItemPedido.Pendiente => Colors.Orange,
                EstadoItemPedido.EnPreparacion => Colors.Blue,
                EstadoItemPedido.Listo => Colors.Green,
                EstadoItemPedido.Servido => Colors.Gray,
                EstadoItemPedido.Cancelado => Colors.Red,
                _ => Colors.Gray
            };
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