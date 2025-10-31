using Microsoft.EntityFrameworkCore;
using RestaurantApp.API.Data;
using RestaurantApp.API.DTOs;
using RestaurantApp.API.Models;

namespace RestaurantApp.API.Services;

public class StockService : IStockService
{
    private readonly ApplicationDbContext _context;

    public StockService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<StockDto>> GetAllStockAsync()
    {
        return await _context.Stocks
            .Include(s => s.Product)
                .ThenInclude(p => p.UnitOfMeasure)
            .Include(s => s.Warehouse)
            .Select(s => MapToStockDto(s))
            .ToListAsync();
    }

    public async Task<IEnumerable<ProductStockDto>> GetProductStockSummaryAsync()
    {
        var products = await _context.Products
            .Include(p => p.Category)
            .Include(p => p.UnitOfMeasure)
            .Include(p => p.Stocks)
                .ThenInclude(s => s.Warehouse)
            .Where(p => p.IsActive)
            .ToListAsync();

        return products.Select(p => new ProductStockDto
        {
            ProductId = p.Id,
            ProductCode = p.Code,
            ProductName = p.Name,
            CategoryName = p.Category.Name,
            UnitOfMeasure = p.UnitOfMeasure.Abbreviation,
            TotalQuantity = p.Stocks.Sum(s => s.Quantity),
            MinimumStock = p.MinimumStock,
            MaximumStock = p.MaximumStock,
            IsLowStock = p.MinimumStock.HasValue && p.Stocks.Sum(s => s.Quantity) <= p.MinimumStock.Value,
            StockByWarehouse = p.Stocks.GroupBy(s => new { s.WarehouseId, s.Warehouse.Name })
                .Select(g => new StockByWarehouseDto
                {
                    WarehouseId = g.Key.WarehouseId,
                    WarehouseName = g.Key.Name,
                    Quantity = g.Sum(s => s.Quantity),
                    ExpirationDate = g.Min(s => s.ExpirationDate),
                    Batch = string.Join(", ", g.Where(s => !string.IsNullOrEmpty(s.Batch)).Select(s => s.Batch).Distinct())
                }).ToList()
        }).ToList();
    }

    public async Task<ProductStockDto?> GetProductStockByIdAsync(int productId)
    {
        var product = await _context.Products
            .Include(p => p.Category)
            .Include(p => p.UnitOfMeasure)
            .Include(p => p.Stocks)
                .ThenInclude(s => s.Warehouse)
            .FirstOrDefaultAsync(p => p.Id == productId);

        if (product == null)
            return null;

        return new ProductStockDto
        {
            ProductId = product.Id,
            ProductCode = product.Code,
            ProductName = product.Name,
            CategoryName = product.Category.Name,
            UnitOfMeasure = product.UnitOfMeasure.Abbreviation,
            TotalQuantity = product.Stocks.Sum(s => s.Quantity),
            MinimumStock = product.MinimumStock,
            MaximumStock = product.MaximumStock,
            IsLowStock = product.MinimumStock.HasValue && product.Stocks.Sum(s => s.Quantity) <= product.MinimumStock.Value,
            StockByWarehouse = product.Stocks.GroupBy(s => new { s.WarehouseId, s.Warehouse.Name })
                .Select(g => new StockByWarehouseDto
                {
                    WarehouseId = g.Key.WarehouseId,
                    WarehouseName = g.Key.Name,
                    Quantity = g.Sum(s => s.Quantity),
                    ExpirationDate = g.Min(s => s.ExpirationDate),
                    Batch = string.Join(", ", g.Where(s => !string.IsNullOrEmpty(s.Batch)).Select(s => s.Batch).Distinct())
                }).ToList()
        };
    }

    public async Task<IEnumerable<StockDto>> GetStockByWarehouseAsync(int warehouseId)
    {
        return await _context.Stocks
            .Include(s => s.Product)
                .ThenInclude(p => p.UnitOfMeasure)
            .Include(s => s.Warehouse)
            .Where(s => s.WarehouseId == warehouseId)
            .Select(s => MapToStockDto(s))
            .ToListAsync();
    }

