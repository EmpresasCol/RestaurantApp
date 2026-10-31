using Microsoft.EntityFrameworkCore;
using RestaurantApi.Dtos;
using RestaurantApi.Models;

namespace RestaurantApi.Services
{
    /// <summary>
    /// Cierre de caja y reportes de ventas. Cuentan lo cobrado (fecha del pago o de la entrega del
    /// domicilio), no lo pedido, y cortan los días en hora de Colombia.
    /// </summary>
    public class ReportesVentas
    {
        /// <summary>Usuario genérico al que quedan los pedidos hechos por el comensal desde el QR.</summary>
        public const string UsuarioQR = "cliente_qr";
        public const int MaximoDias = 366;

        private readonly RestauranteContext _ctx;

        public ReportesVentas(RestauranteContext ctx) => _ctx = ctx;

        private static string Dia(DateTime utc) => (utc + HoraLocal.OffsetColombia).ToString("yyyy-MM-dd");

        // Pagos de mesa con su pedido (platos, mesero y mesa).
        private async Task<List<(Pago Pago, Pedido? Pedido)>> PagosAsync(DateTime desde, DateTime hasta)
        {
            var pagos = await _ctx.Pagos.AsNoTracking()
                .Where(p => p.Fecha >= desde && p.Fecha < hasta)
                .ToListAsync();
            var ids = pagos.Select(p => p.PedidoId).Distinct().ToList();
            var pedidos = await _ctx.Pedidos.AsNoTracking()
                .Include(p => p.Usuario)
                .Include(p => p.Mesa)
                .Include(p => p.Detalles).ThenInclude(d => d.Platillo)
                .Where(p => ids.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id);
            return pagos.Select(p => (p, pedidos.GetValueOrDefault(p.PedidoId))).ToList();
        }

        // Domicilios entregados (el cobro ocurre al entregar).
        private Task<List<Domicilio>> DomiciliosAsync(DateTime desde, DateTime hasta) => _ctx.Domicilios.AsNoTracking()
            .Include(d => d.Detalles).ThenInclude(x => x.Platillo)
            .Where(d => d.Estado == "Entregado" && (d.FechaEntrega ?? d.FechaPedido) >= desde && (d.FechaEntrega ?? d.FechaPedido) < hasta)
            .ToListAsync();

        // Una cuenta = una factura (o un pago suelto anterior a las facturas por cuenta).
        private static string Cuenta(Pago p) => p.FacturaId is { } f ? $"F{f}" : $"P{p.Id}";

        private static List<MetodoRecaudoDto> PorMetodo(List<(Pago Pago, Pedido? Pedido)> pagos, List<Domicilio> domicilios)
        {
            var filas = Cuentas.Grupos.ToDictionary(g => g, g => new MetodoRecaudoDto { Metodo = g });
            foreach (var grupo in pagos.GroupBy(x => Cuentas.GrupoMetodo(x.Pago.MetodoPago.ToString())))
            {
                var f = filas[grupo.Key];
                f.Mesa += grupo.Sum(x => x.Pago.Monto);
                f.Propinas += grupo.Sum(x => x.Pago.MontoPropina);
                f.Cobros += grupo.Select(x => Cuenta(x.Pago)).Distinct().Count();
            }
            foreach (var d in domicilios)
            {
                var f = filas[Cuentas.GrupoMetodo(d.MetodoPago)];
                f.Domicilios += d.Total;
                f.Cobros++;
            }
            foreach (var f in filas.Values) f.Total = f.Mesa + f.Propinas + f.Domicilios;
            // El efectivo siempre aparece: es lo que se cuenta en el cajón.
            return filas.Values.Where(f => f.Metodo == "Efectivo" || f.Total > 0).ToList();
        }

        private async Task<(int Cantidad, decimal Valor)> AnuladosAsync(DateTime desde, DateTime hasta)
        {
            var pedidos = await _ctx.Pedidos.AsNoTracking()
                .Include(p => p.Detalles).ThenInclude(d => d.Platillo)
                .Where(p => p.Estado == EstadoPedido.Cancelado && p.Fecha >= desde && p.Fecha < hasta)
                .ToListAsync();
            var domicilios = await _ctx.Domicilios.AsNoTracking()
                .Where(d => d.Estado == "Cancelado" && d.FechaPedido >= desde && d.FechaPedido < hasta)
                .Select(d => d.Total)
                .ToListAsync();
            return (pedidos.Count + domicilios.Count, pedidos.Sum(Cuentas.Consumo) + domicilios.Sum());
        }

