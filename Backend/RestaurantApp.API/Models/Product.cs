namespace RestaurantApp.API.Models;

public enum ProductType
{
    Ingredient,      // Ingrediente
    Beverage,        // Bebida
    CleaningSupply,  // Material de limpieza
    FinishedProduct, // Producto terminado
    Other            // Otro
}

public class Product
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty; // Código único del producto
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ProductType Type { get; set; }

    // Categoría
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;

    // Unidad de medida
    public int UnitOfMeasureId { get; set; }
    public UnitOfMeasure UnitOfMeasure { get; set; } = null!;

    // Proveedor
    public int? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    // Precios y costos
    public decimal PurchasePrice { get; set; }
    public decimal AverageCost { get; set; }
    public decimal? SalePrice { get; set; }

    // Control de caducidad
    public bool HasExpirationDate { get; set; }
    public int? ShelfLifeDays { get; set; } // Vida útil en días

    // Stock mínimo y máximo
    public decimal? MinimumStock { get; set; }
    public decimal? MaximumStock { get; set; }

    // Estado
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Relaciones
    public ICollection<Stock> Stocks { get; set; } = new List<Stock>();
    public ICollection<StockMovement> StockMovements { get; set; } = new List<StockMovement>();
}
