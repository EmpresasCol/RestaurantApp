using RestaurantApp.API.DTOs;

namespace RestaurantApp.API.Services;

public interface IStockService
{
    Task<IEnumerable<StockDto>> GetAllStockAsync();
    Task<IEnumerable<ProductStockDto>> GetProductStockSummaryAsync();
    Task<ProductStockDto?> GetProductStockByIdAsync(int productId);
    Task<IEnumerable<StockDto>> GetStockByWarehouseAsync(int warehouseId);
    Task<IEnumerable<StockAlertDto>> GetStockAlertsAsync();
    Task<StockMovementDto> RegisterMovementAsync(CreateStockMovementDto movementDto);
    Task<bool> AdjustStockAsync(StockAdjustmentDto adjustmentDto);
    Task<IEnumerable<StockMovementDto>> GetMovementHistoryAsync(int? productId = null, int? warehouseId = null);
}
