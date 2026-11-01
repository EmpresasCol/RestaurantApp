using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;

namespace RestaurantApi.Services
{
    /// <summary>
    /// Reglas de la entrega de un domicilio que comparten la web (caja) y la app del domiciliario:
    /// cómo pagó el cliente, el comprobante de la transferencia, la factura y el efectivo que el
    /// domiciliario debe entregar en caja.
    /// </summary>
    public static class Entregas
    {
        public static readonly string[] Metodos = { "Efectivo", "Transferencia", "Tarjeta", "Nequi", "Daviplata" };

        public static bool EsTransferencia(string metodo) => metodo is "Transferencia" or "Nequi" or "Daviplata";

        /// <summary>Método válido escrito como lo guarda la base (ENUM).</summary>
        public static string? Normalizar(string? metodo)
            => Metodos.FirstOrDefault(m => m.Equals(metodo?.Trim(), StringComparison.OrdinalIgnoreCase));

        /// <summary>El domiciliario cobró en efectivo y todavía no lo ha entregado en caja.</summary>
        public static bool EfectivoPorLiquidar(Domicilio d)
            => d.Estado == "Entregado" && d.MetodoPago == "Efectivo" && !d.PagadoAnticipado
               && d.FechaLiquidacion == null && d.DomiciliarioId != null;

        /// <summary>Billete del cliente frente al total: cambio que lleva el domiciliario (null si no aplica).</summary>
        public static decimal? Cambio(Domicilio d) => d.MetodoPago == "Efectivo" && !d.PagadoAnticipado && d.PagaCon is { } paga && paga >= d.Subtotal + d.CostoEnvio
            ? paga - (d.Subtotal + d.CostoEnvio)
            : null;

        /// <summary>
        /// Marca el domicilio entregado y cobrado con el método con que pagó el cliente (puede no ser
        /// el que dijo al pedir) y emite su factura. Una transferencia necesita la foto del comprobante.
        /// <paramref name="cobradoEnCaja"/>: el dinero llegó directo a la caja (no queda en el domiciliario).
        /// Devuelve el error o null.
        /// </summary>
        public static async Task<string?> EntregarAsync(RestauranteContext ctx, Domicilio d, string? metodoPago, string? comprobante, bool cobradoEnCaja)
        {
            if (!d.PagadoAnticipado && !string.IsNullOrWhiteSpace(metodoPago))
            {
                var metodo = Normalizar(metodoPago);
                if (metodo == null)
                    return "Método de pago inválido";
                if (EsTransferencia(metodo) && string.IsNullOrWhiteSpace(comprobante) && d.ComprobantePago == null && !cobradoEnCaja)
                    return "Toma la foto de la transferencia antes de marcar la entrega";
                d.MetodoPago = metodo;
            }
            if (!string.IsNullOrWhiteSpace(comprobante))
            {
                if (!comprobante.StartsWith("data:image/", StringComparison.Ordinal))
                    return "El comprobante debe ser una foto";
                if (comprobante.Length > Controllers.CuentasController.MaximoComprobante)
                    return "La foto del comprobante es muy pesada";
                d.ComprobantePago = comprobante;
            }

            var ahora = DateTime.UtcNow;
            d.Estado = "Entregado";
            d.FechaEntrega = ahora;
            d.InicioPreparacion ??= d.FechaPedido;
            if (cobradoEnCaja || d.DomiciliarioId == null) d.FechaLiquidacion = ahora;
            await ctx.SaveChangesAsync();

            var cliente = await ctx.Clientes.Where(c => c.Id == d.ClienteId).Select(c => c.Nombre).FirstOrDefaultAsync();
            await Facturacion.EmitirDomicilioAsync(ctx, d, cliente ?? Facturacion.NombreConsumidorFinal);
            return null;
        }
    }
}
