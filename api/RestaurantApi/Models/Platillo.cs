namespace RestaurantApi.Models
{
    public class Platillo
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public decimal Precio { get; set; }
        public string? ImagenUrl { get; set; }
        public string Categoria { get; set; } = "General"; // ✅ AGREGADO
    }
}