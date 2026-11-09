using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Dtos;
using RestaurantApi.Models;

namespace RestaurantApi.Services
{
    /// <summary>Consecutivo, datos del cliente y detalle de las facturas de caja.</summary>
    public static class Facturacion
    {
        // Consecutivo propio: FV-00000001, FV-00000002… (las facturas antiguas "FAC-…" se conservan).
        public const string PrefijoConsecutivo = "FV-";
        public const string NitConsumidorFinal = "222222222222";
        public const string NombreConsumidorFinal = "Consumidor final";

        /// <summary>Cédula o NIT: dígitos, con guion opcional antes del dígito de verificación.</summary>
        public static string? ValidarCliente(string? nit, string? nombre)
        {
            if (!string.IsNullOrWhiteSpace(nit) && !Regex.IsMatch(nit.Trim(), @"^\d{5,15}(-\d)?$"))
                return "La cédula o NIT solo lleva números (y un guion antes del dígito de verificación)";
            if (nombre?.Trim().Length > 150)
                return "El nombre del cliente admite máximo 150 caracteres";
            return null;
        }

        public static void AsignarCliente(Factura f, string? nit, string? nombre)
        {
            f.NitCliente = string.IsNullOrWhiteSpace(nit) ? NitConsumidorFinal : nit.Trim();
            f.NombreCliente = string.IsNullOrWhiteSpace(nombre) ? NombreConsumidorFinal : nombre.Trim();
        }

        /// <summary>Guarda la factura con el siguiente consecutivo; si dos cajas chocan, reintenta.</summary>
        public static async Task EmitirAsync(RestauranteContext ctx, Factura factura)
        {
            for (var intento = 0; ; intento++)
            {
                factura.NumeroFactura = await SiguienteNumeroAsync(ctx);
                ctx.Facturas.Add(factura);
                try
                {
                    await ctx.SaveChangesAsync();
                    return;
                }
                catch (DbUpdateException) when (intento < 2)
                {
                    ctx.Entry(factura).State = EntityState.Detached;
                }
            }
        }

        private static async Task<string> SiguienteNumeroAsync(RestauranteContext ctx)
        {
            // Ancho fijo: el orden alfabético coincide con el numérico.
            var ultimo = await ctx.Facturas
                .Where(f => f.NumeroFactura.StartsWith(PrefijoConsecutivo))
                .OrderByDescending(f => f.NumeroFactura)
                .Select(f => f.NumeroFactura)
                .FirstOrDefaultAsync();

            var n = ultimo != null && int.TryParse(ultimo[PrefijoConsecutivo.Length..], out var actual) ? actual + 1 : 1;
            return $"{PrefijoConsecutivo}{n:D8}";
        }

        /// <summary>
        /// Factura del domicilio: se emite al entregarlo y cobrarlo, a nombre del cliente.
        /// Si ya existe (se marcó entregado dos veces), devuelve la misma.
        /// </summary>
        public static async Task<Factura> EmitirDomicilioAsync(RestauranteContext ctx, Domicilio d, string nombreCliente)
        {
            var existente = await ctx.Facturas.FirstOrDefaultAsync(f => f.DomicilioId == d.Id);
            if (existente != null) return existente;

            var factura = new Factura
            {
                DomicilioId = d.Id,
                Subtotal = d.Subtotal + d.CostoEnvio,
                Propina = 0,
                Total = d.Subtotal + d.CostoEnvio,
                FechaEmision = d.FechaEntrega ?? DateTime.UtcNow
            };
            AsignarCliente(factura, null, nombreCliente);
            await EmitirAsync(ctx, factura);
            return factura;
        }

