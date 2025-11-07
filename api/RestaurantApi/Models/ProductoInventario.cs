using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantApi.Models
{
    [Table("ProductosInventario")]
    public class ProductoInventario
    {
        [Key]
        public int Id { get; set; }

        [StringLength(50)]
        public string? Codigo { get; set; } // ✅ Nullable

        [Required]
        [StringLength(150)]
        public string Nombre { get; set; }

        [Column(TypeName = "TEXT")]
        public string? Descripcion { get; set; } // ✅ Nullable

        [Required]
        public int CategoriaId { get; set; }

        [ForeignKey("CategoriaId")]
        public CategoriaInventario? Categoria { get; set; }

        public int? ProveedorId { get; set; }

        [ForeignKey("ProveedorId")]
        public Proveedor? Proveedor { get; set; }

        [Required]
        [StringLength(20)]
        public string UnidadMedida { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal PrecioCosto { get; set; }

        [Required]
        public int StockMinimo { get; set; }

        public int? StockMaximo { get; set; }

        public int? PuntoReorden { get; set; }

        public bool RequiereCaducidad { get; set; } = false;

        public int? DiasVencimiento { get; set; }

        [StringLength(100)]
        public string? CodigoBarras { get; set; } // ✅ Nullable

        [Column(TypeName = "LONGTEXT")]
        public string? ImagenUrl { get; set; } // ✅ Nullable

        public bool Activo { get; set; } = true;

        public DateTime FechaCreacion { get; set; } = DateTime.Now;

        public DateTime? FechaActualizacion { get; set; }
    }
}