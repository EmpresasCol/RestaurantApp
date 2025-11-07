namespace RestaurantApi.Dtos
{
    public class OrdenCompraDto
    {
        public int Id { get; set; }
        public string NumeroOrden { get; set; } = string.Empty;
        public int ProveedorId { get; set; }
        public string ProveedorNombre { get; set; } = string.Empty;
        public int AlmacenDestinoId { get; set; }
        public string AlmacenDestinoNombre { get; set; } = string.Empty;
        public int UsuarioCreadorId { get; set; }
        public string UsuarioCreadorNombre { get; set; } = string.Empty;
        public DateTime FechaOrden { get; set; }
        public DateTime? FechaEntregaEstimada { get; set; }
        public DateTime? FechaEntregaReal { get; set; }
        public string Estado { get; set; } = string.Empty;
        public decimal Subtotal { get; set; }
        public decimal Impuestos { get; set; }
        public decimal Total { get; set; }
        public string? Notas { get; set; }
        public List<DetalleOrdenCompraDto> Detalles { get; set; } = new();
    }

    public class DetalleOrdenCompraDto
    {
        public int Id { get; set; }
        public int ProductoId { get; set; }
        public string ProductoNombre { get; set; } = string.Empty;
        public decimal Cantidad { get; set; }
        public string UnidadMedida { get; set; } = string.Empty;
        public decimal PrecioUnitario { get; set; }
        public decimal Subtotal { get; set; }
        public decimal CantidadRecibida { get; set; }
    }

    public class CrearOrdenCompraDto
    {
        public int ProveedorId { get; set; }
        public int AlmacenDestinoId { get; set; }
        public int UsuarioCreadorId { get; set; }
        public DateTime FechaOrden { get; set; }
        public DateTime? FechaEntregaEstimada { get; set; }
        public decimal Impuestos { get; set; } = 0;
        public string? Notas { get; set; }
        public List<CrearDetalleOrdenCompraDto> Detalles { get; set; } = new();
    }

    public class CrearDetalleOrdenCompraDto
    {
        public int ProductoId { get; set; }
        public decimal Cantidad { get; set; }
        public decimal PrecioUnitario { get; set; }
    }
}