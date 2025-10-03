using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantApi.Models
{
    public enum RolUsuario
    {
        Mesero,
        Cocina,
        Caja
    }

    public class Usuario
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = null!;

        [Column("Usuario")]
        public string NombreUsuario { get; set; } = null!;

        public string ClaveHash { get; set; } = null!;
        public RolUsuario Rol { get; set; }
    }
}