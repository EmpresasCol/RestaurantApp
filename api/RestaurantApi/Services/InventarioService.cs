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
    /// <summary>
    /// Descuento automático de inventario por recetas.
    ///
    /// Cada sincronización compara el consumo que DEBERÍA tener un pedido (recetas × cantidades
    /// actuales) con el consumo neto ya registrado en MovimientosInventario y aplica solo la
    /// diferencia. Así, editar cantidades, quitar platos, recrear detalles o cancelar deja el
    /// stock correcto y llamar varias veces no duplica nada.
    ///
    /// Los movimientos de un pedido se identifican por prefijo exacto con separador
    /// ("Pedido #1 - ", "Ajuste Pedido #1 - "): "Pedido #1 - " no coincide con "Pedido #10 - ".
    /// </summary>
    public class InventarioService : IInventarioService
    {
        private readonly RestauranteContext _context;
        private readonly ILogger<InventarioService> _logger;

        public InventarioService(RestauranteContext context, ILogger<InventarioService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>Origen de los movimientos (pedido en mesa o domicilio).</summary>
        private sealed record Origen(string Tipo, int Id, int UsuarioId)
        {
            public string PrefijoVenta => $"{Tipo} #{Id} - ";
            public string PrefijoAjuste => $"Ajuste {Tipo} #{Id} - ";
            // Formatos usados por versiones anteriores del servicio.
            public string ReferenciaLegacy => $"{Tipo} #{Id}";
            public string PrefijoCancelacionLegacy => Tipo == "Pedido" ? $"Cancelación #{Id} - " : $"Cancelación Domicilio #{Id} - ";
        }

        public Task<ResultadoInventarioDto> DescontarStockPorPedidoAsync(int pedidoId)
            => SincronizarPedidoAsync(pedidoId, cancelar: false);

        public Task<ResultadoInventarioDto> RevertirStockPorPedidoAsync(int pedidoId)
            => SincronizarPedidoAsync(pedidoId, cancelar: true);

        public Task<ResultadoInventarioDto> DescontarStockPorDomicilioAsync(int domicilioId)
            => SincronizarDomicilioAsync(domicilioId, cancelar: false);

        public Task<ResultadoInventarioDto> RevertirStockPorDomicilioAsync(int domicilioId)
            => SincronizarDomicilioAsync(domicilioId, cancelar: true);

        private async Task<ResultadoInventarioDto> SincronizarPedidoAsync(int pedidoId, bool cancelar)
        {
            var pedido = await _context.Pedidos
                .Include(p => p.Detalles)
                .FirstOrDefaultAsync(p => p.Id == pedidoId);

            if (pedido == null)
                return new ResultadoInventarioDto { Exitoso = false, Mensaje = "Pedido no encontrado." };

            var lineas = cancelar || pedido.Estado == EstadoPedido.Cancelado
                ? new List<(int, int)>()
                : pedido.Detalles.Select(d => (d.PlatilloId, d.Cantidad)).ToList();

            return await SincronizarAsync(new Origen("Pedido", pedidoId, pedido.UsuarioId), lineas, exigirDetalles: !cancelar);
        }

        private async Task<ResultadoInventarioDto> SincronizarDomicilioAsync(int domicilioId, bool cancelar)
        {
            var domicilio = await _context.Domicilios
                .Include(d => d.Detalles)
                .FirstOrDefaultAsync(d => d.Id == domicilioId);

            if (domicilio == null)
                return new ResultadoInventarioDto { Exitoso = false, Mensaje = "Domicilio no encontrado." };

            var lineas = cancelar || domicilio.Estado == "Cancelado"
                ? new List<(int, int)>()
                : domicilio.Detalles.Select(d => (d.PlatilloId, d.Cantidad)).ToList();

            return await SincronizarAsync(new Origen("Domicilio", domicilioId, domicilio.UsuarioCreadorId), lineas, exigirDetalles: !cancelar);
        }

        private async Task<ResultadoInventarioDto> SincronizarAsync(Origen origen, List<(int PlatilloId, int Cantidad)> lineas, bool exigirDetalles)
        {
            try
            {
                var deseado = await ConsumoDeseadoAsync(lineas);

                var movimientos = await MovimientosDeAsync(origen);

                if (exigirDetalles && lineas.Count == 0 && movimientos.Count == 0)
                {
                    _logger.LogWarning("⚠️ {Tipo} #{Id} sin detalles: no hay inventario que descontar.", origen.Tipo, origen.Id);
                    return new ResultadoInventarioDto { Exitoso = false, Mensaje = $"{origen.Tipo} sin detalles." };
                }

                // Consumo neto ya registrado por (producto, almacén, lote): salidas − entradas.
                var neto = movimientos
                    .GroupBy(m => (m.ProductoId, m.AlmacenId, m.LoteId))
                    .ToDictionary(g => g.Key, g => g.Sum(m => m.TipoMovimiento == "Salida" ? m.Cantidad : -m.Cantidad));

                var productos = deseado.Keys.Union(neto.Keys.Select(k => k.ProductoId)).ToList();
                var almacenConsumoId = await AlmacenConsumoIdAsync();
                var faltantes = new List<(int ProductoId, decimal Cantidad)>();
                int generados = 0;

                foreach (var productoId in productos)
                {
                    var objetivo = deseado.GetValueOrDefault(productoId);
                    var actual = neto.Where(kv => kv.Key.ProductoId == productoId).Sum(kv => kv.Value);
                    // Las cantidades se guardan con 2 decimales: comparar al centésimo evita oscilaciones.
                    var diferencia = Math.Round(objetivo - actual, 2);

                    if (diferencia > 0)
                    {
                        var (movs, faltante) = await DescontarAsync(origen, productoId, diferencia, almacenConsumoId);
                        generados += movs;
                        if (faltante > 0) faltantes.Add((productoId, faltante));
                    }
                    else if (diferencia < 0)
                    {
                        generados += await DevolverAsync(origen, productoId, -diferencia, neto);
                    }
                }

                if (generados > 0)
                    await _context.SaveChangesAsync();

                await RegistrarFaltantesAsync(origen, faltantes, almacenConsumoId);

                if (generados > 0)
                    _logger.LogInformation("📦 Inventario sincronizado para {Tipo} #{Id}. Movimientos: {Count}", origen.Tipo, origen.Id, generados);

                return new ResultadoInventarioDto
                {
                    Exitoso = true,
                    Mensaje = generados > 0
                        ? $"Se generaron {generados} movimientos de inventario."
                        : "El inventario ya estaba sincronizado.",
                    MovimientosGenerados = generados
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error al sincronizar inventario para {Tipo} #{Id}", origen.Tipo, origen.Id);
                return new ResultadoInventarioDto { Exitoso = false, Mensaje = "Error al sincronizar el inventario." };
            }
        }

        /// <summary>
        /// Cantidad de cada insumo que corresponde a las líneas, según las recetas.
        /// Un platillo sin receta solo descuenta un producto cuyo nombre sea EXACTAMENTE igual
        /// (p. ej. bebidas embotelladas); nunca por coincidencia parcial ("Pan" ≠ "Panna Cotta").
        /// </summary>
        private async Task<Dictionary<int, decimal>> ConsumoDeseadoAsync(List<(int PlatilloId, int Cantidad)> lineas, bool soloObligatorios = false)
        {
            var porPlatillo = lineas
                .Where(l => l.PlatilloId > 0 && l.Cantidad > 0)
                .GroupBy(l => l.PlatilloId)
                .ToDictionary(g => g.Key, g => g.Sum(l => l.Cantidad));

            var resultado = new Dictionary<int, decimal>();
            if (porPlatillo.Count == 0) return resultado;

            var insumos = await InsumosPorPlatilloAsync(porPlatillo.Keys.ToList(), soloObligatorios);
            foreach (var (platilloId, lista) in insumos)
                foreach (var (productoId, cantidad) in lista)
                    resultado[productoId] = resultado.GetValueOrDefault(productoId) + cantidad * porPlatillo[platilloId];

            foreach (var k in resultado.Keys.ToList())
                resultado[k] = Math.Round(resultado[k], 2);
            return resultado;
        }

        /// <summary>
        /// Insumos que gasta UNA porción de cada platillo: su receta o, si no tiene, el producto
        /// de nombre idéntico (1 unidad). Un platillo sin receta ni producto queda sin entrada.
        /// </summary>
        private async Task<Dictionary<int, List<(int ProductoId, decimal Cantidad)>>> InsumosPorPlatilloAsync(
            List<int>? platilloIds, bool soloObligatorios)
        {
            var recetas = await _context.Recetas
                .Where(r => (platilloIds == null || platilloIds.Contains(r.PlatilloId)) && (!soloObligatorios || !r.Opcional))
                .ToListAsync();

            var resultado = recetas
                .GroupBy(r => r.PlatilloId)
                .ToDictionary(g => g.Key, g => g.Select(r => (r.ProductoId, r.CantidadRequerida)).ToList());

            // Con receta (aunque solo tenga insumos opcionales) no se busca producto homónimo.
            var conReceta = soloObligatorios
                ? (await _context.Recetas.Where(r => platilloIds == null || platilloIds.Contains(r.PlatilloId))
                      .Select(r => r.PlatilloId).Distinct().ToListAsync()).ToHashSet()
                : resultado.Keys.ToHashSet();

            var sinReceta = await _context.Platillos
                .Where(p => (platilloIds == null || platilloIds.Contains(p.Id)))
                .ToListAsync();
            sinReceta = sinReceta.Where(p => !conReceta.Contains(p.Id)).ToList();

            if (sinReceta.Count > 0)
            {
                var productos = await _context.ProductosInventario.ToListAsync();
                foreach (var platillo in sinReceta)
                {
                    var nombre = NormalizarTexto(platillo.Nombre);
                    var producto = productos.FirstOrDefault(p => NormalizarTexto(p.Nombre) == nombre);
                    if (producto != null)
                        resultado[platillo.Id] = new List<(int, decimal)> { (producto.Id, 1m) };
                    else
                        _logger.LogDebug("ℹ️ Platillo '{Platillo}' no tiene receta configurada.", platillo.Nombre);
                }
            }

            return resultado;
        }

        /// <summary>
        /// Existencias utilizables (todos los almacenes) por producto: sin lo vencido.
        /// Un producto inactivo cuenta como 0.
        /// </summary>
        private async Task<Dictionary<int, decimal>> ExistenciasAsync()
        {
            var activos = await _context.ProductosInventario.Where(p => p.Activo).Select(p => p.Id).ToListAsync();
            var stock = await _context.Stock
                .Where(s => activos.Contains(s.ProductoId) && s.Cantidad > 0)
                .Select(s => new { s.ProductoId, s.AlmacenId, s.Cantidad })
                .ToListAsync();
            var vencido = await LotesInventario.VencidoAsync(_context, activos);
            return stock
                .GroupBy(s => s.ProductoId)
                .ToDictionary(g => g.Key, g => g.Sum(s => Math.Max(0, s.Cantidad - vencido.GetValueOrDefault((s.ProductoId, s.AlmacenId)))));
        }

        public async Task<Dictionary<int, int?>> PorcionesDisponiblesAsync()
        {
            var insumos = await InsumosPorPlatilloAsync(null, soloObligatorios: true);
            var existencias = await ExistenciasAsync();
            var ids = await _context.Platillos.Select(p => p.Id).ToListAsync();

            return ids.ToDictionary(id => id, id => insumos.TryGetValue(id, out var lista) && lista.Count > 0
                ? (int?)lista.Min(i => i.Cantidad > 0 ? (int)Math.Floor(existencias.GetValueOrDefault(i.ProductoId) / i.Cantidad) : int.MaxValue)
                : null);
        }

        public Task<string?> VerificarStockPedidoAsync(int pedidoId, IEnumerable<(int PlatilloId, int Cantidad)> lineas)
            => VerificarStockAsync(new Origen("Pedido", pedidoId, 0), lineas.ToList());

        public Task<string?> VerificarStockDomicilioAsync(int domicilioId, IEnumerable<(int PlatilloId, int Cantidad)> lineas)
            => VerificarStockAsync(new Origen("Domicilio", domicilioId, 0), lineas.ToList());

        /// <summary>
        /// Comprueba que haya insumos para las líneas antes de guardarlas. Lo que ese mismo
        /// pedido ya consumió cuenta como disponible (al editar solo se pide la diferencia).
        /// Devuelve el mensaje de error o null si alcanza.
        /// </summary>
        private async Task<string?> VerificarStockAsync(Origen origen, List<(int PlatilloId, int Cantidad)> lineas)
        {
            var deseado = await ConsumoDeseadoAsync(lineas, soloObligatorios: true);
            if (deseado.Count == 0) return null;

            var yaConsumido = origen.Id > 0
                ? (await MovimientosDeAsync(origen))
                    .GroupBy(m => m.ProductoId)
                    .ToDictionary(g => g.Key, g => g.Sum(m => m.TipoMovimiento == "Salida" ? m.Cantidad : -m.Cantidad))
                : new Dictionary<int, decimal>();
            var existencias = await ExistenciasAsync();

            var faltan = deseado
                .Where(kv => kv.Value - Math.Max(0, yaConsumido.GetValueOrDefault(kv.Key)) > existencias.GetValueOrDefault(kv.Key))
                .Select(kv => kv.Key)
                .ToHashSet();
            if (faltan.Count == 0) return null;

            var ids = lineas.Select(l => l.PlatilloId).Distinct().ToList();
            var insumos = await InsumosPorPlatilloAsync(ids, soloObligatorios: true);
            var afectados = insumos.Where(kv => kv.Value.Any(i => faltan.Contains(i.ProductoId))).Select(kv => kv.Key).ToList();
            var nombres = await _context.Platillos.Where(p => afectados.Contains(p.Id)).Select(p => p.Nombre).ToListAsync();

            return $"Platillo no disponible por el momento: {string.Join(", ", nombres)}. No hay ingredientes suficientes.";
        }

        private Task<List<MovimientoInventario>> MovimientosDeAsync(Origen origen) => _context.MovimientosInventario
            .Where(m => m.Referencia != null &&
                        (m.Referencia == origen.ReferenciaLegacy
                         || m.Referencia.StartsWith(origen.PrefijoVenta)
                         || m.Referencia.StartsWith(origen.PrefijoAjuste)
                         || m.Referencia.StartsWith(origen.PrefijoCancelacionLegacy)))
            .ToListAsync();

        /// <summary>
        /// Saca la cantidad del stock existente (primero el almacén de consumo, luego el resto)
        /// y de los lotes por FIFO. Nunca deja existencias negativas: lo que no alcanza se
        /// devuelve como faltante para alertar.
        /// </summary>
        private async Task<(int Movimientos, decimal Faltante)> DescontarAsync(Origen origen, int productoId, decimal cantidad, int almacenConsumoId)
        {
            var stocks = (await _context.Stock.Where(s => s.ProductoId == productoId).ToListAsync())
                .OrderByDescending(s => s.AlmacenId == almacenConsumoId)
                .ThenByDescending(s => s.Cantidad)
                .ToList();

            var producto = await _context.ProductosInventario.FindAsync(productoId);
            var vencido = await LotesInventario.VencidoAsync(_context, new[] { productoId });
            var hoy = HoraLocal.AhoraColombia().Date;
            var restante = cantidad;
            int movimientos = 0;

            foreach (var stock in stocks)
            {
                if (restante <= 0) break;
                // Lo vencido no se gasta en recetas: queda para darlo de baja.
                var utilizable = stock.Cantidad - vencido.GetValueOrDefault((productoId, stock.AlmacenId));
                if (utilizable <= 0) continue;

                var tomar = Math.Min(restante, utilizable);
                stock.Cantidad -= tomar;
                stock.FechaActualizacion = DateTime.UtcNow;
                restante -= tomar;

                var costoStock = stock.CostoPromedio > 0 ? stock.CostoPromedio : producto?.PrecioCosto ?? 0;
                var lotes = await _context.Lotes
                    .Where(l => l.ProductoId == productoId && l.AlmacenId == stock.AlmacenId && l.CantidadActual > 0
                                && (l.FechaVencimiento == null || l.FechaVencimiento >= hoy))
                    .OrderBy(l => l.FechaVencimiento == null)
                    .ThenBy(l => l.FechaVencimiento)
                    .ThenBy(l => l.FechaIngreso)
                    .ToListAsync();

                var pendiente = tomar;
                foreach (var lote in lotes)
                {
                    if (pendiente <= 0) break;
                    var deLote = Math.Min(pendiente, lote.CantidadActual);
                    lote.CantidadActual -= deLote;
                    pendiente -= deLote;
                    AgregarMovimiento(origen, productoId, stock.AlmacenId, lote.Id, deLote, salida: true,
                        lote.CostoUnitario > 0 ? lote.CostoUnitario : costoStock);
                    movimientos++;
                }

                if (pendiente > 0)
                {
                    AgregarMovimiento(origen, productoId, stock.AlmacenId, null, pendiente, salida: true, costoStock);
                    movimientos++;
                }
            }

            return (movimientos, Math.Max(0, restante));
        }

        /// <summary>Devuelve al stock (y al lote) de donde salió, hasta lo consumido en cada uno.</summary>
        private async Task<int> DevolverAsync(Origen origen, int productoId, decimal cantidad,
            Dictionary<(int ProductoId, int AlmacenId, int? LoteId), decimal> neto)
        {
            var restante = cantidad;
            int movimientos = 0;

            foreach (var (clave, consumido) in neto.Where(kv => kv.Key.ProductoId == productoId && kv.Value > 0).ToList())
            {
                if (restante <= 0) break;
                var devolver = Math.Min(restante, consumido);

                var stock = await _context.Stock.FirstOrDefaultAsync(s => s.ProductoId == productoId && s.AlmacenId == clave.AlmacenId);
                if (stock == null)
                {
                    stock = new Stock { ProductoId = productoId, AlmacenId = clave.AlmacenId, Cantidad = 0 };
                    _context.Stock.Add(stock);
                }
                stock.Cantidad += devolver;
                stock.FechaActualizacion = DateTime.UtcNow;

                if (clave.LoteId.HasValue)
                {
                    var lote = await _context.Lotes.FindAsync(clave.LoteId.Value);
                    if (lote != null) lote.CantidadActual += devolver;
                }

                AgregarMovimiento(origen, productoId, clave.AlmacenId, clave.LoteId, devolver, salida: false, stock.CostoPromedio);
                restante -= devolver;
                movimientos++;
            }

            return movimientos;
        }

        private void AgregarMovimiento(Origen origen, int productoId, int almacenId, int? loteId, decimal cantidad, bool salida, decimal costoUnitario)
        {
            // CostoTotal es columna GENERADA en MySQL; UsuarioId es NOT NULL (1 = Admin como respaldo).
            _context.MovimientosInventario.Add(new MovimientoInventario
            {
                ProductoId = productoId,
                AlmacenId = almacenId,
                LoteId = loteId,
                TipoMovimiento = salida ? "Salida" : "Entrada",
                Cantidad = cantidad,
                CostoUnitario = costoUnitario,
                Motivo = salida ? $"Venta {origen.Tipo} #{origen.Id}" : $"Devolución por ajuste/cancelación de {origen.Tipo} #{origen.Id}",
                Referencia = (salida ? origen.PrefijoVenta : origen.PrefijoAjuste) + $"Producto #{productoId}",
                UsuarioId = origen.UsuarioId > 0 ? origen.UsuarioId : 1,
                Fecha = DateTime.UtcNow
            });
        }

        /// <summary>
        /// Registra una alerta crítica por cada insumo que no alcanzó (una por pedido y producto).
        /// Se guarda aparte: si la alerta falla, el descuento ya aplicado se conserva.
        /// </summary>
        private async Task RegistrarFaltantesAsync(Origen origen, List<(int ProductoId, decimal Cantidad)> faltantes, int almacenId)
        {
            if (faltantes.Count == 0) return;
            try
            {
                foreach (var (productoId, cantidad) in faltantes)
                {
                    var encabezado = $"Stock insuficiente para {origen.Tipo} #{origen.Id}:";
                    var existe = await _context.AlertasInventario
                        .AnyAsync(a => !a.Leida && a.ProductoId == productoId && a.Mensaje.StartsWith(encabezado));
                    if (existe) continue;

                    _context.AlertasInventario.Add(new AlertaInventario
                    {
                        TipoAlerta = TipoAlerta.StockCritico,
                        Nivel = NivelAlerta.Critico,
                        ProductoId = productoId,
                        AlmacenId = almacenId,
                        Mensaje = $"{encabezado} faltaron {cantidad:0.##} unidades. Verifique el inventario físico.",
                        FechaGeneracion = DateTime.UtcNow
                    });
                }
                await _context.SaveChangesAsync();
                _logger.LogWarning("⚠️ {Tipo} #{Id}: stock insuficiente en {Count} insumos.", origen.Tipo, origen.Id, faltantes.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "No se pudo registrar la alerta de stock insuficiente para {Tipo} #{Id}", origen.Tipo, origen.Id);
            }
        }

        private async Task<int> AlmacenConsumoIdAsync()
        {
            var almacen = await _context.Almacenes
                .FirstOrDefaultAsync(a => a.Tipo == "Cocina" || a.Nombre.Contains("Cocina") || a.Nombre.Contains("Principal"))
                ?? await _context.Almacenes.FirstOrDefaultAsync();
            return almacen?.Id ?? 1;
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
        /// Se ejecuta solo al arrancar la API.
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
                var platillo = platillos.FirstOrDefault(p => NormalizarTexto(p.Nombre) == targetPlatilloNorm);

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
