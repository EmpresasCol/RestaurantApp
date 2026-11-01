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
        public DateTime FechaPedido { get; set; } = DateTime.UtcNow;

        [Required]
        [MaxLength(50)]
        public string Estado { get; set; } = "EnPreparacion"; // Estados: EnPreparacion, Listo, EnCamino, Entregado, Cancelado

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

        [MaxLength(32)]
        public string? TokenSeguimiento { get; set; }

        public DateTime? PuedeEditarHasta { get; set; }

        public DateTime? FechaRecogida { get; set; }

        public string? ObservacionCliente { get; set; }

        public DateTime? FechaObservacion { get; set; }

        [MaxLength(20)]
        public string OrigenPedido { get; set; } = "Admin";

        /// <summary>La cocina lo empezó; antes el cliente todavía puede editarlo.</summary>
        public DateTime? InicioPreparacion { get; set; }

        /// <summary>Billete con que paga el cliente en efectivo: el domiciliario lleva el cambio.</summary>
        [Column(TypeName = "decimal(10,2)")]
        public decimal? PagaCon { get; set; }

        /// <summary>Foto de la transferencia que recibió el domiciliario al entregar (data URI).</summary>
        public string? ComprobantePago { get; set; }

        /// <summary>La caja recibió el efectivo que cobró el domiciliario.</summary>
        public DateTime? FechaLiquidacion { get; set; }

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