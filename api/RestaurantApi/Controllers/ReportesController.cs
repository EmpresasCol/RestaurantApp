using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantApi.Dtos;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    /// <summary>Cierre de caja (caja y administrador) y reportes de ventas (administrador).</summary>
    [Route("api/reportes")]
    [ApiController]
    [Authorize(Roles = "Administrador")]
    public class ReportesController : ControllerBase
    {
        private readonly ReportesVentas _reportes;

        public ReportesController(RestauranteContext context)
        {
            _reportes = new ReportesVentas(context);
        }

        // GET: api/reportes/cierre?fecha=2026-11-02 (sin fecha: hoy)
        [HttpGet("cierre")]
        [Authorize(Roles = "Administrador,Caja")]
        public async Task<ActionResult<CierreCajaDto>> Cierre([FromQuery] DateTime? fecha = null)
            => await _reportes.CierreAsync(fecha ?? HoraLocal.AhoraColombia().Date);

        // GET: api/reportes/ventas?desde=2026-10-01&hasta=2026-10-31
        [HttpGet("ventas")]
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
