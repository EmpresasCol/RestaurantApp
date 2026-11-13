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
        public const int MaximoLineas = 60;
        public const int MaximoNota = 200;

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
        /// El comensal identifica la mesa con el código secreto de su QR, nunca con el Id:
        /// así no puede cambiar el enlace y pedir a nombre de otra mesa.
        /// </summary>
        [HttpPost]
        [AllowAnonymous]
        [EnableRateLimiting("publico")]
        public async Task<ActionResult<PedidoDto>> PostPedido(CrearPedidoDto crearPedido)
        {
            var usuarioSesion = QproClaims.IdUsuario(HttpContext?.User);
            Mesa? mesa;
            if (usuarioSesion == null)
            {
                var codigo = crearPedido.CodigoMesa?.Trim();
                if (string.IsNullOrEmpty(codigo))
                    return BadRequest("Escanea el código QR de tu mesa para pedir");
                mesa = await _context.Mesas.FirstOrDefaultAsync(m => m.CodigoQR == codigo);
                if (mesa == null)
                    return BadRequest("Este código QR ya no es válido. Pide al mesero el código de tu mesa.");
            }
            else
            {
                mesa = await _context.Mesas.FindAsync(crearPedido.MesaId);
                if (mesa == null)
                    return BadRequest($"Mesa {crearPedido.MesaId} no existe");
            }

            var lineas = crearPedido.Detalles.Select(d => (d.PlatilloId, d.Cantidad)).ToList();
            var error = ErrorDeForma(lineas.Count, crearPedido.Detalles.Select(d => d.Nota))
                        ?? await ValidarDetallesAsync(lineas);
            if (error != null)
                return BadRequest(error);

            var usuarioId = usuarioSesion ?? await ObtenerUsuarioGenericoQR();

            // Con el candado de la mesa: validar insumos, abrir la ocupación, guardar y descontar
            // son un solo paso frente a otro pedido, al cobro final o a la liberación de la mesa.
            await using var tx = await Ocupaciones.BloquearMesaAsync(_context, mesa.Id);
            await _context.Entry(mesa).ReloadAsync();
            var sinStock = await _inventarioService.VerificarStockPedidoAsync(0, lineas);
            if (sinStock != null)
                return BadRequest(sinStock);

            var ocupacion = await Ocupaciones.AbrirAsync(_context, mesa);
            await _context.SaveChangesAsync();

            // Pedido y detalles en un solo SaveChanges: o se crea todo o nada.
            var pedido = new Pedido
            {
                MesaId = mesa.Id,
                OcupacionId = ocupacion.Id,
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

            _context.Pedidos.Add(pedido);
            await _context.SaveChangesAsync();

            await SincronizarInventarioAsync(pedido.Id, cancelar: false);
            await tx.CommitAsync();

            var pedidoCreado = await ConsultaCompleta().FirstAsync(p => p.Id == pedido.Id);
            var resultado = MapearPedidoADto(pedidoCreado);
            // El comensal del QR recibe la llave de seguimiento de esta visita; el personal no la necesita.
            if (usuarioSesion == null) resultado.Seguimiento = ocupacion.Token;
            return CreatedAtAction(nameof(GetPedido), new { id = resultado.Id }, resultado);
        }

        [HttpPut("{id}/estado")]
        public async Task<IActionResult> ActualizarEstado(int id, [FromBody] ActualizarEstadoPedidoDto dto)
        {
            await using var tx = await BloquearMesaDePedidoAsync(id);
            var pedido = await _context.Pedidos
                .Include(p => p.Mesa)
                .Include(p => p.Detalles)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (pedido == null)
                return NotFound($"Pedido con ID {id} no encontrado");

            if (!Enum.TryParse<EstadoPedido>(dto.Estado, true, out var estadoEnum) || !Enum.IsDefined(estadoEnum))
                return BadRequest($"Estado inválido: {dto.Estado}");

            var rechazo = RechazoDeCambio(pedido, estadoEnum);
            if (rechazo != null)
                return rechazo;

            var cambio = pedido.Estado != estadoEnum;
            pedido.Estado = estadoEnum;
            await ActualizarMesaAsync(pedido);
            await _context.SaveChangesAsync();
            await tx!.CommitAsync();

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

        /// <summary>
        /// Cocina empieza a preparar el pedido: sus platos pendientes pasan a EnPreparacion.
        /// Desde ese momento el mesero ya no lo edita ni lo cancela.
        /// </summary>
        [HttpPut("{id}/preparar")]
        [Authorize(Roles = "Administrador,Cocina")]
        public async Task<IActionResult> Preparar(int id)
        {
            var pedido = await _context.Pedidos
                .Include(p => p.Detalles)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (pedido == null)
                return NotFound();
            if (pedido.Estado != EstadoPedido.EnProceso)
                return Conflict(new { message = $"Un pedido {pedido.Estado} ya no se empieza a preparar" });

            foreach (var d in pedido.Detalles.Where(d => d.Estado == EstadoDetalle.Pendiente))
                d.Estado = EstadoDetalle.EnPreparacion;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // PUT: api/Pedidos/5/actualizar
        /// <summary>Reemplaza los detalles; el inventario se ajusta solo por la diferencia.</summary>
        [HttpPut("{id}/actualizar")]
        public async Task<ActionResult<PedidoDto>> ActualizarPedidoCompleto(int id, ActualizarPedidoCompletoDto dto)
        {
            await using var tx = await BloquearMesaDePedidoAsync(id);
            var pedido = await _context.Pedidos
                .Include(p => p.Detalles)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (pedido == null)
                return NotFound();

            if (!EstadosPedido.EsEditable(pedido.Estado))
                return Conflict(new { message = $"Un pedido {pedido.Estado} no se puede modificar" });

            if (EstadosPedido.CocinaEmpezo(pedido))
                return Conflict(new { message = "La cocina ya empezó este pedido. Agrega los platos nuevos como otro pedido." });

            var lineas = dto.Detalles.Select(d => (d.PlatilloId, d.Cantidad)).ToList();
            // Un platillo que se ocultó después de pedirlo puede seguir en el pedido que se edita.
            var yaPedidos = pedido.Detalles.Select(d => d.PlatilloId).ToHashSet();
            var error = ErrorDeForma(lineas.Count, dto.Detalles.Select(d => d.Nota))
                        ?? await ValidarDetallesAsync(lineas, yaPedidos)
                        ?? await _inventarioService.VerificarStockPedidoAsync(id, lineas);
            if (error != null)
                return BadRequest(error);

            // Los platos que ya estaban conservan el precio con que se pidieron.
            var preciosPrevios = pedido.Detalles
                .GroupBy(d => d.PlatilloId)
                .ToDictionary(g => g.Key, g => g.First().PrecioUnitario);

            _context.PedidoDetalles.RemoveRange(pedido.Detalles);
            pedido.FechaEdicion = DateTime.UtcNow;
            foreach (var detalle in dto.Detalles)
            {
                _context.PedidoDetalles.Add(new PedidoDetalle
                {
                    PedidoId = id,
                    PlatilloId = detalle.PlatilloId,
                    Cantidad = detalle.Cantidad,
                    Nota = detalle.Nota,
                    Estado = EstadoDetalle.Pendiente,
                    PrecioUnitario = preciosPrevios.GetValueOrDefault(detalle.PlatilloId)
                });
            }

            await _context.SaveChangesAsync();
            await SincronizarInventarioAsync(id, cancelar: false);
            await tx!.CommitAsync();

            var pedidoActualizado = await ConsultaCompleta().FirstAsync(p => p.Id == id);
            return MapearPedidoADto(pedidoActualizado);
        }

        // PUT: api/Pedidos/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutPedido(int id, ActualizarPedidoDto actualizarDto)
        {
            await using var tx = await BloquearMesaDePedidoAsync(id);
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
                // Mismas reglas de rol que PUT {id}/estado: por aquí tampoco cobra el mesero ni sirve la cocina.
                var rechazo = RechazoDeCambio(pedido, nuevoEstado);
                if (rechazo != null)
                    return rechazo;
                pedido.Estado = nuevoEstado;
            }

            var detalles = actualizarDto.Detalles ?? new List<ActualizarPedidoDetalleDto>();
            if (detalles.Count > 0)
            {
                var forma = ErrorDeForma(detalles.Count, detalles.Select(d => d.Nota));
                if (forma != null) return BadRequest(forma);
                if (!EstadosPedido.EsEditable(estadoAnterior))
                    return Conflict(new { message = $"Un pedido {estadoAnterior} no se puede modificar" });
                if (pedido.Detalles.Any(d => d.FacturaId != null))
                    return Conflict(new { message = "Ya se cobró parte de este pedido; los platos nuevos van en otro pedido" });
                pedido.FechaEdicion = DateTime.UtcNow;

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
            await tx!.CommitAsync();

            var pedidoActualizado = await ConsultaCompleta().FirstAsync(p => p.Id == id);
            return Ok(MapearPedidoADto(pedidoActualizado));
        }

        // DELETE: api/Pedidos/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> DeletePedido(int id)
        {
            await using var tx = await BloquearMesaDePedidoAsync(id);
            var pedido = await _context.Pedidos.Include(p => p.Mesa).FirstOrDefaultAsync(p => p.Id == id);
            if (pedido == null)
                return NotFound();

            // Devolver al stock lo que consumió antes de borrarlo.
            await SincronizarInventarioAsync(id, cancelar: true);

            pedido.Estado = EstadoPedido.Cancelado;
            await ActualizarMesaAsync(pedido);
            _context.Pedidos.Remove(pedido);
            await _context.SaveChangesAsync();
            await tx!.CommitAsync();

            return NoContent();
        }

        // ──────────────────────────────────────────────────────────────────

        private IQueryable<Pedido> ConsultaCompleta() => _context.Pedidos
            .Include(p => p.Mesa)
            .Include(p => p.Usuario)
            .Include(p => p.Detalles)
                .ThenInclude(d => d.Platillo);

        /// <summary>
        /// Reglas de quién puede llevar un pedido a cada estado; null si el cambio se permite.
        /// Las comparten PUT {id}/estado y PUT {id} para que ninguna ruta se las salte.
        /// </summary>
        private IActionResult? RechazoDeCambio(Pedido pedido, EstadoPedido nuevo)
        {
            if (!EstadosPedido.PuedeCambiar(pedido.Estado, nuevo))
                return Conflict(new { message = $"No se puede pasar un pedido de {pedido.Estado} a {nuevo}" });
            if (pedido.Estado == nuevo)
                return null;

            // Cobrar es de la caja (POST api/pagos/cobro emite la factura); el mesero solo lleva la cuenta.
            if (nuevo == EstadoPedido.Pagado && !EsCajaOAdmin())
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "El pago se registra en caja" });

            if (nuevo == EstadoPedido.Cancelado && User?.IsInRole(nameof(RolUsuario.Mesero)) == true && EstadosPedido.CocinaEmpezo(pedido))
                return Conflict(new { message = "La cocina ya empezó este pedido. Pide a cocina o al administrador que lo cancele." });

            // Lo que ya se cobró en una factura no se cancela: la factura emitida no se reescribe.
            if (nuevo == EstadoPedido.Cancelado && pedido.Detalles.Any(d => d.FacturaId != null))
                return Conflict(new { message = "Ya se cobró parte de este pedido; no se puede cancelar" });

            // Servir es del mesero: la cocina solo marca listo y el pedido sigue a la vista hasta que llegue a la mesa.
            if (nuevo == EstadoPedido.Entregado && User?.IsInRole(nameof(RolUsuario.Cocina)) == true)
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "El mesero marca el pedido como servido" });

            return null;
        }

        /// <summary>Tope de líneas y de texto: el pedido del QR es anónimo y su tamaño no se confía al cliente.</summary>
        private static string? ErrorDeForma(int lineas, IEnumerable<string?> notas)
        {
            if (lineas > MaximoLineas)
                return $"Un pedido admite máximo {MaximoLineas} líneas";
            return notas.Any(n => n?.Length > MaximoNota) ? $"Cada indicación admite máximo {MaximoNota} caracteres" : null;
        }

        /// <summary>Al menos un platillo, todos existentes y con cantidad entre 1 y el máximo.</summary>
        private async Task<string?> ValidarDetallesAsync(List<(int PlatilloId, int Cantidad)> detalles, ISet<int>? permitidosOcultos = null)
        {
            if (detalles.Count == 0)
                return "El pedido debe incluir al menos un platillo";

            if (detalles.Any(d => d.Cantidad <= 0 || d.Cantidad > CantidadMaximaPorLinea))
                return $"La cantidad de cada platillo debe estar entre 1 y {CantidadMaximaPorLinea}";

            var ids = detalles.Select(d => d.PlatilloId).Distinct().ToList();
            var existentes = await _context.Platillos.Where(p => ids.Contains(p.Id))
                .Select(p => new { p.Id, p.Nombre, p.Activo }).ToListAsync();
            var faltantes = ids.Except(existentes.Select(p => p.Id)).ToList();
            if (faltantes.Count > 0)
                return $"Platillo(s) inexistente(s): {string.Join(", ", faltantes)}";

            var ocultos = existentes.Where(p => !p.Activo && permitidosOcultos?.Contains(p.Id) != true).Select(p => p.Nombre).ToList();
            return ocultos.Count > 0 ? $"Ya no está en la carta: {string.Join(", ", ocultos)}" : null;
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
                if (pedido.Mesa.Estado == EstadoMesa.Disponible) pedido.Mesa.Estado = EstadoMesa.Ocupada;
                return;
            }

            // Sin más pedidos abiertos se cierra la visita: mesa libre, llamadas y cuenta pedida resueltas.
            await Ocupaciones.CerrarSiSaldadaAsync(_context, pedido.Mesa, pedido.Id);
        }

        /// <summary>Candado de la mesa del pedido (ver <see cref="Ocupaciones.BloquearMesaAsync"/>); null si el pedido no existe.</summary>
        private async Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction?> BloquearMesaDePedidoAsync(int pedidoId)
        {
            var mesaId = await _context.Pedidos.Where(p => p.Id == pedidoId).Select(p => (int?)p.MesaId).FirstOrDefaultAsync();
            return mesaId == null ? null : await Ocupaciones.BloquearMesaAsync(_context, mesaId.Value);
        }

        private bool EsCajaOAdmin()
            => User?.IsInRole(nameof(RolUsuario.Caja)) == true || User?.IsInRole(nameof(RolUsuario.Administrador)) == true;

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
            CocinaEmpezo = EstadosPedido.CocinaEmpezo(pedido),
            FechaEdicion = pedido.FechaEdicion,
            PorCobrar = Cuentas.ConsumoPorCobrar(pedido),
            Detalles = pedido.Detalles.OrderBy(d => d.Id).Select(d => new PedidoDetalleDto
            {
                Id = d.Id,
                PlatilloId = d.PlatilloId,
                PlatilloNombre = d.Platillo?.Nombre ?? "Sin nombre",
                Cantidad = d.Cantidad,
                Precio = Cuentas.Precio(d),
                Nota = d.Nota,
                Estado = d.Estado.ToString(),
                Pagado = d.FacturaId != null
            }).ToList()
        };
    }
}
