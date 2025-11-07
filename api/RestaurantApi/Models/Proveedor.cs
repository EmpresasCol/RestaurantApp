using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantApi.Models
{
    [Table("Proveedores")]
    public class Proveedor
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(150)]
        public string Nombre { get; set; }

        [StringLength(100)]
        public string Contacto { get; set; }

        [StringLength(20)]
        public string Telefono { get; set; }

        [StringLength(100)]
        public string Email { get; set; }

        [Column(TypeName = "TEXT")]
        public string Direccion { get; set; }

        [StringLength(50)]
        public string NIT { get; set; }

        [StringLength(100)]
        public string Ciudad { get; set; }

        [StringLength(100)]
        public string Pais { get; set; } = "Colombia";

        [Column(TypeName = "TEXT")]
        public string NotasAdicionales { get; set; }

        [StringLength(200)] 
        public string TipoProductos { get; set; }

        public bool Activo { get; set; } = true;

        public DateTime FechaRegistro { get; set; } = DateTime.Now; 
    }
}