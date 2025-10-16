using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;

namespace RestaurantApi
{
    public class RestauranteContext : DbContext
    {
        public RestauranteContext(DbContextOptions<RestauranteContext> options) : base(options) { }

        public DbSet<Usuario> Usuarios { get; set; }
        public DbSet<Mesa> Mesas { get; set; }
        public DbSet<Platillo> Platillos { get; set; }
        public DbSet<Pedido> Pedidos { get; set; }
        public DbSet<PedidoDetalle> PedidoDetalles { get; set; }
        public DbSet<Pago> Pagos { get; set; }
        public DbSet<Factura> Facturas { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // ==========================================
            // CONFIGURACIÓN DE PLATILLOS
            // ==========================================
            modelBuilder.Entity<Platillo>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Nombre)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.Descripcion)
                    .HasColumnType("TEXT");

                entity.Property(e => e.Precio)
                    .HasColumnType("decimal(10,2)")
                    .IsRequired();

                // ✅ Configuración de ImagenUrl como LONGTEXT para soportar Base64
                entity.Property(e => e.ImagenUrl)
                    .HasColumnType("LONGTEXT");

                entity.Property(e => e.Categoria)
                    .IsRequired()
                    .HasMaxLength(50)
                    .HasDefaultValue("Platos Principales");

                entity.HasIndex(e => e.Categoria).HasDatabaseName("idx_categoria");
                entity.HasIndex(e => e.Nombre).HasDatabaseName("idx_nombre");
            });

            // ==========================================
            // CONFIGURACIÓN DE ENUMS COMO STRINGS
            // ==========================================
            modelBuilder.Entity<Usuario>()
                .Property(u => u.Rol)
                .HasConversion<string>();

            modelBuilder.Entity<Mesa>()
                .Property(m => m.Estado)
                .HasConversion<string>();

            modelBuilder.Entity<Pedido>()
                .Property(p => p.Estado)
                .HasConversion<string>();

            modelBuilder.Entity<PedidoDetalle>()
                .Property(pd => pd.Estado)
                .HasConversion<string>();

            modelBuilder.Entity<Pago>()
                .Property(p => p.MetodoPago)
                .HasConversion<string>();

            // ==========================================
            // OTRAS CONFIGURACIONES DECIMALES
            // ==========================================
            modelBuilder.Entity<Pago>()
                .Property(p => p.Monto)
                .HasColumnType("decimal(10,2)");

            modelBuilder.Entity<Pago>()
                .Property(p => p.MontoPropina)
                .HasColumnType("decimal(10,2)");

            modelBuilder.Entity<Factura>()
                .Property(f => f.Subtotal)
                .HasColumnType("decimal(10,2)");

            modelBuilder.Entity<Factura>()
                .Property(f => f.Propina)
                .HasColumnType("decimal(10,2)");

            modelBuilder.Entity<Factura>()
                .Property(f => f.Total)
                .HasColumnType("decimal(10,2)");
        }
    }
}