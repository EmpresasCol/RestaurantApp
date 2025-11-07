namespace RestaurantApi.Dtos
{
    public class ResumenInventarioDto
    {
        public int TotalProductos { get; set; }
        public int ProductosActivos { get; set; }
        public int ProductosAgotados { get; set; }
        public int ProductosStockBajo { get; set; }
        public int ProductosStockCritico { get; set; }
        public decimal ValorTotalInventario { get; set; }
        public int TotalAlmacenes { get; set; }
        public int AlertasPendientes { get; set; }
        public int LotesPorVencer { get; set; }
    }

    public class ProductoStockBajoDto
    {
        public int ProductoId { get; set; }
        public string ProductoNombre { get; set; } = string.Empty;
        public string Categoria { get; set; } = string.Empty;
        public decimal StockActual { get; set; }
        public decimal StockMinimo { get; set; }
        public decimal? PuntoReorden { get; set; }
        public string UnidadMedida { get; set; } = string.Empty;
        public string Nivel { get; set; } = "Bajo";
    }

    public class MovimientosPeriodoDto
    {
        public DateTime FechaInicio { get; set; }
        public DateTime FechaFin { get; set; }
        public int TotalMovimientos { get; set; }
        public int Entradas { get; set; }
        public int Salidas { get; set; }
        public int Ajustes { get; set; }
        public int Transferencias { get; set; }
        public decimal ValorEntradas { get; set; }
        public decimal ValorSalidas { get; set; }
    }

    public class ProductoMasMovidoDto
    {
        public int ProductoId { get; set; }
        public string ProductoNombre { get; set; } = string.Empty;
        public string Categoria { get; set; } = string.Empty;
        public int TotalMovimientos { get; set; }
        public decimal CantidadTotal { get; set; }
        public string UnidadMedida { get; set; } = string.Empty;
    }
}