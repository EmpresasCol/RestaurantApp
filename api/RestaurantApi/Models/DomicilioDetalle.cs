// api/RestaurantApi/Models/DomicilioDetalle.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantApi.Models
{
    public class DomicilioDetalle
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int DomicilioId { get; set; }

        [Required]
        public int PlatilloId { get; set; }

        [Required]
        public int Cantidad { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal PrecioUnitario { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal Subtotal { get; set; }

        [MaxLength(500)]
        public string? Nota { get; set; }

        // Navegación
        [ForeignKey("DomicilioId")]
        public virtual Domicilio Domicilio { get; set; } = null!;

        [ForeignKey("PlatilloId")]
        public virtual Platillo Platillo { get; set; } = null!;
    }
}