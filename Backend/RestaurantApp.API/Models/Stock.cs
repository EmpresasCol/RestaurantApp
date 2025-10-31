namespace RestaurantApp.API.Models;

public class Stock
{
    public int Id { get; set; }

    // Producto
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    // Almacén
    public int WarehouseId { get; set; }
    public Warehouse Warehouse { get; set; } = null!;

    // Cantidad
    public decimal Quantity { get; set; }

    // Control de caducidad
    public DateTime? ExpirationDate { get; set; }
    public string? Batch { get; set; } // Lote

    // Metadatos
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
}
