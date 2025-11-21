// api/RestaurantApi/Models/Direccion.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantApi.Models
{
    [Table("Direcciones")]
    public class Direccion
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ClienteId { get; set; }

        [Required]
        [MaxLength(255)]
        public string DireccionCompleta { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? Barrio { get; set; }

        [MaxLength(100)]
        public string Ciudad { get; set; } = "Sincelejo";

        [MaxLength(100)]
        public string Departamento { get; set; } = "Sucre";

        public string? ReferenciasAdicionales { get; set; }

        public bool EsPrincipal { get; set; } = false;

        public bool Activa { get; set; } = true;

        public DateTime FechaCreacion { get; set; } = DateTime.Now;

        // Navegación
        [ForeignKey("ClienteId")]
        public virtual Cliente? Cliente { get; set; }

        public virtual ICollection<Domicilio> Domicilios { get; set; } = new List<Domicilio>();
    }
}