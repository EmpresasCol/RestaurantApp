namespace RestaurantApi.Models
{
    public enum EstadoPedido
    {
        EnProceso,
        Listo,
        Pagado,
        Cancelado,
        Entregado
    }

    public class Pedido
    {
        public int Id { get; set; }
        public int MesaId { get; set; }
        public int UsuarioId { get; set; }
        public EstadoPedido Estado { get; set; }
        public DateTime Fecha { get; set; }

        // Relaciones de navegación
        public Mesa? Mesa { get; set; }
        public Usuario? Usuario { get; set; }
        public List<PedidoDetalle> Detalles { get; set; } = new();
    }
}