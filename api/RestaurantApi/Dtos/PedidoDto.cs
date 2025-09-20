namespace RestaurantApi.Dtos
{
    public class PedidoDto
    {
        public int Id { get; set; }
        public int MesaId { get; set; }
        public int UsuarioId { get; set; }
        public string Estado { get; set; }
        public DateTime Fecha { get; set; }
        public List<PedidoDetalleDto> Detalles { get; set; }
    }
}
