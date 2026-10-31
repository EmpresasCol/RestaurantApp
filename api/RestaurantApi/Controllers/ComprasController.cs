using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    /// <summary>
    /// Trabajo diario del encargado del inventario: qué se está acabando, qué vence, pedir al
    /// proveedor, recibir mercancía (con escáner), contar y dar de baja. Las cantidades van en
    /// la unidad del insumo salvo cuando la línea indica una presentación de compra.
    /// </summary>
    [Route("api/compras")]
    [ApiController]
    [Authorize(Roles = "Administrador")]
    public class ComprasController : ControllerBase
    {
        private const int DiasConsumo = 14;
        private const int DiasAvisoVencimiento = 7;

        private static readonly EstadoOrdenCompra[] EstadosAbiertos =
            { EstadoOrdenCompra.Pendiente, EstadoOrdenCompra.Aprobada, EstadoOrdenCompra.EnTransito };

        private readonly RestauranteContext _context;

        public ComprasController(RestauranteContext context)
        {
            _context = context;
        }

        private static DateTime Hoy => HoraLocal.AhoraColombia().Date;
        private int UsuarioId => QproClaims.IdUsuario(User) ?? 1;

        // ==================== RESUMEN DEL DÍA ====================

        /// <summary>Lo que el encargado debe atender hoy: agotados, por pedir, por vencer, vencidos y pedidos por recibir.</summary>
        [HttpGet("resumen")]
        public async Task<ActionResult<object>> GetResumen()
        {
            var estados = await EstadoInsumosAsync();
            var lotes = await LotesConVencimientoAsync(DiasAvisoVencimiento);
            var ordenes = await _context.OrdenesCompra.CountAsync(o => EstadosAbiertos.Contains(o.Estado));

            return Ok(new
            {
                Agotados = estados.Count(e => e.Estado == "Agotado"),
                PorPedir = estados.Count(e => e.Estado == "Bajo"),
                PorVencer = lotes.Count(l => l.DiasParaVencer >= 0),
                Vencidos = lotes.Count(l => l.DiasParaVencer < 0),
                OrdenesAbiertas = ordenes,
                ValorInventario = Math.Round(estados.Sum(e => e.Valor), 0),
                TotalInsumos = estados.Count,
                Criticos = estados.Where(e => e.Estado != "OK")
                    .OrderBy(e => e.Estado == "Agotado" ? 0 : 1).ThenBy(e => e.DiasCobertura ?? decimal.MaxValue)
                    .Take(8),
                Vencimientos = lotes.Take(8)
            });
        }

        /// <summary>Lista de insumos con su estado (para la tabla principal y el conteo).</summary>
        [HttpGet("insumos")]
        public async Task<ActionResult<object>> GetInsumos() => Ok(await EstadoInsumosAsync());

        // ==================== FICHA DEL INSUMO ====================

        [HttpGet("insumos/{id:int}/ficha")]
        public async Task<ActionResult<object>> GetFicha(int id)
        {
            var p = await _context.ProductosInventario
                .Include(x => x.Categoria).Include(x => x.Proveedor)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (p == null) return NotFound(new { message = "Insumo no encontrado" });

            var estado = (await EstadoInsumosAsync(id)).Single();
            var hoy = Hoy;

            var porAlmacen = await _context.Stock.Where(s => s.ProductoId == id)
                .Select(s => new { s.AlmacenId, Almacen = s.Almacen.Nombre, s.Cantidad, s.CostoPromedio })
                .ToListAsync();

            var lotes = (await _context.Lotes.Where(l => l.ProductoId == id && l.CantidadActual > 0)
                    .Select(l => new { l.Id, l.NumeroLote, l.AlmacenId, Almacen = l.Almacen.Nombre, l.FechaIngreso, l.FechaVencimiento, l.CantidadActual, l.CostoUnitario })
                    .ToListAsync())
                .OrderBy(l => l.FechaVencimiento == null).ThenBy(l => l.FechaVencimiento)
                .Select(l => new
                {
                    l.Id, l.NumeroLote, l.AlmacenId, l.Almacen, l.FechaIngreso, l.FechaVencimiento, l.CantidadActual, l.CostoUnitario,
                    DiasParaVencer = l.FechaVencimiento.HasValue ? (int?)(l.FechaVencimiento.Value.Date - hoy).TotalDays : null
                });

            var presentaciones = await _context.PresentacionesCompra.Where(x => x.ProductoId == id)
                .OrderBy(x => x.Factor)
                .Select(x => new { x.Id, x.Nombre, x.Factor, x.Codigo, x.ProveedorId, Proveedor = x.Proveedor != null ? x.Proveedor.Nombre : null, x.CostoReferencia, x.Activo })
                .ToListAsync();

            var movimientos = await _context.MovimientosInventario.Where(m => m.ProductoId == id)
                .OrderByDescending(m => m.Fecha).Take(25)
                .Select(m => new { m.Id, m.Fecha, m.TipoMovimiento, m.Cantidad, m.CostoUnitario, m.Motivo, m.Referencia, Almacen = m.Almacen.Nombre })
                .ToListAsync();

            var usadoEn = await _context.Recetas.Where(r => r.ProductoId == id)
                .Select(r => new { r.PlatilloId, Platillo = r.Platillo.Nombre, r.CantidadRequerida, r.Opcional })
                .ToListAsync();

            var ordenesAbiertas = await _context.DetallesOrdenCompra
                .Where(d => d.ProductoId == id && EstadosAbiertos.Contains(d.OrdenCompra!.Estado))
                .Select(d => new { d.OrdenCompraId, d.OrdenCompra!.NumeroOrden, d.OrdenCompra.FechaEntregaEstimada, Pendiente = d.Cantidad - d.CantidadRecibida })
                .ToListAsync();

            return Ok(new
            {
                Insumo = new
                {
                    p.Id, p.Codigo, p.Nombre, p.Descripcion, p.UnidadMedida, p.PrecioCosto, p.StockMinimo, p.StockMaximo, p.PuntoReorden,
                    p.RequiereCaducidad, p.DiasVencimiento, p.Activo, p.CategoriaId, Categoria = p.Categoria?.Nombre,
                    p.ProveedorId, Proveedor = p.Proveedor?.Nombre, ProveedorTelefono = p.Proveedor?.Telefono
                },
                estado.Stock, estado.Vencido, estado.Valor, estado.Estado, estado.ConsumoDiario, estado.DiasCobertura, estado.Pedido,
                PorAlmacen = porAlmacen, Lotes = lotes, Presentaciones = presentaciones, Movimientos = movimientos,
                UsadoEn = usadoEn, OrdenesAbiertas = ordenesAbiertas
            });
        }

        // ==================== CÓDIGOS Y PRESENTACIONES ====================

        /// <summary>Qué insumo y presentación corresponden a un código escaneado.</summary>
        [HttpGet("codigo/{codigo}")]
        public async Task<ActionResult<object>> ResolverCodigo(string codigo)
        {
            codigo = codigo.Trim();
            var pres = await _context.PresentacionesCompra.Include(x => x.Producto)
                .FirstOrDefaultAsync(x => x.Codigo == codigo && x.Activo);

            ProductoInventario? producto = pres?.Producto;
            // Código interno del insumo (PROD-001) o el código de barras que tenía antes del cambio.
            producto ??= await _context.ProductosInventario
                .FirstOrDefaultAsync(x => x.Codigo == codigo || x.CodigoBarras == codigo);

            if (producto == null) return NotFound(new { message = "Código sin asociar", codigo });

            return Ok(new
            {
                Codigo = codigo,
                Presentacion = pres == null ? null : new { pres.Id, pres.Nombre, pres.Factor, pres.CostoReferencia },
                Insumo = new { producto.Id, producto.Nombre, producto.UnidadMedida, producto.PrecioCosto, producto.RequiereCaducidad, producto.DiasVencimiento, producto.Activo },
                VencimientoSugerido = producto.DiasVencimiento > 0 ? Hoy.AddDays(producto.DiasVencimiento.Value) : (DateTime?)null
            });
        }

        [HttpGet("presentaciones")]
        public async Task<ActionResult<object>> GetPresentaciones([FromQuery] int? productoId)
            => Ok(await _context.PresentacionesCompra
                .Where(x => productoId == null || x.ProductoId == productoId)
                .OrderBy(x => x.ProductoId).ThenBy(x => x.Factor)
                .Select(x => new { x.Id, x.ProductoId, Insumo = x.Producto!.Nombre, x.Producto.UnidadMedida, x.Nombre, x.Factor, x.Codigo, x.ProveedorId, x.CostoReferencia, x.Activo })
                .ToListAsync());

        [HttpPost("presentaciones")]
        public async Task<ActionResult<object>> CrearPresentacion([FromBody] PresentacionCompraDto dto)
        {
            var error = await ValidarPresentacionAsync(dto, null);
            if (error != null) return BadRequest(new { message = error });

            var pres = new PresentacionCompra();
            Copiar(dto, pres);
            _context.PresentacionesCompra.Add(pres);
            await _context.SaveChangesAsync();
            return Ok(new { pres.Id, pres.ProductoId, pres.Nombre, pres.Factor, pres.Codigo, pres.ProveedorId, pres.CostoReferencia, pres.Activo });
        }

        [HttpPut("presentaciones/{id:int}")]
        public async Task<IActionResult> EditarPresentacion(int id, [FromBody] PresentacionCompraDto dto)
        {
            var pres = await _context.PresentacionesCompra.FindAsync(id);
            if (pres == null) return NotFound(new { message = "Presentación no encontrada" });

            var error = await ValidarPresentacionAsync(dto, id);
            if (error != null) return BadRequest(new { message = error });

            Copiar(dto, pres);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("presentaciones/{id:int}")]
        public async Task<IActionResult> EliminarPresentacion(int id)
        {
            var pres = await _context.PresentacionesCompra.FindAsync(id);
            if (pres == null) return NotFound(new { message = "Presentación no encontrada" });
            _context.PresentacionesCompra.Remove(pres);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private async Task<string?> ValidarPresentacionAsync(PresentacionCompraDto dto, int? id)
        {
            if (!await _context.ProductosInventario.AnyAsync(p => p.Id == dto.ProductoId))
                return "El insumo no existe";
            if (dto.ProveedorId.HasValue && !await _context.Proveedores.AnyAsync(p => p.Id == dto.ProveedorId))
                return "El proveedor no existe";

            var codigo = string.IsNullOrWhiteSpace(dto.Codigo) ? null : dto.Codigo.Trim();
            if (codigo == null) return null;

            var otra = await _context.PresentacionesCompra.Include(x => x.Producto)
                .FirstOrDefaultAsync(x => x.Codigo == codigo && x.Id != id);
            if (otra != null) return $"El código {codigo} ya está asociado a {otra.Producto?.Nombre} ({otra.Nombre})";

            var insumo = await _context.ProductosInventario
                .FirstOrDefaultAsync(p => (p.Codigo == codigo || p.CodigoBarras == codigo) && p.Id != dto.ProductoId);
            return insumo != null ? $"El código {codigo} ya pertenece al insumo {insumo.Nombre}" : null;
        }

        private static void Copiar(PresentacionCompraDto dto, PresentacionCompra pres)
        {
            pres.ProductoId = dto.ProductoId;
            pres.Nombre = dto.Nombre.Trim();
            pres.Factor = dto.Factor;
            pres.Codigo = string.IsNullOrWhiteSpace(dto.Codigo) ? null : dto.Codigo.Trim();
            pres.ProveedorId = dto.ProveedorId;
            pres.CostoReferencia = dto.CostoReferencia;
            pres.Activo = dto.Activo;
        }

        // ==================== RECEPCIÓN DE MERCANCÍA ====================

        /// <summary>
        /// Registra lo que llegó: crea un lote por línea (con su vencimiento), sube el stock con
        /// costo promedio y, si viene de una orden de compra, marca lo recibido.
        /// </summary>
        [HttpPost("recepciones")]
        public async Task<ActionResult<object>> Recibir([FromBody] RecepcionDto dto)
        {
            if (dto.Lineas.Count == 0) return BadRequest(new { message = "Agrega al menos un insumo" });
            if (!await _context.Almacenes.AnyAsync(a => a.Id == dto.AlmacenId))
                return BadRequest(new { message = "El almacén no existe" });

            OrdenCompra? orden = null;
            if (dto.OrdenCompraId.HasValue)
            {
                orden = await _context.OrdenesCompra.Include(o => o.Detalles).FirstOrDefaultAsync(o => o.Id == dto.OrdenCompraId);
                if (orden == null) return BadRequest(new { message = "La orden de compra no existe" });
                if (!EstadosAbiertos.Contains(orden.Estado))
                    return Conflict(new { message = $"La orden {orden.NumeroOrden} está {orden.Estado} y no admite recepciones" });
            }

            var ids = dto.Lineas.Select(l => l.ProductoId).Distinct().ToList();
            var productos = await _context.ProductosInventario.Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id);
            var presIds = dto.Lineas.Where(l => l.PresentacionId.HasValue).Select(l => l.PresentacionId!.Value).Distinct().ToList();
            var presentaciones = await _context.PresentacionesCompra.Where(x => presIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id);
            var hoy = Hoy;

            // Validar todo antes de tocar el stock.
            var lineas = new List<(RecepcionLineaDto Dto, ProductoInventario Producto, PresentacionCompra? Pres, decimal Cantidad, decimal Costo, DateTime? Vence)>();
            foreach (var l in dto.Lineas)
            {
                if (!productos.TryGetValue(l.ProductoId, out var producto))
                    return BadRequest(new { message = $"El insumo {l.ProductoId} no existe" });
                if (l.Cantidad <= 0)
                    return BadRequest(new { message = $"{producto.Nombre}: la cantidad debe ser mayor que cero" });

                PresentacionCompra? pres = null;
                if (l.PresentacionId.HasValue && (!presentaciones.TryGetValue(l.PresentacionId.Value, out pres) || pres.ProductoId != producto.Id))
                    return BadRequest(new { message = $"{producto.Nombre}: la presentación no corresponde al insumo" });

                var factor = pres?.Factor ?? 1;
                var costoBase = l.CostoUnitario.HasValue
                    ? l.CostoUnitario.Value / factor
                    : (pres?.CostoReferencia / factor) ?? producto.PrecioCosto;

                var vence = l.FechaVencimiento?.Date
                            ?? (producto.DiasVencimiento > 0 ? hoy.AddDays(producto.DiasVencimiento.Value) : (DateTime?)null);
                if (producto.RequiereCaducidad && vence == null)
                    return BadRequest(new { message = $"{producto.Nombre}: indica la fecha de vencimiento" });
                if (vence < hoy)
                    return BadRequest(new { message = $"{producto.Nombre}: la fecha de vencimiento ya pasó" });

                lineas.Add((l, producto, pres, Math.Round(l.Cantidad * factor, 2), Math.Round(costoBase, 2), vence));
            }

            using var tx = await _context.Database.BeginTransactionAsync();
            var referencia = orden != null ? $"Recepción {orden.NumeroOrden}" : $"Recepción {dto.Documento ?? hoy.ToString("yyyy-MM-dd")}";
            var consecutivo = await _context.Lotes.CountAsync() + 1;
            decimal total = 0;

            foreach (var (l, producto, pres, cantidad, costo, vence) in lineas)
            {
                var stock = await _context.Stock.FirstOrDefaultAsync(s => s.ProductoId == producto.Id && s.AlmacenId == dto.AlmacenId);
                if (stock == null)
                {
                    stock = new Stock { ProductoId = producto.Id, AlmacenId = dto.AlmacenId, Cantidad = 0, CostoPromedio = costo };
                    _context.Stock.Add(stock);
                }
                stock.CostoPromedio = stock.Cantidad > 0
                    ? Math.Round((stock.Cantidad * stock.CostoPromedio + cantidad * costo) / (stock.Cantidad + cantidad), 2)
                    : costo;
                stock.Cantidad += cantidad;
                stock.FechaActualizacion = DateTime.UtcNow;

                var lote = new Lote
                {
                    ProductoId = producto.Id,
                    AlmacenId = dto.AlmacenId,
                    NumeroLote = string.IsNullOrWhiteSpace(l.NumeroLote) ? $"R{hoy:yyMMdd}-{consecutivo++}" : l.NumeroLote.Trim(),
                    FechaIngreso = hoy,
                    FechaVencimiento = vence,
                    CantidadInicial = cantidad,
                    CantidadActual = cantidad,
                    CostoUnitario = costo,
                    Estado = "Activo"
                };
                _context.Lotes.Add(lote);
                await _context.SaveChangesAsync();

                _context.MovimientosInventario.Add(new MovimientoInventario
                {
                    ProductoId = producto.Id,
                    AlmacenId = dto.AlmacenId,
                    LoteId = lote.Id,
                    TipoMovimiento = "Entrada",
                    Cantidad = cantidad,
                    CostoUnitario = costo,
                    Motivo = pres != null ? $"Compra: {l.Cantidad:0.##} × {pres.Nombre}" : "Compra",
                    Referencia = referencia,
                    UsuarioId = UsuarioId,
                    Fecha = DateTime.UtcNow
                });

                // El último precio pagado alimenta el costo de las recetas y la próxima orden.
                producto.PrecioCosto = costo;
                if (pres != null) pres.CostoReferencia = Math.Round(costo * pres.Factor, 2);
                total += cantidad * costo;

                var detalle = orden?.Detalles.FirstOrDefault(d => d.ProductoId == producto.Id && d.CantidadRecibida < d.Cantidad)
                              ?? orden?.Detalles.FirstOrDefault(d => d.ProductoId == producto.Id);
                if (detalle != null) detalle.CantidadRecibida += cantidad;
            }

            if (orden != null)
            {
                orden.Estado = orden.Detalles.All(d => d.CantidadRecibida >= d.Cantidad) ? EstadoOrdenCompra.Recibida : EstadoOrdenCompra.EnTransito;
                if (orden.Estado == EstadoOrdenCompra.Recibida) orden.FechaEntregaReal = hoy;
                orden.FechaActualizacion = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            return Ok(new
            {
                message = $"Se recibieron {lineas.Count} insumo(s)",
                Lineas = lineas.Count,
                Total = Math.Round(total, 0),
                OrdenEstado = orden?.Estado.ToString()
            });
        }

        // ==================== REPOSICIÓN Y ÓRDENES ====================

        /// <summary>
        /// Qué pedir: insumos en o bajo su punto de reorden, menos lo ya pedido, agrupados por
        /// proveedor y redondeados a la presentación de compra más usada.
        /// </summary>
        [HttpGet("reposicion")]
        public async Task<ActionResult<object>> GetReposicion()
        {
            var estados = (await EstadoInsumosAsync()).Where(e => e.Estado != "OK").ToList();
            var ids = estados.Select(e => e.Id).ToList();
            var productos = await _context.ProductosInventario.Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id);
            var presentaciones = (await _context.PresentacionesCompra.Where(x => ids.Contains(x.ProductoId) && x.Activo).ToListAsync())
                .GroupBy(x => x.ProductoId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Factor).First());
            var proveedores = await _context.Proveedores.ToDictionaryAsync(p => p.Id);

            var sugerencias = estados.Select(e =>
            {
                var p = productos[e.Id];
                var punto = PuntoReorden(p);
                var objetivo = p.StockMaximo > 0 ? p.StockMaximo.Value : Math.Max(punto * 2, 1);
                var falta = Math.Max(objetivo - e.Stock - e.Pedido, 0);
                presentaciones.TryGetValue(p.Id, out var pres);
                var paquetes = pres != null ? Math.Ceiling(falta / pres.Factor) : (decimal?)null;
                var cantidad = pres != null ? paquetes!.Value * pres.Factor : Math.Ceiling(falta);
                var proveedorId = pres?.ProveedorId ?? p.ProveedorId;
                return new
                {
                    e.Id, e.Nombre, e.UnidadMedida, e.Stock, e.Estado, e.Pedido, PuntoReorden = punto, Objetivo = objetivo,
                    Cantidad = cantidad,
                    Presentacion = pres == null ? null : new { pres.Id, pres.Nombre, pres.Factor, Paquetes = paquetes },
                    PrecioUnitario = pres?.CostoReferencia > 0 ? Math.Round(pres.CostoReferencia!.Value / pres.Factor, 2) : p.PrecioCosto,
                    ProveedorId = proveedorId
                };
            })
            .Where(s => s.Cantidad > 0)
            .ToList();

            return Ok(sugerencias
                .GroupBy(s => s.ProveedorId)
                .Select(g => new
                {
                    ProveedorId = g.Key,
                    Proveedor = g.Key.HasValue && proveedores.TryGetValue(g.Key.Value, out var prov) ? prov.Nombre : "Sin proveedor",
                    Telefono = g.Key.HasValue && proveedores.TryGetValue(g.Key.Value, out var prov2) ? prov2.Telefono : null,
                    Total = Math.Round(g.Sum(s => s.Cantidad * s.PrecioUnitario), 0),
                    Insumos = g.OrderBy(s => s.Estado == "Agotado" ? 0 : 1).ThenBy(s => s.Nombre)
                })
                .OrderBy(g => g.ProveedorId == null));
        }

        [HttpGet("ordenes")]
        public async Task<ActionResult<object>> GetOrdenes([FromQuery] bool soloAbiertas = false)
        {
            var ordenes = await _context.OrdenesCompra
                .Where(o => !soloAbiertas || EstadosAbiertos.Contains(o.Estado))
                .OrderByDescending(o => o.FechaCreacion)
                .Select(o => new
                {
                    o.Id, o.NumeroOrden, o.ProveedorId, Proveedor = o.Proveedor!.Nombre, ProveedorTelefono = o.Proveedor.Telefono,
                    o.AlmacenDestinoId, o.FechaOrden, o.FechaEntregaEstimada, o.FechaEntregaReal, Estado = o.Estado.ToString(),
                    o.Total, o.Notas,
                    Items = o.Detalles.Count,
                    Pedido = o.Detalles.Sum(d => d.Cantidad),
                    Recibido = o.Detalles.Sum(d => d.CantidadRecibida)
                })
                .Take(100)
                .ToListAsync();
            return Ok(ordenes);
        }

        [HttpGet("ordenes/{id:int}")]
        public async Task<ActionResult<object>> GetOrden(int id)
        {
            var o = await _context.OrdenesCompra
                .Include(x => x.Proveedor).Include(x => x.AlmacenDestino)
                .Include(x => x.Detalles).ThenInclude(d => d.Producto)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (o == null) return NotFound(new { message = "Orden no encontrada" });

            var ids = o.Detalles.Select(d => d.ProductoId).ToList();
            var presentaciones = (await _context.PresentacionesCompra.Where(x => ids.Contains(x.ProductoId) && x.Activo).ToListAsync())
                .GroupBy(x => x.ProductoId).ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Factor).Select(x => new { x.Id, x.Nombre, x.Factor, x.Codigo }).ToList());

            return Ok(new
            {
                o.Id, o.NumeroOrden, o.ProveedorId, Proveedor = o.Proveedor?.Nombre, ProveedorTelefono = o.Proveedor?.Telefono,
                o.AlmacenDestinoId, AlmacenDestino = o.AlmacenDestino?.Nombre, o.FechaOrden, o.FechaEntregaEstimada, o.FechaEntregaReal,
                Estado = o.Estado.ToString(), o.Subtotal, o.Total, o.Notas,
                Detalles = o.Detalles.Select(d => new
                {
                    d.Id, d.ProductoId, Insumo = d.Producto?.Nombre, d.Producto?.UnidadMedida, d.Producto?.RequiereCaducidad,
                    d.Cantidad, d.PrecioUnitario, d.CantidadRecibida, Pendiente = Math.Max(d.Cantidad - d.CantidadRecibida, 0),
                    Presentaciones = presentaciones.GetValueOrDefault(d.ProductoId)
                })
            });
        }

        [HttpPost("ordenes")]
        public async Task<ActionResult<object>> CrearOrden([FromBody] CrearOrdenCompraDto dto)
        {
            if (dto.Lineas.Count == 0) return BadRequest(new { message = "La orden debe tener al menos un insumo" });
            if (dto.Lineas.Any(l => l.Cantidad <= 0 || l.PrecioUnitario < 0))
                return BadRequest(new { message = "Cantidades mayores que cero y precios no negativos" });
            if (!await _context.Proveedores.AnyAsync(p => p.Id == dto.ProveedorId))
                return BadRequest(new { message = "El proveedor no existe" });
            if (!await _context.Almacenes.AnyAsync(a => a.Id == dto.AlmacenDestinoId))
                return BadRequest(new { message = "El almacén no existe" });

            var ids = dto.Lineas.Select(l => l.ProductoId).Distinct().ToList();
            var existentes = await _context.ProductosInventario.Where(p => ids.Contains(p.Id)).Select(p => p.Id).ToListAsync();
            if (existentes.Count != ids.Count) return BadRequest(new { message = "Uno o más insumos no existen" });

            var siguiente = (await _context.OrdenesCompra.MaxAsync(o => (int?)o.Id) ?? 0) + 1;
            var detalles = dto.Lineas
                .GroupBy(l => l.ProductoId)
                .Select(g => new DetalleOrdenCompra { ProductoId = g.Key, Cantidad = g.Sum(l => l.Cantidad), PrecioUnitario = g.First().PrecioUnitario })
                .ToList();
            var subtotal = Math.Round(detalles.Sum(d => d.Cantidad * d.PrecioUnitario), 2);

            var orden = new OrdenCompra
            {
                NumeroOrden = $"OC-{siguiente:D5}",
                ProveedorId = dto.ProveedorId,
                AlmacenDestinoId = dto.AlmacenDestinoId,
                UsuarioCreadorId = UsuarioId,
                FechaOrden = Hoy,
                FechaEntregaEstimada = dto.FechaEntregaEstimada?.Date,
                Estado = EstadoOrdenCompra.Pendiente,
                Subtotal = subtotal,
                Total = subtotal,
                Notas = dto.Notas,
                Detalles = detalles
            };
            _context.OrdenesCompra.Add(orden);
            await _context.SaveChangesAsync();

            return Ok(new { orden.Id, orden.NumeroOrden, orden.Total });
        }

        /// <summary>Pendiente → Aprobada (enviada al proveedor) → EnTransito; Cancelada desde cualquier estado abierto. Recibida solo por recepción.</summary>
        [HttpPut("ordenes/{id:int}/estado")]
        public async Task<IActionResult> CambiarEstadoOrden(int id, [FromBody] EstadoOrdenCompraDto dto)
        {
            var orden = await _context.OrdenesCompra.FindAsync(id);
            if (orden == null) return NotFound(new { message = "Orden no encontrada" });
            if (!Enum.TryParse<EstadoOrdenCompra>(dto.Estado, true, out var nuevo) || nuevo == EstadoOrdenCompra.Recibida)
                return BadRequest(new { message = "Estado inválido" });
            if (!EstadosAbiertos.Contains(orden.Estado))
                return Conflict(new { message = $"La orden ya está {orden.Estado}" });

            orden.Estado = nuevo;
            orden.FechaActualizacion = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ==================== VENCIMIENTOS ====================

        [HttpGet("vencimientos")]
        public async Task<ActionResult<object>> GetVencimientos([FromQuery] int dias = 30)
            => Ok(await LotesConVencimientoAsync(Math.Clamp(dias, 0, 365)));

        /// <summary>Saca del stock todo lo que queda de un lote (vencido o dañado) como merma.</summary>
        [HttpPost("lotes/{id:int}/baja")]
        public async Task<ActionResult<object>> DarDeBaja(int id, [FromBody] BajaLoteDto? dto)
        {
            var lote = await _context.Lotes.Include(l => l.Producto).FirstOrDefaultAsync(l => l.Id == id);
            if (lote == null) return NotFound(new { message = "Lote no encontrado" });
            if (lote.CantidadActual <= 0) return Conflict(new { message = "El lote ya no tiene existencias" });

            var cantidad = lote.CantidadActual;
            var stock = await _context.Stock.FirstOrDefaultAsync(s => s.ProductoId == lote.ProductoId && s.AlmacenId == lote.AlmacenId);
            if (stock != null)
            {
                stock.Cantidad = Math.Max(0, stock.Cantidad - cantidad);
                stock.FechaActualizacion = DateTime.UtcNow;
            }

            var vencido = lote.FechaVencimiento.HasValue && lote.FechaVencimiento.Value.Date < Hoy;
            lote.CantidadActual = 0;
            lote.Estado = vencido ? "Vencido" : "Agotado";

            _context.MovimientosInventario.Add(new MovimientoInventario
            {
                ProductoId = lote.ProductoId,
                AlmacenId = lote.AlmacenId,
                LoteId = lote.Id,
                TipoMovimiento = "Merma",
                Cantidad = cantidad,
                CostoUnitario = lote.CostoUnitario,
                Motivo = string.IsNullOrWhiteSpace(dto?.Motivo) ? (vencido ? "Lote vencido" : "Baja de lote") : dto!.Motivo!.Trim(),
                Referencia = $"Baja lote {lote.NumeroLote}",
                UsuarioId = UsuarioId,
                Fecha = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = $"Se dio de baja {cantidad:0.##} {lote.Producto?.UnidadMedida} de {lote.Producto?.Nombre}", Perdida = Math.Round(cantidad * lote.CostoUnitario, 0) });
        }

        /// <summary>Corrige la fecha de vencimiento o el número de un lote mal registrado.</summary>
        [HttpPut("lotes/{id:int}")]
        public async Task<IActionResult> EditarLote(int id, [FromBody] EditarLoteDto dto)
        {
            var lote = await _context.Lotes.Include(l => l.Producto).FirstOrDefaultAsync(l => l.Id == id);
            if (lote == null) return NotFound(new { message = "Lote no encontrado" });
            if (dto.FechaVencimiento == null && lote.Producto?.RequiereCaducidad == true)
                return BadRequest(new { message = $"{lote.Producto.Nombre} es perecedero: el lote necesita fecha de vencimiento" });

            lote.FechaVencimiento = dto.FechaVencimiento?.Date;
            if (!string.IsNullOrWhiteSpace(dto.NumeroLote)) lote.NumeroLote = dto.NumeroLote.Trim();
            // Un lote marcado vencido por error vuelve a estar activo si la fecha nueva no ha pasado.
            if (lote.Estado == "Vencido" && lote.CantidadActual > 0 && (lote.FechaVencimiento == null || lote.FechaVencimiento >= Hoy))
                lote.Estado = "Activo";

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ==================== TRASLADOS ====================

        /// <summary>
        /// Mueve existencias entre almacenes. Los lotes viajan con su fecha de vencimiento
        /// (primero los que vencen antes); lo vencido no se traslada.
        /// </summary>
        [HttpPost("traslados")]
        public async Task<ActionResult<object>> Trasladar([FromBody] TrasladoDto dto)
        {
            if (dto.AlmacenOrigenId == dto.AlmacenDestinoId) return BadRequest(new { message = "El origen y el destino son el mismo almacén" });
            if (dto.Cantidad <= 0) return BadRequest(new { message = "La cantidad debe ser mayor que cero" });

            var producto = await _context.ProductosInventario.FindAsync(dto.ProductoId);
            if (producto == null) return BadRequest(new { message = "El insumo no existe" });
            var almacenes = await _context.Almacenes.Where(a => a.Id == dto.AlmacenOrigenId || a.Id == dto.AlmacenDestinoId).ToDictionaryAsync(a => a.Id);
            if (almacenes.Count != 2) return BadRequest(new { message = "Uno de los almacenes no existe" });

            var origen = await _context.Stock.FirstOrDefaultAsync(s => s.ProductoId == dto.ProductoId && s.AlmacenId == dto.AlmacenOrigenId);
            var vencido = (await LotesInventario.VencidoAsync(_context, new[] { dto.ProductoId })).GetValueOrDefault((dto.ProductoId, dto.AlmacenOrigenId));
            var disponible = Math.Max(0, (origen?.Cantidad ?? 0) - vencido);
            if (origen == null || disponible < dto.Cantidad)
                return BadRequest(new { message = $"En {almacenes[dto.AlmacenOrigenId].Nombre} solo hay {disponible:0.##} {producto.UnidadMedida} sin vencer" });

            var destino = await _context.Stock.FirstOrDefaultAsync(s => s.ProductoId == dto.ProductoId && s.AlmacenId == dto.AlmacenDestinoId);
            if (destino == null)
            {
                destino = new Stock { ProductoId = dto.ProductoId, AlmacenId = dto.AlmacenDestinoId, Cantidad = 0, CostoPromedio = origen.CostoPromedio };
                _context.Stock.Add(destino);
            }
            destino.CostoPromedio = destino.Cantidad > 0
                ? Math.Round((destino.Cantidad * destino.CostoPromedio + dto.Cantidad * origen.CostoPromedio) / (destino.Cantidad + dto.Cantidad), 2)
                : origen.CostoPromedio;
            destino.Cantidad += dto.Cantidad;
            origen.Cantidad -= dto.Cantidad;
            origen.FechaActualizacion = destino.FechaActualizacion = DateTime.UtcNow;

            var hoy = Hoy;
            var lotes = (await _context.Lotes
                    .Where(l => l.ProductoId == dto.ProductoId && l.AlmacenId == dto.AlmacenOrigenId && l.CantidadActual > 0
                                && (l.FechaVencimiento == null || l.FechaVencimiento >= hoy))
                    .ToListAsync())
                .OrderBy(l => l.FechaVencimiento == null).ThenBy(l => l.FechaVencimiento).ThenBy(l => l.FechaIngreso);
            var pendiente = dto.Cantidad;
            foreach (var lote in lotes)
            {
                if (pendiente <= 0) break;
                var mover = Math.Min(pendiente, lote.CantidadActual);
                lote.CantidadActual -= mover;
                if (lote.CantidadActual == 0) lote.Estado = "Agotado";
                _context.Lotes.Add(new Lote
                {
                    ProductoId = lote.ProductoId, AlmacenId = dto.AlmacenDestinoId, NumeroLote = lote.NumeroLote,
                    FechaIngreso = lote.FechaIngreso, FechaVencimiento = lote.FechaVencimiento,
                    CantidadInicial = mover, CantidadActual = mover, CostoUnitario = lote.CostoUnitario, Estado = "Activo"
                });
                pendiente -= mover;
            }

            var motivo = string.IsNullOrWhiteSpace(dto.Motivo) ? null : $" · {dto.Motivo.Trim()}";
            foreach (var (almacenId, texto) in new[]
                     {
                         (dto.AlmacenOrigenId, $"Traslado a {almacenes[dto.AlmacenDestinoId].Nombre}{motivo}"),
                         (dto.AlmacenDestinoId, $"Traslado desde {almacenes[dto.AlmacenOrigenId].Nombre}{motivo}")
                     })
            {
                _context.MovimientosInventario.Add(new MovimientoInventario
                {
                    ProductoId = dto.ProductoId, AlmacenId = almacenId, TipoMovimiento = "Transferencia",
                    Cantidad = dto.Cantidad, CostoUnitario = origen.CostoPromedio, Motivo = texto,
                    Referencia = $"Traslado {hoy:yyyy-MM-dd}", UsuarioId = UsuarioId, Fecha = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = $"Se trasladaron {dto.Cantidad:0.##} {producto.UnidadMedida} de {producto.Nombre} a {almacenes[dto.AlmacenDestinoId].Nombre}" });
        }

        // ==================== CONTEO FÍSICO ====================

        /// <summary>Lo contado reemplaza el stock del almacén; cada diferencia queda como ajuste.</summary>
        [HttpPost("conteos")]
        public async Task<ActionResult<object>> RegistrarConteo([FromBody] ConteoDto dto)
        {
            if (dto.Lineas.Count == 0) return BadRequest(new { message = "No hay insumos contados" });
            if (dto.Lineas.Any(l => l.CantidadContada < 0)) return BadRequest(new { message = "Una cantidad contada no puede ser negativa" });
            if (!await _context.Almacenes.AnyAsync(a => a.Id == dto.AlmacenId))
                return BadRequest(new { message = "El almacén no existe" });

            var ids = dto.Lineas.Select(l => l.ProductoId).Distinct().ToList();
            var productos = await _context.ProductosInventario.Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id);
            if (productos.Count != ids.Count) return BadRequest(new { message = "Uno o más insumos no existen" });

            var diferencias = new List<object>();
            decimal valor = 0;
            foreach (var l in dto.Lineas.GroupBy(x => x.ProductoId).Select(g => g.Last()))
            {
                var stock = await _context.Stock.FirstOrDefaultAsync(s => s.ProductoId == l.ProductoId && s.AlmacenId == dto.AlmacenId);
                var sistema = stock?.Cantidad ?? 0;
                var diferencia = Math.Round(l.CantidadContada - sistema, 2);
                if (diferencia == 0) continue;

                if (stock == null)
                {
                    stock = new Stock { ProductoId = l.ProductoId, AlmacenId = dto.AlmacenId, CostoPromedio = productos[l.ProductoId].PrecioCosto };
                    _context.Stock.Add(stock);
                }
                if (diferencia < 0)
                    await LotesInventario.DescontarAsync(_context, l.ProductoId, dto.AlmacenId, null, Math.Min(-diferencia, Math.Max(sistema, 0)));
                stock.Cantidad = l.CantidadContada;
                stock.FechaActualizacion = DateTime.UtcNow;

                var costo = stock.CostoPromedio > 0 ? stock.CostoPromedio : productos[l.ProductoId].PrecioCosto;
                _context.MovimientosInventario.Add(new MovimientoInventario
                {
                    ProductoId = l.ProductoId,
                    AlmacenId = dto.AlmacenId,
                    TipoMovimiento = "Ajuste",
                    Cantidad = Math.Abs(diferencia),
                    CostoUnitario = costo,
                    Motivo = $"Conteo físico: sistema {sistema:0.##}, contado {l.CantidadContada:0.##} ({(diferencia > 0 ? "+" : "")}{diferencia:0.##})",
                    Referencia = $"Conteo {Hoy:yyyy-MM-dd}",
                    UsuarioId = UsuarioId,
                    Fecha = DateTime.UtcNow
                });

                valor += diferencia * costo;
                diferencias.Add(new { l.ProductoId, Insumo = productos[l.ProductoId].Nombre, Sistema = sistema, Contado = l.CantidadContada, Diferencia = diferencia });
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = diferencias.Count == 0 ? "Todo cuadra con el sistema" : $"{diferencias.Count} ajuste(s) registrados", Diferencias = diferencias, Valor = Math.Round(valor, 0) });
        }

        // ==================== CÁLCULOS ====================

        private static decimal PuntoReorden(ProductoInventario p) => p.PuntoReorden > 0 ? p.PuntoReorden.Value : p.StockMinimo;

        public sealed record EstadoInsumo(
            int Id, string? Codigo, string Nombre, string UnidadMedida, string? Categoria, int? ProveedorId, string? Proveedor,
            decimal Stock, decimal StockMinimo, decimal PuntoReorden, decimal? StockMaximo, decimal Valor, string Estado,
            decimal ConsumoDiario, decimal? DiasCobertura, decimal Pedido, DateTime? ProximoVencimiento, bool RequiereCaducidad, bool Activo,
            decimal PrecioCosto, decimal Vencido);

        /// <summary>
        /// Stock, consumo diario (ventas de los últimos 14 días), cobertura y lo ya pedido de
        /// cada insumo activo. Agotado: sin stock. Bajo: en o bajo el punto de reorden.
        /// </summary>
        private async Task<List<EstadoInsumo>> EstadoInsumosAsync(int? soloId = null)
        {
            var productos = await _context.ProductosInventario
                .Include(p => p.Categoria).Include(p => p.Proveedor)
                .Where(p => soloId == null ? p.Activo : p.Id == soloId)
                .OrderBy(p => p.Nombre)
                .ToListAsync();
            var ids = productos.Select(p => p.Id).ToList();

            var vencido = await LotesInventario.VencidoAsync(_context, ids);
            // Cantidad = lo utilizable (sin vencidos); Valor = todo lo que hay en bodega.
            var stock = (await _context.Stock.Where(s => ids.Contains(s.ProductoId)).ToListAsync())
                .GroupBy(s => s.ProductoId)
                .ToDictionary(g => g.Key, g => (
                    Cantidad: g.Sum(s => Math.Max(0, s.Cantidad - vencido.GetValueOrDefault((s.ProductoId, s.AlmacenId)))),
                    Valor: g.Sum(s => Math.Max(s.Cantidad, 0) * s.CostoPromedio),
                    Vencido: g.Sum(s => Math.Min(Math.Max(s.Cantidad, 0), vencido.GetValueOrDefault((s.ProductoId, s.AlmacenId))))));

            var desde = DateTime.UtcNow.AddDays(-DiasConsumo);
            var consumo = (await _context.MovimientosInventario
                    .Where(m => ids.Contains(m.ProductoId) && m.Fecha >= desde && m.Referencia != null
                                && (m.Referencia.StartsWith("Pedido #") || m.Referencia.StartsWith("Domicilio #") || m.Referencia.StartsWith("Ajuste Pedido #") || m.Referencia.StartsWith("Ajuste Domicilio #")))
                    .Select(m => new { m.ProductoId, m.TipoMovimiento, m.Cantidad })
                    .ToListAsync())
                .GroupBy(m => m.ProductoId)
                .ToDictionary(g => g.Key, g => Math.Max(0, g.Sum(m => m.TipoMovimiento == "Salida" ? m.Cantidad : -m.Cantidad)) / DiasConsumo);

            var pedido = (await _context.DetallesOrdenCompra
                    .Where(d => ids.Contains(d.ProductoId) && EstadosAbiertos.Contains(d.OrdenCompra!.Estado))
                    .Select(d => new { d.ProductoId, Pendiente = d.Cantidad - d.CantidadRecibida })
                    .ToListAsync())
                .GroupBy(d => d.ProductoId)
                .ToDictionary(g => g.Key, g => g.Sum(d => Math.Max(d.Pendiente, 0)));

            var vencimientos = (await _context.Lotes
                    .Where(l => ids.Contains(l.ProductoId) && l.CantidadActual > 0 && l.FechaVencimiento != null)
                    .Select(l => new { l.ProductoId, l.FechaVencimiento })
                    .ToListAsync())
                .GroupBy(l => l.ProductoId)
                .ToDictionary(g => g.Key, g => g.Min(l => l.FechaVencimiento));

            return productos.Select(p =>
            {
                var (cantidad, valor, cantidadVencida) = stock.GetValueOrDefault(p.Id);
                var diario = Math.Round(consumo.GetValueOrDefault(p.Id), 3);
                var punto = PuntoReorden(p);
                var estado = cantidad <= 0 ? "Agotado" : punto > 0 && cantidad <= punto ? "Bajo" : "OK";
                return new EstadoInsumo(
                    p.Id, p.Codigo, p.Nombre, p.UnidadMedida, p.Categoria?.Nombre, p.ProveedorId, p.Proveedor?.Nombre,
                    Math.Round(cantidad, 2), p.StockMinimo, punto, p.StockMaximo, Math.Round(valor, 0), estado,
                    diario, diario > 0 ? Math.Round(cantidad / diario, 1) : null, Math.Round(pedido.GetValueOrDefault(p.Id), 2),
                    vencimientos.GetValueOrDefault(p.Id), p.RequiereCaducidad, p.Activo, p.PrecioCosto, Math.Round(cantidadVencida, 2));
            }).ToList();
        }

        public sealed record LoteVencimiento(
            int Id, int ProductoId, string Insumo, string UnidadMedida, string NumeroLote, int AlmacenId, string Almacen,
            DateTime FechaVencimiento, int DiasParaVencer, decimal CantidadActual, decimal Valor);

        /// <summary>Lotes con existencias que vencen en los próximos días (incluye los ya vencidos), del más urgente al menos.</summary>
        private async Task<List<LoteVencimiento>> LotesConVencimientoAsync(int dias)
        {
            var hoy = Hoy;
            var limite = hoy.AddDays(dias);
            var lotes = await _context.Lotes
                .Where(l => l.CantidadActual > 0 && l.FechaVencimiento != null && l.FechaVencimiento <= limite)
                .Select(l => new { l.Id, l.ProductoId, Insumo = l.Producto.Nombre, l.Producto.UnidadMedida, l.NumeroLote, l.AlmacenId, Almacen = l.Almacen.Nombre, l.FechaVencimiento, l.CantidadActual, l.CostoUnitario })
                .ToListAsync();

            return lotes
                .Select(l => new LoteVencimiento(l.Id, l.ProductoId, l.Insumo, l.UnidadMedida, l.NumeroLote, l.AlmacenId, l.Almacen,
                    l.FechaVencimiento!.Value, (int)(l.FechaVencimiento.Value.Date - hoy).TotalDays, l.CantidadActual,
                    Math.Round(l.CantidadActual * l.CostoUnitario, 0)))
                .OrderBy(l => l.FechaVencimiento)
                .ToList();
        }
    }
}
