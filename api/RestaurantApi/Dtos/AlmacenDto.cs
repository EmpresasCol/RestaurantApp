using System.ComponentModel.DataAnnotations;

namespace RestaurantApi.Dtos
{
    public class AlmacenDTO
    {
        public int? Id { get; set; }

        [Required(ErrorMessage = "El código es obligatorio")]
        [StringLength(20)]
        public string Codigo { get; set; }

        [Required(ErrorMessage = "El nombre es obligatorio")]
        [StringLength(100)]
        public string Nombre { get; set; }

        public string Descripcion { get; set; }

        [StringLength(200)]
        public string Ubicacion { get; set; }

        [StringLength(50)]
        public string Tipo { get; set; } = "Principal";

        public bool Activo { get; set; } = true;
    }
}