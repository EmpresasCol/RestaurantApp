using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    /// <summary>
    /// Solicitudes de cuenta del mesero. Una por mesa mientras está pendiente: pedirla otra vez
    /// solo actualiza cómo pagó la mesa. La caja la cierra al cobrar (POST api/pagos/cobro).
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Administrador,Caja,Mesero")]
    public class CuentasController : ControllerBase
    {
        /// <summary>Tamaño máximo del data URI del comprobante (una foto reducida pesa ~300 KB).</summary>
        public const int MaximoComprobante = 2_000_000;
        public const int MaximoPagos = 20;

        private static readonly string[] Metodos = { nameof(MetodoPago.Efectivo), nameof(MetodoPago.Tarjeta), nameof(MetodoPago.QR) };

        private readonly RestauranteContext _context;

        public CuentasController(RestauranteContext context)
        {
            _context = context;
        }

        [HttpGet("solicitudes")]
        public async Task<ActionResult<IEnumerable<SolicitudCuentaDto>>> GetPendientes()
        {
            var solicitudes = await _context.SolicitudesCuenta.AsNoTracking()
                .Where(s => s.Estado == SolicitudCuenta.Pendiente)
                .OrderBy(s => s.Fecha)
                .Select(s => new
                {
                    s.Id, s.MesaId, MesaNumero = s.Mesa != null ? s.Mesa.Numero : 0,
                    MeseroNombre = s.Usuario != null ? s.Usuario.Nombre : string.Empty,
                    s.Fecha, s.MetodoPago, s.FechaPago, s.Propina,
                    ComprobanteAnterior = s.Comprobante != null,
                    // Sin la foto: se pide aparte.
                    Pagos = s.Pagos.Where(p => p.FacturaId == null).OrderBy(p => p.Id)
                        .Select(p => new PagoAvisadoDto { Id = p.Id, MetodoPago = p.MetodoPago, Monto = p.Monto, TieneComprobante = p.Comprobante != null })
                        .ToList()
                })
                .ToListAsync();

            var mesas = solicitudes.Select(s => s.MesaId).Distinct().ToList();
            var abiertos = await _context.Pedidos.AsNoTracking()
                .Include(p => p.Detalles).ThenInclude(d => d.Platillo)
                .Where(p => mesas.Contains(p.MesaId)
                    && (p.Estado == EstadoPedido.EnProceso || p.Estado == EstadoPedido.Listo || p.Estado == EstadoPedido.Entregado))
                .ToListAsync();

            return solicitudes.Select(s =>
            {
                var porCobrar = abiertos.Where(p => p.MesaId == s.MesaId).Sum(Cuentas.ConsumoPorCobrar);
                var avisado = s.Pagos.Sum(p => p.Monto);
                return new SolicitudCuentaDto
                {
                    Id = s.Id,
                    MesaId = s.MesaId,
                    MesaNumero = s.MesaNumero,
                    MeseroNombre = s.MeseroNombre,
                    Fecha = s.Fecha,
                    MetodoPago = s.MetodoPago,
                    FechaPago = s.FechaPago,
                    TieneComprobante = s.ComprobanteAnterior || s.Pagos.Any(p => p.TieneComprobante),
                    Propina = s.Propina ?? 0,
                    Pagos = s.Pagos,
                    TotalAvisado = avisado,
                    PorCobrar = porCobrar,
                    Cuadra = Cuentas.AvisoCuadra(avisado, porCobrar, s.Propina ?? 0)
                };
            }).ToList();
        }

        /// <summary>Foto de la versión anterior (una por solicitud); hoy cada pago trae la suya.</summary>
        [HttpGet("solicitudes/{id}/comprobante")]
        public async Task<IActionResult> GetComprobante(int id)
        {
            var comprobante = await _context.SolicitudesCuenta.Where(s => s.Id == id).Select(s => s.Comprobante).FirstOrDefaultAsync()
                ?? await _context.PagosAvisados.Where(p => p.SolicitudId == id && p.Comprobante != null).OrderBy(p => p.Id).Select(p => p.Comprobante).FirstOrDefaultAsync();
            if (comprobante == null)
                return NotFound(new { message = "Esta cuenta no tiene comprobante" });
            return Ok(new { comprobante });
        }

        [HttpGet("pagos/{id}/comprobante")]
        public async Task<IActionResult> GetComprobantePago(int id)
        {
            var comprobante = await _context.PagosAvisados.Where(p => p.Id == id).Select(p => p.Comprobante).FirstOrDefaultAsync();
            if (comprobante == null)
                return NotFound(new { message = "Este pago no tiene comprobante" });
            return Ok(new { comprobante });
        }

        /// <summary>
        /// Pide la cuenta (sin pagos) o avisa cómo pagó la mesa: uno o varios pagos (pago mixto,
        /// cada persona con su método, varias transferencias con su foto) y la propina.
        /// Un aviso nuevo reemplaza los pagos avisados que la caja todavía no ha usado.
        /// </summary>
        [HttpPost("solicitudes")]
        [Authorize(Roles = "Administrador,Mesero")]
        public async Task<ActionResult<SolicitudCuentaDto>> Solicitar(SolicitarCuentaDto dto)
        {
            var mesa = await _context.Mesas.FindAsync(dto.MesaId);
            if (mesa == null)
                return NotFound(new { message = $"Mesa {dto.MesaId} no existe" });

            var abiertos = await Cuentas.AbiertosDeMesaAsync(_context, mesa.Id);
            var porCobrar = abiertos.Sum(Cuentas.ConsumoPorCobrar);
            if (porCobrar <= 0)
                return BadRequest(new { message = $"La mesa {mesa.Numero} no tiene una cuenta abierta" });

            var propina = dto.Propina ?? 0;
            if (propina < 0)
                return BadRequest(new { message = "La propina no puede ser negativa" });
            if (propina > porCobrar)
                return BadRequest(new { message = "La propina no puede ser mayor que el consumo" });

            // La app anterior mandaba un solo método por toda la cuenta.
            var avisados = dto.Pagos
                ?? (string.IsNullOrWhiteSpace(dto.MetodoPago)
                    ? new List<AvisarPagoDto>()
                    : new List<AvisarPagoDto> { new() { MetodoPago = dto.MetodoPago, Monto = porCobrar + propina, Comprobante = dto.Comprobante } });

            var error = ValidarPagos(avisados, porCobrar + propina);
            if (error != null)
                return BadRequest(new { message = error });

            var solicitud = await _context.SolicitudesCuenta
                .Include(s => s.Pagos)
                .FirstOrDefaultAsync(s => s.MesaId == mesa.Id && s.Estado == SolicitudCuenta.Pendiente);
            if (solicitud == null)
            {
                solicitud = new SolicitudCuenta
                {
                    MesaId = mesa.Id,
                    UsuarioId = QproClaims.IdUsuario(User) ?? 0,
                    Fecha = DateTime.UtcNow
                };
                _context.SolicitudesCuenta.Add(solicitud);
            }

            if (avisados.Count > 0)
            {
                var ahora = DateTime.UtcNow;
                // Lo que la caja ya cobró se conserva; lo pendiente se reemplaza por el aviso nuevo.
                _context.PagosAvisados.RemoveRange(solicitud.Pagos.Where(p => p.FacturaId == null));
                foreach (var p in avisados)
                {
                    var metodo = Metodos.First(m => m.Equals(p.MetodoPago.Trim(), StringComparison.OrdinalIgnoreCase));
                    solicitud.Pagos.Add(new PagoAvisado
                    {
                        MetodoPago = metodo,
                        Monto = p.Monto,
                        Comprobante = metodo == nameof(MetodoPago.QR) ? p.Comprobante : null,
                        Fecha = ahora
                    });
                }
                var metodos = avisados.Select(p => Metodos.First(m => m.Equals(p.MetodoPago.Trim(), StringComparison.OrdinalIgnoreCase))).Distinct().ToList();
                solicitud.MetodoPago = metodos.Count == 1 ? metodos[0] : "Mixto";
                solicitud.Comprobante = null;
                solicitud.Propina = propina;
                solicitud.FechaPago = ahora;
            }

            await _context.SaveChangesAsync();

            var pendientes = solicitud.Pagos.Where(p => p.FacturaId == null).ToList();
            return Ok(new SolicitudCuentaDto
            {
                Id = solicitud.Id,
                MesaId = mesa.Id,
                MesaNumero = mesa.Numero,
                Fecha = solicitud.Fecha,
                MetodoPago = solicitud.MetodoPago,
                FechaPago = solicitud.FechaPago,
                TieneComprobante = pendientes.Any(p => p.Comprobante != null),
                Propina = solicitud.Propina ?? 0,
                Pagos = pendientes.Select(p => new PagoAvisadoDto { Id = p.Id, MetodoPago = p.MetodoPago, Monto = p.Monto, TieneComprobante = p.Comprobante != null }).ToList(),
                TotalAvisado = pendientes.Sum(p => p.Monto),
                PorCobrar = porCobrar,
                Cuadra = Cuentas.AvisoCuadra(pendientes.Sum(p => p.Monto), porCobrar, solicitud.Propina ?? 0)
            });
        }

        /// <summary>
        /// Cada pago: método válido, monto positivo y, si es transferencia, su foto. Juntos pueden
        /// cubrir solo una parte (el resto lo completa la caja), pero nunca pasarse de la cuenta.
        /// </summary>
        public static string? ValidarPagos(List<AvisarPagoDto> pagos, decimal total)
        {
            if (pagos.Count > MaximoPagos)
                return $"Máximo {MaximoPagos} pagos por cuenta";
            foreach (var p in pagos)
            {
                var metodo = Metodos.FirstOrDefault(m => m.Equals(p.MetodoPago?.Trim(), StringComparison.OrdinalIgnoreCase));
                if (metodo == null)
                    return "El método de pago debe ser Efectivo, Tarjeta o QR";
                if (p.Monto <= 0)
                    return "Cada pago debe ser mayor que cero";
                if (metodo != nameof(MetodoPago.QR)) continue;
                if (string.IsNullOrWhiteSpace(p.Comprobante))
                    return "Toma la foto de cada transferencia antes de enviarla a caja";
                if (!p.Comprobante.StartsWith("data:image/", StringComparison.Ordinal))
                    return "El comprobante debe ser una foto";
                if (p.Comprobante.Length > MaximoComprobante)
                    return "La foto del comprobante es muy pesada";
            }
            var suma = pagos.Sum(p => p.Monto);
            return suma - total >= 0.01m
                ? $"Los pagos suman {suma - total:N0} pesos más que la cuenta: si es propina, regístrala como propina"
                : null;
        }

        /// <summary>El mesero se equivocó de mesa o el cliente siguió pidiendo.</summary>
        [HttpDelete("solicitudes/{id}")]
        [Authorize(Roles = "Administrador,Mesero")]
        public async Task<IActionResult> Anular(int id)
        {
            var solicitud = await _context.SolicitudesCuenta.Include(s => s.Pagos).FirstOrDefaultAsync(s => s.Id == id);
            if (solicitud == null || solicitud.Estado != SolicitudCuenta.Pendiente)
                return NotFound(new { message = "La solicitud ya no está pendiente" });
            if (solicitud.Pagos.Any(p => p.FacturaId != null))
                return Conflict(new { message = "La caja ya cobró parte de esta cuenta con estos pagos" });

            solicitud.Estado = SolicitudCuenta.Anulada;
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
