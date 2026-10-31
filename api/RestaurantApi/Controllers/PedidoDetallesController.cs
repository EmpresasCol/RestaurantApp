using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    /// <summary>
    /// CRUD crudo de detalles (solo administración). Los clientes deben usar
    /// api/pedidos/{id}; aun así aquí también se valida el stock y se sincroniza el inventario.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Administrador")]
    public class PedidoDetallesController : ControllerBase
    {
        private readonly RestauranteContext _context;
        private readonly IInventarioService _inventario;

        public PedidoDetallesController(RestauranteContext context, IInventarioService inventario)
        {
            _context = context;
            _inventario = inventario;
        }

        /// <summary>Error si las líneas finales del pedido (con el cambio aplicado) no tienen insumos.</summary>
        private async Task<string?> VerificarStockAsync(int pedidoId, PedidoDetalle cambio)
        {
            var lineas = await _context.PedidoDetalles.AsNoTracking()
                .Where(d => d.PedidoId == pedidoId && d.Id != cambio.Id)
                .Select(d => new { d.PlatilloId, d.Cantidad })
                .ToListAsync();
            var finales = lineas.Select(d => (d.PlatilloId, d.Cantidad)).ToList();
            finales.Add((cambio.PlatilloId, cambio.Cantidad));
            return await _inventario.VerificarStockPedidoAsync(pedidoId, finales);
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
            var sinStock = await VerificarStockAsync(detalle.PedidoId, detalle);
            if (sinStock != null)
                return BadRequest(sinStock);

            _context.PedidoDetalles.Add(detalle);
            await _context.SaveChangesAsync();
            await _inventario.DescontarStockPorPedidoAsync(detalle.PedidoId);
            return CreatedAtAction(nameof(GetPedidoDetalle), new { id = detalle.Id }, detalle);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutPedidoDetalle(int id, PedidoDetalle detalle)
        {
            if (id != detalle.Id)
                return BadRequest();
            if (detalle.Cantidad <= 0)
                return BadRequest("La cantidad debe ser mayor que cero");
            var sinStock = await VerificarStockAsync(detalle.PedidoId, detalle);
            if (sinStock != null)
                return BadRequest(sinStock);

            _context.Entry(detalle).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            await _inventario.DescontarStockPorPedidoAsync(detalle.PedidoId);

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
            // Lo que ya no se pide vuelve al stock.
            await _inventario.DescontarStockPorPedidoAsync(detalle.PedidoId);

            return NoContent();
        }
    }
}
