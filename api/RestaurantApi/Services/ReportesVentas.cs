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

        /// <summary>
        /// Platos vendidos en mesa en esos cobros: los que llevan la factura (cuenta dividida por
        /// consumo) y, en los cobros anteriores sin platos ligados, todos los de su pedido.
        /// </summary>
        private async Task<List<(PedidoDetalle Detalle, Pedido Pedido, string Cuenta)>> PlatosMesaAsync(List<(Pago Pago, Pedido? Pedido)> pagos)
        {
            var facturaIds = pagos.Where(x => x.Pago.FacturaId != null).Select(x => x.Pago.FacturaId!.Value).Distinct().ToList();
            var detalles = await _ctx.PedidoDetalles.AsNoTracking()
                .Include(d => d.Platillo)
                .Include(d => d.Pedido).ThenInclude(p => p!.Usuario)
                .Where(d => d.FacturaId != null && facturaIds.Contains(d.FacturaId.Value))
                .ToListAsync();
            var lineas = detalles.Where(d => d.Pedido != null).Select(d => (d, d.Pedido!, $"F{d.FacturaId}")).ToList();

            var conPlatos = detalles.Select(d => d.FacturaId!.Value).ToHashSet();
            var sueltos = pagos
                .Where(x => x.Pedido != null && (x.Pago.FacturaId is not { } f || !conPlatos.Contains(f)))
                .DistinctBy(x => (Cuenta(x.Pago), x.Pedido!.Id));
            foreach (var (pago, pedido) in sueltos)
                lineas.AddRange(pedido!.Detalles.Select(d => (d, pedido, Cuenta(pago))));
            return lineas;
        }

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
            cierre.EsHoy = fechaColombia.Date == HoraLocal.AhoraColombia().Date;
            cierre.DomiciliosEnCurso = await _ctx.Domicilios.CountAsync(d => d.Estado == "EnPreparacion" || d.Estado == "Listo" || d.Estado == "Recogido" || d.Estado == "EnCamino");

            // ── Arqueo del cajón ──
            var efectivoMesa = pagos.Where(x => x.Pago.MetodoPago == MetodoPago.Efectivo).ToList();
            cierre.EfectivoMesa = efectivoMesa.Sum(x => x.Pago.Monto + x.Pago.MontoPropina);
            cierre.PropinasEfectivo = efectivoMesa.Sum(x => x.Pago.MontoPropina);
            cierre.EfectivoDomicilios = await _ctx.Domicilios.AsNoTracking()
                .Where(d => d.Estado == "Entregado" && d.MetodoPago == "Efectivo" && !d.PagadoAnticipado
                            && d.FechaLiquidacion >= desde && d.FechaLiquidacion < hasta)
                .SumAsync(d => d.Subtotal + d.CostoEnvio);
            cierre.EfectivoEnDomiciliarios = (await _ctx.Domicilios.AsNoTracking()
                    .Include(d => d.Domiciliario)
                    .Where(d => d.Estado == "Entregado" && d.MetodoPago == "Efectivo" && !d.PagadoAnticipado
                                && d.FechaLiquidacion == null && d.DomiciliarioId != null)
                    .ToListAsync())
                .GroupBy(d => d.DomiciliarioId!.Value)
                .Select(g => new LiquidacionPendienteDto
                {
                    DomiciliarioId = g.Key,
                    Nombre = g.First().Domiciliario?.Nombre ?? $"Domiciliario #{g.Key}",
                    Entregas = g.Count(),
                    Total = g.Sum(d => d.Subtotal + d.CostoEnvio),
                    Domicilios = g.Select(d => d.Id).OrderBy(x => x).ToList()
                })
                .ToList();
            cierre.Tarjeta = cierre.PorMetodo.Where(m => m.Metodo == "Tarjeta").Sum(m => m.Total);
            cierre.Transferencias = cierre.PorMetodo.Where(m => m.Metodo == "Transferencia o QR").Sum(m => m.Total);

            var dia = fechaColombia.Date;
            var registro = await _ctx.CierresCaja.AsNoTracking().FirstOrDefaultAsync(c => c.FechaCaja == dia);
            if (registro != null)
            {
                cierre.Base = registro.Base;
                cierre.BaseRegistrada = registro.FechaApertura != null || registro.FechaCierre != null;
                cierre.PropinasPagadas = registro.PropinasPagadas;
                cierre.Retiros = registro.Retiros;
                cierre.EfectivoContado = registro.EfectivoContado;
                cierre.TarjetaDatafono = registro.TarjetaDatafono;
                cierre.TransferenciasBanco = registro.TransferenciasBanco;
                cierre.Observaciones = registro.Observaciones;
                cierre.Cerrada = registro.FechaCierre != null;
                cierre.FechaCierre = registro.FechaCierre;
                if (registro.UsuarioCierreId is { } quien)
                    cierre.CerradaPor = await _ctx.Usuarios.Where(u => u.Id == quien).Select(u => u.Nombre).FirstOrDefaultAsync();
            }
            cierre.EfectivoEsperado = EfectivoEsperado(cierre);
            cierre.Diferencia = cierre.EfectivoContado - cierre.EfectivoEsperado;
            return cierre;
        }

        /// <summary>Lo que debe haber en el cajón: base + efectivo que entró − efectivo que salió.</summary>
        public static decimal EfectivoEsperado(CierreCajaDto c)
            => c.Base + c.EfectivoMesa + c.EfectivoDomicilios - c.PropinasPagadas - c.Retiros;

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
            var lineas = await PlatosMesaAsync(pagos);
            var platos = lineas.Select(x => (x.Detalle.PlatilloId, x.Detalle.Platillo, x.Detalle.Cantidad, Ingreso: Cuentas.Precio(x.Detalle) * x.Detalle.Cantidad))
                .Concat(domicilios.SelectMany(dm => dm.Detalles.Select(d => (d.PlatilloId, Platillo: (Platillo?)d.Platillo, d.Cantidad, Ingreso: d.PrecioUnitario * d.Cantidad))));
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
            bool EsQr(Pedido p) => p.Usuario?.NombreUsuario == UsuarioQR;
            decimal Valor(PedidoDetalle d) => Cuentas.Precio(d) * d.Cantidad;
            var porMesero = lineas.Where(x => !EsQr(x.Pedido)).ToList();
            var porQr = lineas.Where(x => EsQr(x.Pedido)).ToList();
            r.Canales = new List<CanalVentaDto>
            {
                new() { Canal = "Mesero", Ventas = porMesero.Select(x => x.Cuenta).Distinct().Count(), Total = porMesero.Sum(x => Valor(x.Detalle)) },
                new() { Canal = "QR de la mesa", Ventas = porQr.Select(x => x.Cuenta).Distinct().Count(), Total = porQr.Sum(x => Valor(x.Detalle)) },
                new() { Canal = "Domicilio", Ventas = domicilios.Count, Total = domicilios.Sum(d => d.Subtotal) },
            };

            // Meseros: solo personas; los pedidos del QR no son de ningún mesero. La propina de una
            // cuenta va al mesero del primer pedido cobrado.
            r.Meseros = porMesero
                .GroupBy(x => x.Pedido.UsuarioId)
                .Select(g => new MeseroVentaDto
                {
                    UsuarioId = g.Key,
                    Nombre = g.First().Pedido.Usuario?.Nombre ?? $"Usuario #{g.Key}",
                    Pedidos = g.Select(x => x.Pedido.Id).Distinct().Count(),
                    Mesas = g.Select(x => x.Pedido.MesaId).Distinct().Count(),
                    Ventas = g.Sum(x => Valor(x.Detalle)),
                    Propinas = pagos.Where(x => x.Pedido?.UsuarioId == g.Key).Sum(x => x.Pago.MontoPropina)
                })
                .OrderByDescending(m => m.Ventas)
                .ToList();

            return r;
        }
    }
}
