// api/RestaurantApi/Models/Cliente.cs
using FirebaseAdmin.Messaging;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantApi.Models
{
    [Table("Clientes")]
    public class Cliente
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Nombre { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Telefono { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? Email { get; set; }

        public DateTime FechaRegistro { get; set; } = DateTime.Now;

        // Navegación
        public virtual ICollection<Direccion> Direcciones { get; set; } = new List<Direccion>();
        public virtual ICollection<Domicilio> Domicilios { get; set; } = new List<Domicilio>();
    }
}