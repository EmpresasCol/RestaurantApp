namespace RestaurantApi.Dtos
{
    public class PlatilloDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public decimal Precio { get; set; }
        public string ImagenUrl { get; set; } = string.Empty;
        public string Categoria { get; set; } = string.Empty;
    }
}