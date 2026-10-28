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
    [Authorize(Roles = "Administrador,Caja")]
    public class PagosController : ControllerBase
    {
        // Tolerancia de redondeo al comparar el pago con el consumo (pesos).
        private const decimal Tolerancia = 1m;

        private readonly RestauranteContext _context;

        public PagosController(RestauranteContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<PagoDto>>> GetPagos()
        {
            var pagos = await _context.Pagos
                .OrderByDescending(p => p.Fecha)
                .ToListAsync();

            return pagos.Select(ADto).ToList();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<PagoDto>> GetPago(int id)
        {
            var pago = await _context.Pagos.FindAsync(id);
            if (pago == null)
                return NotFound();

            return ADto(pago);
        }

        /// <summary>
        /// Registra el pago de un pedido. El servidor calcula el consumo (precios de la carta,
        /// impuesto incluido) y exige que el monto coincida; un pedido solo se paga una vez.
        /// Pago, cierre del pedido y liberación de la mesa van en una sola transacción.
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<PagoDto>> PostPago(CrearPagoDto crearPago)
        {
            if (!Enum.TryParse<MetodoPago>(crearPago.MetodoPago, true, out var metodoPagoEnum) || !Enum.IsDefined(metodoPagoEnum))
                return BadRequest($"Método de pago inválido: {crearPago.MetodoPago}");

            if (crearPago.Monto <= 0)
                return BadRequest("El monto debe ser mayor que cero");

            if (crearPago.MontoPropina < 0)
                return BadRequest("La propina no puede ser negativa");

            var pedido = await _context.Pedidos
                .Include(p => p.Mesa)
                .Include(p => p.Detalles).ThenInclude(d => d.Platillo)
                .FirstOrDefaultAsync(p => p.Id == crearPago.PedidoId);

            if (pedido == null)
                return NotFound("Pedido no encontrado");

            if (await _context.Pagos.AnyAsync(p => p.PedidoId == pedido.Id))
                return Conflict(new { message = $"El pedido {pedido.Id} ya fue pagado" });

            if (!EstadosPedido.PuedeCambiar(pedido.Estado, EstadoPedido.Pagado))
                return Conflict(new { message = $"Un pedido {pedido.Estado} no se puede cobrar" });

            var consumo = pedido.Detalles.Sum(d => (d.Platillo?.Precio ?? 0) * d.Cantidad);
            if (Math.Abs(crearPago.Monto - consumo) > Tolerancia)
                return BadRequest($"El monto ({crearPago.Monto:0}) no coincide con el consumo del pedido ({consumo:0})");

            using var tx = await _context.Database.BeginTransactionAsync();

            var pago = new Pago
            {
                PedidoId = pedido.Id,
                Monto = crearPago.Monto,
                MontoPropina = crearPago.MontoPropina,
                MetodoPago = metodoPagoEnum,
                Fecha = DateTime.UtcNow
            };
            _context.Pagos.Add(pago);

            pedido.Estado = EstadoPedido.Pagado;
            if (pedido.Mesa != null)
            {
                var otrosAbiertos = await _context.Pedidos.AnyAsync(p =>
                    p.MesaId == pedido.MesaId && p.Id != pedido.Id &&
                    p.Estado != EstadoPedido.Pagado && p.Estado != EstadoPedido.Cancelado);
                if (!otrosAbiertos) pedido.Mesa.Estado = EstadoMesa.Disponible;
            }

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            return CreatedAtAction(nameof(GetPago), new { id = pago.Id }, ADto(pago));
        }

        /// <summary>Corrige método de pago o propina. El monto no se edita: es el consumo del pedido.</summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> PutPago(int id, CrearPagoDto dto)
        {
            var pago = await _context.Pagos.FindAsync(id);
            if (pago == null)
                return NotFound();

            if (!Enum.TryParse<MetodoPago>(dto.MetodoPago, true, out var metodo) || !Enum.IsDefined(metodo))
                return BadRequest($"Método de pago inválido: {dto.MetodoPago}");
            if (dto.MontoPropina < 0)
                return BadRequest("La propina no puede ser negativa");

            pago.MetodoPago = metodo;
            pago.MontoPropina = dto.MontoPropina;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> DeletePago(int id)
        {
            var pago = await _context.Pagos.FindAsync(id);
            if (pago == null)
                return NotFound();

            if (await _context.Facturas.AnyAsync(f => f.PagoId == id))
                return Conflict(new { message = "El pago ya tiene factura emitida" });

            _context.Pagos.Remove(pago);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private static PagoDto ADto(Pago p) => new()
        {
            Id = p.Id,
            PedidoId = p.PedidoId,
            Monto = p.Monto,
            MontoPropina = p.MontoPropina,
            MetodoPago = p.MetodoPago.ToString(),
            Fecha = p.Fecha
        };
    }
}
