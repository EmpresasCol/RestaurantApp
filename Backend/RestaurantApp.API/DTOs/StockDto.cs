namespace RestaurantApp.API.DTOs;

public class StockDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public int WarehouseId { get; set; }
    public string WarehouseName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string UnitOfMeasure { get; set; } = string.Empty;
    public DateTime? ExpirationDate { get; set; }
    public string? Batch { get; set; }
    public DateTime LastUpdated { get; set; }

    // Alertas
    public bool IsLowStock { get; set; }
    public bool IsExpiringSoon { get; set; }
    public int? DaysUntilExpiration { get; set; }
}

public class StockByWarehouseDto
{
    public int WarehouseId { get; set; }
    public string WarehouseName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public DateTime? ExpirationDate { get; set; }
    public string? Batch { get; set; }
}

public class ProductStockDto
{
    public int ProductId { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public string UnitOfMeasure { get; set; } = string.Empty;
    public decimal TotalQuantity { get; set; }
    public decimal? MinimumStock { get; set; }
    public decimal? MaximumStock { get; set; }
    public bool IsLowStock { get; set; }
    public List<StockByWarehouseDto> StockByWarehouse { get; set; } = new();
}

public class StockAlertDto
{
    public int ProductId { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string AlertType { get; set; } = string.Empty; // LowStock, Expiring, Expired
    public decimal CurrentStock { get; set; }
    public decimal? MinimumStock { get; set; }
    public DateTime? ExpirationDate { get; set; }
    public int? DaysUntilExpiration { get; set; }
    public string WarehouseName { get; set; } = string.Empty;
}
