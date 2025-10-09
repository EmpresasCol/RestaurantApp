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
            var data = new { Usuario = usuario, Clave = clave };
            var usuarioDto = await _httpService.PostAsync<UsuarioDto>("api/usuarios/login", data);
            return ConvertirDtoAModelo(usuarioDto);
        }

        public async Task<Usuario> ObtenerPorIdAsync(int id)
        {
            var usuario = await _httpService.GetAsync<UsuarioDto>($"api/usuarios/{id}");
            return ConvertirDtoAModelo(usuario);
        }

        public async Task<List<Usuario>> ObtenerTodosAsync()
        {
            var usuarios = await _httpService.GetAsync<List<UsuarioDto>>("api/usuarios");
            return usuarios.Select(dto => ConvertirDtoAModelo(dto)).ToList();
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

            if (Enum.TryParse<TipoUsuario>(dto.Rol, out var tipoEnum))
            {
                usuario.Tipo = tipoEnum;
            }

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

    public class UsuarioDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; }
        public string Usuario { get; set; }
        public string Rol { get; set; }
    }
}