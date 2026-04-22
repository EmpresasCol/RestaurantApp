// api/RestaurantApi/Controllers/AdminDomiciliariosController.cs
// Endpoints de panel administrativo:
//   · Ranking / estadísticas de los domiciliarios.
//   · Bandeja de observaciones recibidas de clientes.
//
// Ruta: api/admin/domiciliarios/*

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Dtos;
using RestaurantApi.Models;

namespace RestaurantApi.Controllers
{
    [ApiController]
    [Route("api/admin/domiciliarios")]
    public class AdminDomiciliariosController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public AdminDomiciliariosController(RestauranteContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Ranking de domiciliarios: entregas totales, hoy, semana, mes y tiempo promedio.
        /// Ordenado por EntregadosHoy desc, luego Semana, luego Total.
        /// </summary>
        [HttpGet("ranking")]
        public async Task<ActionResult<IEnumerable<EstadisticasDomiciliarioDto>>> GetRanking()
        {
            var hoy          = DateTime.Today;
            var inicioSemana = hoy.AddDays(-(int)hoy.DayOfWeek + (int)DayOfWeek.Monday);
            if (inicioSemana > hoy) inicioSemana = inicioSemana.AddDays(-7);
            var inicioMes    = new DateTime(hoy.Year, hoy.Month, 1);

            var domiciliarios = await _context.Usuarios
                .AsNoTracking()
                .Where(u => u.Rol == RolUsuario.Domiciliario)
                .Select(u => new { u.Id, u.Nombre })
                .ToListAsync();

            if (domiciliarios.Count == 0) return Ok(Array.Empty<EstadisticasDomiciliarioDto>());

            var ids = domiciliarios.Select(d => d.Id).ToList();

            // Materializamos en memoria para evitar traducciones EF complejas
            // (el volumen esperado de domiciliarios por restaurante es pequeño).
            var entregas = await _context.Domicilios
                .AsNoTracking()
                .Where(d => d.DomiciliarioId.HasValue
                         && ids.Contains(d.DomiciliarioId.Value)
                         && d.Estado == "Entregado")
                .Select(d => new { d.DomiciliarioId, d.FechaRecogida, d.FechaEntrega })
                .ToListAsync();

            var ranking = domiciliarios
                .Select(u =>
                {
                    var mias = entregas.Where(e => e.DomiciliarioId == u.Id).ToList();
                    var conTiempos = mias
                        .Where(e => e.FechaRecogida.HasValue && e.FechaEntrega.HasValue)
                        .Select(e => (e.FechaEntrega!.Value - e.FechaRecogida!.Value).TotalMinutes)
                        .ToList();

                    return new EstadisticasDomiciliarioDto
                    {
                        DomiciliarioId           = u.Id,
                        DomiciliarioNombre       = u.Nombre,
                        TotalEntregados          = mias.Count,
                        EntregadosHoy            = mias.Count(e => e.FechaEntrega >= hoy),
                        EntregadosSemana         = mias.Count(e => e.FechaEntrega >= inicioSemana),
                        EntregadosMes            = mias.Count(e => e.FechaEntrega >= inicioMes),
                        TiempoPromedioEntregaMin = conTiempos.Count == 0 ? null : conTiempos.Average()
                    };
                })
                .OrderByDescending(r => r.EntregadosHoy)
                .ThenByDescending(r => r.EntregadosSemana)
                .ThenByDescending(r => r.TotalEntregados)
                .ToList();

            return Ok(ranking);
        }

        /// <summary>Observaciones que los clientes dejaron sobre los domiciliarios.</summary>
        [HttpGet("observaciones")]
        public async Task<ActionResult<IEnumerable<ObservacionClienteDto>>> GetObservaciones(
            [FromQuery] int? domiciliarioId = null,
            [FromQuery] int limit = 100)
        {
            if (limit <= 0 || limit > 500) limit = 100;

            var query = _context.Domicilios
                .AsNoTracking()
                .Include(d => d.Cliente)
                .Include(d => d.Domiciliario)
                .Where(d => !string.IsNullOrEmpty(d.ObservacionCliente));

            if (domiciliarioId.HasValue)
                query = query.Where(d => d.DomiciliarioId == domiciliarioId.Value);

            var lista = await query
                .OrderByDescending(d => d.FechaObservacion)
                .Take(limit)
                .Select(d => new ObservacionClienteDto
                {
                    DomicilioId         = d.Id,
                    FechaObservacion    = d.FechaObservacion!.Value,
                    Observacion         = d.ObservacionCliente!,
                    ClienteId           = d.Cliente.Id,
                    ClienteNombre       = d.Cliente.Nombre,
                    ClienteTelefono     = d.Cliente.Telefono,
                    DomiciliarioId      = d.DomiciliarioId,
                    DomiciliarioNombre  = d.Domiciliario != null ? d.Domiciliario.Nombre : null,
                    FechaEntrega        = d.FechaEntrega
                })
                .ToListAsync();

            return Ok(lista);
        }
    }
}
