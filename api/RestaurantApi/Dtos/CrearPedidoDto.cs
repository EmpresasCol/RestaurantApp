namespace RestaurantApi.Dtos
{
    public class CrearPedidoDto
    {
        public int UsuarioId { get; set; }
        public int MesaId { get; set; }
        /// <summary>Código secreto del QR. Obligatorio en el pedido anónimo del comensal; ahí MesaId se ignora.</summary>
        public string? CodigoMesa { get; set; }
        public List<CrearDetalleDto> Detalles { get; set; } = new();
    }

    public class CrearDetalleDto
    {
        public int PlatilloId { get; set; }
        public int Cantidad { get; set; }
        public string? Nota { get; set; }  
    }
}