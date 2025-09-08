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

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Tabla Usuarios
            modelBuilder.Entity<Usuario>()
                .Property(u => u.Rol)
                .HasConversion<string>(); // Para mapear ENUM de C# a VARCHAR/ENUM en MySQL

            // Tabla Mesas
            modelBuilder.Entity<Mesa>()
                .Property(m => m.Estado)
                .HasConversion<string>();

            // Tabla Pedidos
            modelBuilder.Entity<Pedido>()
                .Property(p => p.Estado)
                .HasConversion<string>();

            // Tabla PedidoDetalles
            modelBuilder.Entity<PedidoDetalle>()
                .Property(pd => pd.Estado)
                .HasConversion<string>();

            // Tabla Pagos
            modelBuilder.Entity<Pago>()
                .Property(p => p.MetodoPago)
                .HasConversion<string>();
        }
    }
}
