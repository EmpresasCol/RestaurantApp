using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantApi.Models
{
    [Table("Lotes")]
    public class Lote
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ProductoId { get; set; }

        [ForeignKey("ProductoId")]
        public ProductoInventario Producto { get; set; }

        [Required]
        public int AlmacenId { get; set; }

        [ForeignKey("AlmacenId")]
        public Almacen Almacen { get; set; }

        [Required]
        [StringLength(50)]
        public string NumeroLote { get; set; }

        [Required]
        public DateTime FechaIngreso { get; set; }

        public DateTime? FechaVencimiento { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal CantidadInicial { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal CantidadActual { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal CostoUnitario { get; set; } // ✅ Cambio: CostoUnitario

        [StringLength(20)]
        public string Estado { get; set; } = "Activo";

        public DateTime FechaCreacion { get; set; } = DateTime.Now;
    }
}