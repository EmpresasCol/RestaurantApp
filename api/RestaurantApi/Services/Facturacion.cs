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

        /// <summary>Facturas con sus platos, mesa y método. Una factura cubre los pagos con su FacturaId (o su PagoId).</summary>
        public static async Task<List<FacturaDto>> ConDetalleAsync(RestauranteContext ctx, List<Factura> facturas)
        {
            var ids = facturas.Select(f => f.Id).ToList();
            var pagoIds = facturas.Select(f => f.PagoId).ToList();
            var pagos = await ctx.Pagos.AsNoTracking()
                .Where(p => (p.FacturaId != null && ids.Contains(p.FacturaId.Value)) || pagoIds.Contains(p.Id))
                .ToListAsync();
            var pedidoIds = pagos.Select(p => p.PedidoId).Distinct().ToList();
            var pedidos = await ctx.Pedidos.AsNoTracking()
                .Include(p => p.Mesa)
                .Include(p => p.Detalles).ThenInclude(d => d.Platillo)
                .Where(p => pedidoIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id);

            return facturas.Select(f =>
            {
                var suyos = pagos.Where(p => p.FacturaId == f.Id || p.Id == f.PagoId).DistinctBy(p => p.Id).ToList();
                var susPedidos = suyos.Select(p => pedidos.GetValueOrDefault(p.PedidoId)).OfType<Pedido>().ToList();
                return new FacturaDto
                {
                    Id = f.Id,
                    PagoId = f.PagoId,
                    NumeroFactura = f.NumeroFactura,
                    NitCliente = f.NitCliente,
                    NombreCliente = f.NombreCliente,
                    Subtotal = f.Subtotal,
                    Propina = f.Propina,
                    Total = f.Total,
                    ArchivoUrl = f.ArchivoUrl,
                    FechaEmision = f.FechaEmision,
                    MesaNumero = susPedidos.FirstOrDefault()?.Mesa?.Numero,
                    MetodoPago = string.Join(" + ", suyos.Select(p => p.MetodoPago.ToString()).Distinct()),
                    PedidoIds = susPedidos.Select(p => p.Id).OrderBy(x => x).ToList(),
                    // El mismo plato al mismo precio en varios pedidos va en una sola línea.
                    Items = susPedidos.SelectMany(p => p.Detalles)
                        .GroupBy(d => new { d.PlatilloId, Precio = Cuentas.Precio(d) })
                        .Select(g => new FacturaItemDto
                        {
                            Nombre = g.First().Platillo?.Nombre ?? "Plato",
                            Cantidad = g.Sum(d => d.Cantidad),
                            PrecioUnitario = g.Key.Precio,
                            Total = g.Key.Precio * g.Sum(d => d.Cantidad)
                        })
                        .OrderBy(i => i.Nombre)
                        .ToList()
                };
            }).ToList();
        }
    }
}
