using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantApi.Models
{
    [Table("Almacenes")]
    public class Almacen
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(20)]
        public string Codigo { get; set; }

        [Required]
        [StringLength(100)]
        public string Nombre { get; set; }

        [Column(TypeName = "TEXT")]
        public string Descripcion { get; set; }

        [StringLength(200)]
        public string Ubicacion { get; set; }

        [StringLength(50)]
        public string Tipo { get; set; } = "Principal"; // Principal, Secundario, Refrigerado, Congelador, etc.

        public bool Activo { get; set; } = true;

        public DateTime FechaCreacion { get; set; } = DateTime.Now;
    }
}