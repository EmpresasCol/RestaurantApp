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
    }

    // ✅ NUEVO DTO: Actualizar método de pago
    public class ActualizarMetodoPagoDto
    {
        public string MetodoPago { get; set; } = null!;
        public bool PagadoAnticipado { get; set; }
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
        public int Listo { get; set; }
        public int EnCamino { get; set; }
        public int Entregados { get; set; }
        public int Cancelados { get; set; }
        public decimal TotalVentas { get; set; }
    }
}