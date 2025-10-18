namespace RestaurantApi.Dtos
{
    public class PedidoDto
    {
        public int Id { get; set; }
        public int MesaId { get; set; }
        public int MesaNumero { get; set; }
        public string Estado { get; set; } = string.Empty;
        public DateTime Fecha { get; set; }

        public int UsuarioId { get; set; }
        public string MeseroNombre { get; set; } = "Sin asignar";

        public List<PedidoDetalleDto> Detalles { get; set; } = new();
    }
}