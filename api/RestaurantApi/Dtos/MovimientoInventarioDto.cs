using System;
using System.ComponentModel.DataAnnotations;

namespace RestaurantApi.Dtos
{
    public class MovimientoInventarioDTO
    {
        [Required]
        public int ProductoId { get; set; }

        [Required]
        public int AlmacenId { get; set; }

        [Required]
        public string TipoMovimiento { get; set; }

        // Ajuste admite 0 (contar y no encontrar nada); el controlador exige > 0 en los demás tipos.
        [Required]
        [Range(0, 9999999)]
        public decimal Cantidad { get; set; }

        [Range(0, 99999999)]
        public decimal? CostoUnitario { get; set; }

        public string? Motivo { get; set; }

        [StringLength(100)]
        public string? Referencia { get; set; }

        public int? LoteId { get; set; }

        public int? UsuarioId { get; set; }
    }
}