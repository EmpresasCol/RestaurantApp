namespace RestaurantApp.API.Models;

public enum MovementType
{
    Entry,        // Entrada (compra, devolución)
    Exit,         // Salida (venta, consumo, merma)
    Transfer,     // Transferencia entre almacenes
    Adjustment    // Ajuste de inventario
}

public class StockMovement
{
    public int Id { get; set; }

    // Producto
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    // Almacén
    public int WarehouseId { get; set; }
    public Warehouse Warehouse { get; set; } = null!;

    // Tipo de movimiento
    public MovementType Type { get; set; }

    // Cantidad (positiva para entradas, negativa para salidas)
    public decimal Quantity { get; set; }

    // Transferencia (si aplica)
    public int? DestinationWarehouseId { get; set; }

    // Información adicional
    public string? Reference { get; set; } // Número de factura, orden, etc.
    public string? Notes { get; set; }
    public decimal? UnitCost { get; set; }
    public decimal? TotalCost { get; set; }

    // Control de caducidad
    public DateTime? ExpirationDate { get; set; }
    public string? Batch { get; set; }

    // Usuario y fecha
    public string? UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
