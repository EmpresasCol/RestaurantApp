using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Administrador,Cocina,Caja,Mesero")]
    public class PedidosController : ControllerBase
    {
        private const int CantidadMaximaPorLinea = 100;

        private readonly RestauranteContext _context;
        private readonly ILogger<PedidosController> _logger;
        private readonly IInventarioService _inventarioService;

        public PedidosController(RestauranteContext context, ILogger<PedidosController> logger, IInventarioService inventarioService)
        {
            _context = context;
            _logger = logger;
            _inventarioService = inventarioService;
        }

        // GET: api/Pedidos
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PedidoDto>>> GetPedidos()
        {
            var pedidos = await ConsultaCompleta()
                .OrderByDescending(p => p.Fecha)
                .ToListAsync();

            return pedidos.Select(MapearPedidoADto).ToList();
        }

        /// <summary>
        /// Pedidos abiertos (EnProceso, Listo, Entregado) del más antiguo al más reciente.
        /// Es lo que consultan cocina y meseros en cada ciclo, sin traer el histórico.
        /// </summary>
        [HttpGet("activos")]
        public async Task<ActionResult<IEnumerable<PedidoDto>>> GetPedidosActivos()
        {
            var pedidos = await ConsultaCompleta()
                .Where(p => p.Estado == EstadoPedido.EnProceso
                         || p.Estado == EstadoPedido.Listo
                         || p.Estado == EstadoPedido.Entregado)
                .OrderBy(p => p.Fecha)
                .ToListAsync();

            return pedidos.Select(MapearPedidoADto).ToList();
        }

        // GET: api/Pedidos/5
        [HttpGet("{id}")]
        public async Task<ActionResult<PedidoDto>> GetPedido(int id)
        {
            var pedido = await ConsultaCompleta().FirstOrDefaultAsync(p => p.Id == id);
            if (pedido == null)
                return NotFound();

            return MapearPedidoADto(pedido);
        }

        // POST: api/Pedidos
        /// <summary>
        /// Crea un pedido de mesa. Anónimo para el menú QR del comensal; si llega con token,
        /// el pedido queda a nombre del usuario autenticado (el UsuarioId del cuerpo se ignora).
        /// </summary>
        [HttpPost]
        [AllowAnonymous]
        [EnableRateLimiting("publico")]
        public async Task<ActionResult<PedidoDto>> PostPedido(CrearPedidoDto crearPedido)
        {
            var mesa = await _context.Mesas.FindAsync(crearPedido.MesaId);
            if (mesa == null)
                return BadRequest($"Mesa {crearPedido.MesaId} no existe");

            var lineas = crearPedido.Detalles.Select(d => (d.PlatilloId, d.Cantidad)).ToList();
            var error = await ValidarDetallesAsync(lineas)
                        ?? await _inventarioService.VerificarStockPedidoAsync(0, lineas);
            if (error != null)
                return BadRequest(error);

            var usuarioId = QproClaims.IdUsuario(HttpContext?.User) ?? await ObtenerUsuarioGenericoQR();

            // Pedido y detalles en un solo SaveChanges: o se crea todo o nada.
            var pedido = new Pedido
            {
                MesaId = crearPedido.MesaId,
                UsuarioId = usuarioId,
                Estado = EstadoPedido.EnProceso,
                Fecha = DateTime.UtcNow,
                Detalles = crearPedido.Detalles.Select(d => new PedidoDetalle
                {
                    PlatilloId = d.PlatilloId,
                    Cantidad = d.Cantidad,
                    Nota = d.Nota,
                    Estado = EstadoDetalle.Pendiente
                }).ToList()
            };

            // TiDB Cloud no admite triggers: marcar la mesa aquí conserva
            // la misma regla que antes aplicaba la base de datos.
            mesa.Estado = EstadoMesa.Ocupada;
            _context.Pedidos.Add(pedido);
            await _context.SaveChangesAsync();

            await SincronizarInventarioAsync(pedido.Id, cancelar: false);

            var pedidoCreado = await ConsultaCompleta().FirstAsync(p => p.Id == pedido.Id);
            var resultado = MapearPedidoADto(pedidoCreado);
            return CreatedAtAction(nameof(GetPedido), new { id = resultado.Id }, resultado);
        }

        [HttpPut("{id}/estado")]
        public async Task<IActionResult> ActualizarEstado(int id, [FromBody] ActualizarEstadoPedidoDto dto)
        {
            var pedido = await _context.Pedidos
                .Include(p => p.Mesa)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (pedido == null)
                return NotFound($"Pedido con ID {id} no encontrado");

            if (!Enum.TryParse<EstadoPedido>(dto.Estado, true, out var estadoEnum) || !Enum.IsDefined(estadoEnum))
                return BadRequest($"Estado inválido: {dto.Estado}");

            if (!EstadosPedido.PuedeCambiar(pedido.Estado, estadoEnum))
                return Conflict(new { message = $"No se puede pasar un pedido de {pedido.Estado} a {estadoEnum}" });

            var cambio = pedido.Estado != estadoEnum;
            pedido.Estado = estadoEnum;
            await ActualizarMesaAsync(pedido);
            await _context.SaveChangesAsync();

            if (cambio && estadoEnum == EstadoPedido.Listo)
            {
                try
                {
                    var notificationService = new FirebaseNotificationService(_context);
                    await notificationService.EnviarNotificacionPedidoListo(pedido.Id, pedido.Mesa?.Numero ?? pedido.MesaId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "No se pudo enviar la notificación de pedido listo #{Id}", pedido.Id);
                }
            }

            if (cambio)
                await SincronizarInventarioAsync(pedido.Id, cancelar: estadoEnum == EstadoPedido.Cancelado);

            return Ok(new PedidoDto
            {
                Id = pedido.Id,
                MesaId = pedido.MesaId,
                MesaNumero = pedido.Mesa?.Numero ?? 0,
                Estado = pedido.Estado.ToString(),
                Fecha = pedido.Fecha
            });
        }

        // PUT: api/Pedidos/5/actualizar
        /// <summary>Reemplaza los detalles; el inventario se ajusta solo por la diferencia.</summary>
        [HttpPut("{id}/actualizar")]
        public async Task<ActionResult<PedidoDto>> ActualizarPedidoCompleto(int id, ActualizarPedidoCompletoDto dto)
        {
            var pedido = await _context.Pedidos
                .Include(p => p.Detalles)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (pedido == null)
                return NotFound();

            if (!EstadosPedido.EsEditable(pedido.Estado))
                return Conflict(new { message = $"Un pedido {pedido.Estado} no se puede modificar" });

            var lineas = dto.Detalles.Select(d => (d.PlatilloId, d.Cantidad)).ToList();
            var error = await ValidarDetallesAsync(lineas)
                        ?? await _inventarioService.VerificarStockPedidoAsync(id, lineas);
            if (error != null)
                return BadRequest(error);

            _context.PedidoDetalles.RemoveRange(pedido.Detalles);
            foreach (var detalle in dto.Detalles)
            {
                _context.PedidoDetalles.Add(new PedidoDetalle
                {
                    PedidoId = id,
                    PlatilloId = detalle.PlatilloId,
                    Cantidad = detalle.Cantidad,
                    Nota = detalle.Nota,
                    Estado = EstadoDetalle.Pendiente
                });
            }

            await _context.SaveChangesAsync();
            await SincronizarInventarioAsync(id, cancelar: false);

            var pedidoActualizado = await ConsultaCompleta().FirstAsync(p => p.Id == id);
            return MapearPedidoADto(pedidoActualizado);
        }

        // PUT: api/Pedidos/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutPedido(int id, ActualizarPedidoDto actualizarDto)
        {
            var pedido = await _context.Pedidos
                .Include(p => p.Detalles)
                .Include(p => p.Mesa)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (pedido == null)
                return NotFound($"Pedido {id} no encontrado");

            var estadoAnterior = pedido.Estado;

            if (!string.IsNullOrEmpty(actualizarDto.Estado))
            {
                if (!Enum.TryParse<EstadoPedido>(actualizarDto.Estado, true, out var nuevoEstado) || !Enum.IsDefined(nuevoEstado))
                    return BadRequest($"Estado inválido: {actualizarDto.Estado}");
                if (!EstadosPedido.PuedeCambiar(pedido.Estado, nuevoEstado))
                    return Conflict(new { message = $"No se puede pasar un pedido de {pedido.Estado} a {nuevoEstado}" });
                pedido.Estado = nuevoEstado;
            }

            var detalles = actualizarDto.Detalles ?? new List<ActualizarPedidoDetalleDto>();
            if (detalles.Count > 0)
            {
                if (!EstadosPedido.EsEditable(estadoAnterior))
                    return Conflict(new { message = $"Un pedido {estadoAnterior} no se puede modificar" });

                var activos = detalles.Where(d => !d.Eliminar).Select(d => (d.PlatilloId, d.Cantidad)).ToList();
                if (activos.Count > 0)
                {
                    var error = await ValidarDetallesAsync(activos);
                    if (error != null) return BadRequest(error);
                }

                var idsAEliminar = detalles.Where(d => d.Eliminar && d.Id.HasValue).Select(d => d.Id!.Value).ToList();
                foreach (var detalle in pedido.Detalles.Where(d => idsAEliminar.Contains(d.Id)).ToList())
                    _context.PedidoDetalles.Remove(detalle);

                foreach (var detalleDto in detalles.Where(d => !d.Eliminar && d.Id.HasValue))
                {
                    var existente = pedido.Detalles.FirstOrDefault(d => d.Id == detalleDto.Id!.Value);
                    if (existente != null)
                    {
                        existente.Cantidad = detalleDto.Cantidad;
                        existente.Nota = detalleDto.Nota;
                    }
                }

                foreach (var detalleDto in detalles.Where(d => !d.Eliminar && !d.Id.HasValue))
                {
                    pedido.Detalles.Add(new PedidoDetalle
                    {
                        PedidoId = id,
                        PlatilloId = detalleDto.PlatilloId,
                        Cantidad = detalleDto.Cantidad,
                        Nota = detalleDto.Nota ?? "",
                        Estado = EstadoDetalle.Pendiente
                    });
                }

                // Lo que quedará en el pedido tras la edición (los eliminados siguen en la colección hasta guardar).
                var finales = pedido.Detalles.Where(d => !idsAEliminar.Contains(d.Id)).Select(d => (d.PlatilloId, d.Cantidad)).ToList();
                if (pedido.Estado != EstadoPedido.Cancelado)
                {
                    var sinStock = await _inventarioService.VerificarStockPedidoAsync(id, finales);
                    if (sinStock != null) return BadRequest(sinStock);
                }
            }

            await ActualizarMesaAsync(pedido);
            await _context.SaveChangesAsync();
            await SincronizarInventarioAsync(id, cancelar: pedido.Estado == EstadoPedido.Cancelado);

            var pedidoActualizado = await ConsultaCompleta().FirstAsync(p => p.Id == id);
            return Ok(MapearPedidoADto(pedidoActualizado));
        }

        // DELETE: api/Pedidos/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> DeletePedido(int id)
        {
            var pedido = await _context.Pedidos.Include(p => p.Mesa).FirstOrDefaultAsync(p => p.Id == id);
            if (pedido == null)
                return NotFound();

            // Devolver al stock lo que consumió antes de borrarlo.
            await SincronizarInventarioAsync(id, cancelar: true);

            pedido.Estado = EstadoPedido.Cancelado;
            await ActualizarMesaAsync(pedido);
            _context.Pedidos.Remove(pedido);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // ──────────────────────────────────────────────────────────────────

        private IQueryable<Pedido> ConsultaCompleta() => _context.Pedidos
            .Include(p => p.Mesa)
            .Include(p => p.Usuario)
            .Include(p => p.Detalles)
                .ThenInclude(d => d.Platillo);

        /// <summary>Al menos un platillo, todos existentes y con cantidad entre 1 y el máximo.</summary>
        private async Task<string?> ValidarDetallesAsync(List<(int PlatilloId, int Cantidad)> detalles)
        {
            if (detalles.Count == 0)
                return "El pedido debe incluir al menos un platillo";

            if (detalles.Any(d => d.Cantidad <= 0 || d.Cantidad > CantidadMaximaPorLinea))
                return $"La cantidad de cada platillo debe estar entre 1 y {CantidadMaximaPorLinea}";

            var ids = detalles.Select(d => d.PlatilloId).Distinct().ToList();
            var existentes = await _context.Platillos.Where(p => ids.Contains(p.Id)).Select(p => p.Id).ToListAsync();
            var faltantes = ids.Except(existentes).ToList();
            return faltantes.Count > 0 ? $"Platillo(s) inexistente(s): {string.Join(", ", faltantes)}" : null;
        }

        /// <summary>
        /// La mesa queda Disponible cuando el pedido se paga o cancela y no le quedan
        /// otros pedidos abiertos; vuelve a Ocupada si el pedido se reabre.
        /// </summary>
        private async Task ActualizarMesaAsync(Pedido pedido)
        {
            if (pedido.Mesa == null) return;

            if (EstadosPedido.EsEditable(pedido.Estado))
            {
                pedido.Mesa.Estado = EstadoMesa.Ocupada;
                return;
            }

            var otrosAbiertos = await _context.Pedidos.AnyAsync(p =>
                p.MesaId == pedido.MesaId && p.Id != pedido.Id &&
                p.Estado != EstadoPedido.Pagado && p.Estado != EstadoPedido.Cancelado);

            if (!otrosAbiertos)
                pedido.Mesa.Estado = EstadoMesa.Disponible;
        }

        private async Task SincronizarInventarioAsync(int pedidoId, bool cancelar)
        {
            // El inventario no bloquea la operación del restaurante: si falla, se registra.
            try
            {
                var res = cancelar
                    ? await _inventarioService.RevertirStockPorPedidoAsync(pedidoId)
                    : await _inventarioService.DescontarStockPorPedidoAsync(pedidoId);
                if (!res.Exitoso)
                    _logger.LogWarning("Inventario del pedido {Id}: {Mensaje}", pedidoId, res.Mensaje);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al sincronizar inventario del pedido {Id}", pedidoId);
            }
        }

        /// <summary>
        /// Obtiene el ID del usuario genérico para pedidos desde QR.
        /// Si no existe, lo crea con una clave inutilizable para login.
        /// </summary>
        private async Task<int> ObtenerUsuarioGenericoQR()
        {
            var usuarioQR = await _context.Usuarios
                .FirstOrDefaultAsync(u => u.NombreUsuario == "cliente_qr");

            if (usuarioQR != null)
                return usuarioQR.Id;

            var nuevoUsuario = new Usuario
            {
                Nombre = "Cliente QR",
                NombreUsuario = "cliente_qr",
                ClaveHash = ClaveHasher.Hash(Guid.NewGuid().ToString("N")),
                Rol = RolUsuario.Mesero
            };

            _context.Usuarios.Add(nuevoUsuario);
            await _context.SaveChangesAsync();
            return nuevoUsuario.Id;
        }

        private static PedidoDto MapearPedidoADto(Pedido pedido) => new()
        {
            Id = pedido.Id,
            MesaId = pedido.MesaId,
            MesaNumero = pedido.Mesa?.Numero ?? 0,
            UsuarioId = pedido.UsuarioId,
            MeseroNombre = pedido.Usuario?.Nombre ?? "Sin asignar",
            Estado = pedido.Estado.ToString(),
            Fecha = pedido.Fecha,
            Detalles = pedido.Detalles.Select(d => new PedidoDetalleDto
            {
                Id = d.Id,
                PlatilloId = d.PlatilloId,
                PlatilloNombre = d.Platillo?.Nombre ?? "Sin nombre",
                Cantidad = d.Cantidad,
                Precio = d.Platillo?.Precio ?? 0,
                Nota = d.Nota,
                Estado = d.Estado.ToString()
            }).ToList()
        };
    }
}