        /// <summary>
        /// Facturas con sus platos, mesa y pagos. Los platos de una cuenta de mesa llevan su FacturaId;
        /// las facturas anteriores a la cuenta dividida se reconstruyen con los pedidos de sus pagos.
        /// </summary>
        public static async Task<List<FacturaDto>> ConDetalleAsync(RestauranteContext ctx, List<Factura> facturas)
        {
            var ids = facturas.Select(f => f.Id).ToList();
            var pagoIds = facturas.Where(f => f.PagoId != null).Select(f => f.PagoId!.Value).ToList();
            var pagos = await ctx.Pagos.AsNoTracking()
                .Where(p => (p.FacturaId != null && ids.Contains(p.FacturaId.Value)) || pagoIds.Contains(p.Id))
                .ToListAsync();
            var detalles = await ctx.PedidoDetalles.AsNoTracking()
                .Include(d => d.Platillo)
                .Include(d => d.Pedido).ThenInclude(p => p!.Mesa)
                .Where(d => d.FacturaId != null && ids.Contains(d.FacturaId.Value))
                .ToListAsync();
            var pedidoIds = pagos.Select(p => p.PedidoId).Distinct().ToList();
            var pedidos = await ctx.Pedidos.AsNoTracking()
                .Include(p => p.Mesa)
                .Include(p => p.Detalles).ThenInclude(d => d.Platillo)
                .Where(p => pedidoIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id);
            var domicilioIds = facturas.Where(f => f.DomicilioId != null).Select(f => f.DomicilioId!.Value).ToList();
            var domicilios = await ctx.Domicilios.AsNoTracking()
                .Include(d => d.Cliente)
                .Include(d => d.Direccion)
                .Include(d => d.Detalles).ThenInclude(x => x.Platillo)
                .Where(d => domicilioIds.Contains(d.Id))
                .ToDictionaryAsync(d => d.Id);

            return facturas.Select(f =>
            {
                var dto = new FacturaDto
                {
                    Id = f.Id,
                    PagoId = f.PagoId,
                    DomicilioId = f.DomicilioId,
                    NumeroFactura = f.NumeroFactura,
                    NitCliente = f.NitCliente,
                    NombreCliente = f.NombreCliente,
                    Subtotal = f.Subtotal,
                    Propina = f.Propina,
                    Total = f.Total,
                    ArchivoUrl = f.ArchivoUrl,
                    FechaEmision = f.FechaEmision
                };

                if (f.DomicilioId is { } domicilioId && domicilios.TryGetValue(domicilioId, out var dom))
                {
                    dto.Domicilio = $"Domicilio #{dom.Id} · {dom.Cliente?.Nombre} · {dom.Direccion?.DireccionCompleta}";
                    dto.MetodoPago = dom.MetodoPago;
                    dto.Pagos = new List<FacturaPagoDto> { new() { MetodoPago = dom.MetodoPago, Monto = f.Total } };
                    dto.Items = dom.Detalles
                        .GroupBy(d => new { d.PlatilloId, d.PrecioUnitario })
                        .Select(g => new FacturaItemDto
                        {
                            Nombre = g.First().Platillo?.Nombre ?? "Plato",
                            Cantidad = g.Sum(d => d.Cantidad),
                            PrecioUnitario = g.Key.PrecioUnitario,
                            Total = g.Key.PrecioUnitario * g.Sum(d => d.Cantidad)
                        })
                        .OrderBy(i => i.Nombre)
                        .ToList();
                    if (dom.CostoEnvio > 0)
                        dto.Items.Add(new FacturaItemDto { Nombre = "Envío a domicilio", Cantidad = 1, PrecioUnitario = dom.CostoEnvio, Total = dom.CostoEnvio });
                    return dto;
                }

                var suyos = pagos.Where(p => p.FacturaId == f.Id || p.Id == f.PagoId).DistinctBy(p => p.Id).OrderBy(p => p.Id).ToList();
                var platos = detalles.Where(d => d.FacturaId == f.Id).ToList();
                if (platos.Count == 0)
                    platos = suyos.Select(p => pedidos.GetValueOrDefault(p.PedidoId)).OfType<Pedido>()
                        .DistinctBy(p => p.Id).SelectMany(p => p.Detalles).ToList();

                dto.MesaNumero = platos.Select(d => d.Pedido?.Mesa?.Numero).FirstOrDefault(n => n != null)
                                 ?? suyos.Select(p => pedidos.GetValueOrDefault(p.PedidoId)?.Mesa?.Numero).FirstOrDefault(n => n != null);
                dto.MetodoPago = string.Join(" + ", suyos.Select(p => p.MetodoPago.ToString()).Distinct());
                dto.Pagos = suyos.Select(p => new FacturaPagoDto { MetodoPago = p.MetodoPago.ToString(), Monto = p.Monto + p.MontoPropina }).ToList();
                dto.PedidoIds = platos.Select(d => d.PedidoId).Distinct().OrderBy(x => x).ToList();
                // El mismo plato al mismo precio en varios pedidos va en una sola línea.
                dto.Items = platos
                    .GroupBy(d => new { d.PlatilloId, Precio = Cuentas.Precio(d) })
                    .Select(g => new FacturaItemDto
                    {
                        Nombre = g.First().Platillo?.Nombre ?? "Plato",
                        Cantidad = g.Sum(d => d.Cantidad),
                        PrecioUnitario = g.Key.Precio,
                        Total = g.Key.Precio * g.Sum(d => d.Cantidad)
                    })
                    .OrderBy(i => i.Nombre)
                    .ToList();
                return dto;
            }).ToList();
        }
    }
}
