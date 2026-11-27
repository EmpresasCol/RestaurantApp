using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    /// <summary>
    /// Personalización del restaurante: nombre, logo, colores, carta del comensal, facturas y
    /// operación. Es pública para leer (el menú QR y el ingreso la muestran sin sesión); solo el
    /// administrador la cambia. Cada cambio avisa el tema "configuracion" por SignalR.
    /// </summary>
    [Route("api/configuracion")]
    [ApiController]
    public class ConfiguracionController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public ConfiguracionController(RestauranteContext context) => _context = context;

        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<ConfiguracionRestaurante>> Get() => await Personalizacion.ObtenerAsync(_context);

        [HttpPut]
        [Authorize(Roles = "Administrador")]
        public async Task<ActionResult<ConfiguracionRestaurante>> Put(ConfiguracionRestaurante dto)
        {
            var error = Personalizacion.NormalizarYValidar(dto);
            if (error != null) return BadRequest(new { message = error });

            dto.FechaActualizacion = DateTime.UtcNow;
            try
            {
                var actual = await _context.ConfiguracionRestaurante.FirstOrDefaultAsync(c => c.Id == 1);
                if (actual == null) _context.ConfiguracionRestaurante.Add(dto);
                else _context.Entry(actual).CurrentValues.SetValues(dto);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex) when (Personalizacion.FaltaLaTabla(ex))
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable,
                    new { message = "Falta aplicar la migración 2026-11-26_configuracion_restaurante.sql en la base de datos" });
            }
            return Ok(dto);
        }
    }
}
