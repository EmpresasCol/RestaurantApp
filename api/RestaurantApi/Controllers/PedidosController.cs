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
        private readonly ILogger<PedidosController> _logger;

        public PedidosController(RestauranteContext context, ILogger<PedidosController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/Pedidos
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PedidoDto>>> GetPedidos()
        {
            var pedidos = await _context.Pedidos
                .Include(p => p.Mesa)
                .Include(p => p.Usuario)
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
                UsuarioId = p.UsuarioId,
                MeseroNombre = p.Usuario?.Nombre ?? "Sin asignar",
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
                .Include(p => p.Usuario)
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
                UsuarioId = pedido.UsuarioId,
                MeseroNombre = pedido.Usuario?.Nombre ?? "Sin asignar",
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
            try
            {
                _logger.LogInformation($"📝 Creando pedido para Mesa {crearPedido.MesaId}");
                _logger.LogInformation($"   UsuarioId recibido: {crearPedido.UsuarioId}");

                // Validar que la mesa existe
                var mesa = await _context.Mesas.FindAsync(crearPedido.MesaId);
                if (mesa == null)
                {
                    _logger.LogWarning($"❌ Mesa {crearPedido.MesaId} no encontrada");
                    return BadRequest($"Mesa {crearPedido.MesaId} no existe");
                }

                // ✅ LÓGICA CORREGIDA: Usar UsuarioId del DTO, o usuario genérico QR si no viene
                int usuarioId;
                if (crearPedido.UsuarioId > 0)
                {
                    // Validar que el usuario existe
                    var usuarioExiste = await _context.Usuarios.AnyAsync(u => u.Id == crearPedido.UsuarioId);
                    if (!usuarioExiste)
                    {
                        _logger.LogWarning($"⚠️ Usuario {crearPedido.UsuarioId} no existe, usando usuario QR");
                        usuarioId = await ObtenerUsuarioGenericoQR();
                    }
                    else
                    {
                        usuarioId = crearPedido.UsuarioId;
                    }
                }
                else
                {
                    // Si no viene UsuarioId, usar el genérico de QR
                    _logger.LogInformation("📱 Pedido desde QR (sin UsuarioId), usando usuario genérico");
                    usuarioId = await ObtenerUsuarioGenericoQR();
                }

                _logger.LogInformation($"✅ UsuarioId asignado: {usuarioId}");

                // Crear el pedido
                var pedido = new Pedido
                {
                    MesaId = crearPedido.MesaId,
                    UsuarioId = usuarioId,
                    Estado = EstadoPedido.EnProceso,
                    Fecha = DateTime.Now
                };

                _context.Pedidos.Add(pedido);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"✅ Pedido {pedido.Id} creado exitosamente");

                // Agregar los detalles
                foreach (var detalle in crearPedido.Detalles)
                {
                    // Validar que el platillo existe
                    var platillo = await _context.Platillos.FindAsync(detalle.PlatilloId);
                    if (platillo == null)
                    {
                        _logger.LogWarning($"⚠️ Platillo {detalle.PlatilloId} no encontrado, se omite");
                        continue;
                    }

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

                _logger.LogInformation($"✅ Detalles del pedido {pedido.Id} guardados");

                // Retornar el pedido completo
                var pedidoCreado = await _context.Pedidos
                    .Include(p => p.Mesa)
                    .Include(p => p.Usuario)
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
                    UsuarioId = pedidoCreado.UsuarioId,
                    MeseroNombre = pedidoCreado.Usuario?.Nombre ?? "Sin asignar",
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

                _logger.LogInformation($"🎉 Pedido {resultado.Id} retornado exitosamente");

                return CreatedAtAction(nameof(GetPedido), new { id = resultado.Id }, resultado);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error al crear pedido");
                return StatusCode(500, new
                {
                    error = "Error al crear el pedido",
                    details = ex.Message,
                    innerError = ex.InnerException?.Message
                });
            }
        }

        /// <summary>
        /// Obtiene el ID del usuario genérico para pedidos desde QR.
        /// Si no existe, lo crea automáticamente.
        /// </summary>
        private async Task<int> ObtenerUsuarioGenericoQR()
        {
            // ✅ CORRECCIÓN: Usar NombreUsuario en lugar de Usuario
            var usuarioQR = await _context.Usuarios
                .FirstOrDefaultAsync(u => u.NombreUsuario == "cliente_qr");

            if (usuarioQR != null)
            {
                return usuarioQR.Id;
            }

            // Si no existe, crear uno nuevo
            _logger.LogWarning("⚠️ Usuario genérico QR no encontrado, creando uno nuevo...");

            // ✅ CORRECCIÓN: Usar las propiedades correctas del modelo
            var nuevoUsuario = new Usuario
            {
                Nombre = "Cliente QR",
                NombreUsuario = "cliente_qr",  // ✅ Propiedad correcta
                ClaveHash = "$2a$11$KIX8g7qZJ5p5K1p5K1p5K1puXYZ1234567890abcdefghijklmnopqrst",
                Rol = RolUsuario.Mesero  // ✅ Enum correcto
            };

            _context.Usuarios.Add(nuevoUsuario);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"✅ Usuario genérico QR creado con ID {nuevoUsuario.Id}");

            return nuevoUsuario.Id;
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
            // ==========================================
            // LOGICA DE DESCUENTO DE INVENTARIO
            // ==========================================
            else if (estadoEnum == EstadoPedido.Pagado || estadoEnum == EstadoPedido.Entregado)
            {
                // Verificar si ya se descontó el inventario para evitar duplicados
                // Podríamos usar una bandera en el pedido, pero por ahora asumimos que el cambio de estado es único
                // Ojo: Si pasa de Entregado a Pagado, podría descontar doble. 
                // Mejor validar si el estado ANTERIOR no era ni Pagado ni Entregado.
                
                // Sin embargo, como no tenemos el estado anterior aquí (ya se guardó en BD arriba),
                // una estrategia simple es solo descontar cuando pasa a "Entregado" (consumo real)
                // O cuando pasa a "Pagado" si no pasó por Entregado. 
                
                // Para simplificar en este prototipo, descontaremos en "Entregado" y "Pagado",
                // pero necesitamos evitar dobles descuentos.
                // Una forma es verificar si YA existen movimientos de salida para este pedido.
                
                var yaDescontado = await _context.MovimientosInventario
                    .AnyAsync(m => m.Referencia == $"Pedido #{pedido.Id}");

                if (!yaDescontado)
                {
                    System.Diagnostics.Debug.WriteLine($"📦 Descontando inventario para pedido {pedido.Id}...");
                    
                    try 
                    {
                        // Cargar detalles compltos con recetas
                        var detalles = await _context.PedidoDetalles
                            .Where(d => d.PedidoId == pedido.Id)
                            .ToListAsync();

                        // Buscar almacén por defecto (ej: Cocina Principal)
                        var almacen = await _context.Almacenes.FirstOrDefaultAsync(a => a.Nombre.Contains("Cocina") || a.Nombre.Contains("Principal"));
                        int almacenId = almacen?.Id ?? 1; // Fallback ID 1

                        foreach (var detalle in detalles)
                        {
                            // Obtener recetas del platillo
                            // Ojo: PlatilloId en Receta referencia al Platillo
                            // Necesitamos traer las recetas donde PlatilloId == detalle.PlatilloId
                            var recetas = await _context.Set<Receta>() // Usando Set<Receta> si no está en Context directamente o DBSet
                                .Where(r => r.PlatilloId == detalle.PlatilloId)
                                .ToListAsync();

                            foreach (var receta in recetas)
                            {
                                decimal cantidadADescontar = receta.CantidadRequerida * detalle.Cantidad;
                                
                                // Registrar Movimiento (Salida)
                                var movimiento = new MovimientoInventario
                                {
                                    ProductoId = receta.ProductoId,
                                    AlmacenId = almacenId,
                                    TipoMovimiento = "Salida",
                                    Cantidad = cantidadADescontar,
                                    Fecha = DateTime.Now,
                                    Motivo = "Venta",
                                    Referencia = $"Pedido #{pedido.Id}",
                                    UsuarioId = pedido.UsuarioId,
                                    CostoUnitario = receta.CostoUnitario ?? 0, // Idealmente costo promedio del stock
                                    CostoTotal = (receta.CostoUnitario ?? 0) * cantidadADescontar
                                };
                                
                                _context.MovimientosInventario.Add(movimiento);

                                // Actualizar Stock
                                var stock = await _context.Stock
                                    .FirstOrDefaultAsync(s => s.ProductoId == receta.ProductoId && s.AlmacenId == almacenId);
                                
                                if (stock != null)
                                {
                                    stock.Cantidad -= cantidadADescontar;
                                    stock.FechaActualizacion = DateTime.Now;
                                    
                                    // Actualizar costo en movimiento con el real del stock
                                    movimiento.CostoUnitario = stock.CostoPromedio;
                                    movimiento.CostoTotal = cantidadADescontar * stock.CostoPromedio;
                                }
                                else 
                                {
                                    // Si no hay stock creado, crearlo en negativo (técnicamente posible si permitimos)
                                    stock = new Stock
                                    {
                                        ProductoId = receta.ProductoId,
                                        AlmacenId = almacenId,
                                        Cantidad = -cantidadADescontar,
                                        CostoPromedio = 0,
                                        CostoTotal = 0,
                                        FechaActualizacion = DateTime.Now
                                    };
                                    _context.Stock.Add(stock);
                                }
                            }
                        }
                        
                        await _context.SaveChangesAsync();
                        System.Diagnostics.Debug.WriteLine($"✅ Inventario descontado correctamente");
                    }
                    catch (Exception ex)
                    {
                         System.Diagnostics.Debug.WriteLine($"❌ Error al descontar inventario: {ex.Message}");
                    }
                }
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"ℹ️ Estado no es LISTO ni PAGADO/ENTREGADO, no se envía notificación ni descuenta stock");
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
                .Include(p => p.Usuario)
                .Include(p => p.Detalles)
                .ThenInclude(d => d.Platillo)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (pedidoActualizado == null)
                return NotFound();

            return new PedidoDto
            {
                Id = pedidoActualizado.Id,
                MesaId = pedidoActualizado.MesaId,
                MesaNumero = pedidoActualizado.Mesa?.Numero ?? 0,
                UsuarioId = pedidoActualizado.UsuarioId,
                MeseroNombre = pedidoActualizado.Usuario?.Nombre ?? "Sin asignar",
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

                // Actualizar estado
                if (!string.IsNullOrEmpty(actualizarDto.Estado))
                {
                    if (Enum.TryParse<EstadoPedido>(actualizarDto.Estado, true, out var nuevoEstado))
                    {
                        pedido.Estado = nuevoEstado;
                        Console.WriteLine($"   Estado: {actualizarDto.Estado}");
                    }
                }

                // Actualizar detalles
                if (actualizarDto.Detalles != null && actualizarDto.Detalles.Count > 0)
                {
                    Console.WriteLine($"   Actualizando {actualizarDto.Detalles.Count} detalles");

                    var idsAEliminar = actualizarDto.Detalles
                        .Where(d => d.Eliminar && d.Id.HasValue)
                        .Select(d => d.Id!.Value)
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

                    var detallesParaActualizar = actualizarDto.Detalles
                        .Where(d => !d.Eliminar && d.Id.HasValue)
                        .ToList();

                    foreach (var detalleDto in detallesParaActualizar)
                    {
                        var detalleExistente = pedido.Detalles
                            .FirstOrDefault(d => d.Id == detalleDto.Id!.Value);

                        if (detalleExistente != null)
                        {
                            detalleExistente.Cantidad = detalleDto.Cantidad;
                            detalleExistente.Nota = detalleDto.Nota;
                            Console.WriteLine($"   🔄 Actualizando item {detalleDto.Id}: cantidad={detalleDto.Cantidad}");
                        }
                    }

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

                var pedidoActualizado = await _context.Pedidos
                    .Include(p => p.Mesa)
                    .Include(p => p.Usuario)
                    .Include(p => p.Detalles)
                        .ThenInclude(d => d.Platillo)
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (pedidoActualizado == null)
                    return NotFound();

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
                MeseroNombre = pedido.Usuario?.Nombre ?? "Sin asignar",
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