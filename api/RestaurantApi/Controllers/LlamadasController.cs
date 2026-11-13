using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    /// <summary>
    /// Llamadas al mesero vistas por el personal. No hay asignación de meseros a mesas: todas las
    /// llamadas vivas las ven todos los meseros activos; el primero que la toma queda como
    /// responsable y los demás ven "va en camino". La caja y el administrador pueden marcarla
    /// atendida desde el tablero.
    /// </summary>
    [Route("api/llamadas")]
    [ApiController]
    [Authorize(Roles = "Administrador,Caja,Mesero")]
    public class LlamadasController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public LlamadasController(RestauranteContext context)
        {
            _context = context;
        }

        /// <summary>Llamadas vivas (pendientes o con un mesero en camino), de la más antigua a la más nueva.</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<LlamadaDto>>> GetVivas()
            => await _context.LlamadasMesero.AsNoTracking()
                .Where(l => l.Activa == true)
                .OrderBy(l => l.Fecha)
                .Select(l => new LlamadaDto
                {
                    Id = l.Id, MesaId = l.MesaId, MesaNumero = l.Mesa!.Numero, Fecha = l.Fecha, Estado = l.Estado,
                    MeseroId = l.MeseroId, MeseroNombre = l.Mesero != null ? l.Mesero.Nombre : null
                })
                .ToListAsync();

        /// <summary>"Voy yo": la llamada queda a nombre de este mesero. Si otro la tomó antes, 409.</summary>
        [HttpPut("{id}/tomar")]
        [Authorize(Roles = "Administrador,Mesero")]
        public async Task<IActionResult> Tomar(int id)
        {
            var llamada = await _context.LlamadasMesero.Include(l => l.Mesa).Include(l => l.Mesero).FirstOrDefaultAsync(l => l.Id == id);
            if (llamada == null)
                return NotFound(new { message = "Esa llamada ya no existe" });

            var yo = QproClaims.IdUsuario(User);
            if (llamada.Estado == LlamadaMesero.EnCamino && llamada.MeseroId == yo)
                return Ok(ADto(llamada));
            if (llamada.Estado != LlamadaMesero.Pendiente)
                return Conflict(new { message = YaResuelta(llamada) });

            llamada.Estado = LlamadaMesero.EnCamino;
            llamada.MeseroId = yo;
            llamada.FechaTomada = DateTime.UtcNow;
            return await GuardarAsync(llamada);
        }

        /// <summary>El mesero ya pasó por la mesa. Repetirlo no cambia nada.</summary>
        [HttpPut("{id}/atender")]
        public async Task<IActionResult> Atender(int id)
        {
            var llamada = await _context.LlamadasMesero.Include(l => l.Mesa).Include(l => l.Mesero).FirstOrDefaultAsync(l => l.Id == id);
            if (llamada == null)
                return NotFound(new { message = "Esa llamada ya no existe" });
            if (llamada.Estado == LlamadaMesero.Atendida)
                return Ok(ADto(llamada));
            if (llamada.Activa != true)
                return Conflict(new { message = YaResuelta(llamada) });

            llamada.Estado = LlamadaMesero.Atendida;
            llamada.Activa = null;
            llamada.MeseroId ??= QproClaims.IdUsuario(User);
            llamada.FechaAtendida = DateTime.UtcNow;
            return await GuardarAsync(llamada);
        }

        /// <summary>Dos dispositivos a la vez: el segundo en guardar no pisa al primero, recibe cómo quedó.</summary>
        private async Task<IActionResult> GuardarAsync(LlamadaMesero llamada)
        {
            try
            {
                await _context.SaveChangesAsync();
                return Ok(ADto(llamada));
            }
            catch (DbUpdateConcurrencyException)
            {
                _context.ChangeTracker.Clear();
                var actual = await _context.LlamadasMesero.AsNoTracking().Include(l => l.Mesa).Include(l => l.Mesero).FirstAsync(l => l.Id == llamada.Id);
                return Conflict(new { message = YaResuelta(actual), llamada = ADto(actual) });
            }
        }

        private static string YaResuelta(LlamadaMesero l) => l.Estado switch
        {
            LlamadaMesero.EnCamino => $"{l.Mesero?.Nombre ?? "Otro mesero"} ya va para la mesa {l.Mesa?.Numero}",
            LlamadaMesero.Atendida => $"La mesa {l.Mesa?.Numero} ya fue atendida",
            _ => $"La mesa {l.Mesa?.Numero} ya se liberó"
        };

        private static LlamadaDto ADto(LlamadaMesero l) => new()
        {
            Id = l.Id, MesaId = l.MesaId, MesaNumero = l.Mesa?.Numero ?? 0, Fecha = l.Fecha, Estado = l.Estado,
            MeseroId = l.MeseroId, MeseroNombre = l.Mesero?.Nombre
        };
    }
}
