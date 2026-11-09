namespace RestaurantApi.Dtos
{
    public class StockDto
    {
        public int Id { get; set; }
        public int ProductoId { get; set; }
        public string ProductoNombre { get; set; } = string.Empty;
        public string? ProductoCodigo { get; set; }
        public int AlmacenId { get; set; }
        public string AlmacenNombre { get; set; } = string.Empty;
        public decimal Cantidad { get; set; }
        public string UnidadMedida { get; set; } = string.Empty;
        public decimal CostoPromedio { get; set; }
        public decimal CostoTotal { get; set; }
        public decimal StockMinimo { get; set; }
        public string EstadoStock { get; set; } = "Normal";
        public DateTime FechaUltimaActualizacion { get; set; }
    }

    public class ActualizarStockDto
    {
        public int ProductoId { get; set; }
        public int AlmacenId { get; set; }
        public decimal Cantidad { get; set; }
        public decimal? CostoUnitario { get; set; }
    }
}