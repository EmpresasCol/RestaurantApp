using System.ComponentModel.DataAnnotations;

namespace RestaurantApi.Dtos
{
    public class ProductoInventarioDto
    {
        public int? Id { get; set; }

        /// <summary>Código interno (PROD-001). Si llega vacío al crear, se genera.</summary>
        [StringLength(50)]
        public string? Codigo { get; set; }

        [Required(ErrorMessage = "El nombre es obligatorio")]
        [StringLength(150)]
        public string Nombre { get; set; } = "";

        public string? Descripcion { get; set; }

        [Required(ErrorMessage = "La categoría es obligatoria")]
        public int CategoriaId { get; set; }

        public string? CategoriaNombre { get; set; }

        public int? ProveedorId { get; set; }

        public string? ProveedorNombre { get; set; }

        [Required(ErrorMessage = "La unidad de medida es obligatoria")]
        [StringLength(20)]
        public string UnidadMedida { get; set; } = "";

        // Un insumo nuevo puede no tener precio hasta la primera compra.
        [Range(0, 999999999, ErrorMessage = "El precio no puede ser negativo")]
        public decimal PrecioCosto { get; set; }

        [Range(0, 9999999, ErrorMessage = "El stock mínimo no puede ser negativo")]
        public decimal StockMinimo { get; set; }

        [Range(0, 9999999, ErrorMessage = "El nivel máximo no puede ser negativo")]
        public decimal? StockMaximo { get; set; }

        [Range(0, 9999999, ErrorMessage = "El punto de pedido no puede ser negativo")]
        public decimal? PuntoReorden { get; set; }

        public decimal? StockActual { get; set; }

        public bool RequiereCaducidad { get; set; } = false;

        [Range(0, 3650, ErrorMessage = "Los días de vida deben estar entre 0 y 3650")]
        public int? DiasVencimiento { get; set; }

        [StringLength(100)]
        public string? CodigoBarras { get; set; }

        public string? ImagenUrl { get; set; }

        public bool Activo { get; set; } = true;
    }
}
