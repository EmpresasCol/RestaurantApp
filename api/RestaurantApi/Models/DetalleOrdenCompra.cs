namespace RestaurantApi.Models
{
    public class DetalleOrdenCompra
    {
        public int Id { get; set; }
        public int OrdenCompraId { get; set; }
        public int ProductoId { get; set; }
        public decimal Cantidad { get; set; }
        public decimal PrecioUnitario { get; set; }
        public decimal CantidadRecibida { get; set; } = 0;

        // Navegación
        public OrdenCompra? OrdenCompra { get; set; }
        public ProductoInventario? Producto { get; set; }
    }
}