using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>Pedido del comensal por código secreto, platillos ocultos y usuarios desactivados.</summary>
public class SeguridadQrYActivosTests
{
    private static PedidosController Anonimo(RestauranteContext ctx)
        => new(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx));

    private static CrearPedidoDto Pedido(int mesaId = 0, string? codigo = null) => new()
    {
        MesaId = mesaId,
        CodigoMesa = codigo,
        Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 1 } }
    };

    // ==================== QR DE LA MESA ====================

    [Fact]
    public async Task El_comensal_no_puede_pedir_solo_con_el_id_de_la_mesa()
    {
        using var ctx = TestDb.Crear();
        var r = await Anonimo(ctx).PostPedido(Pedido(mesaId: TestDb.MesaDosId));

        Assert.IsType<BadRequestObjectResult>(r.Result);
        Assert.False(ctx.Pedidos.Any());
    }

    [Fact]
    public async Task El_pedido_del_comensal_va_a_la_mesa_del_codigo_aunque_cambie_el_id()
    {
        using var ctx = TestDb.Crear();
        var r = await Anonimo(ctx).PostPedido(Pedido(mesaId: TestDb.MesaDosId, codigo: TestDb.CodigoMesaUno));

        var pedido = (PedidoDto)((CreatedAtActionResult)r.Result!).Value!;
        Assert.Equal(TestDb.MesaUnoId, pedido.MesaId);
    }

    [Fact]
    public async Task Un_codigo_inventado_no_crea_pedido()
    {
        using var ctx = TestDb.Crear();
        var r = await Anonimo(ctx).PostPedido(Pedido(codigo: "000000000000000000000000"));

        Assert.IsType<BadRequestObjectResult>(r.Result);
        Assert.False(ctx.Pedidos.Any());
    }

    [Fact]
    public async Task El_mesero_con_sesion_sigue_pidiendo_por_id()
    {
        using var ctx = TestDb.Crear();
        var r = await TestDb.ComoMesero(Anonimo(ctx)).PostPedido(Pedido(mesaId: TestDb.MesaDosId));

        Assert.Equal(TestDb.MesaDosId, ((PedidoDto)((CreatedAtActionResult)r.Result!).Value!).MesaId);
    }

    [Fact]
    public async Task El_codigo_publico_solo_revela_el_numero_de_la_mesa()
    {
        using var ctx = TestDb.Crear();
        var c = new MesasController(ctx);

        Assert.Equal(2, (await c.GetMesaPorCodigo(TestDb.CodigoMesaDos)).Value!.Numero);
        Assert.IsType<NotFoundObjectResult>((await c.GetMesaPorCodigo("otro")).Result);
    }

    [Fact]
    public async Task Solo_el_administrador_recibe_los_codigos_y_las_mesas_sin_codigo_lo_obtienen()
    {
        using var ctx = TestDb.Crear();
        ctx.Mesas.Add(new Mesa { Id = 3, Numero = 3, Estado = EstadoMesa.Disponible });
        ctx.SaveChanges();

        var mesero = (await TestDb.ComoMesero(new MesasController(ctx)).GetMesas()).Value!;
        Assert.All(mesero, m => Assert.Null(m.CodigoQR));

        var admin = (await TestDb.ComoAdmin(new MesasController(ctx)).GetMesas()).Value!.ToList();
        Assert.All(admin, m => Assert.Equal(24, m.CodigoQR!.Length));
        Assert.Equal(3, admin.Select(m => m.CodigoQR).Distinct().Count());
    }

    [Fact]
    public async Task Regenerar_codigos_invalida_los_anteriores()
    {
        using var ctx = TestDb.Crear();
        await TestDb.ComoAdmin(new MesasController(ctx)).RegenerarCodigos();

        var r = await Anonimo(ctx).PostPedido(Pedido(codigo: TestDb.CodigoMesaUno));
        Assert.IsType<BadRequestObjectResult>(r.Result);
    }

    // ==================== PLATILLOS OCULTOS ====================

    private static void Ocultar(RestauranteContext ctx, int platilloId)
    {
        ctx.Platillos.Single(p => p.Id == platilloId).Activo = false;
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();
    }

    [Fact]
    public async Task Ocultar_un_platillo_lo_saca_de_la_carta_publica()
    {
        using var ctx = TestDb.Crear();
        var c = new PlatillosController(ctx, TestDb.Inventario(ctx));
        Assert.IsType<NoContentResult>(await c.CambiarActivo(TestDb.PlatilloHamburguesaId, new CambiarActivoDto { Activo = false }));

        Assert.Empty((await c.GetPlatillos()).Value!);
    }

    [Fact]
    public async Task El_administrador_ve_los_ocultos_solo_si_los_pide()
    {
        using var ctx = TestDb.Crear();
        Ocultar(ctx, TestDb.PlatilloHamburguesaId);
        var c = TestDb.ComoAdmin(new PlatillosController(ctx, TestDb.Inventario(ctx)));

        Assert.Empty((await c.GetPlatillos()).Value!);
        var todos = (await c.GetPlatillos(todos: true)).Value!.ToList();
        Assert.False(Assert.Single(todos).Activo);
    }

    [Fact]
    public async Task Pedir_todos_sin_ser_admin_no_muestra_ocultos()
    {
        using var ctx = TestDb.Crear();
        Ocultar(ctx, TestDb.PlatilloHamburguesaId);
        var c = TestDb.ComoMesero(new PlatillosController(ctx, TestDb.Inventario(ctx)));

        Assert.Empty((await c.GetPlatillos(todos: true)).Value!);
    }

    [Fact]
    public async Task Un_platillo_oculto_no_se_puede_pedir()
    {
        using var ctx = TestDb.Crear();
        Ocultar(ctx, TestDb.PlatilloHamburguesaId);

        var r = await Anonimo(ctx).PostPedido(Pedido(codigo: TestDb.CodigoMesaUno));

        Assert.Contains("Ya no está en la carta", Assert.IsType<BadRequestObjectResult>(r.Result).Value!.ToString());
    }

    [Fact]
    public async Task Un_pedido_abierto_con_un_platillo_que_se_oculto_se_puede_seguir_editando()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1);
        Ocultar(ctx, TestDb.PlatilloHamburguesaId);

        var r = await TestDb.ComoMesero(Anonimo(ctx)).ActualizarPedidoCompleto(1, new ActualizarPedidoCompletoDto
        {
            Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 2 } }
        });

        Assert.IsNotType<BadRequestObjectResult>(r.Result);
    }

    // ==================== USUARIOS DESACTIVADOS ====================

    [Fact]
    public async Task Un_usuario_desactivado_no_puede_iniciar_sesion()
    {
        using var ctx = TestDb.Crear();
        await TestDb.ComoAdmin(new UsuariosController(ctx)).CambiarActivo(TestDb.MeseroId, new CambiarActivoDto { Activo = false });

        var r = await new UsuariosController(ctx).LoginMobile(new LoginRequestDto { Usuario = "mesero", Clave = "123" });

        var error = Assert.IsType<UnauthorizedObjectResult>(r.Result);
        Assert.Contains("desactivado", System.Text.Json.JsonSerializer.Serialize(error.Value));
    }

    [Fact]
    public async Task Un_domiciliario_desactivado_no_entra_a_la_app()
    {
        using var ctx = TestDb.Crear();
        ctx.Usuarios.Single(u => u.Id == TestDb.DomiciliarioId).Activo = false;
        ctx.SaveChanges();

        var c = new DomiciliariosController(ctx,
            new DomicilioRealtimeService(ctx, NullLogger<DomicilioRealtimeService>.Instance),
            NullLogger<DomiciliariosController>.Instance);
        var r = await c.Login(new LoginRequestDto { Usuario = "domi", Clave = "123" });

        Assert.IsType<UnauthorizedObjectResult>(r.Result);
    }

    [Fact]
    public async Task El_administrador_no_puede_desactivarse_a_si_mismo()
    {
        using var ctx = TestDb.Crear();
        var r = await TestDb.ComoAdmin(new UsuariosController(ctx)).CambiarActivo(TestDb.AdminId, new CambiarActivoDto { Activo = false });
        Assert.IsType<BadRequestObjectResult>(r);
    }

    [Fact]
    public async Task No_se_puede_desactivar_al_ultimo_administrador_activo()
    {
        using var ctx = TestDb.Crear();
        ctx.Usuarios.Add(new Usuario { Id = 10, Nombre = "Otro", NombreUsuario = "otro", ClaveHash = "x", Rol = RolUsuario.Administrador, Activo = false });
        ctx.SaveChanges();

        // El otro administrador está desactivado: no cuenta.
        var r = await TestDb.Sesion(new UsuariosController(ctx), 10, RolUsuario.Administrador)
            .CambiarActivo(TestDb.AdminId, new CambiarActivoDto { Activo = false });

        Assert.IsType<BadRequestObjectResult>(r);
    }

    [Fact]
    public async Task Desactivar_y_reactivar_conserva_el_historial()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1);
        var admin = TestDb.ComoAdmin(new UsuariosController(ctx));

        await admin.CambiarActivo(TestDb.MeseroId, new CambiarActivoDto { Activo = false });
        Assert.False(ctx.Usuarios.AsNoTracking().Single(u => u.Id == TestDb.MeseroId).Activo);

        await admin.CambiarActivo(TestDb.MeseroId, new CambiarActivoDto { Activo = true });
        Assert.True(ctx.Usuarios.AsNoTracking().Single(u => u.Id == TestDb.MeseroId).Activo);
        Assert.Equal(1, ctx.Pedidos.Count(p => p.UsuarioId == TestDb.MeseroId));
    }
}
