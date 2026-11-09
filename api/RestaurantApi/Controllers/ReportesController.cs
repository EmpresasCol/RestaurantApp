using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    /// <summary>
    /// Cierre de caja (caja y administrador) y reportes de ventas (administrador).
    /// Los [Authorize] de clase y de método se suman (Y): la clase admite a los dos roles
    /// y lo exclusivo del administrador lo restringe en su método.
    /// </summary>
    [Route("api/reportes")]
    [ApiController]
    [Authorize(Roles = "Administrador,Caja")]
    public class ReportesController : ControllerBase
    {
        private const decimal MaximoMonto = 999_999_999m;

        private readonly RestauranteContext _context;
        private readonly ReportesVentas _reportes;

        public ReportesController(RestauranteContext context)
        {
            _context = context;
            _reportes = new ReportesVentas(context);
        }

        // GET: api/reportes/cierre?fecha=2026-11-02 (sin fecha: hoy)
        [HttpGet("cierre")]
        public async Task<ActionResult<CierreCajaDto>> Cierre([FromQuery] DateTime? fecha = null)
            => await _reportes.CierreAsync(fecha ?? HoraLocal.AhoraColombia().Date);

        // PUT: api/reportes/cierre/apertura
        /// <summary>Abre la caja del día con su base (el efectivo que se deja en el cajón para dar cambio).</summary>
        [HttpPut("cierre/apertura")]
        public async Task<ActionResult<CierreCajaDto>> Abrir(AperturaCajaDto dto)
        {
            if (dto.Base < 0 || dto.Base > MaximoMonto)
                return BadRequest(new { message = "La base debe ser un valor positivo" });

            var dia = dto.Fecha.Date;
            var registro = await _context.CierresCaja.FirstOrDefaultAsync(c => c.FechaCaja == dia);
            if (registro?.FechaCierre != null)
                return Conflict(new { message = "La caja de ese día ya está cerrada" });

            if (registro == null)
            {
                registro = new CierreCaja { FechaCaja = dia };
                _context.CierresCaja.Add(registro);
            }
            registro.Base = dto.Base;
            registro.UsuarioAperturaId = QproClaims.IdUsuario(User);
            registro.FechaApertura = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return await _reportes.CierreAsync(dia);
        }

        // POST: api/reportes/cierre
        /// <summary>
        /// Cierra la caja con el arqueo: lo que se contó en el cajón, las propinas y gastos pagados
        /// con ese efectivo y, si se tienen, el cierre del datáfono y lo que muestra el banco.
        /// El esperado lo calcula el servidor y queda guardado como estaba al cerrar.
        /// </summary>
        [HttpPost("cierre")]
        public async Task<ActionResult<CierreCajaDto>> Cerrar(CerrarCajaDto dto)
        {
            var montos = new[] { dto.EfectivoContado, dto.PropinasPagadas, dto.Retiros, dto.TarjetaDatafono ?? 0, dto.TransferenciasBanco ?? 0 };
            if (montos.Any(m => m < 0 || m > MaximoMonto))
                return BadRequest(new { message = "Los valores del cierre deben ser positivos" });
            if (dto.Observaciones?.Length > 500)
                return BadRequest(new { message = "Las observaciones admiten máximo 500 caracteres" });

            var dia = dto.Fecha.Date;
            if (dia > HoraLocal.AhoraColombia().Date)
                return BadRequest(new { message = "No se cierra una caja de un día que no ha llegado" });

            var registro = await _context.CierresCaja.FirstOrDefaultAsync(c => c.FechaCaja == dia);
            if (registro?.FechaCierre != null && !User.IsInRole(nameof(RolUsuario.Administrador)))
                return Conflict(new { message = "La caja de ese día ya se cerró. Pide al administrador que la reabra." });

            if (registro == null)
            {
                registro = new CierreCaja { FechaCaja = dia };
                _context.CierresCaja.Add(registro);
            }
            registro.PropinasPagadas = dto.PropinasPagadas;
            registro.Retiros = dto.Retiros;
            registro.EfectivoContado = dto.EfectivoContado;
            registro.TarjetaDatafono = dto.TarjetaDatafono;
            registro.TransferenciasBanco = dto.TransferenciasBanco;
            registro.Observaciones = string.IsNullOrWhiteSpace(dto.Observaciones) ? null : dto.Observaciones.Trim();
            await _context.SaveChangesAsync();

            // El esperado sale del mismo cálculo que ve la pantalla, con lo que se acaba de guardar.
            var cierre = await _reportes.CierreAsync(dia);
            registro.EfectivoEsperado = cierre.EfectivoEsperado;
            registro.UsuarioCierreId = QproClaims.IdUsuario(User);
            registro.FechaCierre = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return await _reportes.CierreAsync(dia);
        }

        // DELETE: api/reportes/cierre?fecha=2026-11-02
        /// <summary>Reabre la caja de un día (por ejemplo, se cobró una mesa después de cerrar).</summary>
        [HttpDelete("cierre")]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> Reabrir([FromQuery] DateTime fecha)
        {
            var registro = await _context.CierresCaja.FirstOrDefaultAsync(c => c.FechaCaja == fecha.Date);
            if (registro?.FechaCierre == null)
                return NotFound(new { message = "La caja de ese día no está cerrada" });

            registro.FechaCierre = null;
            registro.UsuarioCierreId = null;
            registro.EfectivoEsperado = null;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // GET: api/reportes/ventas?desde=2026-10-01&hasta=2026-10-31
        [HttpGet("ventas")]
        [Authorize(Roles = "Administrador")]
        public async Task<ActionResult<ReporteVentasDto>> Ventas([FromQuery] DateTime? desde = null, [FromQuery] DateTime? hasta = null)
        {
            var hoy = HoraLocal.AhoraColombia().Date;
            var d = (desde ?? hoy).Date;
            var h = (hasta ?? hoy).Date;
            if (h < d)
                return BadRequest(new { message = "La fecha final no puede ser anterior a la inicial" });
            if ((h - d).TotalDays >= ReportesVentas.MaximoDias)
                return BadRequest(new { message = $"El rango máximo es de {ReportesVentas.MaximoDias} días" });

            return await _reportes.VentasAsync(d, h);
        }
    }
}
