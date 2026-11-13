// api/RestaurantApi/RestauranteContext.cs
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;

namespace RestaurantApi
{
    public class RestauranteContext : DbContext
    {
        public RestauranteContext(DbContextOptions<RestauranteContext> options) : base(options) { }

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            CongelarPrecios();
            RegistrarMesasTocadas();
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }

        public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        {
            CongelarPrecios();
            RegistrarMesasTocadas();
            return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }

        /// <summary>Mesas cuyos pedidos, cuenta, llamadas o visita cambiaron en esta petición (ver Services/AvisosCliente).</summary>
        public HashSet<int> MesasTocadas { get; } = new();

        /// <summary>De esas, las que tuvieron un cambio que el comensal quiere saber aunque no esté mirando la página.</summary>
        public HashSet<int> MesasConAviso { get; } = new();

        /// <summary>
        /// Anota qué mesas toca lo que se va a guardar. Un solo lugar para todos los controladores:
        /// ninguno tiene que acordarse de avisar al comensal.
        /// </summary>
        private void RegistrarMesasTocadas()
        {
            foreach (var e in ChangeTracker.Entries().Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted).ToList())
            {
                var cambioEstado = e.State == EntityState.Modified && e.Properties.Any(p => p.Metadata.Name == "Estado" && p.IsModified);
                switch (e.Entity)
                {
                    case Pedido p:
                        MesasTocadas.Add(p.MesaId);
                        if (cambioEstado && p.Estado is EstadoPedido.Listo or EstadoPedido.Cancelado) MesasConAviso.Add(p.MesaId);
                        break;
                    case PedidoDetalle { Pedido: { } pedido } d:
                        MesasTocadas.Add(pedido.MesaId);
                        if (cambioEstado && d.Estado == EstadoDetalle.EnPreparacion) MesasConAviso.Add(pedido.MesaId);
                        break;
                    case Ocupacion o:
                        MesasTocadas.Add(o.MesaId);
                        if (e.State == EntityState.Modified && o.Abierta != true) MesasConAviso.Add(o.MesaId);
                        break;
                    case LlamadaMesero l:
                        MesasTocadas.Add(l.MesaId);
                        if (cambioEstado && l.Estado == LlamadaMesero.EnCamino) MesasConAviso.Add(l.MesaId);
                        break;
                    case SolicitudCuenta s:
                        MesasTocadas.Add(s.MesaId);
                        break;
                }
            }
        }

        /// <summary>
        /// Un plato nuevo en un pedido toma el precio vigente de la carta. Así, si el administrador
        /// cambia el precio después, la cuenta abierta, el cobro y los reportes no cambian.
        /// </summary>
        private void CongelarPrecios()
        {
            var sinPrecio = ChangeTracker.Entries<PedidoDetalle>()
                .Where(e => e.State == EntityState.Added && e.Entity.PrecioUnitario == null)
                .Select(e => e.Entity)
                .ToList();
            if (sinPrecio.Count == 0) return;

            var ids = sinPrecio.Select(d => d.PlatilloId).Distinct().ToList();
            var precios = Platillos.Where(p => ids.Contains(p.Id)).ToDictionary(p => p.Id, p => p.Precio);
            foreach (var d in sinPrecio)
                if (precios.TryGetValue(d.PlatilloId, out var precio)) d.PrecioUnitario = precio;
        }

        public DbSet<Usuario> Usuarios { get; set; }
        public DbSet<Mesa> Mesas { get; set; }
        public DbSet<Platillo> Platillos { get; set; }
        public DbSet<Pedido> Pedidos { get; set; }
        public DbSet<PedidoDetalle> PedidoDetalles { get; set; }
        public DbSet<Pago> Pagos { get; set; }
        public DbSet<Factura> Facturas { get; set; }
        public DbSet<UsuarioFCM> UsuariosFCM { get; set; }
        public DbSet<SolicitudCuenta> SolicitudesCuenta { get; set; }
        public DbSet<PagoAvisado> PagosAvisados { get; set; }
        public DbSet<CierreCaja> CierresCaja { get; set; }
        public DbSet<Ocupacion> Ocupaciones { get; set; }
        public DbSet<LlamadaMesero> LlamadasMesero { get; set; }
        public DbSet<SuscripcionPush> SuscripcionesPush { get; set; }

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
        public DbSet<Receta> Recetas { get; set; }
        public DbSet<PresentacionCompra> PresentacionesCompra { get; set; }
        public DbSet<OrdenCompra> OrdenesCompra { get; set; }
        public DbSet<DetalleOrdenCompra> DetallesOrdenCompra { get; set; }
        public DbSet<AlertaInventario> AlertasInventario { get; set; }
        public DbSet<Recepcion> Recepciones { get; set; }
        public DbSet<RecepcionFoto> RecepcionFotos { get; set; }

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

            modelBuilder.Entity<Mesa>()
                .HasIndex(m => m.CodigoQR)
                .IsUnique();

            modelBuilder.Entity<Pedido>()
                .Property(p => p.Estado)
                .HasConversion<string>();

            modelBuilder.Entity<Pedido>().HasIndex(p => p.OcupacionId);

            // Ocupaciones, llamadas y avisos del comensal (migraciones/2026-11-13_ocupaciones_llamadas_push.sql).
            modelBuilder.Entity<Ocupacion>(e =>
            {
                e.ToTable("Ocupaciones");
                e.HasIndex(o => o.Token).IsUnique();
                e.HasIndex(o => new { o.MesaId, o.Abierta }).IsUnique();
            });
            modelBuilder.Entity<LlamadaMesero>(e =>
            {
                e.ToTable("LlamadasMesero");
                e.HasIndex(l => l.Clave).IsUnique();
                e.HasIndex(l => new { l.MesaId, l.Activa }).IsUnique();
                // Dos meseros a la vez: el segundo en guardar recibe un conflicto en lugar de pisar al primero.
                e.Property(l => l.Estado).IsConcurrencyToken();
                e.HasOne(l => l.Mesero).WithMany().HasForeignKey(l => l.MeseroId).OnDelete(DeleteBehavior.SetNull);
            });
            modelBuilder.Entity<SuscripcionPush>(e =>
            {
                e.ToTable("SuscripcionesPush");
                e.HasIndex(s => s.Huella).IsUnique();
                e.HasIndex(s => s.OcupacionId);
            });

            modelBuilder.Entity<PedidoDetalle>()
                .Property(pd => pd.PrecioUnitario)
                .HasColumnType("decimal(10,2)");

            modelBuilder.Entity<Pago>()
                .HasIndex(p => p.FacturaId);

            // Plato cobrado: la factura que lo cubre (dividir la cuenta por consumo).
            modelBuilder.Entity<PedidoDetalle>()
                .HasIndex(d => d.FacturaId);

            modelBuilder.Entity<Factura>()
                .HasIndex(f => f.DomicilioId)
                .IsUnique();

            // Factura.PagoId (pago principal) y Pago.FacturaId (todos los pagos de la cuenta) son dos
            // relaciones distintas; sin declararlas, EF las confunde e inventa una columna PagoId1.
            modelBuilder.Entity<Factura>()
                .HasOne(f => f.Pago)
                .WithMany()
                .HasForeignKey(f => f.PagoId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Pago>()
                .HasOne<Factura>()
                .WithMany()
                .HasForeignKey(p => p.FacturaId)
                .OnDelete(DeleteBehavior.Restrict);

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

            // ==========================================
            // CONFIGURACIÓN DE RECETAS
            // ==========================================
            modelBuilder.Entity<Receta>(entity =>
            {
                entity.ToTable("Recetas");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.UnidadMedida).HasConversion<string>();
                entity.Property(e => e.CantidadRequerida).HasColumnType("decimal(10,2)").IsRequired();
                entity.Property(e => e.CostoUnitario).HasColumnType("decimal(10,2)");
                entity.HasOne(e => e.Platillo)
                    .WithMany()
                    .HasForeignKey(e => e.PlatilloId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(e => e.Producto)
                    .WithMany()
                    .HasForeignKey(e => e.ProductoId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // ==========================================
            // CONFIGURACIÓN DE STOCK
            // ==========================================
            modelBuilder.Entity<Stock>(entity =>
            {
                entity.ToTable("Stock");
                entity.HasKey(e => e.Id);
                // CostoTotal es columna GENERADA en MySQL: CostoPromedio * Cantidad
                // EF Core NO debe incluirla en INSERT ni UPDATE
                entity.Property(e => e.CostoTotal)
                    .ValueGeneratedOnAddOrUpdate()
                    .Metadata.SetBeforeSaveBehavior(Microsoft.EntityFrameworkCore.Metadata.PropertySaveBehavior.Ignore);
                entity.Property(e => e.CostoTotal)
                    .Metadata.SetAfterSaveBehavior(Microsoft.EntityFrameworkCore.Metadata.PropertySaveBehavior.Ignore);
            });

            // ==========================================
            // CONFIGURACIÓN DE MOVIMIENTOS DE INVENTARIO
            // ==========================================
            modelBuilder.Entity<MovimientoInventario>(entity =>
            {
                entity.ToTable("MovimientosInventario");
                entity.HasKey(e => e.Id);
                // CostoTotal es columna GENERADA en MySQL: CostoUnitario * Cantidad
                // EF Core NO debe incluirla en INSERT ni UPDATE
                entity.Property(e => e.CostoTotal)
                    .ValueGeneratedOnAddOrUpdate()
                    .Metadata.SetBeforeSaveBehavior(Microsoft.EntityFrameworkCore.Metadata.PropertySaveBehavior.Ignore);
                entity.Property(e => e.CostoTotal)
                    .Metadata.SetAfterSaveBehavior(Microsoft.EntityFrameworkCore.Metadata.PropertySaveBehavior.Ignore);
            });

            modelBuilder.Entity<SolicitudCuenta>(entity =>
            {
                entity.ToTable("SolicitudesCuenta");
                entity.Property(e => e.MetodoPago).HasMaxLength(10);
                entity.Property(e => e.Comprobante).HasColumnType("mediumtext");
                entity.Property(e => e.Estado).HasMaxLength(10).IsRequired();
                entity.Property(e => e.Propina).HasColumnType("decimal(10,2)");
                entity.HasIndex(e => new { e.MesaId, e.Estado });
                entity.HasOne(e => e.Mesa).WithMany().HasForeignKey(e => e.MesaId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(e => e.Usuario).WithMany().HasForeignKey(e => e.UsuarioId).OnDelete(DeleteBehavior.Restrict);
                entity.HasMany(e => e.Pagos).WithOne(p => p.Solicitud).HasForeignKey(p => p.SolicitudId).OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<PagoAvisado>(entity =>
            {
                entity.ToTable("PagosAvisados");
                entity.Property(e => e.MetodoPago).HasMaxLength(10).IsRequired();
                entity.Property(e => e.Monto).HasColumnType("decimal(10,2)");
                entity.Property(e => e.Comprobante).HasColumnType("mediumtext");
                entity.HasIndex(e => e.SolicitudId);
            });

            modelBuilder.Entity<CierreCaja>(entity =>
            {
                entity.ToTable("CierresCaja");
                entity.Property(e => e.FechaCaja).HasColumnType("date");
                entity.HasIndex(e => e.FechaCaja).IsUnique();
                foreach (var monto in new[] { nameof(CierreCaja.Base), nameof(CierreCaja.PropinasPagadas), nameof(CierreCaja.Retiros),
                             nameof(CierreCaja.EfectivoEsperado), nameof(CierreCaja.EfectivoContado),
                             nameof(CierreCaja.TarjetaDatafono), nameof(CierreCaja.TransferenciasBanco) })
                    entity.Property(monto).HasColumnType("decimal(12,2)");
                entity.Property(e => e.Observaciones).HasMaxLength(500);
            });

            modelBuilder.Entity<PresentacionCompra>(entity =>
            {
                entity.ToTable("PresentacionesCompra");
                entity.Property(e => e.Nombre).HasMaxLength(150).IsRequired();
                entity.Property(e => e.Codigo).HasMaxLength(100);
                entity.HasIndex(e => e.Codigo).IsUnique();
                entity.Property(e => e.Factor).HasColumnType("decimal(10,3)");
                entity.Property(e => e.CostoReferencia).HasColumnType("decimal(12,2)");
                entity.HasOne(e => e.Producto).WithMany().HasForeignKey(e => e.ProductoId).OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(e => e.Proveedor).WithMany().HasForeignKey(e => e.ProveedorId).OnDelete(DeleteBehavior.SetNull);
            });

            modelBuilder.Entity<OrdenCompra>(entity =>
            {
                entity.ToTable("OrdenesCompra");
                entity.Property(e => e.Estado).HasConversion<string>();
                entity.HasOne(e => e.Proveedor).WithMany().HasForeignKey(e => e.ProveedorId);
                entity.HasOne(e => e.AlmacenDestino).WithMany().HasForeignKey(e => e.AlmacenDestinoId);
                entity.HasOne(e => e.UsuarioCreador).WithMany().HasForeignKey(e => e.UsuarioCreadorId);
                entity.HasMany(e => e.Detalles).WithOne(d => d.OrdenCompra!).HasForeignKey(d => d.OrdenCompraId);
            });

            modelBuilder.Entity<DetalleOrdenCompra>(entity =>
            {
                // Subtotal es columna GENERADA en MySQL; el modelo no la mapea.
                entity.ToTable("DetallesOrdenCompra");
                entity.HasOne(e => e.Producto).WithMany().HasForeignKey(e => e.ProductoId);
            });

            modelBuilder.Entity<Recepcion>(entity =>
            {
                entity.ToTable("Recepciones");
                entity.Property(e => e.Documento).HasMaxLength(60);
                entity.Property(e => e.Total).HasColumnType("decimal(12,2)");
                entity.HasIndex(e => e.Fecha);
                entity.HasOne(e => e.Proveedor).WithMany().HasForeignKey(e => e.ProveedorId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(e => e.OrdenCompra).WithMany().HasForeignKey(e => e.OrdenCompraId).OnDelete(DeleteBehavior.Restrict);
                entity.HasMany(e => e.Fotos).WithOne(f => f.Recepcion).HasForeignKey(f => f.RecepcionId).OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<RecepcionFoto>(entity =>
            {
                entity.ToTable("RecepcionFotos");
                entity.Property(e => e.Foto).HasColumnType("mediumtext").IsRequired();
                entity.HasIndex(e => e.RecepcionId);
            });

            modelBuilder.Entity<AlertaInventario>(entity =>
            {
                entity.ToTable("AlertasInventario");
                entity.Property(e => e.TipoAlerta).HasConversion<string>();
                entity.Property(e => e.Nivel).HasConversion<string>();
            });

            // Dos domiciliarios no pueden tomar el mismo pedido: el UPDATE incluye
            // el Estado y el DomiciliarioId leídos (concurrencia optimista sin columna nueva).
            modelBuilder.Entity<Domicilio>(entity =>
            {
                entity.Property(e => e.Estado).IsConcurrencyToken();
                entity.Property(e => e.DomiciliarioId).IsConcurrencyToken();
                entity.Property(e => e.ComprobantePago).HasColumnType("mediumtext");
            });

            // Las fechas se guardan en UTC; al leerlas se marcan como UTC para que
            // el JSON lleve la "Z" y cada cliente las convierta a su hora local.
            var utc = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(
                v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v,
                v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
            var utcNullable = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime?, DateTime?>(
                v => v.HasValue && v.Value.Kind == DateTimeKind.Local ? v.Value.ToUniversalTime() : v,
                v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

            // Columnas DATE (sin hora): son fechas de calendario, no instantes.
            var soloFecha = new HashSet<string>
            {
                "FechaIngreso", "FechaVencimiento", "FechaOrden", "FechaEntregaEstimada", "FechaEntregaReal", "FechaCaja"
            };

            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entityType.GetProperties())
                {
                    if (soloFecha.Contains(property.Name)) continue;
                    if (property.ClrType == typeof(DateTime)) property.SetValueConverter(utc);
                    else if (property.ClrType == typeof(DateTime?)) property.SetValueConverter(utcNullable);
                }
            }
        }
    }
}