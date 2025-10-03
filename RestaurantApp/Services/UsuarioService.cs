// RestaurantApp/Services/UsuarioService.cs
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

        public async Task<Usuario> LoginAsync(string usuario, string clave)
        {
            try
            {
                var data = new { Usuario = usuario, Clave = clave };
                var usuarioDto = await _httpService.PostAsync<UsuarioDto>(
                    $"{ApiConfig.Endpoints.Usuarios}/login",
                    data
                );
                return ConvertirDtoAModelo(usuarioDto);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error en login: {ex.Message}");
                throw new Exception("Usuario o contraseña incorrectos");
            }
        }

        public async Task<Usuario> ObtenerPorIdAsync(int id)
        {
            try
            {
                var usuario = await _httpService.GetAsync<UsuarioDto>(
                    $"{ApiConfig.Endpoints.Usuarios}/{id}"
                );
                return ConvertirDtoAModelo(usuario);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error obteniendo usuario: {ex.Message}");
                throw;
            }
        }

        public async Task<List<Usuario>> ObtenerTodosAsync()
        {
            try
            {
                var usuarios = await _httpService.GetAsync<List<UsuarioDto>>(
                    ApiConfig.Endpoints.Usuarios
                );
                return usuarios.Select(dto => ConvertirDtoAModelo(dto)).ToList();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error obteniendo usuarios: {ex.Message}");
                return new List<Usuario>();
            }
        }

        private Usuario ConvertirDtoAModelo(UsuarioDto dto)
        {
            var usuario = new Usuario
            {
                Id = dto.Id,
                Nombre = dto.Nombre,
                NombreUsuario = dto.Usuario,
                EstaActivo = true,
                FechaIngreso = DateTime.Now
            };

            // Convertir rol
            if (Enum.TryParse<TipoUsuario>(dto.Rol, out var tipoEnum))
            {
                usuario.Tipo = tipoEnum;
            }

            // Extraer apellido si existe
            var nombreCompleto = dto.Nombre.Split(' ');
            if (nombreCompleto.Length > 1)
            {
                usuario.Nombre = nombreCompleto[0];
                usuario.Apellido = string.Join(" ", nombreCompleto.Skip(1));
            }

            return usuario;
        }

        public void GuardarSesion(Usuario usuario)
        {
            Preferences.Set("UsuarioId", usuario.Id);
            Preferences.Set("NombreMesero", usuario.NombreCompleto);
            Preferences.Set("TipoUsuario", usuario.Tipo.ToString());
            Preferences.Set("SesionActiva", true);
        }

        public void CerrarSesion()
        {
            Preferences.Remove("UsuarioId");
            Preferences.Remove("NombreMesero");
            Preferences.Remove("TipoUsuario");
            Preferences.Set("SesionActiva", false);
        }

        public bool HaySesionActiva()
        {
            return Preferences.Get("SesionActiva", false);
        }

        public int ObtenerUsuarioIdActual()
        {
            return Preferences.Get("UsuarioId", 0);
        }
    }

    // DTO para la comunicación con la API
    public class UsuarioDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; }
        public string Usuario { get; set; }
        public string Rol { get; set; }
    }
}