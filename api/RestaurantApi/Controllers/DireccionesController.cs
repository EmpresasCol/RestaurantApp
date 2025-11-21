// api/RestaurantApi/Controllers/DireccionesController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;

namespace RestaurantApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DireccionesController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public DireccionesController(RestauranteContext context)
        {
            _context = context;
        }

        // GET: api/direcciones/cliente/{clienteId}
        [HttpGet("cliente/{clienteId}")]
        public async Task<ActionResult<IEnumerable<DireccionResponseDto>>> GetDireccionesCliente(int clienteId)
        {
            var direcciones = await _context.Direcciones
                .Where(d => d.ClienteId == clienteId)
                .Select(d => new DireccionResponseDto
                {
                    Id = d.Id,
                    ClienteId = d.ClienteId,
                    DireccionCompleta = d.DireccionCompleta,
                    Barrio = d.Barrio,
                    ReferenciasAdicionales = d.ReferenciasAdicionales,
                    EsPrincipal = d.EsPrincipal
                })
                .ToListAsync();

            return Ok(direcciones);
        }

        // GET: api/direcciones/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<DireccionResponseDto>> GetDireccion(int id)
        {
            var direccion = await _context.Direcciones
                .Where(d => d.Id == id)
                .Select(d => new DireccionResponseDto
                {
                    Id = d.Id,
                    ClienteId = d.ClienteId,
                    DireccionCompleta = d.DireccionCompleta,
                    Barrio = d.Barrio,
                    ReferenciasAdicionales = d.ReferenciasAdicionales,
                    EsPrincipal = d.EsPrincipal
                })
                .FirstOrDefaultAsync();

            if (direccion == null)
            {
                return NotFound(new { message = "Dirección no encontrada" });
            }

            return Ok(direccion);
        }

        // POST: api/direcciones?clienteId={clienteId}
        [HttpPost]
        public async Task<ActionResult<DireccionResponseDto>> CreateDireccion([FromBody] DireccionDto dto, [FromQuery] int clienteId)
        {
            // Validar que el cliente exista
            var clienteExiste = await _context.Clientes.AnyAsync(c => c.Id == clienteId);
            if (!clienteExiste)
            {
                return BadRequest(new { message = "Cliente no encontrado" });
            }

            var direccion = new Direccion
            {
                ClienteId = clienteId,
                DireccionCompleta = dto.DireccionCompleta,
                Barrio = dto.Barrio,
                ReferenciasAdicionales = dto.ReferenciasAdicionales,
                EsPrincipal = false
            };

            _context.Direcciones.Add(direccion);
            await _context.SaveChangesAsync();

            var direccionDto = new DireccionResponseDto
            {
                Id = direccion.Id,
                ClienteId = direccion.ClienteId,
                DireccionCompleta = direccion.DireccionCompleta,
                Barrio = direccion.Barrio,
                ReferenciasAdicionales = direccion.ReferenciasAdicionales,
                EsPrincipal = direccion.EsPrincipal
            };

            return CreatedAtAction(nameof(GetDireccion), new { id = direccion.Id }, direccionDto);
        }

        // PUT: api/direcciones/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDireccion(int id, [FromBody] DireccionDto dto)
        {
            var direccion = await _context.Direcciones.FindAsync(id);

            if (direccion == null)
            {
                return NotFound(new { message = "Dirección no encontrada" });
            }

            direccion.DireccionCompleta = dto.DireccionCompleta;
            direccion.Barrio = dto.Barrio;
            direccion.ReferenciasAdicionales = dto.ReferenciasAdicionales;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/direcciones/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDireccion(int id)
        {
            var direccion = await _context.Direcciones.FindAsync(id);

            if (direccion == null)
            {
                return NotFound(new { message = "Dirección no encontrada" });
            }

            _context.Direcciones.Remove(direccion);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}