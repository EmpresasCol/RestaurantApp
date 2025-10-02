namespace RestaurantApi.Dtos
{
    public class PedidoDetalleDto
    {
        public int Id { get; set; }
        public int PlatilloId { get; set; }
        public string PlatilloNombre { get; set; } = string.Empty;
        public int Cantidad { get; set; }
        public decimal Precio { get; set; }
        public string? Nota { get; set; }  // ← AGREGADO
        public string Estado { get; set; } = string.Empty;
    }
}