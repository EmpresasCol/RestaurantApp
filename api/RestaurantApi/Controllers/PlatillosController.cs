using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Administrador")]
    public class PlatillosController : ControllerBase
    {
        private readonly RestauranteContext _context;
        private readonly IInventarioService _inventario;
        private readonly ILogger<PlatillosController>? _logger;

        public PlatillosController(RestauranteContext context, IInventarioService inventario, ILogger<PlatillosController>? logger = null)
        {
            _context = context;
            _inventario = inventario;
            _logger = logger;
        }

        // La carta es pública: la consulta el menú QR del comensal. Los ocultos solo los ve
        // el administrador y solo si los pide (?todos=true), para poder volver a mostrarlos.
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<PlatilloDto>>> GetPlatillos([FromQuery] bool todos = false)
        {
            var verOcultos = todos && QproClaims.EsAdministrador(HttpContext?.User);
            var platillos = await _context.Platillos.Where(p => verOcultos || p.Activo).ToListAsync();
            var porciones = await _inventario.PorcionesDisponiblesAsync();
            return platillos.Select(p => ADto(p, porciones.GetValueOrDefault(p.Id))).ToList();
        }

        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<PlatilloDto>> GetPlatillo(int id)
        {
            var platillo = await _context.Platillos.FindAsync(id);
            if (platillo == null) return NotFound();

            var porciones = await _inventario.PorcionesDisponiblesAsync();
            return ADto(platillo, porciones.GetValueOrDefault(id));
        }

        private static PlatilloDto ADto(Platillo p, int? porciones) => new()
        {
            Id = p.Id,
            Nombre = p.Nombre,
            Descripcion = p.Descripcion ?? "",
            Precio = p.Precio,
            ImagenUrl = p.ImagenUrl ?? "",
            Categoria = p.Categoria ?? "General",
            Disponible = p.Activo && (porciones is null or > 0),
            PorcionesDisponibles = porciones,
            Activo = p.Activo
        };

        [HttpPost]
        public async Task<ActionResult<Platillo>> PostPlatillo(Platillo platillo)
        {
            var error = await ValidarAsync(platillo, idActual: null);
            if (error != null) return error;

            platillo.Id = 0;
            platillo.Activo = true;
            _context.Platillos.Add(platillo);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetPlatillo), new { id = platillo.Id }, platillo);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutPlatillo(int id, Platillo platillo)
        {
            if (id != platillo.Id)
            {
                return BadRequest(new { message = "El ID no coincide" });
            }

            var platilloExistente = await _context.Platillos.FindAsync(id);

            if (platilloExistente == null)
            {
                return NotFound(new { message = $"Platillo con ID {id} no encontrado" });
            }

            var error = await ValidarAsync(platillo, id);
            if (error != null) return error;

            try
            {
                platilloExistente.Nombre = platillo.Nombre;
                platilloExistente.Descripcion = platillo.Descripcion;
                platilloExistente.Precio = platillo.Precio;
                platilloExistente.ImagenUrl = platillo.ImagenUrl;
                platilloExistente.Categoria = platillo.Categoria;

                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!PlatilloExists(id))
                {
                    return NotFound(new { message = "El platillo ya no existe" });
                }
                return BadRequest(new { message = "Error de concurrencia al actualizar" });
            }
            catch (DbUpdateException ex)
            {
                _logger?.LogError(ex, "Error al actualizar platillo {Id}", id);
                return BadRequest(new { message = "No se pudo actualizar el platillo. Verifica los datos." });
            }
        }

        /// <summary>Muestra u oculta el platillo en la carta sin perder su historial de ventas.</summary>
        [HttpPut("{id}/activo")]
        public async Task<IActionResult> CambiarActivo(int id, CambiarActivoDto dto)
        {
            var platillo = await _context.Platillos.FindAsync(id);
            if (platillo == null) return NotFound(new { message = $"Platillo con ID {id} no encontrado" });

            platillo.Activo = dto.Activo;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePlatillo(int id)
        {
            var platillo = await _context.Platillos.FindAsync(id);
            if (platillo == null)
            {
                return NotFound(new { message = $"Platillo con ID {id} no encontrado" });
            }

            // Pedidos y domicilios guardan el platillo vendido; borrarlo rompería el historial y la caja.
            var tieneVentas = await _context.PedidoDetalles.AnyAsync(d => d.PlatilloId == id)
                || await _context.DomicilioDetalles.AnyAsync(d => d.PlatilloId == id);

            if (tieneVentas)
            {
                return Conflict(new { message = $"\"{platillo.Nombre}\" ya tiene ventas y no se puede eliminar. Ocúltalo de la carta en su lugar." });
            }

            try
            {
                _context.Platillos.Remove(platillo);
                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (DbUpdateException ex)
            {
                _logger?.LogError(ex, "Error al eliminar platillo {Id}", id);
                return BadRequest(new { message = "No se pudo eliminar el platillo: tiene registros asociados." });
            }
        }

        /// <summary>Normaliza los textos y valida lo que la carta y la caja necesitan.</summary>
        private async Task<ActionResult?> ValidarAsync(Platillo platillo, int? idActual)
        {
            platillo.Nombre = platillo.Nombre?.Trim() ?? "";
            platillo.Descripcion = platillo.Descripcion?.Trim();
            platillo.Categoria = string.IsNullOrWhiteSpace(platillo.Categoria) ? "General" : platillo.Categoria.Trim();

            if (platillo.Nombre.Length == 0)
                return BadRequest(new { message = "El nombre es obligatorio" });
            if (platillo.Nombre.Length > 100)
                return BadRequest(new { message = "El nombre admite máximo 100 caracteres" });
            if (platillo.Categoria.Length > 50)
                return BadRequest(new { message = "La categoría admite máximo 50 caracteres" });
            if (platillo.Precio <= 0)
                return BadRequest(new { message = "El precio debe ser mayor que cero" });

            var nombre = platillo.Nombre.ToLower();
            if (await _context.Platillos.AnyAsync(p => p.Id != idActual && p.Nombre.ToLower() == nombre))
                return Conflict(new { message = $"Ya existe un platillo llamado \"{platillo.Nombre}\"" });

            return null;
        }

        private bool PlatilloExists(int id)
        {
            return _context.Platillos.Any(e => e.Id == id);
        }
    }
}