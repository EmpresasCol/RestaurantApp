namespace RestaurantApi.Models
{
    public enum EstadoPedido
    {
        EnProceso,
        Listo,
        Entregado,  
        Pagado,
        Cancelado
    }

    public class Pedido
    {
        public int Id { get; set; }
        public int MesaId { get; set; }
        public int UsuarioId { get; set; }
        public EstadoPedido Estado { get; set; }
        public DateTime Fecha { get; set; }
        /// <summary>Última vez que el mesero cambió los platos; la cocina lo ve resaltado.</summary>
        public DateTime? FechaEdicion { get; set; }
        /// <summary>Visita de la mesa a la que pertenece; null en los pedidos anteriores a las ocupaciones.</summary>
        public int? OcupacionId { get; set; }

        // Relaciones de navegación
        public Mesa? Mesa { get; set; }
        public Usuario? Usuario { get; set; }
        public List<PedidoDetalle> Detalles { get; set; } = new();
    }
}