    public async Task<IEnumerable<StockAlertDto>> GetStockAlertsAsync()
    {
        var alerts = new List<StockAlertDto>();

        // Alertas de stock bajo
        var lowStockProducts = await _context.Products
            .Include(p => p.Stocks)
                .ThenInclude(s => s.Warehouse)
            .Where(p => p.IsActive && p.MinimumStock.HasValue)
            .ToListAsync();

        foreach (var product in lowStockProducts)
        {
            var totalStock = product.Stocks.Sum(s => s.Quantity);
            if (totalStock <= product.MinimumStock!.Value)
            {
                alerts.Add(new StockAlertDto
                {
                    ProductId = product.Id,
                    ProductCode = product.Code,
                    ProductName = product.Name,
                    AlertType = "LowStock",
                    CurrentStock = totalStock,
                    MinimumStock = product.MinimumStock,
                    WarehouseName = "Todos"
                });
            }
        }

        // Alertas de productos por vencer
        var expiringProducts = await _context.Stocks
            .Include(s => s.Product)
            .Include(s => s.Warehouse)
            .Where(s => s.ExpirationDate.HasValue && s.ExpirationDate.Value <= DateTime.UtcNow.AddDays(30))
            .ToListAsync();

        foreach (var stock in expiringProducts)
        {
            var daysUntilExpiration = (stock.ExpirationDate!.Value - DateTime.UtcNow).Days;
            alerts.Add(new StockAlertDto
            {
                ProductId = stock.ProductId,
                ProductCode = stock.Product.Code,
                ProductName = stock.Product.Name,
                AlertType = daysUntilExpiration < 0 ? "Expired" : "Expiring",
                CurrentStock = stock.Quantity,
                ExpirationDate = stock.ExpirationDate,
                DaysUntilExpiration = daysUntilExpiration,
                WarehouseName = stock.Warehouse.Name
            });
        }

        return alerts;
    }

    public async Task<StockMovementDto> RegisterMovementAsync(CreateStockMovementDto movementDto)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            // Crear el movimiento
            var movement = new StockMovement
            {
                ProductId = movementDto.ProductId,
                WarehouseId = movementDto.WarehouseId,
                Type = movementDto.Type,
                Quantity = movementDto.Quantity,
                DestinationWarehouseId = movementDto.DestinationWarehouseId,
                Reference = movementDto.Reference,
                Notes = movementDto.Notes,
                UnitCost = movementDto.UnitCost,
                TotalCost = movementDto.UnitCost.HasValue ? movementDto.UnitCost.Value * movementDto.Quantity : null,
                ExpirationDate = movementDto.ExpirationDate,
                Batch = movementDto.Batch,
                CreatedAt = DateTime.UtcNow
            };

            _context.StockMovements.Add(movement);

            // Actualizar el stock
            await UpdateStockQuantityAsync(movementDto.ProductId, movementDto.WarehouseId,
                movementDto.Quantity, movementDto.Type, movementDto.ExpirationDate, movementDto.Batch);

