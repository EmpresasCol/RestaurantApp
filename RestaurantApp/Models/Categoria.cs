using System.ComponentModel;

namespace RestaurantApp.Models
{
    public class Categoria : INotifyPropertyChanged
    {
        private int _id;
        private string _nombre;
        private string _descripcion;
        private string _icono;
        private Color _colorFondo;
        private bool _estaActiva;
        private int _ordenVisualizacion;

        public Categoria()
        {
            EstaActiva = true;
            ColorFondo = Colors.Gray;
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

        public string Icono
        {
            get => _icono;
            set => SetProperty(ref _icono, value);
        }

        public Color ColorFondo
        {
            get => _colorFondo;
            set => SetProperty(ref _colorFondo, value);
        }

        public bool EstaActiva
        {
            get => _estaActiva;
            set => SetProperty(ref _estaActiva, value);
        }

        public int OrdenVisualizacion
        {
            get => _ordenVisualizacion;
            set => SetProperty(ref _ordenVisualizacion, value);
        }

        // Propiedades calculadas
        public string NombreConIcono => string.IsNullOrEmpty(Icono) ? Nombre : $"{Icono} {Nombre}";

        // Métodos estáticos para categorías predeterminadas
        public static List<Categoria> ObtenerCategoriasPorDefecto()
        {
            return new List<Categoria>
            {
                new Categoria { Id = 1, Nombre = "Entradas", Icono = "🥗", ColorFondo = Colors.Orange, OrdenVisualizacion = 1 },
                new Categoria { Id = 2, Nombre = "Platos Principales", Icono = "🍽️", ColorFondo = Colors.Red, OrdenVisualizacion = 2 },
                new Categoria { Id = 3, Nombre = "Bebidas", Icono = "🥤", ColorFondo = Colors.Blue, OrdenVisualizacion = 3 },
                new Categoria { Id = 4, Nombre = "Postres", Icono = "🍰", ColorFondo = Colors.Purple, OrdenVisualizacion = 4 },
                new Categoria { Id = 5, Nombre = "Adicionales", Icono = "🧄", ColorFondo = Colors.Green, OrdenVisualizacion = 5 }
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