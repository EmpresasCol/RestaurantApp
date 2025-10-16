using RestaurantApp.Models;

namespace RestaurantApp.Services
{
    public class UsuarioService
    {
        private readonly HttpService _httpService;

        public UsuarioService()
        {
            _httpService = new HttpService();
        }

        public async Task<ResultadoAutenticacion> AutenticarAsync(string usuario, string clave)
        {
            try
            {
                var request = new LoginRequestDto
                {
                    Usuario = usuario,
                    Clave = clave
                };

                var response = await _httpService.PostAsync<LoginResponseDto>("api/usuarios/login", request);

                if (response != null)
                {
                    return new ResultadoAutenticacion
                    {
                        Exito = true,
                        Usuario = response
                    };
                }

                return new ResultadoAutenticacion
                {
                    Exito = false,
                    MensajeError = "Error en el servidor"
                };
            }
            catch (HttpRequestException ex)
            {
                if (ex.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    return new ResultadoAutenticacion
                    {
                        Exito = false,
                        MensajeError = "Usuario o contraseña incorrectos"
                    };
                }

                return new ResultadoAutenticacion
                {
                    Exito = false,
                    MensajeError = "Error de conexión"
                };
            }
            catch
            {
                return new ResultadoAutenticacion
                {
                    Exito = false,
                    MensajeError = "Error inesperado"
                };
            }
        }

        public void GuardarSesion(LoginResponseDto usuario)
        {
            Preferences.Set("SesionActiva", true);
            Preferences.Set("UsuarioId", usuario.Id);
            Preferences.Set("UsuarioNombre", usuario.Nombre);
            Preferences.Set("UsuarioRol", usuario.Rol);
        }

        public void CerrarSesion()
        {
            Preferences.Clear();
        }

        public bool HaySesionActiva()
        {
            return Preferences.Get("SesionActiva", false);
        }

        public int ObtenerUsuarioIdActual()
        {
            return Preferences.Get("UsuarioId", 0);
        }

        public string ObtenerUsuarioNombreActual()
        {
            return Preferences.Get("UsuarioNombre", string.Empty);
        }

        public string ObtenerUsuarioRolActual()
        {
            return Preferences.Get("UsuarioRol", string.Empty);
        }
    }
}