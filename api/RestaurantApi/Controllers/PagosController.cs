using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;

namespace RestaurantApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PagosController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public PagosController(RestauranteContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<PagoDto>>> GetPagos()
        {
            var pagos = await _context.Pagos
                .Include(p => p.Pedido)
                    .ThenInclude(p => p!.Mesa)  // ← Agregar ! para indicar que no es null
                .OrderByDescending(p => p.Fecha)
                .ToListAsync();

            return pagos.Select(p => new PagoDto
            {
                Id = p.Id,
                PedidoId = p.PedidoId,
                Monto = p.Monto,
                MontoPropina = p.MontoPropina,
                MetodoPago = p.MetodoPago.ToString(),
                Fecha = p.Fecha
            }).ToList();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<PagoDto>> GetPago(int id)
        {
            var pago = await _context.Pagos
                .Include(p => p.Pedido)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (pago == null)
                return NotFound();

            return new PagoDto
            {
                Id = pago.Id,
                PedidoId = pago.PedidoId,
                Monto = pago.Monto,
                MontoPropina = pago.MontoPropina,
                MetodoPago = pago.MetodoPago.ToString(),
                Fecha = pago.Fecha
            };
        }

        [HttpPost]
        public async Task<ActionResult<PagoDto>> PostPago(CrearPagoDto crearPago)
        {
            // Validar que el pedido existe
            var pedido = await _context.Pedidos.FindAsync(crearPago.PedidoId);
            if (pedido == null)
                return NotFound("Pedido no encontrado");

            // Parsear el método de pago
            if (!Enum.TryParse<MetodoPago>(crearPago.MetodoPago, true, out var metodoPagoEnum))
            {
                return BadRequest($"Método de pago inválido: {crearPago.MetodoPago}");
            }

            // Crear el pago
            var pago = new Pago
            {
                PedidoId = crearPago.PedidoId,
                Monto = crearPago.Monto,
                MontoPropina = crearPago.MontoPropina,
                MetodoPago = metodoPagoEnum,
                Fecha = DateTime.Now
            };

            _context.Pagos.Add(pago);
            await _context.SaveChangesAsync();

            var pagoDto = new PagoDto
            {
                Id = pago.Id,
                PedidoId = pago.PedidoId,
                Monto = pago.Monto,
                MontoPropina = pago.MontoPropina,
                MetodoPago = pago.MetodoPago.ToString(),
                Fecha = pago.Fecha
            };

            return CreatedAtAction(nameof(GetPago), new { id = pago.Id }, pagoDto);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutPago(int id, Pago pago)
        {
            if (id != pago.Id)
                return BadRequest();

            _context.Entry(pago).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.Pagos.Any(e => e.Id == id))
                    return NotFound();
                throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePago(int id)
        {
            var pago = await _context.Pagos.FindAsync(id);
            if (pago == null)
                return NotFound();

            _context.Pagos.Remove(pago);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}