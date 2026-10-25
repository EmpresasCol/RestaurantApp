using System.ComponentModel.DataAnnotations;

namespace RestaurantApi.Dtos
{
    public class RecetaDto
    {
        public int Id { get; set; }
        public int PlatilloId { get; set; }
        public string PlatilloNombre { get; set; } = string.Empty;
        public int ProductoId { get; set; }
        public string ProductoNombre { get; set; } = string.Empty;
        public string ProductoCodigo { get; set; } = string.Empty;
        public decimal CantidadRequerida { get; set; }
        public string UnidadMedida { get; set; } = string.Empty;
        public decimal? CostoUnitario { get; set; }
        public decimal CostoTotalIngrediente => (CostoUnitario ?? 0) * CantidadRequerida;
        public bool Opcional { get; set; }
        public string? Notas { get; set; }
    }

    public class CrearRecetaDto
    {
        [Required]
        public int PlatilloId { get; set; }

        [Required]
        public int ProductoId { get; set; }

        [Required]
        [Range(0.001, 999999)]
        public decimal CantidadRequerida { get; set; }

        [Required]
        public string UnidadMedida { get; set; } = "Unidad";

        public decimal? CostoUnitario { get; set; }

        public bool Opcional { get; set; } = false;

        public string? Notas { get; set; }
    }

    public class ActualizarRecetaDto
    {
        [Required]
        [Range(0.001, 999999)]
        public decimal CantidadRequerida { get; set; }

        public string? UnidadMedida { get; set; }

        public decimal? CostoUnitario { get; set; }

        public bool? Opcional { get; set; }

        public string? Notas { get; set; }
    }
}