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
        /// Cobra la cuenta de una mesa: uno o varios pedidos de esa mesa con una sola factura.
        /// El servidor calcula el consumo con el precio con que se pidió cada plato. Un pedido que
        /// sigue en cocina no se cobra (desaparecería de la comanda). Pagos, cierre de pedidos,
        /// liberación de la mesa y factura van en una sola transacción.
        /// </summary>
        [HttpPost("cobro")]
        public async Task<ActionResult<CobroDto>> Cobrar(CrearCobroDto dto)
        {
            if (!Enum.TryParse<MetodoPago>(dto.MetodoPago, true, out var metodo) || !Enum.IsDefined(metodo))
                return BadRequest(new { message = $"Método de pago inválido: {dto.MetodoPago}" });

            var ids = dto.PedidoIds.Distinct().ToList();
            if (ids.Count == 0)
                return BadRequest(new { message = "Elige al menos un pedido para cobrar" });
            if (dto.Propina < 0)
                return BadRequest(new { message = "La propina no puede ser negativa" });

            var errorCliente = Facturacion.ValidarCliente(dto.NitCliente, dto.NombreCliente);
            if (errorCliente != null)
                return BadRequest(new { message = errorCliente });

            var pedidos = await _context.Pedidos
                .Include(p => p.Mesa)
                .Include(p => p.Detalles).ThenInclude(d => d.Platillo)
                .Where(p => ids.Contains(p.Id))
                .OrderBy(p => p.Fecha)
                .ToListAsync();

            if (pedidos.Count != ids.Count)
                return NotFound(new { message = "Alguno de los pedidos ya no existe" });
            if (pedidos.Select(p => p.MesaId).Distinct().Count() > 1)
                return BadRequest(new { message = "Solo se cobran juntos los pedidos de una misma mesa" });

            var cerrado = pedidos.FirstOrDefault(p => !EstadosPedido.EsEditable(p.Estado));
            if (cerrado != null)
                return Conflict(new { message = $"El pedido #{cerrado.Id} ya está {(cerrado.Estado == EstadoPedido.Pagado ? "pagado" : "cancelado")}" });
            if (await _context.Pagos.AnyAsync(p => ids.Contains(p.PedidoId)))
                return Conflict(new { message = "Uno de los pedidos ya tiene un pago registrado" });

            var enCocina = pedidos.Where(p => p.Estado == EstadoPedido.EnProceso).Select(p => $"#{p.Id}").ToList();
            if (enCocina.Count > 0)
                return Conflict(new { message = $"El pedido {string.Join(", ", enCocina)} sigue en cocina. Cóbralo cuando esté listo." });

            var consumo = pedidos.Sum(Cuentas.Consumo);
            if (consumo <= 0)
                return BadRequest(new { message = "La cuenta está en cero" });
            if (dto.Propina > consumo)
                return BadRequest(new { message = "La propina no puede ser mayor que el consumo" });

            var total = consumo + dto.Propina;
            decimal? recibido = metodo == MetodoPago.Efectivo ? dto.Recibido : null;
            if (recibido < total)
                return BadRequest(new { message = $"El efectivo recibido no alcanza: faltan {total - recibido:N0} pesos" });

            using var tx = await _context.Database.BeginTransactionAsync();
            var ahora = DateTime.UtcNow;

            // Un pago por pedido (cada uno con su consumo); la propina va en el primero.
            var pagos = pedidos.Select((p, i) => new Pago
            {
                PedidoId = p.Id,
                Monto = Cuentas.Consumo(p),
                MontoPropina = i == 0 ? dto.Propina : 0,
                MetodoPago = metodo,
                Fecha = ahora
            }).ToList();
            _context.Pagos.AddRange(pagos);

            foreach (var p in pedidos) p.Estado = EstadoPedido.Pagado;
            var mesa = pedidos[0].Mesa;
            if (mesa != null)
            {
                var otrosAbiertos = await _context.Pedidos.AnyAsync(p =>
                    p.MesaId == mesa.Id && !ids.Contains(p.Id) &&
                    p.Estado != EstadoPedido.Pagado && p.Estado != EstadoPedido.Cancelado);
                if (!otrosAbiertos) mesa.Estado = EstadoMesa.Disponible;
            }
            await _context.SaveChangesAsync();

            var factura = new Factura
            {
                PagoId = pagos[0].Id,
                Subtotal = consumo,
                Propina = dto.Propina,
                Total = total,
                FechaEmision = ahora
            };
            Facturacion.AsignarCliente(factura, dto.NitCliente, dto.NombreCliente);
            await Facturacion.EmitirAsync(_context, factura);

            foreach (var pago in pagos) pago.FacturaId = factura.Id;
            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            var detalle = (await Facturacion.ConDetalleAsync(_context, new List<Factura> { factura }))[0];
            return Ok(new CobroDto
            {
                Factura = detalle,
                Recibido = recibido,
                Cambio = recibido is { } r ? r - total : 0
            });
        }

        /// <summary>
        /// Registra el pago de un solo pedido (sin factura). La caja usa POST api/pagos/cobro;
        /// este se conserva para clientes anteriores y aplica las mismas reglas.
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

            if (pedido.Estado == EstadoPedido.EnProceso)
                return Conflict(new { message = $"El pedido #{pedido.Id} sigue en cocina. Cóbralo cuando esté listo." });

            var consumo = Cuentas.Consumo(pedido);
            if (Math.Abs(crearPago.Monto - consumo) > Tolerancia)
                return BadRequest($"El monto ({crearPago.Monto:0}) no coincide con el consumo del pedido ({consumo:0})");

            using var tx = await _context.Database.BeginTransactionAsync();

            var pago = new Pago
            {
                PedidoId = pedido.Id,
                Monto = consumo,
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

        /// <summary>
        /// Corrige el método de pago (por ejemplo, se marcó efectivo y fue tarjeta). La propina solo
        /// cambia si el pago aún no tiene factura: una factura emitida no se reescribe.
        /// </summary>
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

            var facturado = pago.FacturaId != null || await _context.Facturas.AnyAsync(f => f.PagoId == id);
            if (facturado && dto.MontoPropina != pago.MontoPropina)
                return Conflict(new { message = "La propina de un pago facturado no se puede cambiar" });

            pago.MetodoPago = metodo;
            pago.MontoPropina = dto.MontoPropina;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>Deshace un pago sin factura: el pedido vuelve a la cuenta abierta y la mesa queda ocupada.</summary>
        [HttpDelete("{id}")]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> DeletePago(int id)
        {
            var pago = await _context.Pagos.FindAsync(id);
            if (pago == null)
                return NotFound();

            if (pago.FacturaId != null || await _context.Facturas.AnyAsync(f => f.PagoId == id))
                return Conflict(new { message = "El pago ya tiene factura emitida" });

            var pedido = await _context.Pedidos.Include(p => p.Mesa).FirstOrDefaultAsync(p => p.Id == pago.PedidoId);
            if (pedido is { Estado: EstadoPedido.Pagado })
            {
                pedido.Estado = EstadoPedido.Entregado;
                if (pedido.Mesa != null) pedido.Mesa.Estado = EstadoMesa.Ocupada;
            }

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
