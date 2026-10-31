using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>Módulos del administrador: platillos, usuarios y mesas (QR).</summary>
public class AdministracionTests
{
    private static PlatillosController Platillos(RestauranteContext ctx) => new(ctx, TestDb.Inventario(ctx));

    private static UsuariosController Usuarios(RestauranteContext ctx, int? sesion = null)
    {
        var c = new UsuariosController(ctx);
        if (sesion != null)
        {
            var identidad = new ClaimsIdentity(new[] { new Claim(QproClaims.Id, sesion.Value.ToString()) }, "test");
            c.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identidad) } };
        }
        return c;
    }

    private static ActualizarUsuarioDto Edicion(int id, string usuario, RolUsuario rol, string? clave = null)
        => new() { Id = id, Nombre = usuario, NombreUsuario = usuario, Rol = rol, ClaveHash = clave };

    private static void VenderEnDomicilio(RestauranteContext ctx, int platilloId)
    {
        ctx.Clientes.Add(new Cliente { Id = 60, Nombre = "Cliente", Telefono = "3110000000" });
        ctx.Direcciones.Add(new Direccion { Id = 60, ClienteId = 60, DireccionCompleta = "Cra 1 # 2-3" });
        ctx.Domicilios.Add(new Domicilio
        {
            Id = 60, ClienteId = 60, DireccionId = 60, Estado = "Entregado",
            Subtotal = 25000m, CostoEnvio = 0m, Total = 25000m, UsuarioCreadorId = TestDb.AdminId,
            Detalles = { new DomicilioDetalle { PlatilloId = platilloId, Cantidad = 1, PrecioUnitario = 25000m } }
        });
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();
    }

    // ==================== PLATILLOS ====================

    [Fact]
    public async Task Crear_platillo_sin_nombre_responde_400()
    {
        using var ctx = TestDb.Crear();
        var r = await Platillos(ctx).PostPlatillo(new Platillo { Nombre = "   ", Precio = 1000m });
        Assert.IsType<BadRequestObjectResult>(r.Result);
    }

    [Fact]
    public async Task Crear_platillo_con_nombre_repetido_responde_409_sin_importar_mayusculas()
    {
        using var ctx = TestDb.Crear();
        var r = await Platillos(ctx).PostPlatillo(new Platillo { Nombre = " hamburguesa clasica ", Precio = 1000m });
        Assert.IsType<ConflictObjectResult>(r.Result);
    }

    [Fact]
    public async Task Crear_platillo_limpia_espacios_y_usa_categoria_general_si_falta()
    {
        using var ctx = TestDb.Crear();
        await Platillos(ctx).PostPlatillo(new Platillo { Nombre = "  Limonada  ", Precio = 6000m, Categoria = " " });

        var p = ctx.Platillos.AsNoTracking().Single(x => x.Nombre == "Limonada");
        Assert.Equal("General", p.Categoria);
    }

    [Fact]
    public async Task Editar_platillo_conserva_su_propio_nombre_sin_conflicto()
    {
        using var ctx = TestDb.Crear();
        var r = await Platillos(ctx).PutPlatillo(TestDb.PlatilloHamburguesaId, new Platillo
        {
            Id = TestDb.PlatilloHamburguesaId, Nombre = "Hamburguesa Clasica", Precio = 27000m, Categoria = "Platos"
        });

        Assert.IsType<NoContentResult>(r);
        Assert.Equal(27000m, ctx.Platillos.AsNoTracking().Single(x => x.Id == TestDb.PlatilloHamburguesaId).Precio);
    }

    [Fact]
    public async Task Eliminar_platillo_vendido_en_mesa_responde_409()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1);
        Assert.IsType<ConflictObjectResult>(await Platillos(ctx).DeletePlatillo(TestDb.PlatilloHamburguesaId));
    }

    [Fact]
    public async Task Eliminar_platillo_vendido_en_domicilio_responde_409()
    {
        using var ctx = TestDb.Crear();
        VenderEnDomicilio(ctx, TestDb.PlatilloHamburguesaId);
        Assert.IsType<ConflictObjectResult>(await Platillos(ctx).DeletePlatillo(TestDb.PlatilloHamburguesaId));
    }

    [Fact]
    public async Task Eliminar_platillo_sin_ventas_lo_quita_de_la_carta()
    {
        using var ctx = TestDb.Crear();
        Assert.IsType<NoContentResult>(await Platillos(ctx).DeletePlatillo(TestDb.PlatilloHamburguesaId));
        Assert.False(ctx.Platillos.Any());
    }

    // ==================== USUARIOS ====================

    [Fact]
    public async Task Crear_usuario_con_clave_corta_responde_400()
    {
        using var ctx = TestDb.Crear();
        var r = await Usuarios(ctx).PostUsuario(new Usuario { Nombre = "Caja", NombreUsuario = "caja2", ClaveHash = "123", Rol = RolUsuario.Caja });
        Assert.IsType<BadRequestObjectResult>(r.Result);
    }

    [Fact]
    public async Task Crear_usuario_con_espacios_en_el_usuario_responde_400()
    {
        using var ctx = TestDb.Crear();
        var r = await Usuarios(ctx).PostUsuario(new Usuario { Nombre = "Caja", NombreUsuario = "la caja", ClaveHash = "clave1", Rol = RolUsuario.Caja });
        Assert.IsType<BadRequestObjectResult>(r.Result);
    }

    [Fact]
    public async Task El_administrador_no_puede_quitarse_su_propio_rol()
    {
        using var ctx = TestDb.Crear();
        ctx.Usuarios.Add(new Usuario { Id = 10, Nombre = "Otro", NombreUsuario = "otro", ClaveHash = "x", Rol = RolUsuario.Administrador });
        ctx.SaveChanges();

        var r = await Usuarios(ctx, sesion: TestDb.AdminId).PutUsuario(TestDb.AdminId, Edicion(TestDb.AdminId, "admin", RolUsuario.Caja));

        Assert.IsType<BadRequestObjectResult>(r);
    }

    [Fact]
    public async Task No_se_puede_degradar_al_ultimo_administrador()
    {
        using var ctx = TestDb.Crear();
        var r = await Usuarios(ctx).PutUsuario(TestDb.AdminId, Edicion(TestDb.AdminId, "admin", RolUsuario.Caja));
        Assert.IsType<BadRequestObjectResult>(r);
    }

    [Fact]
    public async Task Otro_administrador_si_puede_cambiar_el_rol_de_un_administrador()
    {
        using var ctx = TestDb.Crear();
        ctx.Usuarios.Add(new Usuario { Id = 10, Nombre = "Otro", NombreUsuario = "otro", ClaveHash = "x", Rol = RolUsuario.Administrador });
        ctx.SaveChanges();

        var r = await Usuarios(ctx, sesion: 10).PutUsuario(TestDb.AdminId, Edicion(TestDb.AdminId, "admin", RolUsuario.Caja));

        Assert.IsType<NoContentResult>(r);
    }

    [Fact]
    public async Task No_se_puede_eliminar_al_ultimo_administrador()
    {
        using var ctx = TestDb.Crear();
        Assert.IsType<BadRequestObjectResult>(await Usuarios(ctx).DeleteUsuario(TestDb.AdminId));
    }

    [Fact]
    public async Task Eliminar_usuario_con_pedidos_responde_409()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1); // lo tomó el mesero
        Assert.IsType<ConflictObjectResult>(await Usuarios(ctx).DeleteUsuario(TestDb.MeseroId));
    }

    [Fact]
    public async Task Eliminar_usuario_sin_historial_borra_tambien_sus_tokens()
    {
        using var ctx = TestDb.Crear();
        ctx.UsuariosFCM.Add(new UsuarioFCM { UsuarioId = TestDb.DomiciliarioId, FcmToken = "t", FechaRegistro = DateTime.UtcNow });
        ctx.SaveChanges();

        Assert.IsType<NoContentResult>(await Usuarios(ctx).DeleteUsuario(TestDb.DomiciliarioId));
        Assert.False(ctx.UsuariosFCM.Any());
    }

    // ==================== MESAS ====================

    private static List<int> Numeros(RestauranteContext ctx) => ctx.Mesas.AsNoTracking().Select(m => m.Numero).OrderBy(n => n).ToList();

    [Fact]
    public async Task Fijar_cantidad_crea_las_mesas_que_faltan()
    {
        using var ctx = TestDb.Crear();
        var r = await new MesasController(ctx).FijarCantidad(new CantidadMesasDto { Cantidad = 5 });

        Assert.Equal(5, r.Value!.Count());
        Assert.Equal(new[] { 1, 2, 3, 4, 5 }, Numeros(ctx));
    }

    [Fact]
    public async Task Fijar_cantidad_retira_las_mesas_sobrantes_libres()
    {
        using var ctx = TestDb.Crear();
        await new MesasController(ctx).FijarCantidad(new CantidadMesasDto { Cantidad = 1 });
        Assert.Equal(new[] { 1 }, Numeros(ctx));
    }

    [Fact]
    public async Task Fijar_cantidad_no_retira_una_mesa_con_pedidos()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1, TestDb.MesaDosId);

        var r = await new MesasController(ctx).FijarCantidad(new CantidadMesasDto { Cantidad = 1 });

        Assert.IsType<ConflictObjectResult>(r.Result);
        Assert.Equal(new[] { 1, 2 }, Numeros(ctx));
    }

    [Fact]
    public async Task Fijar_cantidad_no_retira_una_mesa_ocupada()
    {
        using var ctx = TestDb.Crear();
        ctx.Mesas.Single(m => m.Id == TestDb.MesaDosId).Estado = EstadoMesa.Ocupada;
        ctx.SaveChanges();

        var r = await new MesasController(ctx).FijarCantidad(new CantidadMesasDto { Cantidad = 1 });

        Assert.IsType<ConflictObjectResult>(r.Result);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(MesasController.MaximoMesas + 1)]
    public async Task Fijar_cantidad_fuera_de_rango_responde_400(int cantidad)
    {
        using var ctx = TestDb.Crear();
        var r = await new MesasController(ctx).FijarCantidad(new CantidadMesasDto { Cantidad = cantidad });
        Assert.IsType<BadRequestObjectResult>(r.Result);
    }
}
