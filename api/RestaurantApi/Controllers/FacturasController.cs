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
    public class FacturasController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public FacturasController(RestauranteContext context)
        {
            _context = context;
        }

        // GET: api/Facturas?fecha=2026-11-02
        /// <summary>Facturas con su detalle. Con fecha, solo las emitidas ese día (hora de Colombia).</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<FacturaDto>>> GetFacturas([FromQuery] DateTime? fecha = null)
        {
            var consulta = _context.Facturas.AsNoTracking();
            if (fecha != null)
            {
                var desde = HoraLocal.AUtc(fecha.Value.Date);
                var hasta = desde.AddDays(1);
                consulta = consulta.Where(f => f.FechaEmision >= desde && f.FechaEmision < hasta);
            }

            var facturas = await consulta.OrderByDescending(f => f.FechaEmision).ToListAsync();
            return await Facturacion.ConDetalleAsync(_context, facturas);
        }

        // GET: api/Facturas/5
        [HttpGet("{id}")]
        public async Task<ActionResult<FacturaDto>> GetFactura(int id)
        {
            var factura = await _context.Facturas.AsNoTracking().FirstOrDefaultAsync(f => f.Id == id);
            if (factura == null)
                return NotFound();

            return (await Facturacion.ConDetalleAsync(_context, new List<Factura> { factura }))[0];
        }

        // POST: api/Facturas
        /// <summary>Emite la factura de un pago suelto (una sola por pago) con número consecutivo.</summary>
        [HttpPost]
        public async Task<ActionResult<FacturaDto>> PostFactura(CrearFacturaDto crearFactura)
        {
            var errorCliente = Facturacion.ValidarCliente(crearFactura.NitCliente, crearFactura.NombreCliente);
            if (errorCliente != null)
                return BadRequest(new { message = errorCliente });

            var pago = await _context.Pagos.FirstOrDefaultAsync(p => p.Id == crearFactura.PagoId);
            if (pago == null)
                return NotFound("Pago no encontrado");

            var existente = await _context.Facturas.FirstOrDefaultAsync(f => f.PagoId == pago.Id || f.Id == pago.FacturaId);
            if (existente != null)
                return Conflict(new { message = $"El pago ya tiene la factura {existente.NumeroFactura}", factura = ADto(existente) });

            var factura = new Factura
            {
                PagoId = pago.Id,
                Subtotal = pago.Monto,
                Propina = pago.MontoPropina,
                Total = pago.Monto + pago.MontoPropina,
                FechaEmision = DateTime.UtcNow
            };
            Facturacion.AsignarCliente(factura, crearFactura.NitCliente, crearFactura.NombreCliente);
            await Facturacion.EmitirAsync(_context, factura);

            pago.FacturaId = factura.Id;
            foreach (var d in await _context.PedidoDetalles.Where(d => d.PedidoId == pago.PedidoId && d.FacturaId == null).ToListAsync())
                d.FacturaId = factura.Id;
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetFactura), new { id = factura.Id }, ADto(factura));
        }

        // POST: api/Facturas/5/anular
        /// <summary>
        /// Anula la factura con motivo obligatorio (queda quién y cuándo). Sin nuevoCliente la venta
        /// se reversa; con nuevoCliente se vuelve a facturar a ese nombre. Responde la factura
        /// anulada y, si la hay, la que la reemplaza.
        /// </summary>
        [HttpPost("{id}/anular")]
        public async Task<IActionResult> Anular(int id, AnularFacturaDto dto)
        {
            var motivo = dto.Motivo?.Trim() ?? "";
            if (motivo.Length is < 5 or > 300)
                return BadRequest(new { message = "Escribe el motivo de la anulación (entre 5 y 300 caracteres)" });
            if (dto.NuevoCliente is { } c)
            {
                if (string.IsNullOrWhiteSpace(c.Nit))
                    return BadRequest(new { message = "Escribe la identificación del cliente para la factura nueva" });
                var error = Facturacion.ValidarCliente(c.Nit, c.Nombre, c.TipoId ?? "CC", c.Correo);
                if (error != null)
                    return BadRequest(new { message = error });
            }
            if (!await _context.Facturas.AnyAsync(f => f.Id == id))
                return NotFound(new { message = "Esa factura no existe" });

            var (reemplazo, rechazo) = await DocumentosDian.AnularAsync(_context, id, motivo, QproClaims.IdUsuario(User), dto.NuevoCliente);
            if (rechazo != null)
                return Conflict(new { message = rechazo });

            var ids = reemplazo == null ? new[] { id } : new[] { id, reemplazo.Id };
            var facturas = await _context.Facturas.AsNoTracking().Where(f => ids.Contains(f.Id)).OrderBy(f => f.Id).ToListAsync();
            var detalle = await Facturacion.ConDetalleAsync(_context, facturas);
            return Ok(new { anulada = detalle[0], reemplazo = detalle.Count > 1 ? detalle[1] : null });
        }

        // POST: api/Facturas/5/reintentar
        /// <summary>Vuelve a enviar a la DIAN los documentos rechazados de la factura, ya corregida la causa.</summary>
        [HttpPost("{id}/reintentar")]
        public async Task<IActionResult> Reintentar(int id)
        {
            if (await DocumentosDian.ReencolarAsync(_context, id) == 0)
                return Conflict(new { message = "Esta factura no tiene documentos rechazados" });
            return NoContent();
        }

        private static FacturaDto ADto(Factura f) => new()
        {
            Id = f.Id,
            PagoId = f.PagoId,
            NumeroFactura = f.NumeroFactura,
            NitCliente = f.NitCliente,
            NombreCliente = f.NombreCliente,
            Subtotal = f.Subtotal,
            Propina = f.Propina,
            Total = f.Total,
            ArchivoUrl = f.ArchivoUrl,
            FechaEmision = f.FechaEmision
        };
    }
}
