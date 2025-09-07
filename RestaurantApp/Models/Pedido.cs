using System.ComponentModel.DataAnnotations;

namespace RestaurantApp.Models
{
    public enum EstadoPedido
    {
        Activo,
        Cancelado,
        EnProceso,
        Listo,
        Pagado
    }

    public class Pedido
    {
        [Key]
        public int Id { get; set; }
        public int MesaId { get; set; }
        public Mesa Mesa { get; set; }
        public DateTime FechaHora { get; set; }
        public EstadoPedido Estado { get; set; }
        public decimal Total { get; set; }
        public List<ItemPedido> Items { get; set; } = new List<ItemPedido>();
        public string? NotasEspeciales { get; set; }
    }
}