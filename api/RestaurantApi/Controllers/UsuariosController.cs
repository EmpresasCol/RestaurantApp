using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UsuariosController : ControllerBase
    {
        // Mismo mensaje para usuario inexistente y clave incorrecta: no permite enumerar usuarios.
        private static readonly object CredencialesInvalidas = new { message = "Credenciales inválidas" };

        private readonly RestauranteContext _context;
        private readonly JwtTokenService _jwt;

        public UsuariosController(RestauranteContext context, JwtTokenService? jwt = null)
        {
            _context = context;
            _jwt = jwt ?? new JwtTokenService(new JwtOptions());
        }

        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public async Task<ActionResult<LoginResponseDto>> Login(LoginRequestDto request)
        {
            var usuario = await AutenticarAsync(request);
            if (usuario == null)
                return Unauthorized(CredencialesInvalidas);

            if (usuario.Rol == RolUsuario.Mesero)
            {
                return Unauthorized(new
                {
                    message = "Los meseros deben usar la aplicación móvil. Por favor, descarga la app en tu dispositivo móvil."
                });
            }

            // Solo roles de la web: Administrador, Caja, Cocina
            if (usuario.Rol != RolUsuario.Administrador &&
                usuario.Rol != RolUsuario.Caja &&
                usuario.Rol != RolUsuario.Cocina)
            {
                return Unauthorized(new { message = "No tienes permisos para acceder al sistema web" });
            }

            return Ok(CrearRespuestaLogin(usuario));
        }

        [HttpPost("login-mobile")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public async Task<ActionResult<LoginResponseDto>> LoginMobile(LoginRequestDto request)
        {
            var usuario = await AutenticarAsync(request);
            if (usuario == null)
                return Unauthorized(CredencialesInvalidas);

            if (usuario.Rol != RolUsuario.Mesero)
            {
                return Unauthorized(new
                {
                    message = "Solo usuarios con rol Mesero pueden acceder a la aplicación móvil."
                });
            }

            return Ok(CrearRespuestaLogin(usuario));
        }

        [HttpPost("{id}/fcm-token")]
        public async Task<IActionResult> RegistrarTokenFCM(int id, [FromBody] TokenFCMDto dto)
        {
            // Cada usuario solo registra tokens para sí mismo.
            if (QproClaims.IdUsuario(User) != id && !QproClaims.EsAdministrador(User))
                return Forbid();

            if (string.IsNullOrWhiteSpace(dto.FcmToken))
                return BadRequest(new { message = "Token FCM requerido" });

            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null)
                return NotFound("Usuario no encontrado");

            var tokenExistente = await _context.UsuariosFCM
                .AnyAsync(u => u.UsuarioId == id && u.FcmToken == dto.FcmToken);

            if (!tokenExistente)
            {
                _context.UsuariosFCM.Add(new UsuarioFCM
                {
                    UsuarioId = id,
                    FcmToken = dto.FcmToken,
                    FechaRegistro = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Token registrado correctamente" });
        }

        public class TokenFCMDto
        {
            public string FcmToken { get; set; } = string.Empty;
        }

        [HttpGet]
        [Authorize(Roles = "Administrador")]
        public async Task<ActionResult<IEnumerable<UsuarioDto>>> GetUsuarios()
        {
            var usuarios = await _context.Usuarios.ToListAsync();
            return usuarios.Select(ADto).ToList();
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "Administrador")]
        public async Task<ActionResult<UsuarioDto>> GetUsuario(int id)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound();
            return ADto(usuario);
        }

        /// <summary>Crea un usuario. ClaveHash llega en texto plano y se guarda con BCrypt.</summary>
        [HttpPost]
        [Authorize(Roles = "Administrador")]
        public async Task<ActionResult<UsuarioDto>> PostUsuario(Usuario usuario)
        {
            usuario.Nombre = usuario.Nombre?.Trim() ?? "";
            usuario.NombreUsuario = usuario.NombreUsuario?.Trim() ?? "";
            var error = ValidarDatos(usuario.Nombre, usuario.NombreUsuario, usuario.Rol)
                ?? (string.IsNullOrWhiteSpace(usuario.ClaveHash) ? "La clave es obligatoria" : ValidarClave(usuario.ClaveHash));
            if (error != null)
                return BadRequest(new { message = error });
            if (await _context.Usuarios.AnyAsync(u => u.NombreUsuario == usuario.NombreUsuario))
                return Conflict(new { message = "El nombre de usuario ya existe" });

            usuario.Id = 0;
            usuario.ClaveHash = ClaveHasher.Hash(usuario.ClaveHash);
            _context.Usuarios.Add(usuario);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetUsuario), new { id = usuario.Id }, ADto(usuario));
        }

        /// <summary>Actualiza datos y rol; la clave solo cambia si se envía.</summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> PutUsuario(int id, ActualizarUsuarioDto dto)
        {
            if (id != dto.Id) return BadRequest();
            dto.Nombre = dto.Nombre?.Trim() ?? "";
            dto.NombreUsuario = dto.NombreUsuario?.Trim() ?? "";
            var error = ValidarDatos(dto.Nombre, dto.NombreUsuario, dto.Rol)
                ?? (string.IsNullOrWhiteSpace(dto.ClaveHash) ? null : ValidarClave(dto.ClaveHash));
            if (error != null)
                return BadRequest(new { message = error });

            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound();

            if (await _context.Usuarios.AnyAsync(u => u.Id != id && u.NombreUsuario == dto.NombreUsuario))
                return Conflict(new { message = "El nombre de usuario ya existe" });

            // Sin estas dos reglas el administrador podría dejar el sistema sin nadie que lo gestione.
            if (usuario.Rol == RolUsuario.Administrador && dto.Rol != RolUsuario.Administrador)
            {
                if (QproClaims.IdUsuario(User) == id)
                    return BadRequest(new { message = "No puedes quitarte el rol de Administrador" });
                if (await EsUltimoAdministradorAsync(id))
                    return BadRequest(new { message = "Debe quedar al menos un Administrador" });
            }

            usuario.Nombre = dto.Nombre;
            usuario.NombreUsuario = dto.NombreUsuario;
            usuario.Rol = dto.Rol;
            if (!string.IsNullOrWhiteSpace(dto.ClaveHash))
                usuario.ClaveHash = ClaveHasher.Hash(dto.ClaveHash);

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> DeleteUsuario(int id)
        {
            if (QproClaims.IdUsuario(User) == id)
                return BadRequest(new { message = "No puedes eliminar tu propio usuario" });

            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound();

            if (usuario.Rol == RolUsuario.Administrador && await EsUltimoAdministradorAsync(id))
                return BadRequest(new { message = "Debe quedar al menos un Administrador" });

            // Pedidos y domicilios guardan quién los tomó: borrar al usuario rompería el historial.
            var tieneHistorial = await _context.Pedidos.AnyAsync(p => p.UsuarioId == id)
                || await _context.Domicilios.AnyAsync(d => d.UsuarioCreadorId == id || d.DomiciliarioId == id);
            if (tieneHistorial)
                return Conflict(new { message = $"{usuario.Nombre} tiene pedidos o domicilios en el historial y no se puede eliminar. Cámbiale la clave para quitarle el acceso." });

            _context.UsuariosFCM.RemoveRange(_context.UsuariosFCM.Where(t => t.UsuarioId == id));
            _context.Usuarios.Remove(usuario);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private static string? ValidarDatos(string nombre, string nombreUsuario, RolUsuario rol)
        {
            if (!Enum.IsDefined(rol)) return "Rol inválido";
            if (nombre.Length == 0) return "El nombre es obligatorio";
            if (nombreUsuario.Length < 3) return "El usuario debe tener al menos 3 caracteres";
            if (nombreUsuario.Any(char.IsWhiteSpace)) return "El usuario no puede tener espacios";
            return null;
        }

        private static string? ValidarClave(string clave)
            => clave.Length < 4 ? "La clave debe tener al menos 4 caracteres" : null;

        private Task<bool> EsUltimoAdministradorAsync(int id)
            => _context.Usuarios.AllAsync(u => u.Id == id || u.Rol != RolUsuario.Administrador);

        /// <summary>Valida credenciales y migra a BCrypt las claves heredadas en texto plano.</summary>
        private async Task<Usuario?> AutenticarAsync(LoginRequestDto request)
        {
            var usuario = await _context.Usuarios
                .FirstOrDefaultAsync(u => u.NombreUsuario == request.Usuario);

            if (usuario == null)
            {
                ClaveHasher.VerificarFicticio(request.Clave);
                return null;
            }

            if (!ClaveHasher.Verificar(request.Clave, usuario.ClaveHash, out var migrar))
                return null;

            if (migrar)
            {
                usuario.ClaveHash = ClaveHasher.Hash(request.Clave);
                await _context.SaveChangesAsync();
            }
            return usuario;
        }

        private LoginResponseDto CrearRespuestaLogin(Usuario usuario) => new()
        {
            Id = usuario.Id,
            Nombre = usuario.Nombre,
            NombreUsuario = usuario.NombreUsuario,
            Rol = usuario.Rol.ToString(),
            Token = _jwt.Crear(usuario)
        };

        private static UsuarioDto ADto(Usuario u) => new()
        {
            Id = u.Id,
            Nombre = u.Nombre,
            NombreUsuario = u.NombreUsuario,
            Rol = u.Rol.ToString()
        };
    }
}
