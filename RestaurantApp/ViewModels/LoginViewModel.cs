using RestaurantApp.Helpers;
using RestaurantApp.Services;
using System.Windows.Input;

namespace RestaurantApp.ViewModels
{
    public class LoginViewModel : BaseViewModel
    {
        private readonly UsuarioService _usuarioService;
        private string _nombreUsuario = string.Empty;
        private string _password = string.Empty;
        private string _mensajeError = string.Empty;
        private bool _mostrarError;
        private bool _estaCargando;

        public LoginViewModel()
        {
            _usuarioService = new UsuarioService();
            IniciarSesionCommand = new AsyncCommand(IniciarSesion);
        }

        public string NombreUsuario
        {
            get => _nombreUsuario;
            set => SetProperty(ref _nombreUsuario, value);
        }

        public string Password
        {
            get => _password;
            set => SetProperty(ref _password, value);
        }

        public string MensajeError
        {
            get => _mensajeError;
            set => SetProperty(ref _mensajeError, value);
        }

        public bool MostrarError
        {
            get => _mostrarError;
            set => SetProperty(ref _mostrarError, value);
        }

        public bool EstaCargando
        {
            get => _estaCargando;
            set => SetProperty(ref _estaCargando, value);
        }

        public ICommand IniciarSesionCommand { get; }

        private async Task IniciarSesion()
        {
            if (string.IsNullOrWhiteSpace(NombreUsuario) || string.IsNullOrWhiteSpace(Password))
            {
                MostrarMensajeError("Ingresa usuario y contraseña");
                return;
            }

            try
            {
                EstaCargando = true;
                MostrarError = false;

                var resultado = await _usuarioService.AutenticarAsync(NombreUsuario, Password);

                if (resultado.Exito && resultado.Usuario != null)
                {
                    if (resultado.Usuario.Rol != "Mesero")
                    {
                        MostrarMensajeError($"Acceso denegado. Solo usuarios con rol Mesero pueden acceder.");
                        return;
                    }

                    _usuarioService.GuardarSesion(resultado.Usuario);
                    await Shell.Current.GoToAsync("//mesero");
                }
                else
                {
                    MostrarMensajeError(resultado.MensajeError);
                }
            }
            catch (Exception ex)
            {
                MostrarMensajeError($"Error: {ex.Message}");
            }
            finally
            {
                EstaCargando = false;
            }
        }

        private void MostrarMensajeError(string mensaje)
        {
            MensajeError = mensaje;
            MostrarError = true;
        }
    }
}