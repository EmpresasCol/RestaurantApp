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

        /// <summary>
        /// Una factura emitida no se reescribe: ni sus platos ni los de un pedido ya cerrado se
        /// tocan por aquí. Devuelve el rechazo o null.
        /// </summary>
        private async Task<IActionResult?> RechazoSiCerradoAsync(int pedidoId, int? detalleId)
        {
            var estado = await _context.Pedidos.Where(p => p.Id == pedidoId).Select(p => (EstadoPedido?)p.Estado).FirstOrDefaultAsync();
            if (estado == null)
                return NotFound(new { message = $"Pedido {pedidoId} no encontrado" });
            if (!EstadosPedido.EsEditable(estado.Value))
                return Conflict(new { message = $"Un pedido {estado} no se puede modificar" });
            if (detalleId != null && await _context.PedidoDetalles.AnyAsync(d => d.Id == detalleId && (d.FacturaId != null || d.PedidoId != pedidoId)))
                return Conflict(new { message = "Ese plato ya está en una factura o es de otro pedido: no se modifica" });
            return null;
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
            var rechazo = await RechazoSiCerradoAsync(detalle.PedidoId, null);
            if (rechazo != null)
                return new ActionResult<PedidoDetalle>((ActionResult)rechazo);
            var sinStock = await VerificarStockAsync(detalle.PedidoId, detalle);
            if (sinStock != null)
                return BadRequest(sinStock);

            detalle.Id = 0;
            detalle.FacturaId = null; // una línea nueva nunca nace cobrada
            detalle.PrecioUnitario = null; // el precio lo fija el servidor con la carta, no el cliente
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
            var rechazo = await RechazoSiCerradoAsync(detalle.PedidoId, id);
            if (rechazo != null)
                return rechazo;
            var sinStock = await VerificarStockAsync(detalle.PedidoId, detalle);
            if (sinStock != null)
                return BadRequest(sinStock);

            detalle.FacturaId = null; // llegó hasta aquí: no estaba facturado y no se marca desde el cuerpo
            // El precio con que se pidió no se edita desde aquí.
            detalle.PrecioUnitario = await _context.PedidoDetalles.AsNoTracking()
                .Where(d => d.Id == id).Select(d => d.PrecioUnitario).FirstOrDefaultAsync();
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
            var rechazo = await RechazoSiCerradoAsync(detalle.PedidoId, id);
            if (rechazo != null)
                return rechazo;

            _context.PedidoDetalles.Remove(detalle);
            await _context.SaveChangesAsync();
            // Lo que ya no se pide vuelve al stock.
            await _inventario.DescontarStockPorPedidoAsync(detalle.PedidoId);

            return NoContent();
        }
    }
}
