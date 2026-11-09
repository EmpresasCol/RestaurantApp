namespace RestaurantApi.Models
{
    /// <summary>
    /// Forma en que se compra un insumo (producto de compra), separada del insumo que gastan
    /// las recetas. "Leche Alquería caja x12" → 12 litros del insumo "Leche".
    /// Un insumo puede tener varias presentaciones y cada una su código de barras, así que
    /// varios códigos (unidad, caja, otra marca) llevan al mismo insumo.
    /// </summary>
    public class PresentacionCompra
    {
        public int Id { get; set; }
        public int ProductoId { get; set; }
        public string Nombre { get; set; } = null!;
        /// <summary>Cuántas unidades del insumo (su UnidadMedida) trae una presentación.</summary>
        public decimal Factor { get; set; } = 1;
        /// <summary>Código de barras (EAN/UPC/interno). Único en todo el inventario.</summary>
        public string? Codigo { get; set; }
        public int? ProveedorId { get; set; }
        /// <summary>Último precio pagado por presentación.</summary>
        public decimal? CostoReferencia { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

        public ProductoInventario? Producto { get; set; }
        public Proveedor? Proveedor { get; set; }
    }
}
