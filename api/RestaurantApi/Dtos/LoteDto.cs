namespace RestaurantApi.Dtos
{
    public class LoteDto
    {
        public int Id { get; set; }
        public int ProductoId { get; set; }
        public string ProductoNombre { get; set; } = string.Empty;
        public int AlmacenId { get; set; }
        public string AlmacenNombre { get; set; } = string.Empty;
        public string NumeroLote { get; set; } = string.Empty;
        public DateTime FechaIngreso { get; set; }
        public DateTime? FechaVencimiento { get; set; }
        public decimal CantidadInicial { get; set; }
        public decimal CantidadActual { get; set; }
        public decimal PrecioCosto { get; set; }
        public string Estado { get; set; } = string.Empty;
        public int? DiasParaVencer { get; set; }
        public string NivelAlerta { get; set; } = "Normal";
        public string? Proveedor { get; set; }
        public string? NotasCalidad { get; set; }
    }

    public class CrearLoteDto
    {
        public int ProductoId { get; set; }
        public int AlmacenId { get; set; }
        public string NumeroLote { get; set; } = string.Empty;
        public DateTime FechaIngreso { get; set; }
        public DateTime? FechaVencimiento { get; set; }
        public decimal Cantidad { get; set; }
        public decimal PrecioCosto { get; set; }
        public string? Proveedor { get; set; }
        public string? NotasCalidad { get; set; }
    }
}