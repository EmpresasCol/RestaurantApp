using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantApi.Models
{
    [Table("MovimientosInventario")]
    public class MovimientoInventario
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
        public string TipoMovimiento { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal Cantidad { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal? CostoUnitario { get; set; }

        [Column(TypeName = "decimal(12,2)")]
        public decimal? CostoTotal { get; set; }

        [Column(TypeName = "TEXT")]
        public string Motivo { get; set; }

        [StringLength(100)]
        public string Referencia { get; set; }

        public int? LoteId { get; set; }

        [ForeignKey("LoteId")]
        public Lote Lote { get; set; }

        public int? UsuarioId { get; set; }

        public DateTime Fecha { get; set; } = DateTime.Now;
    }
}