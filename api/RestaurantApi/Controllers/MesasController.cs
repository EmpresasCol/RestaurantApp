// api/RestaurantApi/Controllers/MesasController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;

namespace RestaurantApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class MesasController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public MesasController(RestauranteContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<MesaDto>>> GetMesas()
        {
            var mesas = await _context.Mesas.ToListAsync();
            return mesas.Select(m => new MesaDto
            {
                Id = m.Id,
                Numero = m.Numero,
                Estado = m.Estado.ToString()
            }).ToList();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<MesaDto>> GetMesa(int id)
        {
            var mesa = await _context.Mesas.FindAsync(id);
            if (mesa == null) return NotFound();

            return new MesaDto
            {
                Id = mesa.Id,
                Numero = mesa.Numero,
                Estado = mesa.Estado.ToString()
            };
        }

        [HttpPost]
        [Authorize(Roles = "Administrador")]
        public async Task<ActionResult<Mesa>> PostMesa(Mesa mesa)
        {
            if (mesa.Numero <= 0)
                return BadRequest("El número de mesa debe ser mayor que cero");
            if (await _context.Mesas.AnyAsync(m => m.Numero == mesa.Numero))
                return Conflict(new { message = $"Ya existe la mesa {mesa.Numero}" });

            mesa.Id = 0;
            _context.Mesas.Add(mesa);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetMesa), new { id = mesa.Id }, mesa);
        }

        /// <summary>Actualiza número y/o estado; los campos vacíos se conservan.</summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> PutMesa(int id, MesaDto dto)
        {
            if (id != dto.Id) return BadRequest();

            var mesa = await _context.Mesas.FindAsync(id);
            if (mesa == null) return NotFound();

            if (dto.Numero > 0) mesa.Numero = dto.Numero;
            if (!string.IsNullOrWhiteSpace(dto.Estado))
            {
                if (!Enum.TryParse<EstadoMesa>(dto.Estado, true, out var estado) || !Enum.IsDefined(estado))
                    return BadRequest($"Estado inválido: {dto.Estado}");
                mesa.Estado = estado;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPut("{id}/estado")]
        [Authorize(Roles = "Administrador,Caja,Mesero")]
        public async Task<IActionResult> ActualizarEstado(int id, [FromBody] ActualizarEstadoMesaDto dto)
        {
            var mesa = await _context.Mesas.FindAsync(id);

            if (mesa == null)
                return NotFound($"Mesa con ID {id} no encontrada");

            // Validar que el estado sea válido
            if (!Enum.TryParse<EstadoMesa>(dto.Estado, true, out var estadoEnum) || !Enum.IsDefined(estadoEnum))
            {
                return BadRequest($"Estado inválido: {dto.Estado}. Estados válidos: Disponible, Ocupada, EsperandoPago");
            }

            mesa.Estado = estadoEnum;
            await _context.SaveChangesAsync();

            return Ok(new MesaDto
            {
                Id = mesa.Id,
                Numero = mesa.Numero,
                Estado = mesa.Estado.ToString()
            });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> DeleteMesa(int id)
        {
            var mesa = await _context.Mesas.FindAsync(id);
            if (mesa == null) return NotFound();

            _context.Mesas.Remove(mesa);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}