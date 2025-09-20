namespace RestaurantApi.Dtos
{
    public class PedidoDetalleDto
    {
        public int Id { get; set; }
        public int PlatilloId { get; set; }
        public string PlatilloNombre { get; set; }
        public int Cantidad { get; set; }
        public string Estado { get; set; }
    }
}
