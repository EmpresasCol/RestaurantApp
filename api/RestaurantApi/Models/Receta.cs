using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantApi.Models
{
    public enum UnidadMedida
    {
        Kg,
        Gramos,
        Litro,
        Mililitro,
        Unidad,
        Paquete,
        Caja,
        Botella,
        Lata,
        Pieza,
        Porcion,
        Taza,
        Cucharada,
        Cucharadita
    }

    [Table("Recetas")]

    public class Receta
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int PlatilloId { get; set; }

        [ForeignKey("PlatilloId")]
        public Platillo Platillo { get; set; }

        [Required]
        public int ProductoId { get; set; }

        [ForeignKey("ProductoId")]
        public ProductoInventario Producto { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal CantidadRequerida { get; set; }

        [Required]
        public UnidadMedida UnidadMedida { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal? CostoUnitario { get; set; }

        public bool Opcional { get; set; } = false;

        [StringLength(500)]
        public string Notas { get; set; }

        public DateTime FechaCreacion { get; set; } = DateTime.Now;
    }
}