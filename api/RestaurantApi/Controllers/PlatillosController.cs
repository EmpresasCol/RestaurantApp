using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;

namespace RestaurantApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PlatillosController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public PlatillosController(RestauranteContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<PlatilloDto>>> GetPlatillos()
        {
            var platillos = await _context.Platillos.ToListAsync();
            return platillos.Select(p => new PlatilloDto
            {
                Id = p.Id,
                Nombre = p.Nombre,
                Descripcion = p.Descripcion ?? "",
                Precio = p.Precio,
                ImagenUrl = p.ImagenUrl ?? "",
                Categoria = p.Categoria ?? "General"
            }).ToList();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<PlatilloDto>> GetPlatillo(int id)
        {
            var platillo = await _context.Platillos.FindAsync(id);
            if (platillo == null) return NotFound();

            return new PlatilloDto
            {
                Id = platillo.Id,
                Nombre = platillo.Nombre,
                Descripcion = platillo.Descripcion ?? "",
                Precio = platillo.Precio,
                ImagenUrl = platillo.ImagenUrl ?? "",
                Categoria = platillo.Categoria ?? "General"
            };
        }

        [HttpPost]
        public async Task<ActionResult<Platillo>> PostPlatillo(Platillo platillo)
        {
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
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Error al actualizar: {ex.InnerException?.Message ?? ex.Message}" });
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
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Error al eliminar: {ex.Message}" });
            }
        }

        private bool PlatilloExists(int id)
        {
            return _context.Platillos.Any(e => e.Id == id);
        }
    }
}