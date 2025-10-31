using Microsoft.EntityFrameworkCore;
using RestaurantApp.API.Models;

namespace RestaurantApp.API.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Category> Categories { get; set; }
    public DbSet<Supplier> Suppliers { get; set; }
    public DbSet<UnitOfMeasure> UnitOfMeasures { get; set; }
    public DbSet<Product> Products { get; set; }
    public DbSet<Warehouse> Warehouses { get; set; }
    public DbSet<Stock> Stocks { get; set; }
    public DbSet<StockMovement> StockMovements { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configuración de Category
        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.HasIndex(e => e.Name).IsUnique();
        });

        // Configuración de Supplier
        modelBuilder.Entity<Supplier>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.ContactName).HasMaxLength(200);
            entity.Property(e => e.Phone).HasMaxLength(50);
            entity.Property(e => e.Email).HasMaxLength(200);
            entity.Property(e => e.Address).HasMaxLength(500);
            entity.Property(e => e.TaxId).HasMaxLength(50);
        });

        // Configuración de UnitOfMeasure
        modelBuilder.Entity<UnitOfMeasure>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Abbreviation).IsRequired().HasMaxLength(10);
            entity.HasIndex(e => e.Name).IsUnique();
            entity.HasIndex(e => e.Abbreviation).IsUnique();
        });

        // Configuración de Product
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Code).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.PurchasePrice).HasColumnType("decimal(18,2)");
            entity.Property(e => e.AverageCost).HasColumnType("decimal(18,2)");
            entity.Property(e => e.SalePrice).HasColumnType("decimal(18,2)");
            entity.Property(e => e.MinimumStock).HasColumnType("decimal(18,2)");
            entity.Property(e => e.MaximumStock).HasColumnType("decimal(18,2)");

            entity.HasIndex(e => e.Code).IsUnique();
            entity.HasIndex(e => e.Name);

            // Relaciones
            entity.HasOne(e => e.Category)
                .WithMany(c => c.Products)
                .HasForeignKey(e => e.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.UnitOfMeasure)
                .WithMany(u => u.Products)
                .HasForeignKey(e => e.UnitOfMeasureId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Supplier)
                .WithMany(s => s.Products)
                .HasForeignKey(e => e.SupplierId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Configuración de Warehouse
        modelBuilder.Entity<Warehouse>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.Location).HasMaxLength(500);
            entity.HasIndex(e => e.Name).IsUnique();
        });

        // Configuración de Stock
        modelBuilder.Entity<Stock>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Quantity).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Batch).HasMaxLength(100);

            // Índice único compuesto: Un producto solo puede tener un registro de stock por almacén y lote
            entity.HasIndex(e => new { e.ProductId, e.WarehouseId, e.Batch });

            // Relaciones
            entity.HasOne(e => e.Product)
                .WithMany(p => p.Stocks)
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Warehouse)
                .WithMany(w => w.Stocks)
                .HasForeignKey(e => e.WarehouseId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configuración de StockMovement
        modelBuilder.Entity<StockMovement>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Quantity).HasColumnType("decimal(18,2)");
            entity.Property(e => e.UnitCost).HasColumnType("decimal(18,2)");
            entity.Property(e => e.TotalCost).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Reference).HasMaxLength(100);
            entity.Property(e => e.Notes).HasMaxLength(1000);
            entity.Property(e => e.Batch).HasMaxLength(100);
            entity.Property(e => e.UserId).HasMaxLength(100);

            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.Type);

            // Relaciones
            entity.HasOne(e => e.Product)
                .WithMany(p => p.StockMovements)
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Warehouse)
                .WithMany(w => w.StockMovements)
                .HasForeignKey(e => e.WarehouseId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Datos semilla (seed data)
        SeedData(modelBuilder);
    }

    private void SeedData(ModelBuilder modelBuilder)
    {
        // Unidades de medida
        modelBuilder.Entity<UnitOfMeasure>().HasData(
            new UnitOfMeasure { Id = 1, Name = "Kilogramo", Abbreviation = "kg", IsActive = true },
            new UnitOfMeasure { Id = 2, Name = "Gramo", Abbreviation = "g", IsActive = true },
            new UnitOfMeasure { Id = 3, Name = "Litro", Abbreviation = "L", IsActive = true },
            new UnitOfMeasure { Id = 4, Name = "Mililitro", Abbreviation = "ml", IsActive = true },
            new UnitOfMeasure { Id = 5, Name = "Unidad", Abbreviation = "u", IsActive = true },
            new UnitOfMeasure { Id = 6, Name = "Caja", Abbreviation = "cj", IsActive = true },
            new UnitOfMeasure { Id = 7, Name = "Libra", Abbreviation = "lb", IsActive = true },
            new UnitOfMeasure { Id = 8, Name = "Onza", Abbreviation = "oz", IsActive = true }
        );

        // Categorías
        modelBuilder.Entity<Category>().HasData(
            new Category { Id = 1, Name = "Carnes", Description = "Carnes y productos cárnicos", IsActive = true },
            new Category { Id = 2, Name = "Verduras", Description = "Verduras y hortalizas frescas", IsActive = true },
            new Category { Id = 3, Name = "Bebidas", Description = "Bebidas alcohólicas y no alcohólicas", IsActive = true },
            new Category { Id = 4, Name = "Lácteos", Description = "Productos lácteos", IsActive = true },
            new Category { Id = 5, Name = "Limpieza", Description = "Productos de limpieza", IsActive = true },
            new Category { Id = 6, Name = "Granos", Description = "Granos y cereales", IsActive = true },
            new Category { Id = 7, Name = "Condimentos", Description = "Condimentos y especias", IsActive = true },
            new Category { Id = 8, Name = "Aceites", Description = "Aceites y grasas", IsActive = true }
        );

        // Almacenes
        modelBuilder.Entity<Warehouse>().HasData(
            new Warehouse { Id = 1, Name = "Cocina Principal", Description = "Almacén principal de cocina", IsActive = true },
            new Warehouse { Id = 2, Name = "Bar", Description = "Almacén del bar", IsActive = true },
            new Warehouse { Id = 3, Name = "Bodega de Bebidas", Description = "Bodega de almacenamiento de bebidas", IsActive = true },
            new Warehouse { Id = 4, Name = "Bodega Seca", Description = "Almacén de productos secos", IsActive = true }
        );
    }
}