        /// <summary>Cuadre de un día: lo recaudado por método, facturas emitidas y lo que quedó pendiente.</summary>
        public async Task<CierreCajaDto> CierreAsync(DateTime fechaColombia)
        {
            var desde = HoraLocal.AUtc(fechaColombia.Date);
            var hasta = desde.AddDays(1);

            var pagos = await PagosAsync(desde, hasta);
            var domicilios = await DomiciliosAsync(desde, hasta);
            var facturas = await _ctx.Facturas.AsNoTracking()
                .Where(f => f.FechaEmision >= desde && f.FechaEmision < hasta)
                .Select(f => f.NumeroFactura)
                .OrderBy(n => n)
                .ToListAsync();
            var (anulados, valorAnulado) = await AnuladosAsync(desde, hasta);

            var abiertos = await _ctx.Pedidos.AsNoTracking()
                .Include(p => p.Detalles).ThenInclude(d => d.Platillo)
                .Where(p => p.Estado != EstadoPedido.Pagado && p.Estado != EstadoPedido.Cancelado)
                .ToListAsync();

            var cierre = new CierreCajaDto
            {
                Fecha = fechaColombia.ToString("yyyy-MM-dd"),
                VentasMesa = pagos.Sum(x => x.Pago.Monto),
                Propinas = pagos.Sum(x => x.Pago.MontoPropina),
                VentasDomicilio = domicilios.Sum(d => d.Subtotal),
                Envios = domicilios.Sum(d => d.CostoEnvio),
                CuentasMesa = pagos.Select(x => Cuenta(x.Pago)).Distinct().Count(),
                Domicilios = domicilios.Count,
                PorMetodo = PorMetodo(pagos, domicilios),
                FacturasEmitidas = facturas.Count,
                PrimeraFactura = facturas.FirstOrDefault(),
                UltimaFactura = facturas.LastOrDefault(),
                PedidosAnulados = anulados,
                ValorAnulado = valorAnulado,
                CuentasAbiertas = abiertos.Select(p => p.MesaId).Distinct().Count(),
                ValorAbierto = abiertos.Sum(Cuentas.Consumo)
            };
            cierre.TotalRecaudado = cierre.VentasMesa + cierre.Propinas + cierre.VentasDomicilio + cierre.Envios;
            return cierre;
        }

