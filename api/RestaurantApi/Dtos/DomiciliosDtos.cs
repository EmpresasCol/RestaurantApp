// api/RestaurantApi/Dtos/DomiciliosDtos.cs
namespace RestaurantApi.Dtos
{
    // ==================== REQUEST DTOs ====================

    public class CreateClienteConDireccionDto
    {
        public ClienteDto Cliente { get; set; } = null!;
        public DireccionDto Direccion { get; set; } = null!;
    }

    public class ClienteDto
    {
        public string Nombre { get; set; } = null!;
        public string Telefono { get; set; } = null!;
        public string? Email { get; set; }
    }

    public class DireccionDto
    {
        public string DireccionCompleta { get; set; } = null!;
        public string? Barrio { get; set; }
        public string? ReferenciasAdicionales { get; set; }
    }

    public class CreateDomicilioDto
    {
        public int ClienteId { get; set; }
        public int DireccionId { get; set; }
        public decimal CostoEnvio { get; set; }
        public string MetodoPago { get; set; } = "Efectivo";
        public bool PagadoAnticipado { get; set; }
        /// <summary>En efectivo: billete con que paga el cliente, para que el domiciliario lleve el cambio.</summary>
        public decimal? PagaCon { get; set; }
        public string? NotasCliente { get; set; }
        public string? NotasInternas { get; set; }
        public int UsuarioCreadorId { get; set; }
        public List<CreateDomicilioDetalleDto> Detalles { get; set; } = new();
    }

    public class CreateDomicilioDetalleDto
    {
        public int PlatilloId { get; set; }
        public int Cantidad { get; set; }
        public string? Nota { get; set; }
    }

    public class ActualizarEstadoDto
    {
        public string Estado { get; set; } = null!;
        /// <summary>Al entregar: cómo pagó de verdad el cliente (si cambió).</summary>
        public string? MetodoPago { get; set; }
        /// <summary>Al cancelar: por qué (queda en las notas internas).</summary>
        public string? Motivo { get; set; }
    }

    public class ActualizarMetodoPagoDto
    {
        public string MetodoPago { get; set; } = null!;
        public bool PagadoAnticipado { get; set; }
        public decimal? PagaCon { get; set; }
    }

    public class AsignarDomiciliarioDto
    {
        /// <summary>null = vuelve a la bolsa común de domicilios por recoger.</summary>
        public int? DomiciliarioId { get; set; }
    }

    /// <summary>Al entregar desde la app: cómo pagó el cliente y la foto si fue transferencia.</summary>
    public class EntregarDomicilioDto
    {
        public string? MetodoPago { get; set; }
        public string? Comprobante { get; set; }
    }

    /// <summary>Efectivo que un domiciliario cobró y todavía no ha entregado en caja.</summary>
    public class LiquidacionPendienteDto
    {
        public int DomiciliarioId { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public int Entregas { get; set; }
        public decimal Total { get; set; }
        public List<int> Domicilios { get; set; } = new();
    }

    // ==================== RESPONSE DTOs ====================

    public class ClienteResponseDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = null!;
        public string Telefono { get; set; } = null!;
        public string? Email { get; set; }
        public DateTime FechaRegistro { get; set; }
    }

    public class DireccionResponseDto
    {
        public int Id { get; set; }
        public int ClienteId { get; set; }
        public string DireccionCompleta { get; set; } = null!;
        public string? Barrio { get; set; }
        public string? ReferenciasAdicionales { get; set; }
        public bool EsPrincipal { get; set; }
    }

    public class ClienteConDireccionResponseDto
    {
        public int ClienteId { get; set; }
        public int DireccionId { get; set; }
    }

    public class DomicilioResponseDto
    {
        public int Id { get; set; }
        public int ClienteId { get; set; }
        public string ClienteNombre { get; set; } = null!;
        public string ClienteTelefono { get; set; } = null!;
        public int DireccionId { get; set; }
        public string DireccionCompleta { get; set; } = null!;
        public string? Barrio { get; set; }
        public string? ReferenciasAdicionales { get; set; }
        public DateTime FechaPedido { get; set; }
        public string Estado { get; set; } = null!;
        public decimal Subtotal { get; set; }
        public decimal CostoEnvio { get; set; }
        public decimal Total { get; set; }
        public string MetodoPago { get; set; } = null!;
        public bool PagadoAnticipado { get; set; }
        public string? NotasCliente { get; set; }
        public string? NotasInternas { get; set; }
        public int UsuarioCreadorId { get; set; }
        public string? UsuarioCreadorNombre { get; set; }
        public int? DomiciliarioId { get; set; }
        public string? DomiciliarioNombre { get; set; }
        public DateTime? FechaEstimadaEntrega { get; set; }
        public DateTime? FechaEntrega { get; set; }
        public DateTime? FechaRecogida { get; set; }
        public DateTime? FechaLiquidacion { get; set; }
        /// <summary>La cocina ya lo empezó: el cliente ya no lo edita.</summary>
        public bool CocinaEmpezo { get; set; }
        public decimal? PagaCon { get; set; }
        /// <summary>Cambio que debe llevar el domiciliario (billete menos total).</summary>
        public decimal? Cambio { get; set; }
        public bool TieneComprobante { get; set; }
        public string OrigenPedido { get; set; } = "Admin";
        public string? NumeroFactura { get; set; }
        /// <summary>Entregado en efectivo y el domiciliario aún no lo entrega en caja.</summary>
        public bool PorLiquidar { get; set; }
        public List<DomicilioDetalleDto> Detalles { get; set; } = new();
    }

    public class DomicilioDetalleDto
    {
        public int Id { get; set; }
        public int PlatilloId { get; set; }
        public string PlatilloNombre { get; set; } = null!;
        public int Cantidad { get; set; }
        public decimal PrecioUnitario { get; set; }
        public decimal Subtotal { get; set; }
        public string? Nota { get; set; }
    }

    public class EstadisticasDomiciliosDto
    {
        public int TotalDomicilios { get; set; }
        public int EnPreparacion { get; set; }
        /// <summary>Recibidos que la cocina todavía no empieza.</summary>
        public int PorEmpezar { get; set; }
        public int Listo { get; set; }
        public int EnCamino { get; set; }
        public int Entregados { get; set; }
        public int Cancelados { get; set; }
        public decimal TotalVentas { get; set; }
        /// <summary>Efectivo que los domiciliarios cobraron y no han entregado en caja.</summary>
        public decimal EfectivoPorLiquidar { get; set; }
    }
}