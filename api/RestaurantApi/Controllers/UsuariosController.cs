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
        public const string MensajeDesactivado = "Tu usuario está desactivado. Habla con el administrador.";

        /// <summary>Largo mínimo de una clave nueva o cambiada (las vigentes siguen sirviendo).</summary>
        public const int LargoMinimoClave = 8;

        private readonly RestauranteContext _context;
        private readonly JwtTokenService _jwt;
        private readonly IntentosLogin _intentos;
        private readonly ILogger _auditoria;

        public UsuariosController(RestauranteContext context, JwtTokenService? jwt = null, IntentosLogin? intentos = null,
            ILoggerFactory? logs = null)
        {
            _context = context;
            _jwt = jwt ?? new JwtTokenService(new JwtOptions());
            _intentos = intentos ?? new IntentosLogin();
            _auditoria = logs?.CreateLogger(Auditoria.Categoria) ?? Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance;
        }

        private ObjectResult Bloqueado(string usuario)
        {
            _auditoria.LogWarning(Auditoria.CuentaBloqueada, "Auditoría: ingreso rechazado, cuenta {Usuario} bloqueada por intentos fallidos", Auditoria.Limpio(usuario));
            return StatusCode(StatusCodes.Status429TooManyRequests, new { message = IntentosLogin.MensajeBloqueo });
        }

        private void IngresoCorrecto(Usuario usuario, string canal)
            => _auditoria.LogInformation(Auditoria.LoginCorrecto, "Auditoría: ingreso correcto de {Usuario} (Id {Id}, {Rol}) por {Canal}",
                usuario.NombreUsuario, usuario.Id, usuario.Rol, canal);

        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public async Task<ActionResult<LoginResponseDto>> Login(LoginRequestDto request)
        {
            if (_intentos.EstaBloqueado(request.Usuario))
                return Bloqueado(request.Usuario);
            var usuario = await AutenticarAsync(request);
            if (usuario == null)
                return Unauthorized(CredencialesInvalidas);
            if (!usuario.Activo)
                return Unauthorized(new { message = MensajeDesactivado });

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

            IngresoCorrecto(usuario, "web");
            return Ok(CrearRespuestaLogin(usuario));
        }

        [HttpPost("login-mobile")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public async Task<ActionResult<LoginResponseDto>> LoginMobile(LoginRequestDto request)
        {
            if (_intentos.EstaBloqueado(request.Usuario))
                return Bloqueado(request.Usuario);
            var usuario = await AutenticarAsync(request);
            if (usuario == null)
                return Unauthorized(CredencialesInvalidas);
            if (!usuario.Activo)
                return Unauthorized(new { message = MensajeDesactivado });

            if (usuario.Rol != RolUsuario.Mesero)
            {
                return Unauthorized(new
                {
                    message = "Solo usuarios con rol Mesero pueden acceder a la aplicación móvil."
                });
            }

            IngresoCorrecto(usuario, "app móvil");
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

            // El token es del dispositivo: si antes lo usó otro usuario, deja de recibir sus avisos.
            var registros = await _context.UsuariosFCM.Where(u => u.FcmToken == dto.FcmToken).ToListAsync();
            _context.UsuariosFCM.RemoveRange(registros.Where(u => u.UsuarioId != id));
            var tokenExistente = registros.Any(u => u.UsuarioId == id);
            if (registros.Count > (tokenExistente ? 1 : 0))
                await _context.SaveChangesAsync();

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

        /// <summary>
        /// Al cerrar sesión el dispositivo deja de recibir los avisos de ese usuario (llamadas de
        /// mesa, pedidos listos). Idempotente: un token que ya no está responde igual.
        /// </summary>
        [HttpDelete("{id}/fcm-token")]
        public async Task<IActionResult> QuitarTokenFCM(int id, [FromBody] TokenFCMDto dto)
        {
            if (QproClaims.IdUsuario(User) != id && !QproClaims.EsAdministrador(User))
                return Forbid();
            if (string.IsNullOrWhiteSpace(dto.FcmToken))
                return NoContent();

            _context.UsuariosFCM.RemoveRange(_context.UsuariosFCM.Where(u => u.UsuarioId == id && u.FcmToken == dto.FcmToken));
            await _context.SaveChangesAsync();
            return NoContent();
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
            usuario.Activo = true;
            usuario.ClaveHash = ClaveHasher.Hash(usuario.ClaveHash);
            _context.Usuarios.Add(usuario);
            await _context.SaveChangesAsync();
            Cambio("creó el usuario {Usuario} (Id {Id}) con rol {Rol}", usuario.NombreUsuario, usuario.Id, usuario.Rol);
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

            var rolAnterior = usuario.Rol;
            usuario.Nombre = dto.Nombre;
            usuario.NombreUsuario = dto.NombreUsuario;
            usuario.Rol = dto.Rol;
            var cambiaClave = !string.IsNullOrWhiteSpace(dto.ClaveHash);
            if (cambiaClave)
                usuario.ClaveHash = ClaveHasher.Hash(dto.ClaveHash!);

            await _context.SaveChangesAsync();
            if (rolAnterior != usuario.Rol)
                Cambio("cambió el rol de {Usuario} (Id {Id}) de {Antes} a {Despues}", usuario.NombreUsuario, id, rolAnterior, usuario.Rol);
            if (cambiaClave)
                Cambio("cambió la clave de {Usuario} (Id {Id})", usuario.NombreUsuario, id);
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
                return Conflict(new { message = $"{usuario.Nombre} tiene pedidos o domicilios en el historial y no se puede eliminar. Desactívalo en su lugar." });

            _context.UsuariosFCM.RemoveRange(_context.UsuariosFCM.Where(t => t.UsuarioId == id));
            _context.Usuarios.Remove(usuario);
            await _context.SaveChangesAsync();
            Cambio("eliminó al usuario {Usuario} (Id {Id})", usuario.NombreUsuario, id);
            return NoContent();
        }

        /// <summary>Activa o desactiva el acceso sin borrar el historial del usuario.</summary>
        [HttpPut("{id}/activo")]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> CambiarActivo(int id, CambiarActivoDto dto)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound();

            if (!dto.Activo)
            {
                if (QproClaims.IdUsuario(User) == id)
                    return BadRequest(new { message = "No puedes desactivar tu propio usuario" });
                if (usuario.Rol == RolUsuario.Administrador && await EsUltimoAdministradorAsync(id))
                    return BadRequest(new { message = "Debe quedar al menos un Administrador activo" });
            }

            usuario.Activo = dto.Activo;
            await _context.SaveChangesAsync();
            Cambio(dto.Activo ? "activó a {Usuario} (Id {Id})" : "desactivó a {Usuario} (Id {Id})", usuario.NombreUsuario, id);
            return NoContent();
        }

        /// <summary>Cambio administrativo sobre usuarios, firmado por quien lo hizo.</summary>
        private void Cambio(string accion, params object?[] datos)
            => _auditoria.LogWarning(Auditoria.CambioDeUsuario, "Auditoría: {Admin} (Id {AdminId}) " + accion,
                new object?[] { User?.Identity?.Name, QproClaims.IdUsuario(User) }.Concat(datos).ToArray());

        private static string? ValidarDatos(string nombre, string nombreUsuario, RolUsuario rol)
        {
            if (!Enum.IsDefined(rol)) return "Rol inválido";
            if (nombre.Length == 0) return "El nombre es obligatorio";
            if (nombreUsuario.Length < 3) return "El usuario debe tener al menos 3 caracteres";
            if (nombreUsuario.Any(char.IsWhiteSpace)) return "El usuario no puede tener espacios";
            return null;
        }

        private static string? ValidarClave(string clave)
            => clave.Length < LargoMinimoClave ? $"La clave debe tener al menos {LargoMinimoClave} caracteres" : null;

        private Task<bool> EsUltimoAdministradorAsync(int id)
            => _context.Usuarios.AllAsync(u => u.Id == id || u.Rol != RolUsuario.Administrador || !u.Activo);

        /// <summary>
        /// Valida credenciales y migra a BCrypt las claves heredadas en texto plano. Cada fallo
        /// cuenta para el bloqueo de la cuenta; un ingreso correcto lo reinicia.
        /// </summary>
        private async Task<Usuario?> AutenticarAsync(LoginRequestDto request)
        {
            // Los usuarios técnicos se tratan como inexistentes: mismo tiempo y mismo mensaje.
            var usuario = UsuariosSistema.Es(request.Usuario) ? null : await _context.Usuarios
                .FirstOrDefaultAsync(u => u.NombreUsuario == request.Usuario);

            if (usuario == null)
            {
                ClaveHasher.VerificarFicticio(request.Clave);
                RegistrarFallo(request.Usuario, existe: false);
                return null;
            }

            if (!ClaveHasher.Verificar(request.Clave, usuario.ClaveHash, out var migrar))
            {
                RegistrarFallo(request.Usuario, existe: true);
                return null;
            }
            _intentos.Limpiar(request.Usuario);

            if (migrar)
            {
                usuario.ClaveHash = ClaveHasher.Hash(request.Clave);
                await _context.SaveChangesAsync();
            }
            return usuario;
        }

        private void RegistrarFallo(string usuario, bool existe)
        {
            var fallos = _intentos.RegistrarFallo(usuario);
            // El log sí distingue si el usuario existe (la respuesta no): ayuda a ver ataques de diccionario.
            _auditoria.LogWarning(fallos >= IntentosLogin.MaximoFallos ? Auditoria.CuentaBloqueada : Auditoria.LoginFallido,
                "Auditoría: clave errada para {Usuario} (existe: {Existe}), fallo {Fallos} de {Maximo}",
                Auditoria.Limpio(usuario), existe, fallos, IntentosLogin.MaximoFallos);
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
            Rol = u.Rol.ToString(),
            Activo = u.Activo
        };
    }
}
