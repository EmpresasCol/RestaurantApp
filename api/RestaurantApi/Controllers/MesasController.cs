// api/RestaurantApi/Controllers/MesasController.cs
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class MesasController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public MesasController(RestauranteContext context)
        {
            _context = context;
        }

        /// <summary>96 bits al azar en hexadecimal: imposible de adivinar a partir de otra mesa.</summary>
        public static string NuevoCodigo() => Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant();

        private bool EsAdmin => QproClaims.EsAdministrador(HttpContext?.User);

        // Solo el administrador recibe el código del QR (lo necesita para imprimirlo).
        private MesaDto ADto(Mesa m) => new()
        {
            Id = m.Id,
            Numero = m.Numero,
            Estado = m.Estado.ToString(),
            CodigoQR = EsAdmin ? m.CodigoQR : null
        };

        [HttpGet]
        public async Task<ActionResult<IEnumerable<MesaDto>>> GetMesas()
        {
            var mesas = await _context.Mesas.OrderBy(m => m.Numero).ToListAsync();

            // Las mesas creadas antes de existir el código lo reciben la primera vez que el admin las ve.
            if (EsAdmin && mesas.Any(m => string.IsNullOrEmpty(m.CodigoQR)))
            {
                foreach (var m in mesas.Where(m => string.IsNullOrEmpty(m.CodigoQR)))
                    m.CodigoQR = NuevoCodigo();
                await _context.SaveChangesAsync();
            }

            return mesas.Select(ADto).ToList();
        }

        /// <summary>Lo único que el comensal sabe de su mesa: el número, a partir del código de su QR.</summary>
        [HttpGet("qr/{codigo}")]
        [AllowAnonymous]
        [EnableRateLimiting("publico")]
        public async Task<ActionResult<MesaPublicaDto>> GetMesaPorCodigo(string codigo)
        {
            var mesa = await _context.Mesas.FirstOrDefaultAsync(m => m.CodigoQR == codigo);
            if (mesa == null)
                return NotFound(new { message = "Este código QR ya no es válido. Pide al mesero el código de tu mesa." });
            return new MesaPublicaDto { Numero = mesa.Numero };
        }

        /// <summary>
        /// Cambia el código de todas las mesas (por ejemplo, si alguien se llevó la foto de un QR).
        /// Los QR impresos antes dejan de servir.
        /// </summary>
        [HttpPost("codigos")]
        [Authorize(Roles = "Administrador")]
        public async Task<ActionResult<IEnumerable<MesaDto>>> RegenerarCodigos()
        {
            var mesas = await _context.Mesas.OrderBy(m => m.Numero).ToListAsync();
            foreach (var m in mesas) m.CodigoQR = NuevoCodigo();
            await _context.SaveChangesAsync();
            return mesas.Select(ADto).ToList();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<MesaDto>> GetMesa(int id)
        {
            var mesa = await _context.Mesas.FindAsync(id);
            if (mesa == null) return NotFound();

            return new MesaDto
            {
                Id = mesa.Id,
                Numero = mesa.Numero,
                Estado = mesa.Estado.ToString()
            };
        }

        [HttpPost]
        [Authorize(Roles = "Administrador")]
        public async Task<ActionResult<Mesa>> PostMesa(Mesa mesa)
        {
            if (mesa.Numero <= 0)
                return BadRequest("El número de mesa debe ser mayor que cero");
            if (await _context.Mesas.AnyAsync(m => m.Numero == mesa.Numero))
                return Conflict(new { message = $"Ya existe la mesa {mesa.Numero}" });

            mesa.Id = 0;
            mesa.CodigoQR = NuevoCodigo();
            _context.Mesas.Add(mesa);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetMesa), new { id = mesa.Id }, mesa);
        }

        /// <summary>Actualiza número y/o estado; los campos vacíos se conservan.</summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> PutMesa(int id, MesaDto dto)
        {
            if (id != dto.Id) return BadRequest();

            var mesa = await _context.Mesas.FindAsync(id);
            if (mesa == null) return NotFound();

            if (dto.Numero > 0) mesa.Numero = dto.Numero;
            if (!string.IsNullOrWhiteSpace(dto.Estado))
            {
                if (!Enum.TryParse<EstadoMesa>(dto.Estado, true, out var estado) || !Enum.IsDefined(estado))
                    return BadRequest($"Estado inválido: {dto.Estado}");
                mesa.Estado = estado;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPut("{id}/estado")]
        [Authorize(Roles = "Administrador,Caja,Mesero")]
        public async Task<IActionResult> ActualizarEstado(int id, [FromBody] ActualizarEstadoMesaDto dto)
        {
            var mesa = await _context.Mesas.FindAsync(id);

            if (mesa == null)
                return NotFound($"Mesa con ID {id} no encontrada");

            // Validar que el estado sea válido
            if (!Enum.TryParse<EstadoMesa>(dto.Estado, true, out var estadoEnum) || !Enum.IsDefined(estadoEnum))
            {
                return BadRequest($"Estado inválido: {dto.Estado}. Estados válidos: Disponible, Ocupada, EsperandoPago");
            }

            mesa.Estado = estadoEnum;
            await _context.SaveChangesAsync();

            return Ok(new MesaDto
            {
                Id = mesa.Id,
                Numero = mesa.Numero,
                Estado = mesa.Estado.ToString()
            });
        }

        public const int MaximoMesas = 200;

        /// <summary>
        /// Deja el salón con las mesas 1..N: crea las que faltan y retira las de número mayor.
        /// No retira una mesa ocupada o con pedidos en el historial (los pedidos guardan su mesa).
        /// </summary>
        [HttpPut("cantidad")]
        [Authorize(Roles = "Administrador")]
        public async Task<ActionResult<IEnumerable<MesaDto>>> FijarCantidad([FromBody] CantidadMesasDto dto)
        {
            if (dto.Cantidad < 1 || dto.Cantidad > MaximoMesas)
                return BadRequest(new { message = $"El número de mesas debe estar entre 1 y {MaximoMesas}" });

            var mesas = await _context.Mesas.ToListAsync();
            var sobrantes = mesas.Where(m => m.Numero > dto.Cantidad).ToList();
            var idsSobrantes = sobrantes.Select(m => m.Id).ToList();
            var conPedidos = await _context.Pedidos
                .Where(p => idsSobrantes.Contains(p.MesaId))
                .Select(p => p.MesaId).Distinct().ToListAsync();

            var bloqueadas = sobrantes
                .Where(m => m.Estado != EstadoMesa.Disponible || conPedidos.Contains(m.Id))
                .Select(m => m.Numero).OrderBy(n => n).ToList();
            if (bloqueadas.Count > 0)
            {
                return Conflict(new
                {
                    message = $"No se pueden retirar las mesas {string.Join(", ", bloqueadas)}: están ocupadas o tienen pedidos registrados.",
                    mesas = bloqueadas
                });
            }

            _context.Mesas.RemoveRange(sobrantes);
            var existentes = mesas.Select(m => m.Numero).ToHashSet();
            for (var n = 1; n <= dto.Cantidad; n++)
                if (!existentes.Contains(n))
                    _context.Mesas.Add(new Mesa { Numero = n, Estado = EstadoMesa.Disponible, CodigoQR = NuevoCodigo() });

            await _context.SaveChangesAsync();
            var resultado = await _context.Mesas.OrderBy(m => m.Numero).ToListAsync();
            foreach (var m in resultado.Where(m => string.IsNullOrEmpty(m.CodigoQR)))
                m.CodigoQR = NuevoCodigo();
            await _context.SaveChangesAsync();
            return resultado.Select(ADto).ToList();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> DeleteMesa(int id)
        {
            var mesa = await _context.Mesas.FindAsync(id);
            if (mesa == null) return NotFound();
            if (await _context.Pedidos.AnyAsync(p => p.MesaId == id))
                return Conflict(new { message = $"La mesa {mesa.Numero} tiene pedidos registrados y no se puede eliminar" });

            _context.Mesas.Remove(mesa);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}