            // Si es transferencia, actualizar el almacén de destino
            if (movementDto.Type == MovementType.Transfer && movementDto.DestinationWarehouseId.HasValue)
            {
                await UpdateStockQuantityAsync(movementDto.ProductId, movementDto.DestinationWarehouseId.Value,
                    movementDto.Quantity, MovementType.Entry, movementDto.ExpirationDate, movementDto.Batch);
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return (await GetMovementByIdAsync(movement.Id))!;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> AdjustStockAsync(StockAdjustmentDto adjustmentDto)
    {
        var stock = await _context.Stocks
            .FirstOrDefaultAsync(s => s.ProductId == adjustmentDto.ProductId &&
                                     s.WarehouseId == adjustmentDto.WarehouseId);

        if (stock == null)
        {
            stock = new Stock
            {
                ProductId = adjustmentDto.ProductId,
                WarehouseId = adjustmentDto.WarehouseId,
                Quantity = adjustmentDto.NewQuantity,
                LastUpdated = DateTime.UtcNow
            };
            _context.Stocks.Add(stock);
        }
        else
        {
            var difference = adjustmentDto.NewQuantity - stock.Quantity;

            // Registrar el ajuste como movimiento
            var movement = new StockMovement
            {
                ProductId = adjustmentDto.ProductId,
                WarehouseId = adjustmentDto.WarehouseId,
                Type = MovementType.Adjustment,
                Quantity = difference,
                Notes = adjustmentDto.Reason,
                CreatedAt = DateTime.UtcNow
            };
            _context.StockMovements.Add(movement);

            stock.Quantity = adjustmentDto.NewQuantity;
            stock.LastUpdated = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<StockMovementDto>> GetMovementHistoryAsync(int? productId = null, int? warehouseId = null)
    {
        var query = _context.StockMovements
            .Include(m => m.Product)
                .ThenInclude(p => p.UnitOfMeasure)
            .Include(m => m.Warehouse)
            .AsQueryable();

        if (productId.HasValue)
            query = query.Where(m => m.ProductId == productId.Value);

        if (warehouseId.HasValue)
            query = query.Where(m => m.WarehouseId == warehouseId.Value);

        return await query
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => MapToMovementDto(m))
            .ToListAsync();
    }

    private async Task UpdateStockQuantityAsync(int productId, int warehouseId, decimal quantity,
        MovementType type, DateTime? expirationDate, string? batch)
    {
        var stock = await _context.Stocks
            .FirstOrDefaultAsync(s => s.ProductId == productId &&
                                     s.WarehouseId == warehouseId &&
                                     (string.IsNullOrEmpty(batch) || s.Batch == batch));

        var quantityChange = type == MovementType.Entry ? quantity : -quantity;

        if (stock == null)
        {
            if (quantityChange > 0)
            {
                stock = new Stock
                {
                    ProductId = productId,
                    WarehouseId = warehouseId,
                    Quantity = quantityChange,
                    ExpirationDate = expirationDate,
                    Batch = batch,
                    LastUpdated = DateTime.UtcNow
                };
                _context.Stocks.Add(stock);
            }
        }
        else
        {
            stock.Quantity += quantityChange;
            stock.LastUpdated = DateTime.UtcNow;

            if (stock.Quantity < 0)
                throw new InvalidOperationException("Stock insuficiente para realizar la operación");

            if (stock.Quantity == 0)
                _context.Stocks.Remove(stock);
        }
    }

    private async Task<StockMovementDto?> GetMovementByIdAsync(int id)
    {
        var movement = await _context.StockMovements
            .Include(m => m.Product)
                .ThenInclude(p => p.UnitOfMeasure)
            .Include(m => m.Warehouse)
            .FirstOrDefaultAsync(m => m.Id == id);

        return movement == null ? null : MapToMovementDto(movement);
    }

    private static StockDto MapToStockDto(Stock stock)
    {
        var daysUntilExpiration = stock.ExpirationDate.HasValue
            ? (stock.ExpirationDate.Value - DateTime.UtcNow).Days
            : (int?)null;

        return new StockDto
        {
            Id = stock.Id,
            ProductId = stock.ProductId,
            ProductCode = stock.Product.Code,
            ProductName = stock.Product.Name,
            WarehouseId = stock.WarehouseId,
            WarehouseName = stock.Warehouse.Name,
            Quantity = stock.Quantity,
            UnitOfMeasure = stock.Product.UnitOfMeasure.Abbreviation,
            ExpirationDate = stock.ExpirationDate,
            Batch = stock.Batch,
            LastUpdated = stock.LastUpdated,
            IsLowStock = stock.Product.MinimumStock.HasValue && stock.Quantity <= stock.Product.MinimumStock.Value,
            IsExpiringSoon = daysUntilExpiration.HasValue && daysUntilExpiration.Value <= 30,
            DaysUntilExpiration = daysUntilExpiration
        };
    }

    private static StockMovementDto MapToMovementDto(StockMovement movement)
    {
        return new StockMovementDto
        {
            Id = movement.Id,
            ProductId = movement.ProductId,
            ProductCode = movement.Product.Code,
            ProductName = movement.Product.Name,
            WarehouseId = movement.WarehouseId,
            WarehouseName = movement.Warehouse.Name,
            Type = movement.Type,
            TypeName = movement.Type.ToString(),
            Quantity = movement.Quantity,
            UnitOfMeasure = movement.Product.UnitOfMeasure.Abbreviation,
            DestinationWarehouseId = movement.DestinationWarehouseId,
            Reference = movement.Reference,
            Notes = movement.Notes,
            UnitCost = movement.UnitCost,
            TotalCost = movement.TotalCost,
            ExpirationDate = movement.ExpirationDate,
            Batch = movement.Batch,
            UserId = movement.UserId,
            CreatedAt = movement.CreatedAt
        };
    }
}
