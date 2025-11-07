using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantApi.Models
{
    [Table("Stock")]
    public class Stock
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
        [Column(TypeName = "decimal(10,2)")]
        public decimal Cantidad { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal CostoPromedio { get; set; }

        [Column(TypeName = "decimal(12,2)")]
        public decimal CostoTotal { get; set; }

        public DateTime FechaActualizacion { get; set; } = DateTime.Now; 
    }
}