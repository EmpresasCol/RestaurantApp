using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;

namespace RestaurantApi.Services
{
    /// <summary>Cálculos de la cuenta que comparten caja, facturas y reportes.</summary>
    public static class Cuentas
    {
        /// <summary>Monto en pesos como se lee en Colombia: 25.000 (no 25,000, que parece decimal).</summary>
        public static string Pesos(decimal valor)
            => Math.Round(valor).ToString("#,0", System.Globalization.CultureInfo.InvariantCulture).Replace(',', '.');

        public static string Pesos(decimal? valor) => Pesos(valor ?? 0);

        /// <summary>Precio con que se vendió el plato; los pedidos viejos sin precio usan el de la carta.</summary>
        public static decimal Precio(PedidoDetalle d) => d.PrecioUnitario ?? d.Platillo?.Precio ?? 0;

        /// <summary>Consumo del pedido con impuesto incluido (lo que se cobra).</summary>
        public static decimal Consumo(Pedido p) => p.Detalles.Sum(d => Precio(d) * d.Cantidad);

        /// <summary>Platos que siguen en la cuenta: ni cobrados en una factura ni cancelados.</summary>
        public static IEnumerable<PedidoDetalle> PorCobrar(Pedido p)
            => p.Detalles.Where(d => d.FacturaId == null && d.Estado != EstadoDetalle.Cancelado);

        public static decimal ConsumoPorCobrar(Pedido p) => PorCobrar(p).Sum(d => Precio(d) * d.Cantidad);

        /// <summary>Pedido con cuenta abierta (en cocina, listo o servido).</summary>
        public static bool Abierto(EstadoPedido e) => e is EstadoPedido.EnProceso or EstadoPedido.Listo or EstadoPedido.Entregado;

        /// <summary>Lo que sigue en cocina no se cobra: desaparecería de la comanda.</summary>
        public static bool Cobrable(EstadoPedido e) => e is EstadoPedido.Listo or EstadoPedido.Entregado;

        /// <summary>Pedidos abiertos de una mesa con sus platos y precios.</summary>
        public static Task<List<Pedido>> AbiertosDeMesaAsync(RestauranteContext ctx, int mesaId) => ctx.Pedidos
            .Include(p => p.Detalles).ThenInclude(d => d.Platillo)
            .Where(p => p.MesaId == mesaId
                && (p.Estado == EstadoPedido.EnProceso || p.Estado == EstadoPedido.Listo || p.Estado == EstadoPedido.Entregado))
            .OrderBy(p => p.Fecha)
            .ToListAsync();

        /// <summary>
        /// Los pagos avisados cubren exacto lo que debe la mesa más la propina avisada: la mesa ya
        /// pagó y la caja solo confirma. Si no cuadra (faltó o cambió la cuenta), la caja completa el cobro.
        /// </summary>
        public static bool AvisoCuadra(decimal totalAvisado, decimal porCobrar, decimal propina)
            => totalAvisado > 0 && porCobrar > 0 && Math.Abs(totalAvisado - (porCobrar + propina)) < 0.01m;

        /// <summary>
        /// Reparte la propina entre varios pagos en proporción a lo que cubre cada uno
        /// (redondeado a pesos); el último absorbe el redondeo para que la suma sea exacta.
        /// </summary>
        public static decimal[] RepartirPropina(IReadOnlyList<decimal> montos, decimal propina)
        {
            var reparto = new decimal[montos.Count];
            var total = montos.Sum();
            if (montos.Count == 0 || propina <= 0 || total <= 0) return reparto;
            for (var i = 0; i < montos.Count - 1; i++)
                reparto[i] = Math.Min(montos[i], Math.Round(propina * montos[i] / total, 0, MidpointRounding.AwayFromZero));
            reparto[^1] = propina - reparto.Take(montos.Count - 1).Sum();
            return reparto;
        }

        /// <summary>
        /// Agrupa los métodos de mesa (Efectivo, Tarjeta, QR, Otro) y de domicilio
        /// (Efectivo, Tarjeta, Transferencia, Nequi, Daviplata) para el cierre y los reportes.
        /// </summary>
        public static string GrupoMetodo(string? metodo) => (metodo ?? "").Trim().ToLowerInvariant() switch
        {
            "efectivo" => "Efectivo",
            "tarjeta" => "Tarjeta",
            "qr" or "transferencia" or "nequi" or "daviplata" => "Transferencia o QR",
            _ => "Otro"
        };

        public static readonly string[] Grupos = { "Efectivo", "Tarjeta", "Transferencia o QR", "Otro" };
    }
}
