using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;

namespace RestaurantApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Administrador,Caja")]
    public class FacturasController : ControllerBase
    {
        // Consecutivo propio: FV-00000001, FV-00000002… (las facturas antiguas "FAC-…" se conservan).
        private const string PrefijoConsecutivo = "FV-";
        private const string NitConsumidorFinal = "222222222222";

        private readonly RestauranteContext _context;

        public FacturasController(RestauranteContext context)
        {
            _context = context;
        }

        // GET: api/Facturas
        [HttpGet]
        public async Task<ActionResult<IEnumerable<FacturaDto>>> GetFacturas()
        {
            var facturas = await _context.Facturas
                .OrderByDescending(f => f.FechaEmision)
                .ToListAsync();

            return facturas.Select(ADto).ToList();
        }

        // GET: api/Facturas/5
        [HttpGet("{id}")]
        public async Task<ActionResult<FacturaDto>> GetFactura(int id)
        {
            var factura = await _context.Facturas.FindAsync(id);
            if (factura == null)
                return NotFound();

            return ADto(factura);
        }

        // POST: api/Facturas
        /// <summary>Emite la factura de un pago (una sola por pago) con número consecutivo.</summary>
        [HttpPost]
        public async Task<ActionResult<FacturaDto>> PostFactura(CrearFacturaDto crearFactura)
        {
            var pago = await _context.Pagos.FirstOrDefaultAsync(p => p.Id == crearFactura.PagoId);
            if (pago == null)
                return NotFound("Pago no encontrado");

            var existente = await _context.Facturas.FirstOrDefaultAsync(f => f.PagoId == pago.Id);
            if (existente != null)
                return Conflict(new { message = $"El pago ya tiene la factura {existente.NumeroFactura}", factura = ADto(existente) });

            var factura = new Factura
            {
                PagoId = pago.Id,
                NitCliente = string.IsNullOrWhiteSpace(crearFactura.NitCliente) ? NitConsumidorFinal : crearFactura.NitCliente.Trim(),
                NombreCliente = string.IsNullOrWhiteSpace(crearFactura.NombreCliente) ? "Consumidor final" : crearFactura.NombreCliente.Trim(),
                Subtotal = pago.Monto,
                Propina = pago.MontoPropina,
                Total = pago.Monto + pago.MontoPropina,
                FechaEmision = DateTime.UtcNow
            };

            // NumeroFactura es UNIQUE: si dos cajas emiten a la vez, se reintenta con el siguiente.
            for (var intento = 0; ; intento++)
            {
                factura.NumeroFactura = await SiguienteNumeroAsync();
                _context.Facturas.Add(factura);
                try
                {
                    await _context.SaveChangesAsync();
                    break;
                }
                catch (DbUpdateException) when (intento < 2)
                {
                    _context.Entry(factura).State = EntityState.Detached;
                }
            }

            return CreatedAtAction(nameof(GetFactura), new { id = factura.Id }, ADto(factura));
        }

        private async Task<string> SiguienteNumeroAsync()
        {
            // Ancho fijo: el orden alfabético coincide con el numérico.
            var ultimo = await _context.Facturas
                .Where(f => f.NumeroFactura.StartsWith(PrefijoConsecutivo))
                .OrderByDescending(f => f.NumeroFactura)
                .Select(f => f.NumeroFactura)
                .FirstOrDefaultAsync();

            var n = ultimo != null && int.TryParse(ultimo[PrefijoConsecutivo.Length..], out var actual) ? actual + 1 : 1;
            return $"{PrefijoConsecutivo}{n:D8}";
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
