// api/RestaurantApi/Controllers/DomiciliariosController.cs
// Endpoints específicos para el rol Domiciliario (app móvil).
// No expone información más allá de lo necesario: el domiciliario solo ve
// pedidos 'Listo' sin asignar y los suyos asignados en curso.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Domiciliario,Administrador")]
    public class DomiciliariosController : ControllerBase
    {
        private readonly RestauranteContext _context;
        private readonly DomicilioRealtimeService _realtime;
        private readonly ILogger<DomiciliariosController> _logger;
        private readonly JwtTokenService _jwt;

        public DomiciliariosController(
            RestauranteContext context,
            DomicilioRealtimeService realtime,
            ILogger<DomiciliariosController> logger,
            JwtTokenService? jwt = null)
        {
            _context  = context;
            _realtime = realtime;
            _logger   = logger;
            _jwt      = jwt ?? new JwtTokenService(new JwtOptions());
        }

        // ══════════════════════════════════════════════════════════════════
        // LOGIN
        // ══════════════════════════════════════════════════════════════════

        /// <summary>Login dedicado para domiciliarios desde la app móvil.</summary>
        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public async Task<ActionResult<LoginDomiciliarioResponseDto>> Login([FromBody] LoginRequestDto req)
        {
            if (string.IsNullOrWhiteSpace(req.Usuario) || string.IsNullOrWhiteSpace(req.Clave))
                return BadRequest(new { message = "Usuario y contraseña son obligatorios" });

            var usuario = await _context.Usuarios
                .FirstOrDefaultAsync(u => u.NombreUsuario == req.Usuario);

            var migrar = false;
            if (usuario is null)
                ClaveHasher.VerificarFicticio(req.Clave);

            if (usuario is null || !ClaveHasher.Verificar(req.Clave, usuario.ClaveHash, out migrar))
            {
                // No revelamos si el usuario existe o no: mismo mensaje.
                _logger.LogWarning("🚫 Login domiciliario fallido");
                return Unauthorized(new { message = "Credenciales inválidas" });
            }

            if (migrar)
            {
                usuario.ClaveHash = ClaveHasher.Hash(req.Clave);
                await _context.SaveChangesAsync();
            }

            if (usuario.Rol != RolUsuario.Domiciliario)
            {
                _logger.LogWarning("⛔ Usuario {Id} intentó login como domiciliario con rol {Rol}",
                    usuario.Id, usuario.Rol);
                return Unauthorized(new
                {
                    message = "Esta cuenta no tiene permisos de domiciliario."
                });
            }

            var hoy = HoraLocal.InicioDeHoyUtc();
            var manana = hoy.AddDays(1);

            var entregasHoy = await _context.Domicilios
                .CountAsync(d => d.DomiciliarioId == usuario.Id
                              && d.Estado == "Entregado"
                              && d.FechaEntrega >= hoy
                              && d.FechaEntrega <  manana);

            var entregasTotales = await _context.Domicilios
                .CountAsync(d => d.DomiciliarioId == usuario.Id && d.Estado == "Entregado");

            _logger.LogInformation("✅ Login domiciliario: {Nombre}", usuario.Nombre);

            return Ok(new LoginDomiciliarioResponseDto
            {
                Id              = usuario.Id,
                Nombre          = usuario.Nombre,
                NombreUsuario   = usuario.NombreUsuario,
                Rol             = usuario.Rol.ToString(),
                EntregasHoy     = entregasHoy,
                EntregasTotales = entregasTotales,
                Token           = _jwt.Crear(usuario)
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // PEDIDOS VISIBLES PARA EL DOMICILIARIO
        //   · Listos y SIN asignar (bolsa común).
        //   · Recogidos / EnCamino del propio domiciliario.
        // ══════════════════════════════════════════════════════════════════

        [HttpGet("{domiciliarioId:int}/pedidos")]
        public async Task<ActionResult<IEnumerable<DomicilioDomiciliarioDto>>> GetPedidos(int domiciliarioId)
        {
            var rechazo = await ValidarDomiciliarioAsync(domiciliarioId);
            if (rechazo is not null) return rechazo;

            var pedidos = await _context.Domicilios
                .AsNoTracking()
                .Include(d => d.Cliente)
                .Include(d => d.Direccion)
                .Include(d => d.Detalles).ThenInclude(dd => dd.Platillo)
                .Include(d => d.Domiciliario)
                .Where(d =>
                    // Bolsa común: listos sin asignar
                    (d.Estado == "Listo" && d.DomiciliarioId == null)
                    // Mis entregas activas
                    || ((d.Estado == "Recogido" || d.Estado == "EnCamino")
                        && d.DomiciliarioId == domiciliarioId))
                .OrderBy(d => d.FechaPedido)
                .Select(d => MapToDomiciliarioDto(d))
                .ToListAsync();

            return Ok(pedidos);
        }

        // ══════════════════════════════════════════════════════════════════
        // ACCIONES DEL DOMICILIARIO
        // ══════════════════════════════════════════════════════════════════

        /// <summary>
        /// El domiciliario toma un pedido listo y marca "recogido del restaurante".
        /// Transición: Listo → Recogido. Asigna DomiciliarioId y FechaRecogida.
        /// </summary>
        [HttpPut("{domiciliarioId:int}/pedidos/{domicilioId:int}/recoger")]
        public async Task<IActionResult> MarcarRecogido(int domiciliarioId, int domicilioId)
        {
            var rechazo = await ValidarDomiciliarioAsync(domiciliarioId);
            if (rechazo is not null) return rechazo;

            var domicilio = await _context.Domicilios.FindAsync(domicilioId);
            if (domicilio is null)
                return NotFound(new { message = "Domicilio no encontrado" });

            // Solo se puede recoger si está 'Listo' y libre, o ya asignado al mismo usuario.
            if (domicilio.Estado != "Listo")
                return Conflict(new { message = $"El pedido no está listo (estado actual: {domicilio.Estado})" });

            if (domicilio.DomiciliarioId.HasValue && domicilio.DomiciliarioId.Value != domiciliarioId)
                return Conflict(new { message = "Este pedido ya fue tomado por otro domiciliario" });

            domicilio.DomiciliarioId = domiciliarioId;
            domicilio.Estado         = "Recogido";
            domicilio.FechaRecogida  = DateTime.UtcNow;

            // Estado y DomiciliarioId son tokens de concurrencia: si otro domiciliario
            // lo tomó entre la lectura y el guardado, el UPDATE no afecta filas.
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(new { message = "Este pedido ya fue tomado por otro domiciliario" });
            }

            // Notificar a cliente (por token) y admin vía FCM.
            await _realtime.NotificarCambioEstadoAsync(domicilio);

            _logger.LogInformation("📦 Pedido #{Id} recogido por domiciliario {Dom}", domicilioId, domiciliarioId);
            return NoContent();
        }

        /// <summary>
        /// Marcar como "en camino hacia el cliente". Transición: Recogido → EnCamino.
        /// Botón opcional en la app; útil para telemetría y UX del cliente.
        /// </summary>
        [HttpPut("{domiciliarioId:int}/pedidos/{domicilioId:int}/en-camino")]
        public async Task<IActionResult> MarcarEnCamino(int domiciliarioId, int domicilioId)
        {
            var rechazo = await ValidarDomiciliarioAsync(domiciliarioId);
            if (rechazo is not null) return rechazo;

            var domicilio = await _context.Domicilios.FindAsync(domicilioId);
            if (domicilio is null) return NotFound();

            if (domicilio.DomiciliarioId != domiciliarioId)
                return Forbid();

            if (domicilio.Estado != "Recogido")
                return Conflict(new { message = $"Estado inválido: {domicilio.Estado}" });

            domicilio.Estado = "EnCamino";
            await _context.SaveChangesAsync();
            await _realtime.NotificarCambioEstadoAsync(domicilio);

            return NoContent();
        }

        /// <summary>
        /// Marcar "entregado al cliente". Transición: Recogido o EnCamino → Entregado.
        /// </summary>
        [HttpPut("{domiciliarioId:int}/pedidos/{domicilioId:int}/entregar")]
        public async Task<IActionResult> MarcarEntregado(int domiciliarioId, int domicilioId)
        {
            var rechazo = await ValidarDomiciliarioAsync(domiciliarioId);
            if (rechazo is not null) return rechazo;

            var domicilio = await _context.Domicilios.FindAsync(domicilioId);
            if (domicilio is null) return NotFound();

            if (domicilio.DomiciliarioId != domiciliarioId)
                return Forbid();

            if (domicilio.Estado is not ("Recogido" or "EnCamino"))
                return Conflict(new { message = $"Estado inválido: {domicilio.Estado}" });

            domicilio.Estado       = "Entregado";
            domicilio.FechaEntrega = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            await _realtime.NotificarCambioEstadoAsync(domicilio);

            _logger.LogInformation("✅ Pedido #{Id} entregado por domiciliario {Dom}", domicilioId, domiciliarioId);
            return NoContent();
        }

        // ══════════════════════════════════════════════════════════════════
        // ESTADÍSTICAS (propias del domiciliario, para mostrar en la app)
        // ══════════════════════════════════════════════════════════════════

        [HttpGet("{domiciliarioId:int}/estadisticas")]
        public async Task<ActionResult<EstadisticasDomiciliarioDto>> GetEstadisticas(int domiciliarioId)
        {
            var rechazo = await ValidarDomiciliarioAsync(domiciliarioId);
            if (rechazo is not null) return rechazo;

            var usuario = await _context.Usuarios
                .AsNoTracking()
                .FirstAsync(u => u.Id == domiciliarioId);

            var hoyLocal     = HoraLocal.AhoraColombia().Date;
            var semanaLocal  = hoyLocal.AddDays(-(int)hoyLocal.DayOfWeek + (int)DayOfWeek.Monday);
            if (semanaLocal > hoyLocal) semanaLocal = semanaLocal.AddDays(-7);
            var hoy          = HoraLocal.AUtc(hoyLocal);
            var inicioSemana = HoraLocal.AUtc(semanaLocal);
            var inicioMes    = HoraLocal.AUtc(new DateTime(hoyLocal.Year, hoyLocal.Month, 1));

            var entregas = await _context.Domicilios
                .AsNoTracking()
                .Where(d => d.DomiciliarioId == domiciliarioId && d.Estado == "Entregado")
                .ToListAsync();

            var stats = new EstadisticasDomiciliarioDto
            {
                DomiciliarioId         = usuario.Id,
                DomiciliarioNombre     = usuario.Nombre,
                TotalEntregados        = entregas.Count,
                EntregadosHoy          = entregas.Count(e => e.FechaEntrega >= hoy),
                EntregadosSemana       = entregas.Count(e => e.FechaEntrega >= inicioSemana),
                EntregadosMes          = entregas.Count(e => e.FechaEntrega >= inicioMes),
                TiempoPromedioEntregaMin = entregas
                    .Where(e => e.FechaRecogida.HasValue && e.FechaEntrega.HasValue)
                    .Select(e => (e.FechaEntrega!.Value - e.FechaRecogida!.Value).TotalMinutes)
                    .DefaultIfEmpty()
                    .Average()
            };

            return Ok(stats);
        }

        // ══════════════════════════════════════════════════════════════════
        // Helpers
        // ══════════════════════════════════════════════════════════════════

        /// <summary>
        /// El id de la ruta debe ser el del token (salvo administrador) y corresponder
        /// a un usuario con rol Domiciliario. Devuelve null si puede continuar.
        /// </summary>
        private async Task<ActionResult?> ValidarDomiciliarioAsync(int domiciliarioId)
        {
            var idToken = QproClaims.IdUsuario(HttpContext?.User);
            if (idToken.HasValue && idToken.Value != domiciliarioId && !QproClaims.EsAdministrador(HttpContext?.User))
                return Forbid();

            var esDomiciliario = await _context.Usuarios
                .AnyAsync(u => u.Id == domiciliarioId && u.Rol == RolUsuario.Domiciliario);

            return esDomiciliario ? null : Forbid();
        }

        private static DomicilioDomiciliarioDto MapToDomiciliarioDto(Domicilio d) => new()
        {
            Id                    = d.Id,
            Estado                = d.Estado,
            FechaPedido           = d.FechaPedido,
            FechaRecogida         = d.FechaRecogida,
            FechaEntrega          = d.FechaEntrega,
            ClienteNombre         = d.Cliente.Nombre,
            ClienteTelefono       = d.Cliente.Telefono,
            DireccionCompleta     = d.Direccion.DireccionCompleta,
            Barrio                = d.Direccion.Barrio,
            ReferenciasAdicionales = d.Direccion.ReferenciasAdicionales,
            Subtotal              = d.Subtotal,
            CostoEnvio            = d.CostoEnvio,
            Total                 = d.Total,
            MetodoPago            = d.MetodoPago,
            PagadoAnticipado      = d.PagadoAnticipado,
            NotasCliente          = d.NotasCliente,
            DomiciliarioId        = d.DomiciliarioId,
            DomiciliarioNombre    = d.Domiciliario?.Nombre,
            Detalles = d.Detalles.Select(dd => new DomicilioDetalleDto
            {
                Id              = dd.Id,
                PlatilloId      = dd.PlatilloId,
                PlatilloNombre  = dd.Platillo.Nombre,
                Cantidad        = dd.Cantidad,
                PrecioUnitario  = dd.PrecioUnitario,
                Subtotal        = dd.Subtotal,
                Nota            = dd.Nota ?? ""
            }).ToList()
        };
    }
}
