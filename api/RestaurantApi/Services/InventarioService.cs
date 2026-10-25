using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace RestaurantApi.Services
{
    public class InventarioService : IInventarioService
    {
        private readonly RestauranteContext _context;
        private readonly ILogger<InventarioService> _logger;

        public InventarioService(RestauranteContext context, ILogger<InventarioService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Descuenta automáticamente el stock correspondiente a los platillos de un pedido.
        /// Soporta descuentos por detalle para permitir que adiciones a un pedido existente también descuenten stock.
        /// </summary>
        public async Task<ResultadoInventarioDto> DescontarStockPorPedidoAsync(int pedidoId)
        {
            try
            {
                // 1. Cargar el pedido con sus detalles y platillos
                var pedido = await _context.Pedidos
                    .Include(p => p.Detalles)
                        .ThenInclude(d => d.Platillo)
                    .FirstOrDefaultAsync(p => p.Id == pedidoId);

                if (pedido == null || pedido.Detalles == null || !pedido.Detalles.Any())
                {
                    _logger.LogWarning("⚠️ Pedido #{PedidoId} no encontrado o sin detalles.", pedidoId);
                    return new ResultadoInventarioDto { Exitoso = false, Mensaje = "Pedido no encontrado o sin detalles." };
                }

                // Asegurar que existan recetas predeterminadas en el sistema
                await InicializarRecetasPredeterminadasAsync();

                // 2. Obtener almacén de consumo (prioritariamente Cocina o Principal)
                var almacenCocina = await _context.Almacenes
                    .FirstOrDefaultAsync(a => a.Tipo == "Cocina" || a.Nombre.Contains("Cocina") || a.Nombre.Contains("Principal"))
                    ?? await _context.Almacenes.FirstOrDefaultAsync();

                int almacenDefaultId = almacenCocina?.Id ?? 1;
                int movimientosCount = 0;

                // 3. Procesar cada detalle del pedido
                foreach (var detalle in pedido.Detalles)
                {
                    if (detalle.PlatilloId <= 0 || detalle.Cantidad <= 0)
                        continue;

                    // Referencia única por detalle (evita duplicados si se llama varias veces)
                    var referenciaDetalle = $"Pedido #{pedidoId} - Detalle #{detalle.Id}";
                    var referenciaLegacy = $"Pedido #{pedidoId}";

                    var yaDescontado = await _context.MovimientosInventario
                        .AnyAsync(m => (m.Referencia == referenciaDetalle || m.Referencia == referenciaLegacy) 
                                       && m.TipoMovimiento == "Salida");

                    if (yaDescontado)
                    {
                        continue;
                    }

                    // Buscar recetas asociadas al platillo
                    var recetas = await _context.Recetas
                        .Where(r => r.PlatilloId == detalle.PlatilloId)
                        .Include(r => r.Producto)
                        .ToListAsync();

                    if (recetas.Any())
                    {
                        // Descontar insumos según la ficha técnica (receta)
                        foreach (var receta in recetas)
                        {
                            decimal cantidadADescontar = receta.CantidadRequerida * detalle.Cantidad;
                            await AplicarSalidaStockAsync(
                                receta.ProductoId,
                                almacenDefaultId,
                                cantidadADescontar,
                                $"Venta Pedido #{pedidoId}: '{detalle.Platillo?.Nombre}' x{detalle.Cantidad}",
                                referenciaDetalle,
                                pedido.UsuarioId
                            );
                            movimientosCount++;
                        }
                    }
                    else if (detalle.Platillo != null)
                    {
                        // Si no tiene receta configurada, intentar vincular directamente con un producto homónimo
                        var nombrePlatilloNorm = NormalizarTexto(detalle.Platillo.Nombre);
                        var productos = await _context.ProductosInventario.ToListAsync();
                        var productoMatch = productos.FirstOrDefault(p =>
                        {
                            var pNorm = NormalizarTexto(p.Nombre);
                            return pNorm == nombrePlatilloNorm ||
                                   pNorm.Contains(nombrePlatilloNorm) ||
                                   nombrePlatilloNorm.Contains(pNorm);
                        });

                        if (productoMatch != null)
                        {
                            decimal cantidadADescontar = 1m * detalle.Cantidad;
                            await AplicarSalidaStockAsync(
                                productoMatch.Id,
                                almacenDefaultId,
                                cantidadADescontar,
                                $"Venta Directa Pedido #{pedidoId}: '{detalle.Platillo.Nombre}' x{detalle.Cantidad}",
                                referenciaDetalle,
                                pedido.UsuarioId
                            );
                            movimientosCount++;
                        }
                        else
                        {
                            _logger.LogInformation("ℹ️ Platillo '{Platillo}' no tiene receta ni producto directo vinculado.", detalle.Platillo.Nombre);
                        }
                    }
                }

                if (movimientosCount > 0)
                {
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("✅ Inventario descontado exitosamente para Pedido #{PedidoId}. Movimientos: {Count}", pedidoId, movimientosCount);
                }

                return new ResultadoInventarioDto
                {
                    Exitoso = true,
                    Mensaje = movimientosCount > 0 
                        ? $"Se generaron {movimientosCount} movimientos de inventario."
                        : "El inventario del pedido ya estaba sincronizado.",
                    MovimientosGenerados = movimientosCount
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error al descontar inventario para Pedido #{PedidoId}", pedidoId);
                return new ResultadoInventarioDto
                {
                    Exitoso = false,
                    Mensaje = $"Error al descontar inventario: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// Revierte el descuento de inventario si un pedido es cancelado.
        /// </summary>
        public async Task<ResultadoInventarioDto> RevertirStockPorPedidoAsync(int pedidoId)
        {
            try
            {
                var prefijoReferencia = $"Pedido #{pedidoId}";
                var referenciaReverso = $"Cancelación #{pedidoId}";

                // Evitar revertir más de una vez
                var yaRevertido = await _context.MovimientosInventario
                    .AnyAsync(m => m.Referencia != null && m.Referencia.StartsWith(referenciaReverso));

                if (yaRevertido)
                {
                    return new ResultadoInventarioDto { Exitoso = true, Mensaje = "El pedido ya había sido revertido previamente." };
                }

                // Buscar todos los movimientos de salida originados por este pedido
                var movimientosSalida = await _context.MovimientosInventario
                    .Where(m => m.Referencia != null && m.Referencia.StartsWith(prefijoReferencia) && m.TipoMovimiento == "Salida")
                    .ToListAsync();

                if (!movimientosSalida.Any())
                {
                    return new ResultadoInventarioDto { Exitoso = true, Mensaje = "No había movimientos previos para revertir." };
                }

                int revertidos = 0;
                foreach (var mov in movimientosSalida)
                {
                    // Restaurar el stock
                    var stock = await _context.Stock
                        .FirstOrDefaultAsync(s => s.ProductoId == mov.ProductoId && s.AlmacenId == mov.AlmacenId);

                    if (stock != null)
                    {
                        stock.Cantidad += mov.Cantidad;
                        stock.CostoTotal = stock.Cantidad * stock.CostoPromedio;
                        stock.FechaActualizacion = DateTime.UtcNow;
                    }

                    // Restaurar en lote si existía
                    if (mov.LoteId.HasValue)
                    {
                        var lote = await _context.Lotes.FindAsync(mov.LoteId.Value);
                        if (lote != null)
                        {
                            lote.CantidadActual += mov.Cantidad;
                        }
                    }

                    // Registrar movimiento de Entrada por cancelación
                    var reverso = new MovimientoInventario
                    {
                        ProductoId = mov.ProductoId,
                        AlmacenId = mov.AlmacenId,
                        LoteId = mov.LoteId,
                        TipoMovimiento = "Entrada",
                        Cantidad = mov.Cantidad,
                        CostoUnitario = mov.CostoUnitario,
                        CostoTotal = mov.CostoTotal,
                        Motivo = $"Reverso por Pedido #{pedidoId} Cancelado ({mov.Motivo})",
                        Referencia = $"{referenciaReverso} - Mov #{mov.Id}",
                        UsuarioId = mov.UsuarioId,
                        Fecha = DateTime.UtcNow
                    };

                    _context.MovimientosInventario.Add(reverso);
                    revertidos++;
                }

                await _context.SaveChangesAsync();
                _logger.LogInformation("🔄 Inventario revertido para Pedido #{PedidoId}. Movimientos restaurados: {Count}", pedidoId, revertidos);

                return new ResultadoInventarioDto
                {
                    Exitoso = true,
                    Mensaje = $"Se restauraron {revertidos} insumos al inventario.",
                    MovimientosGenerados = revertidos
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error al revertir inventario para Pedido #{PedidoId}", pedidoId);
                return new ResultadoInventarioDto { Exitoso = false, Mensaje = ex.Message };
            }
        }

        /// <summary>
        /// Descuenta inventario para pedidos a domicilio.
        /// </summary>
        public async Task<ResultadoInventarioDto> DescontarStockPorDomicilioAsync(int domicilioId)
        {
            try
            {
                var domicilio = await _context.Domicilios
                    .Include(d => d.Detalles)
                        .ThenInclude(dd => dd.Platillo)
                    .FirstOrDefaultAsync(d => d.Id == domicilioId);

                if (domicilio == null || domicilio.Detalles == null || !domicilio.Detalles.Any())
                    return new ResultadoInventarioDto { Exitoso = false, Mensaje = "Domicilio no encontrado o sin platillos." };

                await InicializarRecetasPredeterminadasAsync();

                var almacenCocina = await _context.Almacenes
                    .FirstOrDefaultAsync(a => a.Tipo == "Cocina" || a.Nombre.Contains("Cocina") || a.Nombre.Contains("Principal"))
                    ?? await _context.Almacenes.FirstOrDefaultAsync();

                int almacenId = almacenCocina?.Id ?? 1;
                int count = 0;

                foreach (var det in domicilio.Detalles)
                {
                    if (det.PlatilloId <= 0 || det.Cantidad <= 0)
                        continue;

                    var referenciaDetalle = $"Domicilio #{domicilioId} - Detalle #{det.Id}";
                    var referenciaLegacy = $"Domicilio #{domicilioId}";

                    var yaDescontado = await _context.MovimientosInventario
                        .AnyAsync(m => (m.Referencia == referenciaDetalle || m.Referencia == referenciaLegacy) 
                                       && m.TipoMovimiento == "Salida");

                    if (yaDescontado)
                        continue;

                    var recetas = await _context.Recetas
                        .Where(r => r.PlatilloId == det.PlatilloId)
                        .Include(r => r.Producto)
                        .ToListAsync();

                    if (recetas.Any())
                    {
                        foreach (var receta in recetas)
                        {
                            decimal cantidad = receta.CantidadRequerida * det.Cantidad;
                            await AplicarSalidaStockAsync(
                                receta.ProductoId,
                                almacenId,
                                cantidad,
                                $"Venta Domicilio #{domicilioId}: '{det.Platillo?.Nombre}' x{det.Cantidad}",
                                referenciaDetalle,
                                domicilio.UsuarioCreadorId
                            );
                            count++;
                        }
                    }
                    else if (det.Platillo != null)
                    {
                        var platilloNorm = NormalizarTexto(det.Platillo.Nombre);
                        var productos = await _context.ProductosInventario.ToListAsync();
                        var productoMatch = productos.FirstOrDefault(p =>
                        {
                            var pNorm = NormalizarTexto(p.Nombre);
                            return pNorm == platilloNorm || pNorm.Contains(platilloNorm) || platilloNorm.Contains(pNorm);
                        });

                        if (productoMatch != null)
                        {
                            decimal cantidad = 1m * det.Cantidad;
                            await AplicarSalidaStockAsync(
                                productoMatch.Id,
                                almacenId,
                                cantidad,
                                $"Venta Directa Domicilio #{domicilioId}: '{det.Platillo.Nombre}' x{det.Cantidad}",
                                referenciaDetalle,
                                domicilio.UsuarioCreadorId
                            );
                            count++;
                        }
                    }
                }

                if (count > 0)
                {
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("✅ Inventario descontado para Domicilio #{DomicilioId}. Movimientos: {Count}", domicilioId, count);
                }

                return new ResultadoInventarioDto 
                { 
                    Exitoso = true, 
                    Mensaje = count > 0 ? $"Descontados {count} insumos para el domicilio." : "Ya sincronizado.",
                    MovimientosGenerados = count 
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error al descontar inventario para Domicilio #{DomicilioId}", domicilioId);
                return new ResultadoInventarioDto { Exitoso = false, Mensaje = ex.Message };
            }
        }

        /// <summary>
        /// Revierte el inventario de un pedido a domicilio cancelado.
        /// </summary>
        public async Task<ResultadoInventarioDto> RevertirStockPorDomicilioAsync(int domicilioId)
        {
            try
            {
                var prefijoReferencia = $"Domicilio #{domicilioId}";
                var referenciaReverso = $"Cancelación Domicilio #{domicilioId}";

                var yaRevertido = await _context.MovimientosInventario
                    .AnyAsync(m => m.Referencia != null && m.Referencia.StartsWith(referenciaReverso));

                if (yaRevertido)
                {
                    return new ResultadoInventarioDto { Exitoso = true, Mensaje = "El domicilio ya había sido revertido." };
                }

                var movimientosSalida = await _context.MovimientosInventario
                    .Where(m => m.Referencia != null && m.Referencia.StartsWith(prefijoReferencia) && m.TipoMovimiento == "Salida")
                    .ToListAsync();

                if (!movimientosSalida.Any())
                {
                    return new ResultadoInventarioDto { Exitoso = true, Mensaje = "No había movimientos para revertir." };
                }

                int count = 0;
                foreach (var mov in movimientosSalida)
                {
                    var stock = await _context.Stock
                        .FirstOrDefaultAsync(s => s.ProductoId == mov.ProductoId && s.AlmacenId == mov.AlmacenId);

                    if (stock != null)
                    {
                        stock.Cantidad += mov.Cantidad;
                        stock.CostoTotal = stock.Cantidad * stock.CostoPromedio;
                        stock.FechaActualizacion = DateTime.UtcNow;
                    }

                    if (mov.LoteId.HasValue)
                    {
                        var lote = await _context.Lotes.FindAsync(mov.LoteId.Value);
                        if (lote != null)
                        {
                            lote.CantidadActual += mov.Cantidad;
                        }
                    }

                    _context.MovimientosInventario.Add(new MovimientoInventario
                    {
                        ProductoId = mov.ProductoId,
                        AlmacenId = mov.AlmacenId,
                        LoteId = mov.LoteId,
                        TipoMovimiento = "Entrada",
                        Cantidad = mov.Cantidad,
                        CostoUnitario = mov.CostoUnitario,
                        CostoTotal = mov.CostoTotal,
                        Motivo = $"Reverso por Domicilio #{domicilioId} Cancelado",
                        Referencia = $"{referenciaReverso} - Mov #{mov.Id}",
                        UsuarioId = mov.UsuarioId,
                        Fecha = DateTime.UtcNow
                    });

                    count++;
                }

                await _context.SaveChangesAsync();
                return new ResultadoInventarioDto { Exitoso = true, MovimientosGenerados = count };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error al revertir inventario para Domicilio #{DomicilioId}", domicilioId);
                return new ResultadoInventarioDto { Exitoso = false, Mensaje = ex.Message };
            }
        }

        /// <summary>
        /// Aplica una salida de stock y registra el movimiento de inventario correspondiente.
        /// Actualiza además el lote FIFO correspondiente si existe.
        /// </summary>
        private async Task AplicarSalidaStockAsync(int productoId, int almacenDefaultId, decimal cantidad, string motivo, string referencia, int? usuarioId)
        {
            // 1. Buscar stock existente prioritariamente en el almacén indicado o en cualquiera con existencia
            var stock = await _context.Stock
                .FirstOrDefaultAsync(s => s.ProductoId == productoId && s.AlmacenId == almacenDefaultId)
                ?? await _context.Stock
                    .Where(s => s.ProductoId == productoId)
                    .OrderByDescending(s => s.Cantidad)
                    .FirstOrDefaultAsync();

            int almacenEfectivoId = stock?.AlmacenId ?? almacenDefaultId;

            // Obtener producto para precio de costo de respaldo
            var producto = await _context.ProductosInventario.FindAsync(productoId);
            decimal costoUnitario = (stock != null && stock.CostoPromedio > 0) 
                ? stock.CostoPromedio 
                : (producto?.PrecioCosto ?? 0);

            if (stock == null)
            {
                // Si no hay registro de stock previo, se crea
                stock = new Stock
                {
                    ProductoId = productoId,
                    AlmacenId = almacenEfectivoId,
                    Cantidad = -cantidad,
                    CostoPromedio = costoUnitario,
                    CostoTotal = -cantidad * costoUnitario,
                    FechaActualizacion = DateTime.UtcNow
                };
                _context.Stock.Add(stock);
            }
            else
            {
                stock.Cantidad -= cantidad;
                stock.CostoTotal = stock.Cantidad * stock.CostoPromedio;
                stock.FechaActualizacion = DateTime.UtcNow;
            }

            // 2. Descontar de Lote por FIFO si existen lotes activos
            int? loteIdUsado = null;
            var loteActivo = await _context.Lotes
                .Where(l => l.ProductoId == productoId && l.CantidadActual > 0)
                .OrderBy(l => l.FechaVencimiento)
                .ThenBy(l => l.FechaIngreso)
                .FirstOrDefaultAsync();

            if (loteActivo != null)
            {
                loteIdUsado = loteActivo.Id;
                loteActivo.CantidadActual = Math.Max(0, loteActivo.CantidadActual - cantidad);
            }

            // 3. Registrar el movimiento de auditoría
            var movimiento = new MovimientoInventario
            {
                ProductoId = productoId,
                AlmacenId = almacenEfectivoId,
                LoteId = loteIdUsado,
                TipoMovimiento = "Salida",
                Cantidad = cantidad,
                CostoUnitario = costoUnitario,
                CostoTotal = cantidad * costoUnitario,
                Motivo = motivo,
                Referencia = referencia,
                UsuarioId = usuarioId,
                Fecha = DateTime.UtcNow
            };

            _context.MovimientosInventario.Add(movimiento);
        }

        /// <summary>
        /// Normaliza texto removiendo acentos/tildes y convirtiendo a minúsculas para comparaciones infalibles.
        /// </summary>
        private static string NormalizarTexto(string? texto)
        {
            if (string.IsNullOrWhiteSpace(texto))
                return string.Empty;

            var normalizedString = texto.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
            var stringBuilder = new StringBuilder();

            foreach (var c in normalizedString)
            {
                var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(c);
                if (unicodeCategory != UnicodeCategory.NonSpacingMark)
                {
                    stringBuilder.Append(c);
                }
            }

            return stringBuilder.ToString().Normalize(NormalizationForm.FormC);
        }

        /// <summary>
        /// Inicializa recetas predeterminadas para los platillos del restaurante si aún no existen.
        /// </summary>
        public async Task InicializarRecetasPredeterminadasAsync()
        {
            if (await _context.Recetas.AnyAsync())
                return;

            _logger.LogInformation("🌱 Sembrando recetas predeterminadas para platillos...");

            var recetasBase = new List<(string Platillo, string CodigoProd, decimal Cantidad, UnidadMedida Unidad, string Nota)>
            {
                // Hamburguesa Clásica (Platillo 1)
                ("Hamburguesa Clasica", "PROD-001", 0.20m, UnidadMedida.Kg, "Carne de res seleccionada"),
                ("Hamburguesa Clasica", "PROD-007", 0.05m, UnidadMedida.Kg, "Cebolla picada"),
                ("Hamburguesa Clasica", "PROD-010", 0.05m, UnidadMedida.Kg, "Queso mozzarella"),
                ("Hamburguesa Clasica", "PROD-006", 0.05m, UnidadMedida.Kg, "Tomate en rodajas"),
                ("Hamburguesa Clasica", "PROD-008", 0.05m, UnidadMedida.Unidad, "Hojas de lechuga"),
                ("Hamburguesa Clasica", "PROD-009", 0.15m, UnidadMedida.Kg, "Papa criolla frita"),

                // Pizza Margarita (Platillo 2)
                ("Pizza Margarita", "PROD-015", 0.25m, UnidadMedida.Kg, "Masa para pizza"),
                ("Pizza Margarita", "PROD-010", 0.15m, UnidadMedida.Kg, "Queso mozzarella"),
                ("Pizza Margarita", "PROD-006", 0.10m, UnidadMedida.Kg, "Salsa y rodajas de tomate"),
                ("Pizza Margarita", "PROD-016", 0.02m, UnidadMedida.Litro, "Aceite de oliva"),

                // Ensalada César (Platillo 3)
                ("Ensalada Cesar", "PROD-008", 1.00m, UnidadMedida.Unidad, "Lechuga romana"),
                ("Ensalada Cesar", "PROD-002", 0.15m, UnidadMedida.Kg, "Pechuga de pollo a la plancha"),
                ("Ensalada Cesar", "PROD-010", 0.03m, UnidadMedida.Kg, "Queso rallado"),
                ("Ensalada Cesar", "PROD-016", 0.02m, UnidadMedida.Litro, "Aceite de oliva extra virgen"),

                // Pasta Carbonara (Platillo 4)
                ("Pasta Carbonara", "PROD-014", 0.20m, UnidadMedida.Paquete, "Pasta spaghetti"),
                ("Pasta Carbonara", "PROD-010", 0.08m, UnidadMedida.Kg, "Queso mozzarella"),
                ("Pasta Carbonara", "PROD-012", 0.03m, UnidadMedida.Kg, "Mantequilla"),
                ("Pasta Carbonara", "PROD-011", 0.05m, UnidadMedida.Litro, "Leche entera cremosa"),

                // Tacos al Pastor (Platillo 5)
                ("Tacos al Pastor", "PROD-003", 0.20m, UnidadMedida.Kg, "Chuleta de cerdo marinada"),
                ("Tacos al Pastor", "PROD-007", 0.05m, UnidadMedida.Kg, "Cebolla picada"),
                ("Tacos al Pastor", "PROD-006", 0.05m, UnidadMedida.Kg, "Tomate en cubos"),

                // Salmón a la Parrilla (Platillo 6)
                ("Salmon a la Parrilla", "PROD-004", 0.25m, UnidadMedida.Kg, "Filete de salmón fresco"),
                ("Salmon a la Parrilla", "PROD-016", 0.02m, UnidadMedida.Litro, "Aceite de oliva"),
                ("Salmon a la Parrilla", "PROD-018", 0.01m, UnidadMedida.Kg, "Sal marina"),
                ("Salmon a la Parrilla", "PROD-013", 0.10m, UnidadMedida.Kg, "Porción de arroz"),

                // Sopa de Tomate (Platillo 7)
                ("Sopa de Tomate", "PROD-006", 0.25m, UnidadMedida.Kg, "Tomate chonto fresco"),
                ("Sopa de Tomate", "PROD-007", 0.05m, UnidadMedida.Kg, "Cebolla cabezona"),
                ("Sopa de Tomate", "PROD-020", 0.01m, UnidadMedida.Kg, "Ajo en pasta"),

                // Pollo Teriyaki (Platillo 8)
                ("Pollo Teriyaki", "PROD-002", 0.25m, UnidadMedida.Kg, "Pechuga de pollo"),
                ("Pollo Teriyaki", "PROD-013", 0.15m, UnidadMedida.Kg, "Arroz blanco"),
                ("Pollo Teriyaki", "PROD-007", 0.05m, UnidadMedida.Kg, "Cebolla salteada"),

                // Brownie con Helado (Platillo 9)
                ("Brownie con Helado", "PROD-015", 0.10m, UnidadMedida.Kg, "Harina de trigo"),
                ("Brownie con Helado", "PROD-011", 0.10m, UnidadMedida.Litro, "Leche entera"),
                ("Brownie con Helado", "PROD-012", 0.05m, UnidadMedida.Kg, "Mantequilla")
            };

            var platillos = await _context.Platillos.ToListAsync();
            var productos = await _context.ProductosInventario.ToListAsync();

            foreach (var r in recetasBase)
            {
                var targetPlatilloNorm = NormalizarTexto(r.Platillo);
                var platillo = platillos.FirstOrDefault(p =>
                {
                    var pNorm = NormalizarTexto(p.Nombre);
                    return pNorm == targetPlatilloNorm ||
                           pNorm.Contains(targetPlatilloNorm) ||
                           targetPlatilloNorm.Contains(pNorm);
                });

                var producto = productos.FirstOrDefault(p => 
                    !string.IsNullOrEmpty(p.Codigo) && p.Codigo.Equals(r.CodigoProd, StringComparison.OrdinalIgnoreCase));

                if (platillo != null && producto != null)
                {
                    _context.Recetas.Add(new Receta
                    {
                        PlatilloId = platillo.Id,
                        ProductoId = producto.Id,
                        CantidadRequerida = r.Cantidad,
                        UnidadMedida = r.Unidad,
                        CostoUnitario = producto.PrecioCosto,
                        Opcional = false,
                        Notas = r.Nota,
                        FechaCreacion = DateTime.UtcNow
                    });
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("✅ Recetas predeterminadas sembradas exitosamente.");
        }
    }
}
