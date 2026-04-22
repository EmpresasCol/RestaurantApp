// api/RestaurantApi/RestauranteContext.cs
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
        public DbSet<UsuarioFCM> UsuariosFCM { get; set; }

        // Domicilios
        public DbSet<Cliente> Clientes { get; set; }
        public DbSet<Direccion> Direcciones { get; set; }
        public DbSet<Domicilio> Domicilios { get; set; }
        public DbSet<DomicilioDetalle> DomicilioDetalles { get; set; }

        // Inventario
        public DbSet<CategoriaInventario> CategoriasInventario { get; set; }
        public DbSet<Proveedor> Proveedores { get; set; }
        public DbSet<Almacen> Almacenes { get; set; }
        public DbSet<ProductoInventario> ProductosInventario { get; set; }
        public DbSet<Stock> Stock { get; set; }
        public DbSet<Lote> Lotes { get; set; }
        public DbSet<MovimientoInventario> MovimientosInventario { get; set; }

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

            // ==========================================
            // CONFIGURACIÓN DE DOMICILIOS
            // ==========================================

            // Cliente
            modelBuilder.Entity<Cliente>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Nombre)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.Telefono)
                    .IsRequired()
                    .HasMaxLength(20);

                entity.Property(e => e.Email)
                    .HasMaxLength(100);

                entity.HasIndex(e => e.Telefono)
                    .HasDatabaseName("idx_telefono");

                entity.HasIndex(e => e.Nombre)
                    .HasDatabaseName("idx_nombre");
            });

            // Direccion
            modelBuilder.Entity<Direccion>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.DireccionCompleta)
                    .IsRequired()
                    .HasMaxLength(255)
                    .HasColumnName("Direccion"); // Mapear a columna "Direccion" en BD

                entity.Property(e => e.Barrio)
                    .HasMaxLength(100);

                entity.Property(e => e.Ciudad)
                    .IsRequired()
                    .HasMaxLength(100)
                    .HasDefaultValue("Sincelejo");

                entity.Property(e => e.Departamento)
                    .IsRequired()
                    .HasMaxLength(100)
                    .HasDefaultValue("Sucre");

                entity.HasOne(e => e.Cliente)
                    .WithMany(c => c.Direcciones)
                    .HasForeignKey(e => e.ClienteId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(e => e.ClienteId)
                    .HasDatabaseName("idx_cliente");

                entity.HasIndex(e => e.Ciudad)
                    .HasDatabaseName("idx_ciudad");
            });

            // Domicilio
            modelBuilder.Entity<Domicilio>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Estado)
                    .HasConversion<string>()
                    .IsRequired();

                entity.Property(e => e.Subtotal)
                    .HasColumnType("decimal(10,2)")
                    .IsRequired();

                entity.Property(e => e.CostoEnvio)
                    .HasColumnType("decimal(10,2)")
                    .IsRequired();

                // Total es una columna calculada en la BD
                entity.Property(e => e.Total)
                    .HasColumnType("decimal(10,2)")
                    .ValueGeneratedOnAddOrUpdate();

                entity.Property(e => e.MetodoPago)
                    .HasConversion<string>()
                    .IsRequired();

                entity.HasOne(e => e.Cliente)
                    .WithMany(c => c.Domicilios)
                    .HasForeignKey(e => e.ClienteId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Direccion)
                    .WithMany(d => d.Domicilios)
                    .HasForeignKey(e => e.DireccionId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Domiciliario)
                    .WithMany()
                    .HasForeignKey(e => e.DomiciliarioId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasOne(e => e.UsuarioCreador)
                    .WithMany()
                    .HasForeignKey(e => e.UsuarioCreadorId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(e => e.Estado)
                    .HasDatabaseName("idx_estado");

                entity.HasIndex(e => e.ClienteId)
                    .HasDatabaseName("idx_cliente");

                entity.HasIndex(e => e.FechaPedido)
                    .HasDatabaseName("idx_fecha_pedido");

                entity.HasIndex(e => e.DomiciliarioId)
                    .HasDatabaseName("idx_domiciliario");

                entity.Property(e => e.TokenSeguimiento)
                    .HasMaxLength(32)
                    .IsRequired(false);

                entity.HasIndex(e => e.TokenSeguimiento)
                    .IsUnique()
                    .HasDatabaseName("idx_token_seguimiento");

                entity.Property(e => e.PuedeEditarHasta)
                    .IsRequired(false);

                entity.Property(e => e.FechaRecogida)
                    .IsRequired(false);

                entity.Property(e => e.ObservacionCliente)
                    .HasColumnType("TEXT")
                    .IsRequired(false);

                entity.Property(e => e.FechaObservacion)
                    .IsRequired(false);

                entity.Property(e => e.OrigenPedido)
                    .HasMaxLength(20)
                    .HasDefaultValue("Admin")
                    .IsRequired();

            });

            // DomicilioDetalle
            modelBuilder.Entity<DomicilioDetalle>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Cantidad)
                    .IsRequired();

                entity.Property(e => e.PrecioUnitario)
                    .HasColumnType("decimal(10,2)")
                    .IsRequired();

                // Subtotal es una columna calculada en la BD
                entity.Property(e => e.Subtotal)
                    .HasColumnType("decimal(10,2)")
                    .ValueGeneratedOnAddOrUpdate();

                entity.HasOne(e => e.Domicilio)
                    .WithMany(d => d.Detalles)
                    .HasForeignKey(e => e.DomicilioId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Platillo)
                    .WithMany()
                    .HasForeignKey(e => e.PlatilloId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(e => e.DomicilioId)
                    .HasDatabaseName("idx_domicilio");

                entity.HasIndex(e => e.PlatilloId)
                    .HasDatabaseName("idx_platillo");
            });
        }
    }
}