using System.ComponentModel.DataAnnotations;

namespace RestaurantApi.Dtos
{
    public class ProveedorDto
    {
        public int? Id { get; set; }

        [Required(ErrorMessage = "El nombre es obligatorio")]
        [StringLength(150)]
        public string Nombre { get; set; }

        [StringLength(100)]
        public string Contacto { get; set; }

        [StringLength(20)]
        public string Telefono { get; set; }

        [EmailAddress(ErrorMessage = "Email inválido")]
        [StringLength(100)]
        public string Email { get; set; }

        public string Direccion { get; set; }

        [StringLength(100)]
        public string Ciudad { get; set; }

        [StringLength(200)]
        public string TipoProductos { get; set; }

        public bool Activo { get; set; } = true;
    }
}