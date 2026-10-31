using RestaurantApi.Models;

namespace RestaurantApi.Services
{
    /// <summary>Cálculos de la cuenta que comparten caja, facturas y reportes.</summary>
    public static class Cuentas
    {
        /// <summary>Precio con que se vendió el plato; los pedidos viejos sin precio usan el de la carta.</summary>
        public static decimal Precio(PedidoDetalle d) => d.PrecioUnitario ?? d.Platillo?.Precio ?? 0;

        /// <summary>Consumo del pedido con impuesto incluido (lo que se cobra).</summary>
        public static decimal Consumo(Pedido p) => p.Detalles.Sum(d => Precio(d) * d.Cantidad);

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
