using Microsoft.EntityFrameworkCore;
using RestaurantApp.API.Data;
using RestaurantApp.API.DTOs;
using RestaurantApp.API.Models;

namespace RestaurantApp.API.Services;

public class ProductService : IProductService
{
    private readonly ApplicationDbContext _context;

    public ProductService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<ProductDto>> GetAllProductsAsync()
    {
        return await _context.Products
            .Include(p => p.Category)
            .Include(p => p.UnitOfMeasure)
            .Include(p => p.Supplier)
            .Include(p => p.Stocks)
            .Select(p => MapToDto(p))
            .ToListAsync();
    }

    public async Task<ProductDto?> GetProductByIdAsync(int id)
    {
        var product = await _context.Products
            .Include(p => p.Category)
            .Include(p => p.UnitOfMeasure)
            .Include(p => p.Supplier)
            .Include(p => p.Stocks)
            .FirstOrDefaultAsync(p => p.Id == id);

        return product == null ? null : MapToDto(product);
    }

    public async Task<ProductDto> CreateProductAsync(CreateProductDto createProductDto)
    {
        var product = new Product
        {
            Code = createProductDto.Code,
            Name = createProductDto.Name,
            Description = createProductDto.Description,
            Type = createProductDto.Type,
            CategoryId = createProductDto.CategoryId,
            UnitOfMeasureId = createProductDto.UnitOfMeasureId,
            SupplierId = createProductDto.SupplierId,
            PurchasePrice = createProductDto.PurchasePrice,
            AverageCost = createProductDto.PurchasePrice,
            SalePrice = createProductDto.SalePrice,
            HasExpirationDate = createProductDto.HasExpirationDate,
            ShelfLifeDays = createProductDto.ShelfLifeDays,
            MinimumStock = createProductDto.MinimumStock,
            MaximumStock = createProductDto.MaximumStock,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        return (await GetProductByIdAsync(product.Id))!;
    }

    public async Task<ProductDto?> UpdateProductAsync(int id, UpdateProductDto updateProductDto)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null)
            return null;

        product.Code = updateProductDto.Code;
        product.Name = updateProductDto.Name;
        product.Description = updateProductDto.Description;
        product.Type = updateProductDto.Type;
        product.CategoryId = updateProductDto.CategoryId;
        product.UnitOfMeasureId = updateProductDto.UnitOfMeasureId;
        product.SupplierId = updateProductDto.SupplierId;
        product.PurchasePrice = updateProductDto.PurchasePrice;
        product.SalePrice = updateProductDto.SalePrice;
        product.HasExpirationDate = updateProductDto.HasExpirationDate;
        product.ShelfLifeDays = updateProductDto.ShelfLifeDays;
        product.MinimumStock = updateProductDto.MinimumStock;
        product.MaximumStock = updateProductDto.MaximumStock;
        product.IsActive = updateProductDto.IsActive;
        product.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return await GetProductByIdAsync(id);
    }

    public async Task<bool> DeleteProductAsync(int id)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null)
            return false;

        _context.Products.Remove(product);
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<IEnumerable<ProductDto>> GetProductsByCategoryAsync(int categoryId)
    {
        return await _context.Products
            .Include(p => p.Category)
            .Include(p => p.UnitOfMeasure)
            .Include(p => p.Supplier)
            .Include(p => p.Stocks)
            .Where(p => p.CategoryId == categoryId)
            .Select(p => MapToDto(p))
            .ToListAsync();
    }

    public async Task<IEnumerable<ProductDto>> GetLowStockProductsAsync()
    {
        return await _context.Products
            .Include(p => p.Category)
            .Include(p => p.UnitOfMeasure)
            .Include(p => p.Supplier)
            .Include(p => p.Stocks)
            .Where(p => p.MinimumStock.HasValue &&
                       p.Stocks.Sum(s => s.Quantity) <= p.MinimumStock.Value)
            .Select(p => MapToDto(p))
            .ToListAsync();
    }

    private static ProductDto MapToDto(Product product)
    {
        return new ProductDto
        {
            Id = product.Id,
            Code = product.Code,
            Name = product.Name,
            Description = product.Description,
            Type = product.Type,
            TypeName = product.Type.ToString(),
            CategoryId = product.CategoryId,
            CategoryName = product.Category.Name,
            UnitOfMeasureId = product.UnitOfMeasureId,
            UnitOfMeasureName = product.UnitOfMeasure.Name,
            UnitOfMeasureAbbreviation = product.UnitOfMeasure.Abbreviation,
            SupplierId = product.SupplierId,
            SupplierName = product.Supplier?.Name,
            PurchasePrice = product.PurchasePrice,
            AverageCost = product.AverageCost,
            SalePrice = product.SalePrice,
            HasExpirationDate = product.HasExpirationDate,
            ShelfLifeDays = product.ShelfLifeDays,
            MinimumStock = product.MinimumStock,
            MaximumStock = product.MaximumStock,
            IsActive = product.IsActive,
            TotalStock = product.Stocks.Sum(s => s.Quantity)
        };
    }
}
