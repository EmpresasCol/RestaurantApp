using RestaurantApp.API.Models;

namespace RestaurantApp.API.DTOs;

public class ProductDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ProductType Type { get; set; }
    public string TypeName { get; set; } = string.Empty;

    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;

    public int UnitOfMeasureId { get; set; }
    public string UnitOfMeasureName { get; set; } = string.Empty;
    public string UnitOfMeasureAbbreviation { get; set; } = string.Empty;

    public int? SupplierId { get; set; }
    public string? SupplierName { get; set; }

    public decimal PurchasePrice { get; set; }
    public decimal AverageCost { get; set; }
    public decimal? SalePrice { get; set; }

    public bool HasExpirationDate { get; set; }
    public int? ShelfLifeDays { get; set; }

    public decimal? MinimumStock { get; set; }
    public decimal? MaximumStock { get; set; }

    public bool IsActive { get; set; }

    // Stock total (suma de todos los almacenes)
    public decimal TotalStock { get; set; }
}

public class CreateProductDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ProductType Type { get; set; }
    public int CategoryId { get; set; }
    public int UnitOfMeasureId { get; set; }
    public int? SupplierId { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal? SalePrice { get; set; }
    public bool HasExpirationDate { get; set; }
    public int? ShelfLifeDays { get; set; }
    public decimal? MinimumStock { get; set; }
    public decimal? MaximumStock { get; set; }
}

public class UpdateProductDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ProductType Type { get; set; }
    public int CategoryId { get; set; }
    public int UnitOfMeasureId { get; set; }
    public int? SupplierId { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal? SalePrice { get; set; }
    public bool HasExpirationDate { get; set; }
    public int? ShelfLifeDays { get; set; }
    public decimal? MinimumStock { get; set; }
    public decimal? MaximumStock { get; set; }
    public bool IsActive { get; set; }
}
