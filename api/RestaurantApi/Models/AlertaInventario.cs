namespace RestaurantApi.Models
{
    public enum TipoAlerta
    {
        StockBajo,
        StockCritico,
        Vencimiento,
        Vencido,
        StockExcedido
    }

    public enum NivelAlerta
    {
        Info,
        Advertencia,
        Critico
    }

    public class AlertaInventario
    {
        public int Id { get; set; }
        public TipoAlerta TipoAlerta { get; set; }
        public int ProductoId { get; set; }
        public int? AlmacenId { get; set; }
        public int? LoteId { get; set; }
        public string Mensaje { get; set; } = null!;
        public NivelAlerta Nivel { get; set; } = NivelAlerta.Info;
        public bool Leida { get; set; } = false;
        public DateTime FechaGeneracion { get; set; } = DateTime.Now;
        public DateTime? FechaLeida { get; set; }

        // Navegación
        public ProductoInventario? Producto { get; set; }
        public Almacen? Almacen { get; set; }
        public Lote? Lote { get; set; }
    }
}