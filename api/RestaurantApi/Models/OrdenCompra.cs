namespace RestaurantApi.Models
{
    public enum EstadoOrdenCompra
    {
        Pendiente,
        Aprobada,
        EnTransito,
        Recibida,
        Cancelada
    }

    public class OrdenCompra
    {
        public int Id { get; set; }
        public string NumeroOrden { get; set; } = null!;
        public int ProveedorId { get; set; }
        public int AlmacenDestinoId { get; set; }
        public int UsuarioCreadorId { get; set; }
        public DateTime FechaOrden { get; set; }
        public DateTime? FechaEntregaEstimada { get; set; }
        public DateTime? FechaEntregaReal { get; set; }
        public EstadoOrdenCompra Estado { get; set; } = EstadoOrdenCompra.Pendiente;
        public decimal Subtotal { get; set; } = 0;
        public decimal Impuestos { get; set; } = 0;
        public decimal Total { get; set; } = 0;
        public string? Notas { get; set; }
        public DateTime FechaCreacion { get; set; } = DateTime.Now;
        public DateTime FechaActualizacion { get; set; } = DateTime.Now;

        // Navegación
        public Proveedor? Proveedor { get; set; }
        public Almacen? AlmacenDestino { get; set; }
        public Usuario? UsuarioCreador { get; set; }
        public List<DetalleOrdenCompra> Detalles { get; set; } = new();
    }
}