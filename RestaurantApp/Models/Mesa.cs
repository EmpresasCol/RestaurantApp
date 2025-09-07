using System.ComponentModel.DataAnnotations;

namespace RestaurantApp.Models
{
    public class Mesa
    {
        [Key]
        public int Id { get; set; }
        public int Numero { get; set; }
        public int Capacidad { get; set; }
        public bool EstaOcupada { get; set; }
        public List<Pedido> Pedidos { get; set; } = new List<Pedido>();
    }
}