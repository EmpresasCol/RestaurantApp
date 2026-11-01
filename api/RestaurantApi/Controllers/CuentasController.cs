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
    /// solo actualiza cómo pagó el cliente. La caja la cierra al cobrar (POST api/pagos/cobro).
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Administrador,Caja,Mesero")]
    public class CuentasController : ControllerBase
    {
        /// <summary>Tamaño máximo del data URI del comprobante (una foto reducida pesa ~300 KB).</summary>
        public const int MaximoComprobante = 2_000_000;

        private static readonly string[] Metodos = { nameof(MetodoPago.Efectivo), nameof(MetodoPago.Tarjeta), nameof(MetodoPago.QR) };

        private readonly RestauranteContext _context;

        public CuentasController(RestauranteContext context)
        {
            _context = context;
        }

        [HttpGet("solicitudes")]
        public async Task<ActionResult<IEnumerable<SolicitudCuentaDto>>> GetPendientes()
        {
            return await _context.SolicitudesCuenta
                .Where(s => s.Estado == SolicitudCuenta.Pendiente)
                .OrderBy(s => s.Fecha)
                .Select(s => new SolicitudCuentaDto
                {
                    Id = s.Id,
                    MesaId = s.MesaId,
                    MesaNumero = s.Mesa != null ? s.Mesa.Numero : 0,
                    MeseroNombre = s.Usuario != null ? s.Usuario.Nombre : string.Empty,
                    Fecha = s.Fecha,
                    MetodoPago = s.MetodoPago,
                    FechaPago = s.FechaPago,
                    TieneComprobante = s.Comprobante != null
                })
                .ToListAsync();
        }

        [HttpGet("solicitudes/{id}/comprobante")]
        public async Task<IActionResult> GetComprobante(int id)
        {
            var comprobante = await _context.SolicitudesCuenta
                .Where(s => s.Id == id)
                .Select(s => s.Comprobante)
                .FirstOrDefaultAsync();
            if (comprobante == null)
                return NotFound(new { message = "Esta cuenta no tiene comprobante" });
            return Ok(new { comprobante });
        }

        [HttpPost("solicitudes")]
        [Authorize(Roles = "Administrador,Mesero")]
        public async Task<ActionResult<SolicitudCuentaDto>> Solicitar(SolicitarCuentaDto dto)
        {
            var mesa = await _context.Mesas.FindAsync(dto.MesaId);
            if (mesa == null)
                return NotFound(new { message = $"Mesa {dto.MesaId} no existe" });

            var abierta = await _context.Pedidos.AnyAsync(p => p.MesaId == mesa.Id
                && p.Estado != EstadoPedido.Pagado && p.Estado != EstadoPedido.Cancelado);
            if (!abierta)
                return BadRequest(new { message = $"La mesa {mesa.Numero} no tiene una cuenta abierta" });

            var metodo = dto.MetodoPago?.Trim();
            if (!string.IsNullOrEmpty(metodo))
            {
                metodo = Metodos.FirstOrDefault(m => m.Equals(metodo, StringComparison.OrdinalIgnoreCase));
                if (metodo == null)
                    return BadRequest(new { message = "El método de pago debe ser Efectivo, Tarjeta o QR" });
            }
            else metodo = null;

            var comprobante = string.IsNullOrWhiteSpace(dto.Comprobante) ? null : dto.Comprobante;
            if (comprobante != null)
            {
                if (!comprobante.StartsWith("data:image/", StringComparison.Ordinal))
                    return BadRequest(new { message = "El comprobante debe ser una foto" });
                if (comprobante.Length > MaximoComprobante)
                    return BadRequest(new { message = "La foto del comprobante es muy pesada" });
            }

            var solicitud = await _context.SolicitudesCuenta
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

            if (metodo != null)
            {
                if (metodo == nameof(MetodoPago.QR) && comprobante == null && solicitud.Comprobante == null)
                    return BadRequest(new { message = "Toma la foto de la transferencia antes de enviarla a caja" });
                solicitud.MetodoPago = metodo;
                // Una foto vieja no respalda un pago que ya no es por transferencia.
                solicitud.Comprobante = metodo == nameof(MetodoPago.QR) ? comprobante ?? solicitud.Comprobante : null;
                solicitud.FechaPago = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return Ok(new SolicitudCuentaDto
            {
                Id = solicitud.Id,
                MesaId = mesa.Id,
                MesaNumero = mesa.Numero,
                Fecha = solicitud.Fecha,
                MetodoPago = solicitud.MetodoPago,
                FechaPago = solicitud.FechaPago,
                TieneComprobante = solicitud.Comprobante != null
            });
        }

        /// <summary>El mesero se equivocó de mesa o el cliente siguió pidiendo.</summary>
        [HttpDelete("solicitudes/{id}")]
        [Authorize(Roles = "Administrador,Mesero")]
        public async Task<IActionResult> Anular(int id)
        {
            var solicitud = await _context.SolicitudesCuenta.FindAsync(id);
            if (solicitud == null || solicitud.Estado != SolicitudCuenta.Pendiente)
                return NotFound(new { message = "La solicitud ya no está pendiente" });

            solicitud.Estado = SolicitudCuenta.Anulada;
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
