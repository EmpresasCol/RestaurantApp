using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;

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
        public async Task<ActionResult<IEnumerable<Platillo>>> GetPlatillos()
        {
            return await _context.Platillos.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Platillo>> GetPlatillo(int id)
        {
            var platillo = await _context.Platillos.FindAsync(id);
            if (platillo == null) return NotFound();
            return platillo;
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
            if (id != platillo.Id) return BadRequest();
            _context.Entry(platillo).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePlatillo(int id)
        {
            var platillo = await _context.Platillos.FindAsync(id);
            if (platillo == null) return NotFound();

            _context.Platillos.Remove(platillo);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
