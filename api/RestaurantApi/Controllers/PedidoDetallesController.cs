using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;

namespace RestaurantApi.Controllers
{
    /// <summary>
    /// CRUD crudo de detalles (solo administración). Los clientes deben usar
    /// api/pedidos/{id}, que valida y sincroniza el inventario.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Administrador")]
    public class PedidoDetallesController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public PedidoDetallesController(RestauranteContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<PedidoDetalle>>> GetPedidoDetalles()
        {
            return await _context.PedidoDetalles
                .Include(d => d.Pedido)
                .Include(d => d.Platillo)
                .ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<PedidoDetalle>> GetPedidoDetalle(int id)
        {
            var detalle = await _context.PedidoDetalles
                .Include(d => d.Pedido)
                .Include(d => d.Platillo)
                .FirstOrDefaultAsync(d => d.Id == id);

            if (detalle == null)
                return NotFound();

            return detalle;
        }

        [HttpPost]
        public async Task<ActionResult<PedidoDetalle>> PostPedidoDetalle(PedidoDetalle detalle)
        {
            if (detalle.Cantidad <= 0)
                return BadRequest("La cantidad debe ser mayor que cero");

            _context.PedidoDetalles.Add(detalle);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetPedidoDetalle), new { id = detalle.Id }, detalle);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutPedidoDetalle(int id, PedidoDetalle detalle)
        {
            if (id != detalle.Id)
                return BadRequest();
            if (detalle.Cantidad <= 0)
                return BadRequest("La cantidad debe ser mayor que cero");

            _context.Entry(detalle).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePedidoDetalle(int id)
        {
            var detalle = await _context.PedidoDetalles.FindAsync(id);
            if (detalle == null)
                return NotFound();

            _context.PedidoDetalles.Remove(detalle);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
