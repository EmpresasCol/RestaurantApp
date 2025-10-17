using System.ComponentModel;

namespace RestaurantApp.Models
{
    public class Platillo : INotifyPropertyChanged
    {
        private int _id;
        private string _nombre;
        private string _descripcion;
        private decimal _precio;
        private int _categoriaId;
        private CategoriaProducto _categoria;
        private string _categoriaTexto; // ✅ NUEVA PROPIEDAD para la categoría de la BD
        private string _imagenUrl;
        private bool _estaDisponible;
        private int _cantidadTemporal;
        private int _tiempoPreparacion;
        private bool _esEspecial;

        public Platillo()
        {
            EstaDisponible = true;
            CantidadTemporal = 0;
            TiempoPreparacion = 15; // minutos por defecto
        }

        // Propiedades principales
        public int Id
        {
            get => _id;
            set => SetProperty(ref _id, value);
        }

        public string Nombre
        {
            get => _nombre;
            set => SetProperty(ref _nombre, value);
        }

        public string Descripcion
        {
            get => _descripcion;
            set => SetProperty(ref _descripcion, value);
        }

        public decimal Precio
        {
            get => _precio;
            set => SetProperty(ref _precio, value);
        }

        public int CategoriaId
        {
            get => _categoriaId;
            set => SetProperty(ref _categoriaId, value);
        }

        public CategoriaProducto Categoria
        {
            get => _categoria;
            set => SetProperty(ref _categoria, value);
        }

        // ✅ NUEVA PROPIEDAD: Categoría como texto (viene de la BD)
        public string CategoriaTexto
        {
            get => _categoriaTexto;
            set => SetProperty(ref _categoriaTexto, value);
        }

        public string ImagenUrl
        {
            get => _imagenUrl;
            set => SetProperty(ref _imagenUrl, value);
        }

        public bool EstaDisponible
        {
            get => _estaDisponible;
            set => SetProperty(ref _estaDisponible, value);
        }

        public int CantidadTemporal
        {
            get => _cantidadTemporal;
            set => SetProperty(ref _cantidadTemporal, value);
        }

        public int TiempoPreparacion
        {
            get => _tiempoPreparacion;
            set => SetProperty(ref _tiempoPreparacion, value);
        }

        public bool EsEspecial
        {
            get => _esEspecial;
            set => SetProperty(ref _esEspecial, value);
        }

        // Propiedades calculadas
        public string EstadoTexto => EstaDisponible ? "Disponible" : "No disponible";
        public Color EstadoColor => EstaDisponible ? Colors.Green : Colors.Red;
        public string PrecioFormateado => $"${Precio:N0}";
        public string TiempoPreparacionTexto => $"⏱️ {TiempoPreparacion} min";
        public string ImagenFinal => string.IsNullOrEmpty(ImagenUrl)
            ? "https://via.placeholder.com/150x150?text=🍽️"
            : ImagenUrl;

        // ✅ NUEVA PROPIEDAD CALCULADA: Obtener la categoría correcta
        public string CategoriaNombre
        {
            get
            {
                // Primero intentar usar CategoriaTexto si existe (viene de la BD)
                if (!string.IsNullOrEmpty(CategoriaTexto))
                    return CategoriaTexto;

                // Si no, usar el enum Categoria
                if (Categoria != CategoriaProducto.Entrada || CategoriaId != 0)
                    return Categoria.ToString();

                // Fallback: mapear desde CategoriaId
                return CategoriaId switch
                {
                    1 => "Entradas",
                    2 => "Platos Principales",
                    3 => "Bebidas",
                    4 => "Postres",
                    5 => "Ensaladas",
                    6 => "Sopas",
                    _ => "General"
                };
            }
        }

        // Métodos
        public void ToggleDisponibilidad()
        {
            EstaDisponible = !EstaDisponible;
        }

        public ItemPedido CrearItemPedido(int cantidad = 1, string adiciones = null)
        {
            return new ItemPedido
            {
                PlatilloId = Id,
                Platillo = this,
                Cantidad = cantidad,
                PrecioUnitario = Precio,
                AdicionesEspeciales = adiciones
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