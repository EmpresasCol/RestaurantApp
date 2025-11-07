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

        [Required]
        [Range(0.01, double.MaxValue)]
        public decimal Cantidad { get; set; }

        public decimal? CostoUnitario { get; set; }

        public string Motivo { get; set; }

        public string Referencia { get; set; }

        public int? LoteId { get; set; }

        public int? UsuarioId { get; set; }
    }
}