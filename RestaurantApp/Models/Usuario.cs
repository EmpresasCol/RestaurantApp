using System.ComponentModel;

namespace RestaurantApp.Models
{
    public class Usuario : INotifyPropertyChanged
    {
        private int _id;
        private string _nombre;
        private string _apellido;
        private string _nombreUsuario;
        private string _email;
        private TipoUsuario _tipo;
        private TipoTurno _turno;
        private bool _estaActivo;
        private DateTime _fechaIngreso;
        private DateTime? _ultimoAcceso;

        public Usuario()
        {
            EstaActivo = true;
            FechaIngreso = DateTime.Now;
            Tipo = TipoUsuario.Mesero;
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

        public string Apellido
        {
            get => _apellido;
            set => SetProperty(ref _apellido, value);
        }

        public string NombreUsuario
        {
            get => _nombreUsuario;
            set => SetProperty(ref _nombreUsuario, value);
        }

        public string Email
        {
            get => _email;
            set => SetProperty(ref _email, value);
        }

        public TipoUsuario Tipo
        {
            get => _tipo;
            set => SetProperty(ref _tipo, value);
        }

        public TipoTurno Turno
        {
            get => _turno;
            set => SetProperty(ref _turno, value);
        }

        public bool EstaActivo
        {
            get => _estaActivo;
            set => SetProperty(ref _estaActivo, value);
        }

        public DateTime FechaIngreso
        {
            get => _fechaIngreso;
            set => SetProperty(ref _fechaIngreso, value);
        }

        public DateTime? UltimoAcceso
        {
            get => _ultimoAcceso;
            set => SetProperty(ref _ultimoAcceso, value);
        }

        // Propiedades calculadas
        public string NombreCompleto => $"{Nombre} {Apellido}".Trim();
        public string TipoTexto => Tipo.ToString();
        public string TurnoTexto => Turno.ToString();
        public string EstadoTexto => EstaActivo ? "Activo" : "Inactivo";
        public Color EstadoColor => EstaActivo ? Colors.Green : Colors.Red;

        // Métodos
        public void MarcarAcceso()
        {
            UltimoAcceso = DateTime.Now;
        }

        public void Activar()
        {
            EstaActivo = true;
        }

        public void Desactivar()
        {
            EstaActivo = false;
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