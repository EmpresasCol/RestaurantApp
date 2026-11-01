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
        private const int MaximoPagos = 20;

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
        /// Cobra la cuenta de una mesa con una sola factura: todos sus pedidos, algunos, o solo los
        /// platos de una persona (dividir por consumo, incluso 1 de 2 unidades). Se paga con uno o
        /// varios pagos (efectivo + tarjeta, partes iguales, varias transferencias). El servidor
        /// calcula el consumo con el precio congelado. Lo que sigue en cocina no se cobra. Si el
        /// mesero ya avisó pagos que cubren toda la cuenta, se cobra tal cual: nadie los cambia.
        /// </summary>
        [HttpPost("cobro")]
        public async Task<ActionResult<CobroDto>> Cobrar(CrearCobroDto dto)
        {
            if (dto.Propina < 0)
                return BadRequest(new { message = "La propina no puede ser negativa" });

            var errorCliente = Facturacion.ValidarCliente(dto.NitCliente, dto.NombreCliente);
            if (errorCliente != null)
                return BadRequest(new { message = errorCliente });

            // ── Qué se cobra ──────────────────────────────────────────────
            var lineasPedidas = dto.Lineas.Where(l => l.Cantidad != 0).ToList();
            if (lineasPedidas.Any(l => l.Cantidad < 0))
                return BadRequest(new { message = "La cantidad de cada plato debe ser positiva" });
            if (lineasPedidas.GroupBy(l => l.DetalleId).Any(g => g.Count() > 1))
                return BadRequest(new { message = "Un plato aparece dos veces en el cobro" });

            var detalleIds = lineasPedidas.Select(l => l.DetalleId).ToList();
            var pedidoIds = dto.PedidoIds.Distinct().ToList();
            if (detalleIds.Count > 0)
                pedidoIds = await _context.PedidoDetalles.Where(d => detalleIds.Contains(d.Id)).Select(d => d.PedidoId).Distinct().ToListAsync();
            if (pedidoIds.Count == 0)
                return BadRequest(new { message = "Elige al menos un plato o pedido para cobrar" });

            var pedidos = await _context.Pedidos
                .Include(p => p.Mesa)
                .Include(p => p.Detalles).ThenInclude(d => d.Platillo)
                .Where(p => pedidoIds.Contains(p.Id))
                .OrderBy(p => p.Fecha)
                .ToListAsync();

            var encontrados = pedidos.SelectMany(p => p.Detalles).Count(d => detalleIds.Contains(d.Id));
            if (pedidos.Count != pedidoIds.Count || encontrados != detalleIds.Count)
                return NotFound(new { message = "Alguno de los platos o pedidos ya no existe" });
            if (pedidos.Select(p => p.MesaId).Distinct().Count() > 1)
                return BadRequest(new { message = "Solo se cobran juntos los pedidos de una misma mesa" });

            var cerrado = pedidos.FirstOrDefault(p => !EstadosPedido.EsEditable(p.Estado));
            if (cerrado != null)
                return Conflict(new { message = $"El pedido #{cerrado.Id} ya está {(cerrado.Estado == EstadoPedido.Pagado ? "pagado" : "cancelado")}" });

            var enCocina = pedidos.Where(p => !Cuentas.Cobrable(p.Estado)).Select(p => $"#{p.Id}").ToList();
            if (enCocina.Count > 0)
                return Conflict(new { message = $"El pedido {string.Join(", ", enCocina)} sigue en cocina. Cóbralo cuando esté listo." });

            // (plato, unidades que se cobran ahora)
            var cobrar = new List<(PedidoDetalle Detalle, int Cantidad)>();
            if (detalleIds.Count == 0)
            {
                cobrar.AddRange(pedidos.SelectMany(Cuentas.PorCobrar).Select(d => (d, d.Cantidad)));
                if (cobrar.Count == 0)
                    return Conflict(new { message = "Esos pedidos ya están cobrados" });
            }
            else
            {
                foreach (var l in lineasPedidas)
                {
                    var d = pedidos.SelectMany(p => p.Detalles).Single(x => x.Id == l.DetalleId);
                    var nombre = d.Platillo?.Nombre ?? "ese plato";
                    if (d.FacturaId != null || d.Estado == EstadoDetalle.Cancelado)
                        return Conflict(new { message = $"{nombre} ya se cobró" });
                    if (l.Cantidad > d.Cantidad)
                        return BadRequest(new { message = $"De {nombre} solo quedan {d.Cantidad} por cobrar" });
                    cobrar.Add((d, l.Cantidad));
                }
            }

            var consumo = cobrar.Sum(x => Cuentas.Precio(x.Detalle) * x.Cantidad);
            if (consumo <= 0)
                return BadRequest(new { message = "La cuenta está en cero" });
            if (dto.Propina > consumo)
                return BadRequest(new { message = "La propina no puede ser mayor que el consumo" });
            var total = consumo + dto.Propina;

            // ── Cómo se paga ──────────────────────────────────────────────
            var pagosDto = dto.Pagos.Count > 0
                ? dto.Pagos
                : new List<PagoCobroDto> { new() { MetodoPago = dto.MetodoPago, Monto = total, Recibido = dto.Recibido } };
            if (pagosDto.Count > MaximoPagos)
                return BadRequest(new { message = $"Máximo {MaximoPagos} pagos por cuenta" });

            var pagos = new List<(MetodoPago Metodo, decimal Monto, decimal? Recibido, int? AvisoId)>();
            foreach (var p in pagosDto)
            {
                if (!Enum.TryParse<MetodoPago>(p.MetodoPago, true, out var metodo) || !Enum.IsDefined(metodo))
                    return BadRequest(new { message = $"Método de pago inválido: {p.MetodoPago}" });
                if (p.Monto <= 0)
                    return BadRequest(new { message = "Cada pago debe ser mayor que cero" });
                var recibido = metodo == MetodoPago.Efectivo ? p.Recibido : null;
                if (recibido < p.Monto)
                    return BadRequest(new { message = $"El efectivo recibido no alcanza: faltan {p.Monto - recibido:N0} pesos" });
                pagos.Add((metodo, p.Monto, recibido, p.AvisoId));
            }
            var pagado = pagos.Sum(p => p.Monto);
            if (Math.Abs(pagado - total) >= 0.01m)
                return BadRequest(new
                {
                    message = pagado < total
                        ? $"Los pagos no cubren la cuenta: faltan {total - pagado:N0} pesos"
                        : $"Los pagos suman {pagado - total:N0} pesos de más: súmalos a la propina o corrige un pago"
                });

            // ── Lo que avisó el mesero no se cambia ───────────────────────
            var mesaId = pedidos[0].MesaId;
            var solicitud = await _context.SolicitudesCuenta
                .Include(s => s.Pagos)
                .FirstOrDefaultAsync(s => s.MesaId == mesaId && s.Estado == SolicitudCuenta.Pendiente);
            var avisos = solicitud?.Pagos.Where(a => a.FacturaId == null).ToList() ?? new List<PagoAvisado>();
            var abiertos = await Cuentas.AbiertosDeMesaAsync(_context, mesaId);
            var debeMesa = abiertos.Sum(Cuentas.ConsumoPorCobrar);

            if (pagos.Where(p => p.AvisoId != null).GroupBy(p => p.AvisoId).Any(g => g.Count() > 1))
                return Conflict(new { message = "Un pago avisado aparece dos veces" });
            foreach (var p in pagos.Where(p => p.AvisoId != null))
            {
                var aviso = avisos.FirstOrDefault(a => a.Id == p.AvisoId);
                if (aviso == null)
                    return Conflict(new { message = "Ese pago avisado ya se usó o no es de esta mesa" });
                if (!string.Equals(aviso.MetodoPago, p.Metodo.ToString(), StringComparison.OrdinalIgnoreCase) || aviso.Monto != p.Monto)
                    return Conflict(new { message = "Un pago que avisó el mesero no se puede cambiar" });
            }

            var propinaAvisada = solicitud?.Propina ?? 0;
            if (Cuentas.AvisoCuadra(avisos.Sum(a => a.Monto), debeMesa, propinaAvisada))
            {
                var mismosPagos = pagos.Count == avisos.Count && pagos.All(p => p.AvisoId != null);
                if (consumo != debeMesa || dto.Propina != propinaAvisada || !mismosPagos)
                    return Conflict(new { message = "El mesero ya registró el pago completo de esta mesa: cóbrala tal como la avisó" });
            }

            // ── Registrar ─────────────────────────────────────────────────
            using var tx = await _context.Database.BeginTransactionAsync();
            var ahora = DateTime.UtcNow;

            // Cobrar solo una parte de un plato: la parte que se paga queda en su propia línea.
            var cobrados = new List<PedidoDetalle>();
            foreach (var (d, cantidad) in cobrar)
            {
                if (cantidad == d.Cantidad) { cobrados.Add(d); continue; }
                d.Cantidad -= cantidad;
                var parte = new PedidoDetalle
                {
                    PedidoId = d.PedidoId, PlatilloId = d.PlatilloId, Cantidad = cantidad, Nota = d.Nota,
                    Estado = d.Estado, PrecioUnitario = Cuentas.Precio(d), Platillo = d.Platillo
                };
                pedidos.Single(p => p.Id == d.PedidoId).Detalles.Add(parte);
                cobrados.Add(parte);
            }

            // Un pago por cada forma de pago; la propina se reparte en proporción.
            var propinas = Cuentas.RepartirPropina(pagos.Select(p => p.Monto).ToList(), dto.Propina);
            var primerPedido = pedidos.First(p => cobrados.Any(d => d.PedidoId == p.Id));
            var registros = pagos.Select((p, i) => new Pago
            {
                PedidoId = primerPedido.Id,
                Monto = p.Monto - propinas[i],
                MontoPropina = propinas[i],
                MetodoPago = p.Metodo,
                Fecha = ahora
            }).ToList();
            _context.Pagos.AddRange(registros);
            await _context.SaveChangesAsync();

            var factura = new Factura
            {
                PagoId = registros[0].Id,
                Subtotal = consumo,
                Propina = dto.Propina,
                Total = total,
                FechaEmision = ahora
            };
            Facturacion.AsignarCliente(factura, dto.NitCliente, dto.NombreCliente);
            await Facturacion.EmitirAsync(_context, factura);

            foreach (var r in registros) r.FacturaId = factura.Id;
            foreach (var d in cobrados) d.FacturaId = factura.Id;
            foreach (var p in pagos.Where(p => p.AvisoId != null))
                avisos.Single(a => a.Id == p.AvisoId).FacturaId = factura.Id;

            // Un pedido queda pagado cuando ya no le queda nada por cobrar.
            foreach (var p in pedidos.Where(p => !Cuentas.PorCobrar(p).Any()))
                p.Estado = EstadoPedido.Pagado;

            // `abiertos` y `pedidos` comparten las mismas entidades rastreadas.
            var pendiente = abiertos.Where(p => p.Estado != EstadoPedido.Pagado).Sum(Cuentas.ConsumoPorCobrar);
            var cuentaSaldada = abiertos.All(p => p.Estado == EstadoPedido.Pagado);
            if (cuentaSaldada)
            {
                if (pedidos[0].Mesa is { } mesa) mesa.Estado = EstadoMesa.Disponible;
                // La solicitud del mesero queda ligada a su factura (y a sus comprobantes).
                if (solicitud != null)
                {
                    solicitud.Estado = SolicitudCuenta.Cobrada;
                    solicitud.FacturaId = factura.Id;
                }
            }
            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            var efectivo = pagos.Where(p => p.Recibido != null).ToList();
            var detalle = (await Facturacion.ConDetalleAsync(_context, new List<Factura> { factura }))[0];
            return Ok(new CobroDto
            {
                Factura = detalle,
                Recibido = efectivo.Count > 0 ? efectivo.Sum(p => p.Recibido!.Value) : null,
                Cambio = efectivo.Sum(p => p.Recibido!.Value - p.Monto),
                CuentaSaldada = cuentaSaldada,
                Pendiente = pendiente
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
