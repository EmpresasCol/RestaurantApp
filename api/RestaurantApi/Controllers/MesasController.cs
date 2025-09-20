using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;

namespace RestaurantApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
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
        public async Task<ActionResult<Mesa>> PostMesa(Mesa mesa)
        {
            _context.Mesas.Add(mesa);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetMesa), new { id = mesa.Id }, mesa);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutMesa(int id, Mesa mesa)
        {
            if (id != mesa.Id) return BadRequest();
            _context.Entry(mesa).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
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
