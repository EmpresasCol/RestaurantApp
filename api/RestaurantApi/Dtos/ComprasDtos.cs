using System.ComponentModel.DataAnnotations;

namespace RestaurantApi.Dtos
{
    public class PresentacionCompraDto
    {
        [Required] public int ProductoId { get; set; }
        [Required, StringLength(150)] public string Nombre { get; set; } = "";
        [Range(0.001, 999999)] public decimal Factor { get; set; } = 1;
        [StringLength(100)] public string? Codigo { get; set; }
        public int? ProveedorId { get; set; }
        [Range(0, 999999999)] public decimal? CostoReferencia { get; set; }
        public bool Activo { get; set; } = true;
    }

    /// <summary>Mercancía que llega: con o sin orden de compra.</summary>
    public class RecepcionDto
    {
        [Required] public int AlmacenId { get; set; }
        public int? ProveedorId { get; set; }
        public int? OrdenCompraId { get; set; }
        /// <summary>Número de factura o remisión del proveedor.</summary>
        [StringLength(60)] public string? Documento { get; set; }
        public List<RecepcionLineaDto> Lineas { get; set; } = new();
    }

    public class RecepcionLineaDto
    {
        [Required] public int ProductoId { get; set; }
        /// <summary>Si viene, Cantidad y CostoUnitario son por presentación (caja, bulto).</summary>
        public int? PresentacionId { get; set; }
        [Range(0.001, 9999999)] public decimal Cantidad { get; set; }
        [Range(0, 999999999)] public decimal? CostoUnitario { get; set; }
        public DateTime? FechaVencimiento { get; set; }
        [StringLength(50)] public string? NumeroLote { get; set; }
    }

    /// <summary>Corrige un lote registrado con datos equivocados.</summary>
    public class EditarLoteDto
    {
        /// <summary>Null quita la fecha (solo si el insumo no es perecedero).</summary>
        public DateTime? FechaVencimiento { get; set; }
        [StringLength(50)] public string? NumeroLote { get; set; }
    }

    /// <summary>Mover existencias entre almacenes (bodega → cocina, por ejemplo).</summary>
    public class TrasladoDto
    {
        [Required] public int ProductoId { get; set; }
        [Required] public int AlmacenOrigenId { get; set; }
        [Required] public int AlmacenDestinoId { get; set; }
        [Range(0.001, 9999999)] public decimal Cantidad { get; set; }
        [StringLength(300)] public string? Motivo { get; set; }
    }

    public class BajaLoteDto
    {
        [StringLength(300)] public string? Motivo { get; set; }
    }

    /// <summary>Toma física: lo contado reemplaza lo que dice el sistema.</summary>
    public class ConteoDto
    {
        [Required] public int AlmacenId { get; set; }
        public List<ConteoLineaDto> Lineas { get; set; } = new();
    }

    public class ConteoLineaDto
    {
        [Required] public int ProductoId { get; set; }
        [Range(0, 9999999)] public decimal CantidadContada { get; set; }
    }

    public class CrearOrdenCompraDto
    {
        [Required] public int ProveedorId { get; set; }
        [Required] public int AlmacenDestinoId { get; set; }
        public DateTime? FechaEntregaEstimada { get; set; }
        [StringLength(500)] public string? Notas { get; set; }
        public List<OrdenCompraLineaDto> Lineas { get; set; } = new();
    }

    /// <summary>Cantidad y precio en la unidad del insumo.</summary>
    public class OrdenCompraLineaDto
    {
        [Required] public int ProductoId { get; set; }
        [Range(0.001, 9999999)] public decimal Cantidad { get; set; }
        [Range(0, 999999999)] public decimal PrecioUnitario { get; set; }
    }

    public class EstadoOrdenCompraDto
    {
        [Required] public string Estado { get; set; } = "";
    }
}
