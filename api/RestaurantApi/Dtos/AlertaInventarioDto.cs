namespace RestaurantApi.Dtos
{
    public class AlertaInventarioDto
    {
        public int Id { get; set; }
        public string TipoAlerta { get; set; } = string.Empty;
        public int ProductoId { get; set; }
        public string ProductoNombre { get; set; } = string.Empty;
        public int? AlmacenId { get; set; }
        public string? AlmacenNombre { get; set; }
        public int? LoteId { get; set; }
        public string? NumeroLote { get; set; }
        public string Mensaje { get; set; } = string.Empty;
        public string Nivel { get; set; } = string.Empty;
        public bool Leida { get; set; }
        public DateTime FechaGeneracion { get; set; }
        public DateTime? FechaLeida { get; set; }
    }
}