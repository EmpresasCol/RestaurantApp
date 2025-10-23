namespace RestaurantApi.Dtos
{
    public class ActualizarPedidoCompletoDto
    {
        public List<CrearDetalleDto> Detalles { get; set; } = new();
    }
}