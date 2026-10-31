namespace RestaurantApi.Dtos
{
    public class PlatilloDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public decimal Precio { get; set; }
        public string ImagenUrl { get; set; } = string.Empty;
        public string Categoria { get; set; } = "General"; // ✅ AGREGADO
        /// <summary>False si no hay insumos para preparar al menos una porción.</summary>
        public bool Disponible { get; set; } = true;
        /// <summary>Porciones que alcanzan con el stock actual; null = sin control de inventario.</summary>
        public int? PorcionesDisponibles { get; set; }
    }
}