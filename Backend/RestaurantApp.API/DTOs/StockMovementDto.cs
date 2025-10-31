using RestaurantApp.API.Models;

namespace RestaurantApp.API.DTOs;

public class StockMovementDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public int WarehouseId { get; set; }
    public string WarehouseName { get; set; } = string.Empty;
    public MovementType Type { get; set; }
    public string TypeName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string UnitOfMeasure { get; set; } = string.Empty;
    public int? DestinationWarehouseId { get; set; }
    public string? DestinationWarehouseName { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public decimal? UnitCost { get; set; }
    public decimal? TotalCost { get; set; }
    public DateTime? ExpirationDate { get; set; }
    public string? Batch { get; set; }
    public string? UserId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateStockMovementDto
{
    public int ProductId { get; set; }
    public int WarehouseId { get; set; }
    public MovementType Type { get; set; }
    public decimal Quantity { get; set; }
    public int? DestinationWarehouseId { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public decimal? UnitCost { get; set; }
    public DateTime? ExpirationDate { get; set; }
    public string? Batch { get; set; }
}

public class StockAdjustmentDto
{
    public int ProductId { get; set; }
    public int WarehouseId { get; set; }
    public decimal NewQuantity { get; set; }
    public string? Reason { get; set; }
}
