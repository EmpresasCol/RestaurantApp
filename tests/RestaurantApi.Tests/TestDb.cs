using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi;
using RestaurantApi.Models;
using RestaurantApi.Services;

namespace RestaurantApi.Tests;

/// <summary>
/// Crea un RestauranteContext aislado sobre EF Core InMemory y siembra un
/// escenario mínimo: 1 almacén, 1 insumo con stock, 1 platillo con receta,
/// 2 mesas y usuarios de cada rol.
/// </summary>
internal static class TestDb
{
    public const int AlmacenId = 1;
    public const int ProductoCarneId = 1;
    public const int PlatilloHamburguesaId = 1;
    public const decimal StockInicialCarne = 100m;
    public const decimal CarnePorHamburguesa = 0.2m;

    public const int MesaUnoId = 1;
    public const int MesaDosId = 2;
    public const string CodigoMesaUno = "a1b2c3d4e5f6a1b2c3d4e5f6";
    public const string CodigoMesaDos = "f6e5d4c3b2a1f6e5d4c3b2a1";

    public const int AdminId = 1;
    public const int MeseroId = 2;
    public const int DomiciliarioId = 3;

    public static RestauranteContext Crear(bool sembrar = true)
    {
        var options = new DbContextOptionsBuilder<RestauranteContext>()
            .UseInMemoryDatabase($"qpro-tests-{Guid.NewGuid()}")
            // InMemory no soporta transacciones; varios controladores las abren.
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var ctx = new RestauranteContext(options);
        if (sembrar) Sembrar(ctx);
        return ctx;
    }

    /// <summary>Simula una petición con JWT del usuario y rol dados.</summary>
    public static T Sesion<T>(T controlador, int usuarioId, RolUsuario rol) where T : ControllerBase
    {
        var identidad = new ClaimsIdentity(new[]
        {
            new Claim(QproClaims.Id, usuarioId.ToString()),
            new Claim(QproClaims.Rol, rol.ToString())
        }, "test", QproClaims.Usuario, QproClaims.Rol);
        controlador.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identidad) } };
        return controlador;
    }

    public static T ComoMesero<T>(T controlador) where T : ControllerBase => Sesion(controlador, MeseroId, RolUsuario.Mesero);

    public static T ComoAdmin<T>(T controlador) where T : ControllerBase => Sesion(controlador, AdminId, RolUsuario.Administrador);

    public static InventarioService Inventario(RestauranteContext ctx)
        => new(ctx, NullLogger<InventarioService>.Instance);

    private static void Sembrar(RestauranteContext ctx)
    {
        ctx.Usuarios.AddRange(
            new Usuario { Id = AdminId, Nombre = "Admin", NombreUsuario = "admin", ClaveHash = "123", Rol = RolUsuario.Administrador },
            new Usuario { Id = MeseroId, Nombre = "Mesero", NombreUsuario = "mesero", ClaveHash = "123", Rol = RolUsuario.Mesero },
            new Usuario { Id = DomiciliarioId, Nombre = "Domi", NombreUsuario = "domi", ClaveHash = "123", Rol = RolUsuario.Domiciliario });

        ctx.Mesas.AddRange(
            new Mesa { Id = MesaUnoId, Numero = 1, Estado = EstadoMesa.Disponible, CodigoQR = CodigoMesaUno },
            new Mesa { Id = MesaDosId, Numero = 2, Estado = EstadoMesa.Disponible, CodigoQR = CodigoMesaDos });

        ctx.Almacenes.Add(new Almacen
        {
            Id = AlmacenId, Codigo = "ALM-01", Nombre = "Cocina Principal",
            Descripcion = "-", Ubicacion = "-", Tipo = "Cocina"
        });

        ctx.CategoriasInventario.Add(new CategoriaInventario { Id = 1, Nombre = "Carnes", Descripcion = "-", Tipo = "Ingrediente" });

        ctx.ProductosInventario.Add(new ProductoInventario
        {
            Id = ProductoCarneId, Codigo = "PROD-001", Nombre = "Carne de res",
            CategoriaId = 1, UnidadMedida = "Kg", PrecioCosto = 20000m
        });

        ctx.Stock.Add(new Stock
        {
            Id = 1, ProductoId = ProductoCarneId, AlmacenId = AlmacenId,
            Cantidad = StockInicialCarne, CostoPromedio = 20000m
        });

        ctx.Platillos.Add(new Platillo
        {
            Id = PlatilloHamburguesaId, Nombre = "Hamburguesa Clasica", Precio = 25000m, Categoria = "Platos"
        });

        ctx.Recetas.Add(new Receta
        {
            Id = 1, PlatilloId = PlatilloHamburguesaId, ProductoId = ProductoCarneId,
            CantidadRequerida = CarnePorHamburguesa, UnidadMedida = UnidadMedida.Kg
        });

        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();
    }

    public static decimal StockCarne(RestauranteContext ctx)
        => ctx.Stock.AsNoTracking().Where(s => s.ProductoId == ProductoCarneId).Sum(s => s.Cantidad);

    /// <summary>Inserta un pedido directamente en BD con un detalle de hamburguesas.</summary>
    public static Pedido CrearPedidoDirecto(RestauranteContext ctx, int pedidoId, int cantidad, int mesaId = MesaUnoId)
    {
        var pedido = new Pedido
        {
            Id = pedidoId, MesaId = mesaId, UsuarioId = MeseroId,
            Estado = EstadoPedido.EnProceso, Fecha = DateTime.Now,
            Detalles = { new PedidoDetalle { PlatilloId = PlatilloHamburguesaId, Cantidad = cantidad, Estado = EstadoDetalle.Pendiente } }
        };
        ctx.Pedidos.Add(pedido);
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();
        return pedido;
    }
}
