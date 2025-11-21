// api/RestaurantApi/Models/Domicilio.cs
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RestaurantApi.Models
{
    public class Domicilio
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ClienteId { get; set; }

        [Required]
        public int DireccionId { get; set; }

        [Required]
        public DateTime FechaPedido { get; set; } = DateTime.Now;

        [Required]
        [MaxLength(50)]
        public string Estado { get; set; } = "EnProceso"; // Estados: EnProceso, EnCamino, Entregado, Cancelado

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal Subtotal { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal CostoEnvio { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal Total { get; set; }

        [Required]
        [MaxLength(50)]
        public string MetodoPago { get; set; } = "Efectivo";

        public bool PagadoAnticipado { get; set; } = false;

        [MaxLength(500)]
        public string? NotasCliente { get; set; }

        [MaxLength(500)]
        public string? NotasInternas { get; set; }

        [Required]
        public int UsuarioCreadorId { get; set; }

        public int? DomiciliarioId { get; set; }

        public DateTime? FechaEstimadaEntrega { get; set; }

        public DateTime? FechaEntrega { get; set; }

        // Navegación
        [ForeignKey("ClienteId")]
        public virtual Cliente Cliente { get; set; } = null!;

        [ForeignKey("DireccionId")]
        public virtual Direccion Direccion { get; set; } = null!;

        [ForeignKey("UsuarioCreadorId")]
        public virtual Usuario UsuarioCreador { get; set; } = null!;

        [ForeignKey("DomiciliarioId")]
        public virtual Usuario? Domiciliario { get; set; }

        public virtual ICollection<DomicilioDetalle> Detalles { get; set; } = new List<DomicilioDetalle>();
    }
}