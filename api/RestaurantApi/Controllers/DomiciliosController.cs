// api/RestaurantApi/Controllers/DomiciliosController.cs
using System.Linq.Expressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Administrador,Caja,Cocina")]
    public class DomiciliosController : ControllerBase
    {
        private const int CantidadMaximaPorLinea = 100;
        private static readonly string[] MetodosPagoValidos = { "Efectivo", "Transferencia", "Tarjeta", "Nequi", "Daviplata" };
        private static readonly string[] EstadosActivos = { "EnPreparacion", "Listo", "Recogido", "EnCamino" };

        private readonly RestauranteContext _context;
        private readonly IInventarioService _inventarioService;

        public DomiciliosController(RestauranteContext context, IInventarioService inventarioService)
        {
            _context = context;
            _inventarioService = inventarioService;
        }

        // GET: api/domicilios
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DomicilioResponseDto>>> GetDomicilios()
        {
            var domicilios = await _context.Domicilios
                .OrderByDescending(d => d.FechaPedido)
                .Select(AResponseDto)
                .ToListAsync();

            return Ok(domicilios);
        }

        // GET: api/domicilios/activos
        /// <summary>Domicilios en curso: en preparación, listos, recogidos o en camino.</summary>
        [HttpGet("activos")]
        public async Task<ActionResult<IEnumerable<DomicilioResponseDto>>> GetDomiciliosActivos()
        {
            var domicilios = await _context.Domicilios
                .Where(d => EstadosActivos.Contains(d.Estado))
                .OrderBy(d => d.FechaPedido)
                .Select(AResponseDto)
                .ToListAsync();

            return Ok(domicilios);
        }

        // GET: api/domicilios/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<DomicilioResponseDto>> GetDomicilio(int id)
        {
            var domicilio = await _context.Domicilios
                .Where(d => d.Id == id)
                .Select(AResponseDto)
                .FirstOrDefaultAsync();

            if (domicilio == null)
                return NotFound(new { message = "Domicilio no encontrado" });

            return Ok(domicilio);
        }

        // POST: api/domicilios
        [HttpPost]
        [Authorize(Roles = "Administrador,Caja")]
        public async Task<ActionResult<DomicilioResponseDto>> CreateDomicilio([FromBody] CreateDomicilioDto dto)
        {
            if (dto.Detalles == null || dto.Detalles.Count == 0)
                return BadRequest(new { message = "El domicilio debe incluir al menos un platillo" });

            if (dto.Detalles.Any(d => d.Cantidad <= 0 || d.Cantidad > CantidadMaximaPorLinea))
                return BadRequest(new { message = $"La cantidad de cada platillo debe estar entre 1 y {CantidadMaximaPorLinea}" });

            if (dto.CostoEnvio < 0)
                return BadRequest(new { message = "El costo de envío no puede ser negativo" });

            var metodoPago = string.IsNullOrWhiteSpace(dto.MetodoPago) ? "Efectivo" : dto.MetodoPago;
            if (!MetodosPagoValidos.Contains(metodoPago))
                return BadRequest(new { message = "Método de pago inválido" });

            if (!await _context.Clientes.AnyAsync(c => c.Id == dto.ClienteId))
                return BadRequest(new { message = "Cliente no encontrado" });

            if (!await _context.Direcciones.AnyAsync(d => d.Id == dto.DireccionId && d.ClienteId == dto.ClienteId))
                return BadRequest(new { message = "Dirección no encontrada para el cliente" });

            // Quien crea el domicilio es el usuario del token, no el que diga el cuerpo.
            var usuarioCreadorId = QproClaims.IdUsuario(HttpContext?.User) ?? dto.UsuarioCreadorId;
            if (!await _context.Usuarios.AnyAsync(u => u.Id == usuarioCreadorId))
                return BadRequest(new { message = "Usuario creador no válido" });

            var platilloIds = dto.Detalles.Select(d => d.PlatilloId).Distinct().ToList();
            var platillos = await _context.Platillos
                .Where(p => platilloIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id);

            var faltantes = platilloIds.Except(platillos.Keys).ToList();
            if (faltantes.Count > 0)
                return BadRequest(new { message = $"Platillo(s) no encontrado(s): {string.Join(", ", faltantes)}" });

            var sinStock = await _inventarioService.VerificarStockDomicilioAsync(0, dto.Detalles.Select(d => (d.PlatilloId, d.Cantidad)));
            if (sinStock != null)
                return BadRequest(new { message = sinStock });

            var detalles = dto.Detalles.Select(d => new DomicilioDetalle
            {
                PlatilloId = d.PlatilloId,
                Cantidad = d.Cantidad,
                PrecioUnitario = platillos[d.PlatilloId].Precio,
                Subtotal = platillos[d.PlatilloId].Precio * d.Cantidad,
                Nota = d.Nota ?? ""
            }).ToList();

            var subtotal = detalles.Sum(d => d.Subtotal);

            // Domicilio y detalles en un solo SaveChanges.
            var domicilio = new Domicilio
            {
                ClienteId = dto.ClienteId,
                DireccionId = dto.DireccionId,
                FechaPedido = DateTime.UtcNow,
                Estado = "EnPreparacion",
                Subtotal = subtotal,
                CostoEnvio = dto.CostoEnvio,
                Total = subtotal + dto.CostoEnvio,
                MetodoPago = metodoPago,
                PagadoAnticipado = dto.PagadoAnticipado,
                NotasCliente = dto.NotasCliente ?? "",
                NotasInternas = dto.NotasInternas ?? "",
                UsuarioCreadorId = usuarioCreadorId,
                FechaEstimadaEntrega = DateTime.UtcNow.AddMinutes(30),
                Detalles = detalles
            };

            _context.Domicilios.Add(domicilio);
            await _context.SaveChangesAsync();

            await _inventarioService.DescontarStockPorDomicilioAsync(domicilio.Id);

            var domicilioCreado = await _context.Domicilios
                .Where(d => d.Id == domicilio.Id)
                .Select(AResponseDto)
                .FirstAsync();

            return CreatedAtAction(nameof(GetDomicilio), new { id = domicilio.Id }, domicilioCreado);
        }

        // PUT: api/domicilios/{id}/estado
        [HttpPut("{id}/estado")]
        public async Task<IActionResult> ActualizarEstado(int id, [FromBody] ActualizarEstadoDto dto)
        {
            var domicilio = await _context.Domicilios.FindAsync(id);

            if (domicilio == null)
                return NotFound(new { message = "Domicilio no encontrado" });

            if (string.IsNullOrWhiteSpace(dto.Estado) || !EstadosPedido.EsEstadoDomicilio(dto.Estado) || dto.Estado == "Recogido")
                return BadRequest(new { message = "Estado inválido" });

            if (!EstadosPedido.PuedeCambiarDomicilio(domicilio.Estado, dto.Estado))
                return Conflict(new { message = $"No se puede pasar un domicilio de {domicilio.Estado} a {dto.Estado}" });

            if (domicilio.Estado == dto.Estado)
                return NoContent();

            domicilio.Estado = dto.Estado;
            if (dto.Estado == "Entregado")
                domicilio.FechaEntrega = DateTime.UtcNow;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(new { message = "El domicilio cambió mientras lo editabas. Recarga e intenta de nuevo." });
            }

            if (dto.Estado == "Cancelado")
                await _inventarioService.RevertirStockPorDomicilioAsync(id);
            else
                await _inventarioService.DescontarStockPorDomicilioAsync(id);

            return NoContent();
        }

        // PUT: api/domicilios/{id}/metodo-pago
        [HttpPut("{id}/metodo-pago")]
        [Authorize(Roles = "Administrador,Caja")]
        public async Task<IActionResult> ActualizarMetodoPago(int id, [FromBody] ActualizarMetodoPagoDto dto)
        {
            var domicilio = await _context.Domicilios.FindAsync(id);

            if (domicilio == null)
                return NotFound(new { message = "Domicilio no encontrado" });

            if (!MetodosPagoValidos.Contains(dto.MetodoPago))
                return BadRequest(new { message = "Método de pago inválido" });

            domicilio.MetodoPago = dto.MetodoPago;
            domicilio.PagadoAnticipado = dto.PagadoAnticipado;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // GET: api/domicilios/estadisticas/hoy
        [HttpGet("estadisticas/hoy")]
        public async Task<ActionResult<EstadisticasDomiciliosDto>> GetEstadisticasHoy()
        {
            var hoy = HoraLocal.InicioDeHoyUtc();
            var manana = hoy.AddDays(1);

            var domiciliosHoy = await _context.Domicilios
                .Where(d => d.FechaPedido >= hoy && d.FechaPedido < manana)
                .ToListAsync();

            var estadisticas = new EstadisticasDomiciliosDto
            {
                TotalDomicilios = domiciliosHoy.Count,
                EnPreparacion = domiciliosHoy.Count(d => d.Estado == "EnPreparacion"),
                Listo = domiciliosHoy.Count(d => d.Estado == "Listo"),
                EnCamino = domiciliosHoy.Count(d => d.Estado == "EnCamino" || d.Estado == "Recogido"),
                Entregados = domiciliosHoy.Count(d => d.Estado == "Entregado"),
                Cancelados = domiciliosHoy.Count(d => d.Estado == "Cancelado"),
                TotalVentas = domiciliosHoy.Where(d => d.Estado == "Entregado").Sum(d => d.Total)
            };

            return Ok(estadisticas);
        }

        private static readonly Expression<Func<Domicilio, DomicilioResponseDto>> AResponseDto = d => new DomicilioResponseDto
        {
            Id = d.Id,
            ClienteId = d.ClienteId,
            ClienteNombre = d.Cliente.Nombre,
            ClienteTelefono = d.Cliente.Telefono,
            DireccionId = d.DireccionId,
            DireccionCompleta = d.Direccion.DireccionCompleta,
            Barrio = d.Direccion.Barrio ?? "",
            ReferenciasAdicionales = d.Direccion.ReferenciasAdicionales ?? "",
            FechaPedido = d.FechaPedido,
            Estado = d.Estado,
            Subtotal = d.Subtotal,
            CostoEnvio = d.CostoEnvio,
            Total = d.Total,
            MetodoPago = d.MetodoPago,
            PagadoAnticipado = d.PagadoAnticipado,
            NotasCliente = d.NotasCliente ?? "",
            NotasInternas = d.NotasInternas ?? "",
            UsuarioCreadorId = d.UsuarioCreadorId,
            UsuarioCreadorNombre = d.UsuarioCreador.Nombre,
            DomiciliarioId = d.DomiciliarioId,
            DomiciliarioNombre = d.Domiciliario != null ? d.Domiciliario.Nombre : null,
            FechaEstimadaEntrega = d.FechaEstimadaEntrega,
            FechaEntrega = d.FechaEntrega,
            Detalles = d.Detalles.Select(dd => new DomicilioDetalleDto
            {
                Id = dd.Id,
                PlatilloId = dd.PlatilloId,
                PlatilloNombre = dd.Platillo.Nombre,
                Cantidad = dd.Cantidad,
                PrecioUnitario = dd.PrecioUnitario,
                Subtotal = dd.Subtotal,
                Nota = dd.Nota ?? ""
            }).ToList()
        };
    }
}
