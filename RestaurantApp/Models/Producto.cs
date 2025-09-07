using System.ComponentModel.DataAnnotations;

namespace RestaurantApp.Models
{
    public enum CategoriaProducto
    {
        Entrada,
        PlatoPrincipal,
        Postre,
        Bebida,
        Adicional
    }

    public class Producto
    {
        [Key]
        public int Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public decimal Precio { get; set; }
        public CategoriaProducto Categoria { get; set; }
        public bool EstaDisponible { get; set; } = true;
        public string? ImagenUrl { get; set; }
    }
}