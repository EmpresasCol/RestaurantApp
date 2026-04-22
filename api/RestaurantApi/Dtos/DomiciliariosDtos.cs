// api/RestaurantApi/Dtos/DomiciliariosDtos.cs
// DTOs específicos del módulo de domiciliarios y pedidos públicos.
// Se mantienen separados de DomiciliosDtos.cs para responsabilidad única.

using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace RestaurantApi.Dtos
{
    // ═══════════════════════════════════════════════════════════════════════
    // DOMICILIARIO · Autenticación y operación desde la app móvil
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>Respuesta enriquecida del login del domiciliario.</summary>
    public class LoginDomiciliarioResponseDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = null!;
        public string NombreUsuario { get; set; } = null!;
        public string Rol { get; set; } = "Domiciliario";
        public int EntregasHoy { get; set; }
        public int EntregasTotales { get; set; }
    }

    /// <summary>
    /// Vista compacta del domicilio para la lista de la app móvil:
    /// solo los campos que el domiciliario necesita ver/usar.
    /// </summary>
    public class DomicilioDomiciliarioDto
    {
        public int Id { get; set; }
        public string Estado { get; set; } = null!;
        public DateTime FechaPedido { get; set; }
        public DateTime? FechaRecogida { get; set; }
        public DateTime? FechaEntrega { get; set; }

        public string ClienteNombre { get; set; } = null!;
        public string ClienteTelefono { get; set; } = null!;

        public string DireccionCompleta { get; set; } = null!;
        public string? Barrio { get; set; }
        public string? ReferenciasAdicionales { get; set; }

        public decimal Subtotal { get; set; }
        public decimal CostoEnvio { get; set; }
        public decimal Total { get; set; }
        public string MetodoPago { get; set; } = null!;
        public bool PagadoAnticipado { get; set; }

        public string? NotasCliente { get; set; }

        public int? DomiciliarioId { get; set; }
        public string? DomiciliarioNombre { get; set; }

        public List<DomicilioDetalleDto> Detalles { get; set; } = new();
    }

    public class EstadisticasDomiciliarioDto
    {
        public int DomiciliarioId { get; set; }
        public string DomiciliarioNombre { get; set; } = null!;
        public int TotalEntregados { get; set; }
        public int EntregadosHoy { get; set; }
        public int EntregadosSemana { get; set; }
        public int EntregadosMes { get; set; }
        public double? TiempoPromedioEntregaMin { get; set; }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PÚBLICO · Pedidos desde el link abierto (cliente final)
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>Payload completo que llega desde la página pública de pedido.</summary>
    public class CreateDomicilioPublicoDto
    {
        [Required, StringLength(100, MinimumLength = 2)]
        public string ClienteNombre { get; set; } = null!;

        [Required, StringLength(20, MinimumLength = 7)]
        public string ClienteTelefono { get; set; } = null!;

        [EmailAddress, StringLength(100)]
        public string? ClienteEmail { get; set; }

        [Required, StringLength(255, MinimumLength = 5)]
        public string DireccionCompleta { get; set; } = null!;

        [StringLength(100)]
        public string? Barrio { get; set; }

        [StringLength(500)]
        public string? ReferenciasAdicionales { get; set; }

        [StringLength(50)]
        public string MetodoPago { get; set; } = "Efectivo";

        [StringLength(500)]
        public string? NotasCliente { get; set; }

        [Required, MinLength(1)]
        public List<CreateDomicilioDetalleDto> Detalles { get; set; } = new();
    }

    /// <summary>Respuesta tras crear el pedido público: el cliente debe guardar el token.</summary>
    public class CreateDomicilioPublicoResponseDto
    {
        public int DomicilioId { get; set; }
        public string TokenSeguimiento { get; set; } = null!;
        public DateTime PuedeEditarHasta { get; set; }
        public decimal Total { get; set; }
    }

    /// <summary>DTO de seguimiento: lo que ve el cliente en la barra progresiva.</summary>
    public class SeguimientoPublicoDto
    {
        public int DomicilioId { get; set; }
        public string Estado { get; set; } = null!;
        public DateTime FechaPedido { get; set; }
        public DateTime? FechaEstimadaEntrega { get; set; }
        public DateTime? FechaRecogida { get; set; }
        public DateTime? FechaEntrega { get; set; }
        public DateTime? PuedeEditarHasta { get; set; }
        public bool PuedeEditarAhora { get; set; }
        public bool PuedeEnviarObservacion { get; set; }

        public string ClienteNombre { get; set; } = null!;
        public string DireccionCompleta { get; set; } = null!;

        public decimal Subtotal { get; set; }
        public decimal CostoEnvio { get; set; }
        public decimal Total { get; set; }
        public string MetodoPago { get; set; } = null!;

        public string? NotasCliente { get; set; }
        public string? DomiciliarioNombre { get; set; }

        public List<DomicilioDetalleDto> Detalles { get; set; } = new();
    }

    /// <summary>Edición del pedido dentro de la ventana de 5 minutos.</summary>
    public class EditarDomicilioPublicoDto
    {
        [Required, MinLength(1)]
        public List<CreateDomicilioDetalleDto> Detalles { get; set; } = new();

        [StringLength(500)]
        public string? NotasCliente { get; set; }
    }

    public class EnviarObservacionDto
    {
        [Required, StringLength(500, MinimumLength = 3)]
        public string Observacion { get; set; } = null!;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN · Panel de domiciliarios + observaciones recibidas
    // ═══════════════════════════════════════════════════════════════════════

    public class ObservacionClienteDto
    {
        public int DomicilioId { get; set; }
        public DateTime FechaObservacion { get; set; }
        public string Observacion { get; set; } = null!;
        public int ClienteId { get; set; }
        public string ClienteNombre { get; set; } = null!;
        public string ClienteTelefono { get; set; } = null!;
        public int? DomiciliarioId { get; set; }
        public string? DomiciliarioNombre { get; set; }
        public DateTime? FechaEntrega { get; set; }
    }
}
