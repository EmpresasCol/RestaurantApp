namespace RestaurantApi.Dtos
{
    public class CrearPedidoDto
    {
        public int MesaId { get; set; }
        public List<CrearDetalleDto> Detalles { get; set; } = new();
    }

    public class CrearDetalleDto
    {
        public int PlatilloId { get; set; }
        public int Cantidad { get; set; }
        public string? Nota { get; set; }  
    }
}