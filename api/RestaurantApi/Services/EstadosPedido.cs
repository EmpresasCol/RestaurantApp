using RestaurantApi.Models;

namespace RestaurantApi.Services
{
    /// <summary>
    /// Transiciones permitidas de pedidos (mesa) y domicilios, en un solo lugar.
    /// Pagado y Cancelado son finales. Repetir el mismo estado es un no-op válido.
    /// </summary>
    public static class EstadosPedido
    {
        private static readonly Dictionary<EstadoPedido, EstadoPedido[]> Pedido = new()
        {
            [EstadoPedido.EnProceso] = new[] { EstadoPedido.Listo, EstadoPedido.Entregado, EstadoPedido.Pagado, EstadoPedido.Cancelado },
            // Listo → EnProceso: cocina corrige o el mesero agrega platos.
            [EstadoPedido.Listo]     = new[] { EstadoPedido.EnProceso, EstadoPedido.Entregado, EstadoPedido.Pagado, EstadoPedido.Cancelado },
            [EstadoPedido.Entregado] = new[] { EstadoPedido.EnProceso, EstadoPedido.Pagado, EstadoPedido.Cancelado },
            [EstadoPedido.Pagado]    = Array.Empty<EstadoPedido>(),
            [EstadoPedido.Cancelado] = Array.Empty<EstadoPedido>(),
        };

        public static bool PuedeCambiar(EstadoPedido actual, EstadoPedido nuevo)
            => actual == nuevo || Pedido[actual].Contains(nuevo);

        public static bool EsEditable(EstadoPedido estado)
            => estado is not (EstadoPedido.Pagado or EstadoPedido.Cancelado);

        /// <summary>
        /// La cocina tocó el pedido: lo empezó (algún plato EnPreparacion) o ya lo terminó.
        /// Desde ahí el mesero no lo edita ni lo cancela; los platos nuevos van en otro pedido.
        /// </summary>
        public static bool CocinaEmpezo(Pedido pedido)
            => pedido.Estado != EstadoPedido.EnProceso
               || pedido.Detalles.Any(d => d.Estado is EstadoDetalle.EnPreparacion or EstadoDetalle.Listo);

        private static readonly Dictionary<string, string[]> Domicilio = new()
        {
            ["EnPreparacion"] = new[] { "Listo", "Cancelado" },
            ["Listo"]         = new[] { "EnPreparacion", "Recogido", "EnCamino", "Entregado", "Cancelado" },
            ["Recogido"]      = new[] { "EnCamino", "Entregado", "Cancelado" },
            ["EnCamino"]      = new[] { "Entregado", "Cancelado" },
            ["Entregado"]     = Array.Empty<string>(),
            ["Cancelado"]     = Array.Empty<string>(),
        };

        public static bool EsEstadoDomicilio(string estado) => Domicilio.ContainsKey(estado);

        public static bool PuedeCambiarDomicilio(string actual, string nuevo)
            => actual == nuevo || (Domicilio.TryGetValue(actual, out var destinos) && destinos.Contains(nuevo));
    }
}