        /// <summary>Ventas entre dos días de calendario de Colombia (ambos incluidos).</summary>
        public async Task<ReporteVentasDto> VentasAsync(DateTime desdeColombia, DateTime hastaColombia)
        {
            var desde = HoraLocal.AUtc(desdeColombia.Date);
            var hasta = HoraLocal.AUtc(hastaColombia.Date.AddDays(1));

            var pagos = await PagosAsync(desde, hasta);
            var domicilios = await DomiciliosAsync(desde, hasta);
            var (anulados, valorAnulado) = await AnuladosAsync(desde, hasta);

            var cuentasMesa = pagos.Select(x => Cuenta(x.Pago)).Distinct().Count();
            var r = new ReporteVentasDto
            {
                Desde = desdeColombia.ToString("yyyy-MM-dd"),
                Hasta = hastaColombia.ToString("yyyy-MM-dd"),
                Ventas = pagos.Sum(x => x.Pago.Monto) + domicilios.Sum(d => d.Subtotal),
                Propinas = pagos.Sum(x => x.Pago.MontoPropina),
                Envios = domicilios.Sum(d => d.CostoEnvio),
                NumeroVentas = cuentasMesa + domicilios.Count,
                PedidosAnulados = anulados,
                ValorAnulado = valorAnulado,
                PorMetodo = PorMetodo(pagos, domicilios)
            };
            r.TicketPromedio = r.NumeroVentas > 0 ? Math.Round(r.Ventas / r.NumeroVentas) : 0;

            // Por día: todos los días del rango, también los que no tuvieron ventas.
            var dias = new Dictionary<string, VentaDiaDto>();
            for (var d = desdeColombia.Date; d <= hastaColombia.Date; d = d.AddDays(1))
                dias[d.ToString("yyyy-MM-dd")] = new VentaDiaDto { Fecha = d.ToString("yyyy-MM-dd") };
            foreach (var g in pagos.GroupBy(x => Dia(x.Pago.Fecha)))
            {
                if (!dias.TryGetValue(g.Key, out var dia)) continue;
                dia.Mesa += g.Sum(x => x.Pago.Monto);
                dia.Ventas += g.Select(x => Cuenta(x.Pago)).Distinct().Count();
            }
            foreach (var g in domicilios.GroupBy(d => Dia(d.FechaEntrega ?? d.FechaPedido)))
            {
                if (!dias.TryGetValue(g.Key, out var dia)) continue;
                dia.Domicilios += g.Sum(d => d.Subtotal);
                dia.Ventas += g.Count();
            }
            foreach (var dia in dias.Values) dia.Total = dia.Mesa + dia.Domicilios;
            r.PorDia = dias.Values.ToList();

            // Horas pico (hora local).
            var horas = Enumerable.Range(0, 24).Select(h => new VentaHoraDto { Hora = h }).ToList();
            foreach (var g in pagos.GroupBy(x => (x.Pago.Fecha + HoraLocal.OffsetColombia).Hour))
            {
                horas[g.Key].Total += g.Sum(x => x.Pago.Monto);
                horas[g.Key].Ventas += g.Select(x => Cuenta(x.Pago)).Distinct().Count();
            }
            foreach (var g in domicilios.GroupBy(d => ((d.FechaEntrega ?? d.FechaPedido) + HoraLocal.OffsetColombia).Hour))
            {
                horas[g.Key].Total += g.Sum(d => d.Subtotal);
                horas[g.Key].Ventas += g.Count();
            }
            r.PorHora = horas;

            // Platos vendidos con el precio con que se vendieron.
            var platos = pagos.Where(x => x.Pedido != null)
                .SelectMany(x => x.Pedido!.Detalles.Select(d => (d.PlatilloId, d.Platillo, d.Cantidad, Ingreso: Cuentas.Precio(d) * d.Cantidad)))
                .Concat(domicilios.SelectMany(dm => dm.Detalles.Select(d => (d.PlatilloId, d.Platillo, d.Cantidad, Ingreso: d.PrecioUnitario * d.Cantidad))));
            r.Platillos = platos.GroupBy(x => x.PlatilloId)
                .Select(g => new PlatilloVendidoDto
                {
                    PlatilloId = g.Key,
                    Nombre = g.Select(x => x.Platillo?.Nombre).FirstOrDefault(n => n != null) ?? $"Platillo #{g.Key}",
                    Categoria = g.Select(x => x.Platillo?.Categoria).FirstOrDefault(c => c != null) ?? "",
                    Cantidad = g.Sum(x => x.Cantidad),
                    Ingresos = g.Sum(x => x.Ingreso)
                })
                .OrderByDescending(p => p.Cantidad).ThenByDescending(p => p.Ingresos)
                .ToList();

            // Canales: mesero (app), comensal por QR y domicilio.
            var mesa = pagos.Where(x => x.Pedido != null).ToList();
            bool EsQr((Pago Pago, Pedido? Pedido) x) => x.Pedido!.Usuario?.NombreUsuario == UsuarioQR;
            r.Canales = new List<CanalVentaDto>
            {
                new() { Canal = "Mesero", Ventas = mesa.Count(x => !EsQr(x)), Total = mesa.Where(x => !EsQr(x)).Sum(x => x.Pago.Monto) },
                new() { Canal = "QR de la mesa", Ventas = mesa.Count(EsQr), Total = mesa.Where(EsQr).Sum(x => x.Pago.Monto) },
                new() { Canal = "Domicilio", Ventas = domicilios.Count, Total = domicilios.Sum(d => d.Subtotal) },
            };

            // Meseros: solo personas; los pedidos del QR no son de ningún mesero.
            r.Meseros = mesa.Where(x => !EsQr(x))
                .GroupBy(x => x.Pedido!.UsuarioId)
                .Select(g => new MeseroVentaDto
                {
                    UsuarioId = g.Key,
                    Nombre = g.First().Pedido!.Usuario?.Nombre ?? $"Usuario #{g.Key}",
                    Pedidos = g.Count(),
                    Mesas = g.Select(x => x.Pedido!.MesaId).Distinct().Count(),
                    Ventas = g.Sum(x => x.Pago.Monto),
                    Propinas = g.Sum(x => x.Pago.MontoPropina)
                })
                .OrderByDescending(m => m.Ventas)
                .ToList();

            return r;
        }
    }
}
