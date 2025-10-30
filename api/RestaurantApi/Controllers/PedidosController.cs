using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PedidosController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public PedidosController(RestauranteContext context)
        {
            _context = context;
        }

        // GET: api/Pedidos
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PedidoDto>>> GetPedidos()
        {
            var pedidos = await _context.Pedidos
                .Include(p => p.Mesa)
                .Include(p => p.Usuario)  // ✅ AGREGAR ESTA LÍNEA
                .Include(p => p.Detalles)
                    .ThenInclude(d => d.Platillo)
                .OrderByDescending(p => p.Fecha)
                .ToListAsync();

            return pedidos.Select(p => new PedidoDto
            {
                Id = p.Id,
                MesaId = p.MesaId,
                MesaNumero = p.Mesa?.Numero ?? 0,
                Estado = p.Estado.ToString(),
                Fecha = p.Fecha,
                UsuarioId = p.UsuarioId,  // ✅ AGREGAR
                MeseroNombre = p.Usuario?.Nombre ?? "Sin asignar",  // ✅ AGREGAR
                Detalles = p.Detalles.Select(d => new PedidoDetalleDto
                {
                    Id = d.Id,
                    PlatilloId = d.PlatilloId,
                    PlatilloNombre = d.Platillo?.Nombre ?? "Sin nombre",
                    Cantidad = d.Cantidad,
                    Precio = d.Platillo?.Precio ?? 0,
                    Nota = d.Nota,
                    Estado = d.Estado.ToString()
                }).ToList()
            }).ToList();
        }

        // GET: api/Pedidos/5
        [HttpGet("{id}")]
        public async Task<ActionResult<PedidoDto>> GetPedido(int id)
        {
            var pedido = await _context.Pedidos
                .Include(p => p.Mesa)
                .Include(p => p.Usuario)  // ✅ AGREGAR ESTA LÍNEA
                .Include(p => p.Detalles)
                    .ThenInclude(d => d.Platillo)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (pedido == null)
                return NotFound();

            return new PedidoDto
            {
                Id = pedido.Id,
                MesaId = pedido.MesaId,
                MesaNumero = pedido.Mesa?.Numero ?? 0,
                Estado = pedido.Estado.ToString(),
                Fecha = pedido.Fecha,
                UsuarioId = pedido.UsuarioId,  // ✅ AGREGAR
                MeseroNombre = pedido.Usuario?.Nombre ?? "Sin asignar",  // ✅ AGREGAR
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

        // POST: api/Pedidos
        [HttpPost]
        public async Task<ActionResult<PedidoDto>> PostPedido(CrearPedidoDto crearPedido)
        {
            // Crear el pedido
            var pedido = new Pedido
            {
                MesaId = crearPedido.MesaId,
                UsuarioId = crearPedido.UsuarioId, // Por ahora usuario fijo
                Estado = EstadoPedido.EnProceso,
                Fecha = DateTime.Now
            };

            _context.Pedidos.Add(pedido);
            await _context.SaveChangesAsync();

            // Agregar los detalles
            foreach (var detalle in crearPedido.Detalles)
            {
                var pedidoDetalle = new PedidoDetalle
                {
                    PedidoId = pedido.Id,
                    PlatilloId = detalle.PlatilloId,
                    Cantidad = detalle.Cantidad,
                    Nota = detalle.Nota,
                    Estado = EstadoDetalle.Pendiente
                };
                _context.PedidoDetalles.Add(pedidoDetalle);
            }

            await _context.SaveChangesAsync();

            // Retornar el pedido completo
            var pedidoCreado = await _context.Pedidos
                .Include(p => p.Mesa)
                .Include(p => p.Detalles)
                    .ThenInclude(d => d.Platillo)
                .FirstOrDefaultAsync(p => p.Id == pedido.Id);

            if (pedidoCreado == null)
                return NotFound();

            var resultado = new PedidoDto
            {
                Id = pedidoCreado.Id,
                MesaId = pedidoCreado.MesaId,
                MesaNumero = pedidoCreado.Mesa?.Numero ?? 0,
                Estado = pedidoCreado.Estado.ToString(),
                Fecha = pedidoCreado.Fecha,
                UsuarioId = pedidoCreado.UsuarioId,  // ✅ AGREGAR
                MeseroNombre = pedidoCreado.Usuario?.Nombre ?? "Sin asignar",  // ✅ AGREGAR
                Detalles = pedidoCreado.Detalles.Select(d => new PedidoDetalleDto
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

            return CreatedAtAction(nameof(GetPedido), new { id = resultado.Id }, resultado);
        }

        [HttpPut("{id}/estado")]
        public async Task<IActionResult> ActualizarEstado(int id, [FromBody] ActualizarEstadoPedidoDto dto)
        {
            System.Diagnostics.Debug.WriteLine("========================================");
            System.Diagnostics.Debug.WriteLine($"🔄 ACTUALIZANDO PEDIDO {id} A ESTADO: {dto.Estado}");
            System.Diagnostics.Debug.WriteLine("========================================");

            var pedido = await _context.Pedidos
                .Include(p => p.Mesa)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (pedido == null)
            {
                System.Diagnostics.Debug.WriteLine($"❌ Pedido {id} no encontrado");
                return NotFound($"Pedido con ID {id} no encontrado");
            }

            if (!Enum.TryParse<EstadoPedido>(dto.Estado, true, out var estadoEnum))
            {
                System.Diagnostics.Debug.WriteLine($"❌ Estado inválido: {dto.Estado}");
                return BadRequest($"Estado inválido: {dto.Estado}");
            }

            System.Diagnostics.Debug.WriteLine($"✅ Estado anterior: {pedido.Estado}");
            System.Diagnostics.Debug.WriteLine($"✅ Estado nuevo: {estadoEnum}");

            pedido.Estado = estadoEnum;
            await _context.SaveChangesAsync();

            System.Diagnostics.Debug.WriteLine($"💾 Estado guardado en BD");

            if (estadoEnum == EstadoPedido.Listo)
            {
                System.Diagnostics.Debug.WriteLine($"🔔 El estado es LISTO, enviando notificación...");
                try
                {
                    var notificationService = new FirebaseNotificationService(_context);
                    await notificationService.EnviarNotificacionPedidoListo(
                        pedido.Id,
                        pedido.Mesa?.Numero ?? pedido.MesaId
                    );
                    System.Diagnostics.Debug.WriteLine($"✅ Notificación enviada correctamente");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"❌ ERROR enviando notificación: {ex.Message}");
                    System.Diagnostics.Debug.WriteLine($"   Stack: {ex.StackTrace}");
                }
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"ℹ️ Estado no es LISTO, no se envía notificación");
            }

            System.Diagnostics.Debug.WriteLine("========================================");

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
        [HttpPut("{id}/actualizar")]
        public async Task<ActionResult<PedidoDto>> ActualizarPedidoCompleto(int id, ActualizarPedidoCompletoDto dto)
        {
            var pedido = await _context.Pedidos
                .Include(p => p.Detalles)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (pedido == null)
                return NotFound();

            // Eliminar detalles anteriores
            _context.PedidoDetalles.RemoveRange(pedido.Detalles);

            // Agregar nuevos detalles
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

            // Retornar pedido actualizado
            var pedidoActualizado = await _context.Pedidos
                .Include(p => p.Mesa)
                .Include(p => p.Detalles)
                .ThenInclude(d => d.Platillo)
                .FirstOrDefaultAsync(p => p.Id == id);

            return new PedidoDto
            {
                Id = pedidoActualizado.Id,
                MesaId = pedidoActualizado.MesaId,
                MesaNumero = pedidoActualizado.Mesa?.Numero ?? 0,
                Estado = pedidoActualizado.Estado.ToString(),
                Fecha = pedidoActualizado.Fecha,
                Detalles = pedidoActualizado.Detalles.Select(d => new PedidoDetalleDto
                {
                    Id = d.Id,
                    PlatilloId = d.PlatilloId,
                    PlatilloNombre = d.Platillo?.Nombre ?? "",
                    Cantidad = d.Cantidad,
                    Precio = d.Platillo?.Precio ?? 0,
                    Nota = d.Nota,
                    Estado = d.Estado.ToString()
                }).ToList()
            };
        }

        // PUT: api/Pedidos/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutPedido(int id, ActualizarPedidoDto actualizarDto)
        {
            try
            {
                var pedido = await _context.Pedidos
                    .Include(p => p.Detalles)
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (pedido == null)
                    return NotFound($"Pedido {id} no encontrado");

                Console.WriteLine($"📝 Actualizando pedido {id}");

                // ✅ ACTUALIZAR ESTADO si se proporciona
                if (!string.IsNullOrEmpty(actualizarDto.Estado))
                {
                    if (Enum.TryParse<EstadoPedido>(actualizarDto.Estado, true, out var nuevoEstado))
                    {
                        pedido.Estado = nuevoEstado;
                        Console.WriteLine($"   Estado: {actualizarDto.Estado}");
                    }
                }

                // ✅ ACTUALIZAR DETALLES si se proporcionan
                if (actualizarDto.Detalles != null && actualizarDto.Detalles.Count > 0)
                {
                    Console.WriteLine($"   Actualizando {actualizarDto.Detalles.Count} detalles");

                    // 1. Eliminar items marcados para eliminar
                    var idsAEliminar = actualizarDto.Detalles
                        .Where(d => d.Eliminar && d.Id.HasValue)
                        .Select(d => d.Id.Value)
                        .ToList();

                    if (idsAEliminar.Any())
                    {
                        var detallesAEliminar = pedido.Detalles
                            .Where(d => idsAEliminar.Contains(d.Id))
                            .ToList();

                        foreach (var detalle in detallesAEliminar)
                        {
                            _context.PedidoDetalles.Remove(detalle);
                            Console.WriteLine($"   ❌ Eliminando item: {detalle.Id}");
                        }
                    }

                    // 2. Actualizar items existentes
                    var detallesParaActualizar = actualizarDto.Detalles
                        .Where(d => !d.Eliminar && d.Id.HasValue)
                        .ToList();

                    foreach (var detalleDto in detallesParaActualizar)
                    {
                        var detalleExistente = pedido.Detalles
                            .FirstOrDefault(d => d.Id == detalleDto.Id.Value);

                        if (detalleExistente != null)
                        {
                            detalleExistente.Cantidad = detalleDto.Cantidad;
                            detalleExistente.Nota = detalleDto.Nota;
                            Console.WriteLine($"   🔄 Actualizando item {detalleDto.Id}: cantidad={detalleDto.Cantidad}");
                        }
                    }

                    // 3. Agregar nuevos items
                    var detallesNuevos = actualizarDto.Detalles
                        .Where(d => !d.Eliminar && !d.Id.HasValue)
                        .ToList();

                    foreach (var detalleDto in detallesNuevos)
                    {
                        var nuevoDetalle = new PedidoDetalle
                        {
                            PedidoId = id,
                            PlatilloId = detalleDto.PlatilloId,
                            Cantidad = detalleDto.Cantidad,
                            Nota = detalleDto.Nota ?? "",
                            Estado = EstadoDetalle.Pendiente
                        };

                        pedido.Detalles.Add(nuevoDetalle);
                        Console.WriteLine($"   ➕ Agregando nuevo item: PlatilloId={detalleDto.PlatilloId}");
                    }
                }

                await _context.SaveChangesAsync();
                Console.WriteLine($"✅ Pedido {id} actualizado exitosamente");

                // Retornar el pedido actualizado
                var pedidoActualizado = await _context.Pedidos
                    .Include(p => p.Mesa)
                    .Include(p => p.Detalles)
                        .ThenInclude(d => d.Platillo)
                    .FirstOrDefaultAsync(p => p.Id == id);

                var pedidoDto = MapearPedidoADto(pedidoActualizado);
                return Ok(pedidoDto);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error actualizando pedido {id}: {ex.Message}");
                return StatusCode(500, $"Error al actualizar pedido: {ex.Message}");
            }
        }
        private PedidoDto MapearPedidoADto(Pedido pedido)
        {
            return new PedidoDto
            {
                Id = pedido.Id,
                MesaId = pedido.MesaId,
                MesaNumero = pedido.Mesa?.Numero ?? 0,
                UsuarioId = pedido.UsuarioId,
                Estado = pedido.Estado.ToString(),
                Fecha = pedido.Fecha,
                Detalles = pedido.Detalles.Select(d => new PedidoDetalleDto
                {
                    Id = d.Id,
                    PlatilloId = d.PlatilloId,
                    PlatilloNombre = d.Platillo?.Nombre ?? "Producto",
                    Cantidad = d.Cantidad,
                    Precio = d.Platillo?.Precio ?? 0,
                    Nota = d.Nota,
                    Estado = d.Estado.ToString()
                }).ToList()
            };
        }


        // DELETE: api/Pedidos/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePedido(int id)
        {
            var pedido = await _context.Pedidos.FindAsync(id);
            if (pedido == null)
                return NotFound();

            _context.Pedidos.Remove(pedido);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}