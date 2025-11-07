using System.ComponentModel.DataAnnotations;

namespace RestaurantApi.Dtos
{
    public class CategoriaInventarioDTO
    {
        public int? Id { get; set; }

        [Required(ErrorMessage = "El nombre es obligatorio")]
        [StringLength(100)]
        public string Nombre { get; set; }

        public string Descripcion { get; set; }

        [Required(ErrorMessage = "El tipo es obligatorio")]
        public string Tipo { get; set; }

        public string Color { get; set; } = "#3b82f6";

        public bool Activo { get; set; } = true;
    }
}