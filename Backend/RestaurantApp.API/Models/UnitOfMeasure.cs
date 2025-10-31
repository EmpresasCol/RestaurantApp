namespace RestaurantApp.API.Models;

public class UnitOfMeasure
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // kg, lb, L, ml, unidad, caja, etc.
    public string Abbreviation { get; set; } = string.Empty; // kg, lb, L, ml, u, cj
    public bool IsActive { get; set; } = true;

    // Relaciones
    public ICollection<Product> Products { get; set; } = new List<Product>();
}
