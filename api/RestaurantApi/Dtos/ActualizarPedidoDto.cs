namespace RestaurantApi.Dtos
{
    public class ActualizarPedidoDto
    {
        public List<ActualizarPedidoDetalleDto> Detalles { get; set; }
        public string? Estado { get; set; }
    }

    public class ActualizarPedidoDetalleDto
    {
        public int? Id { get; set; }  // Si es null, es un nuevo item
        public int PlatilloId { get; set; }
        public int Cantidad { get; set; }
        public string? Nota { get; set; }
        public bool Eliminar { get; set; } = false;  // Para marcar items a eliminar
    }
}