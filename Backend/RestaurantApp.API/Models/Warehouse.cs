namespace RestaurantApp.API.Models;

public class Warehouse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // Cocina principal, Bar, Bodega de bebidas, etc.
    public string? Description { get; set; }
    public string? Location { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Relaciones
    public ICollection<Stock> Stocks { get; set; } = new List<Stock>();
    public ICollection<StockMovement> StockMovements { get; set; } = new List<StockMovement>();
}
