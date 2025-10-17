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

        // ✅ ACTUALIZADO: Métodos estáticos para categorías que coinciden con la BD y la foto
        public static List<Categoria> ObtenerCategoriasPorDefecto()
        {
            return new List<Categoria>
            {
                new Categoria
                {
                    Id = 0,
                    Nombre = "Todos",
                    Icono = "🍽️",
                    ColorFondo = Color.FromArgb("#6C757D"),
                    OrdenVisualizacion = 0
                },
                new Categoria
                {
                    Id = 1,
                    Nombre = "Entradas",
                    Icono = "🥗",
                    ColorFondo = Color.FromArgb("#28A745"),
                    OrdenVisualizacion = 1
                },
                new Categoria
                {
                    Id = 2,
                    Nombre = "Platos Principales",
                    Icono = "🍖",
                    ColorFondo = Color.FromArgb("#FF6B35"),
                    OrdenVisualizacion = 2
                },
                new Categoria
                {
                    Id = 3,
                    Nombre = "Postres",
                    Icono = "🍰",
                    ColorFondo = Color.FromArgb("#E83E8C"),
                    OrdenVisualizacion = 3
                },
                new Categoria
                {
                    Id = 4,
                    Nombre = "Bebidas",
                    Icono = "🥤",
                    ColorFondo = Color.FromArgb("#17A2B8"),
                    OrdenVisualizacion = 4
                },
                new Categoria
                {
                    Id = 5,
                    Nombre = "Ensaladas",
                    Icono = "🥬",
                    ColorFondo = Color.FromArgb("#20C997"),
                    OrdenVisualizacion = 5
                },
                new Categoria
                {
                    Id = 6,
                    Nombre = "Sopas",
                    Icono = "🍲",
                    ColorFondo = Color.FromArgb("#FFC107"),
                    OrdenVisualizacion = 6
                }
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