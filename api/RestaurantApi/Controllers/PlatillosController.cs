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

        // La carta es pública: la consulta el menú QR del comensal.
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<PlatilloDto>>> GetPlatillos()
        {
            var platillos = await _context.Platillos.ToListAsync();
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
            Disponible = porciones is null or > 0,
            PorcionesDisponibles = porciones
        };

        [HttpPost]
        public async Task<ActionResult<Platillo>> PostPlatillo(Platillo platillo)
        {
            if (platillo.Precio <= 0)
                return BadRequest(new { message = "El precio debe ser mayor que cero" });

            platillo.Id = 0;
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

            if (platillo.Precio <= 0)
                return BadRequest(new { message = "El precio debe ser mayor que cero" });

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

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePlatillo(int id)
        {
            var platillo = await _context.Platillos.FindAsync(id);
            if (platillo == null)
            {
                return NotFound(new { message = $"Platillo con ID {id} no encontrado" });
            }

            var tieneDetalles = await _context.PedidoDetalles
                .AnyAsync(d => d.PlatilloId == id);

            if (tieneDetalles)
            {
                return BadRequest(new { message = "No se puede eliminar este platillo porque está siendo usado en pedidos existentes." });
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

        private bool PlatilloExists(int id)
        {
            return _context.Platillos.Any(e => e.Id == id);
        }
    }
}