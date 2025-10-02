using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;

namespace RestaurantApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class FacturasController : ControllerBase
    {
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
                .Include(f => f.Pago)
                    .ThenInclude(p => p!.Pedido)
                .OrderByDescending(f => f.FechaEmision)
                .ToListAsync();

            return facturas.Select(f => new FacturaDto
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
            }).ToList();
        }

        // GET: api/Facturas/5
        [HttpGet("{id}")]
        public async Task<ActionResult<FacturaDto>> GetFactura(int id)
        {
            var factura = await _context.Facturas
                .Include(f => f.Pago)
                .FirstOrDefaultAsync(f => f.Id == id);

            if (factura == null)
                return NotFound();

            return new FacturaDto
            {
                Id = factura.Id,
                PagoId = factura.PagoId,
                NumeroFactura = factura.NumeroFactura,
                NitCliente = factura.NitCliente,
                NombreCliente = factura.NombreCliente,
                Subtotal = factura.Subtotal,
                Propina = factura.Propina,
                Total = factura.Total,
                ArchivoUrl = factura.ArchivoUrl,
                FechaEmision = factura.FechaEmision
            };
        }

        // POST: api/Facturas
        [HttpPost]
        public async Task<ActionResult<FacturaDto>> PostFactura(CrearFacturaDto crearFactura)
        {
            // Obtener el pago
            var pago = await _context.Pagos
                .Include(p => p.Pedido)
                .FirstOrDefaultAsync(p => p.Id == crearFactura.PagoId);

            if (pago == null)
                return NotFound("Pago no encontrado");

            // Generar número de factura único
            var numeroFactura = $"FAC-{DateTime.Now:yyyyMMdd}-{DateTime.Now.Ticks}";

            // Calcular totales
            var subtotal = pago.Monto;
            var propina = pago.MontoPropina;
            var total = subtotal + propina;

            // Crear factura
            var factura = new Factura
            {
                PagoId = crearFactura.PagoId,
                NumeroFactura = numeroFactura,
                NitCliente = crearFactura.NitCliente,
                NombreCliente = crearFactura.NombreCliente,
                Subtotal = subtotal,
                Propina = propina,
                Total = total,
                FechaEmision = DateTime.Now
            };

            _context.Facturas.Add(factura);
            await _context.SaveChangesAsync();

            var facturaDto = new FacturaDto
            {
                Id = factura.Id,
                PagoId = factura.PagoId,
                NumeroFactura = factura.NumeroFactura,
                NitCliente = factura.NitCliente,
                NombreCliente = factura.NombreCliente,
                Subtotal = factura.Subtotal,
                Propina = factura.Propina,
                Total = factura.Total,
                ArchivoUrl = factura.ArchivoUrl,
                FechaEmision = factura.FechaEmision
            };

            return CreatedAtAction(nameof(GetFactura), new { id = factura.Id }, facturaDto);
        }
    }
}