using System.ComponentModel.DataAnnotations;

namespace RestaurantApi.Dtos
{
    public class CrearProductoInventarioDto
    {
        [Required(ErrorMessage = "El código es obligatorio")]
        [StringLength(50)]
        public string Codigo { get; set; }

        [Required(ErrorMessage = "El nombre es obligatorio")]
        [StringLength(150)]
        public string Nombre { get; set; }

        public string Descripcion { get; set; }

        [Required(ErrorMessage = "La categoría es obligatoria")]
        public int CategoriaId { get; set; }

        public int? ProveedorId { get; set; }

        [Required(ErrorMessage = "La unidad de medida es obligatoria")]
        [StringLength(20)]
        public string UnidadMedida { get; set; }

        [Required(ErrorMessage = "El precio de costo es obligatorio")]
        [Range(0.01, double.MaxValue, ErrorMessage = "El precio debe ser mayor a 0")]
        public decimal PrecioCosto { get; set; }

        [Required(ErrorMessage = "El stock mínimo es obligatorio")]
        [Range(0, int.MaxValue, ErrorMessage = "El stock mínimo no puede ser negativo")]
        public int StockMinimo { get; set; }

        public int? StockMaximo { get; set; }

        public int? PuntoReorden { get; set; }

        public bool RequiereCaducidad { get; set; } = false;

        public int? DiasVencimiento { get; set; }

        [StringLength(100)]
        public string CodigoBarras { get; set; }

        public string ImagenUrl { get; set; }

        public bool Activo { get; set; } = true;
    }
}