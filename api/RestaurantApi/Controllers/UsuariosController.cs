using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;

namespace RestaurantApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsuariosController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public UsuariosController(RestauranteContext context)
        {
            _context = context;
        }

        [HttpPost("login")]
        public async Task<ActionResult<LoginResponseDto>> Login(LoginRequestDto request)
        {
            try
            {
                Console.WriteLine($"🔐 Intento de login: {request.Usuario}");

                // Buscar usuario por nombre de usuario
                var usuario = await _context.Usuarios
                    .FirstOrDefaultAsync(u => u.NombreUsuario == request.Usuario);

                if (usuario == null)
                {
                    Console.WriteLine($"❌ Usuario no encontrado: {request.Usuario}");
                    return Unauthorized(new { message = "Usuario no encontrado" });
                }

                // Verificar contraseña (en producción usar BCrypt o similar)
                if (usuario.ClaveHash != request.Clave)
                {
                    Console.WriteLine($"❌ Contraseña incorrecta para: {request.Usuario}");
                    return Unauthorized(new { message = "Contraseña incorrecta" });
                }

                // ⛔ BLOQUEAR MESEROS
                if (usuario.Rol == RolUsuario.Mesero)
                {
                    Console.WriteLine($"⛔ Mesero intentó acceder a la web: {request.Usuario}");
                    return Unauthorized(new
                    {
                        message = "Los meseros deben usar la aplicación móvil. Por favor, descarga la app en tu dispositivo móvil."
                    });
                }

                // 🍳 BLOQUEAR LOGIN DE COCINA - DEBEN USAR URL DIRECTA
                if (usuario.Rol == RolUsuario.Cocina)
                {
                    Console.WriteLine($"🍳 Usuario de cocina intentó login normal: {request.Usuario}");
                    return Unauthorized(new
                    {
                        message = "COCINA_URL_DIRECTA"
                    });
                }

                // ✅ Permitir solo: Administrador, Caja
                if (usuario.Rol != RolUsuario.Administrador &&
                    usuario.Rol != RolUsuario.Caja)
                {
                    Console.WriteLine($"⛔ Rol no permitido: {usuario.Rol}");
                    return Unauthorized(new { message = "No tienes permisos para acceder al sistema web" });
                }

                // ✅ Login exitoso
                Console.WriteLine($"✅ Login exitoso: {usuario.Nombre} ({usuario.Rol})");

                var response = new LoginResponseDto
                {
                    Id = usuario.Id,
                    Nombre = usuario.Nombre,
                    NombreUsuario = usuario.NombreUsuario,
                    Rol = usuario.Rol.ToString()
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error en login: {ex.Message}");
                return StatusCode(500, new { message = $"Error en el servidor: {ex.Message}" });
            }
        }
        [HttpPost("login-mobile")]
        public async Task<ActionResult<LoginResponseDto>> LoginMobile(LoginRequestDto request)
        {
            try
            {
                Console.WriteLine($"📱 Intento de login MÓVIL: {request.Usuario}");

                // Buscar usuario por nombre de usuario
                var usuario = await _context.Usuarios
                    .FirstOrDefaultAsync(u => u.NombreUsuario == request.Usuario);

                if (usuario == null)
                {
                    Console.WriteLine($"❌ Usuario no encontrado: {request.Usuario}");
                    return Unauthorized(new { message = "Usuario no encontrado" });
                }

                // Verificar contraseña
                if (usuario.ClaveHash != request.Clave)
                {
                    Console.WriteLine($"❌ Contraseña incorrecta para: {request.Usuario}");
                    return Unauthorized(new { message = "Contraseña incorrecta" });
                }

                if (usuario.Rol != RolUsuario.Mesero)
                {
                    Console.WriteLine($"⛔ No-mesero intentó acceder desde móvil: {request.Usuario}");
                    return Unauthorized(new
                    {
                        message = "Solo usuarios con rol Mesero pueden acceder a la aplicación móvil."
                    });
                }

                Console.WriteLine($"✅ Login móvil exitoso: {usuario.Nombre} (Mesero)");

                var response = new LoginResponseDto
                {
                    Id = usuario.Id,
                    Nombre = usuario.Nombre,
                    NombreUsuario = usuario.NombreUsuario,
                    Rol = usuario.Rol.ToString()
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error en login móvil: {ex.Message}");
                return StatusCode(500, new { message = $"Error en el servidor: {ex.Message}" });
            }
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<UsuarioDto>>> GetUsuarios()
        {
            var usuarios = await _context.Usuarios.ToListAsync();
            return usuarios.Select(u => new UsuarioDto
            {
                Id = u.Id,
                Nombre = u.Nombre,
                NombreUsuario = u.NombreUsuario,
                Rol = u.Rol.ToString()
            }).ToList();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<UsuarioDto>> GetUsuario(int id)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound();

            return new UsuarioDto
            {
                Id = usuario.Id,
                Nombre = usuario.Nombre,
                NombreUsuario = usuario.NombreUsuario,
                Rol = usuario.Rol.ToString()
            };
        }

        [HttpPost]
        public async Task<ActionResult<Usuario>> PostUsuario(Usuario usuario)
        {
            _context.Usuarios.Add(usuario);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetUsuario), new { id = usuario.Id }, usuario);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutUsuario(int id, Usuario usuario)
        {
            if (id != usuario.Id) return BadRequest();

            _context.Entry(usuario).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.Usuarios.Any(e => e.Id == id))
                    return NotFound();
                throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUsuario(int id)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound();

            _context.Usuarios.Remove(usuario);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}