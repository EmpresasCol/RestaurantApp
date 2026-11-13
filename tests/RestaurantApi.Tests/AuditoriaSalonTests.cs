using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>Hallazgos de la auditoría del salón: permisos por rol, mesas y entradas no confiables.</summary>
public class AuditoriaSalonTests
{
    private static PedidosController Pedidos(RestauranteContext ctx, RolUsuario rol)
        => TestDb.Sesion(new PedidosController(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx)), TestDb.MeseroId, rol);

    private static int? Codigo(IActionResult r) => (r as ObjectResult)?.StatusCode ?? (r as StatusCodeResult)?.StatusCode;

    /// <summary>[ALTO] PUT api/pedidos/{id} dejaba al mesero marcar un pedido como pagado sin pasar por caja.</summary>
    [Theory]
    [InlineData(RolUsuario.Mesero)]
    [InlineData(RolUsuario.Cocina)]
    public async Task Solo_caja_o_admin_pagan_un_pedido_por_la_edicion_completa(RolUsuario rol)
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1, estado: EstadoPedido.Entregado);

        var r = await Pedidos(ctx, rol).PutPedido(1, new ActualizarPedidoDto { Estado = "Pagado" });

        Assert.Equal(StatusCodes.Status403Forbidden, Codigo(r));
        Assert.Equal(EstadoPedido.Entregado, ctx.Pedidos.AsNoTracking().Single().Estado);
    }

    [Fact]
    public async Task La_cocina_no_sirve_un_pedido_por_la_edicion_completa()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1, estado: EstadoPedido.Listo);

        var r = await Pedidos(ctx, RolUsuario.Cocina).PutPedido(1, new ActualizarPedidoDto { Estado = "Entregado" });

        Assert.Equal(StatusCodes.Status403Forbidden, Codigo(r));
    }

    /// <summary>[ALTO] Cualquier mesero o cajero liberaba una mesa con consumo abierto cambiándole el estado.</summary>
    [Fact]
    public async Task Una_mesa_con_pedidos_abiertos_no_se_libera_cambiando_el_estado()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 2, estado: EstadoPedido.Entregado);
        var mesa = ctx.Mesas.Single(m => m.Id == TestDb.MesaUnoId);
        mesa.Estado = EstadoMesa.Ocupada;
        ctx.SaveChanges();
        var c = TestDb.ComoMesero(new MesasController(ctx));

        var porEstado = await c.ActualizarEstado(TestDb.MesaUnoId, new ActualizarEstadoMesaDto { Estado = "Disponible" });
        var porEdicion = await TestDb.ComoAdmin(new MesasController(ctx)).PutMesa(TestDb.MesaUnoId, new MesaDto { Id = TestDb.MesaUnoId, Estado = "Disponible" });

        Assert.IsType<ConflictObjectResult>(porEstado);
        Assert.IsType<ConflictObjectResult>(porEdicion);
        Assert.Equal(EstadoMesa.Ocupada, ctx.Mesas.AsNoTracking().Single(m => m.Id == TestDb.MesaUnoId).Estado);
    }

    [Fact]
    public async Task Una_mesa_sin_pedidos_abiertos_si_se_libera()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1, estado: EstadoPedido.Pagado);
        ctx.Mesas.Single(m => m.Id == TestDb.MesaUnoId).Estado = EstadoMesa.Ocupada;
        ctx.SaveChanges();

        var r = await TestDb.ComoMesero(new MesasController(ctx)).ActualizarEstado(TestDb.MesaUnoId, new ActualizarEstadoMesaDto { Estado = "Disponible" });

        Assert.IsType<OkObjectResult>(r);
        Assert.Equal(EstadoMesa.Disponible, ctx.Mesas.AsNoTracking().Single(m => m.Id == TestDb.MesaUnoId).Estado);
    }

    /// <summary>[MEDIO] El pedido anónimo del QR aceptaba cualquier número de líneas y notas sin tope.</summary>
    [Fact]
    public async Task El_pedido_del_qr_tiene_tope_de_lineas_y_de_nota()
    {
        using var ctx = TestDb.Crear();
        var c = new PedidosController(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx));
        var linea = new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 1 };

        var muchas = await c.PostPedido(new CrearPedidoDto
        {
            CodigoMesa = TestDb.CodigoMesaUno,
            Detalles = Enumerable.Repeat(linea, PedidosController.MaximoLineas + 1).ToList()
        });
        var notaLarga = await c.PostPedido(new CrearPedidoDto
        {
            CodigoMesa = TestDb.CodigoMesaUno,
            Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 1, Nota = new string('x', PedidosController.MaximoNota + 1) } }
        });

        Assert.IsType<BadRequestObjectResult>(muchas.Result);
        Assert.IsType<BadRequestObjectResult>(notaLarga.Result);
        Assert.Empty(ctx.Pedidos);
    }

    /// <summary>[MEDIO] El token del teléfono seguía ligado al mesero anterior: recibía avisos ajenos.</summary>
    [Fact]
    public async Task El_token_fcm_de_un_dispositivo_queda_solo_con_su_ultimo_usuario()
    {
        using var ctx = TestDb.Crear();
        ctx.UsuariosFCM.Add(new UsuarioFCM { UsuarioId = TestDb.AdminId, FcmToken = "tok-1", FechaRegistro = DateTime.UtcNow });
        ctx.SaveChanges();

        var r = await TestDb.ComoMesero(new UsuariosController(ctx)).RegistrarTokenFCM(TestDb.MeseroId, new UsuariosController.TokenFCMDto { FcmToken = "tok-1" });

        Assert.IsType<OkObjectResult>(r);
        var registro = Assert.Single(ctx.UsuariosFCM.AsNoTracking());
        Assert.Equal(TestDb.MeseroId, registro.UsuarioId);
    }

    [Fact]
    public async Task Al_cerrar_sesion_el_dispositivo_deja_de_recibir_los_avisos_del_mesero()
    {
        using var ctx = TestDb.Crear();
        ctx.UsuariosFCM.Add(new UsuarioFCM { UsuarioId = TestDb.MeseroId, FcmToken = "tok-1", FechaRegistro = DateTime.UtcNow });
        ctx.UsuariosFCM.Add(new UsuarioFCM { UsuarioId = TestDb.MeseroId, FcmToken = "tok-2", FechaRegistro = DateTime.UtcNow });
        ctx.SaveChanges();
        var controlador = TestDb.ComoMesero(new UsuariosController(ctx));

        // Otro usuario no puede quitar los tokens del mesero.
        Assert.IsType<ForbidResult>(await controlador.QuitarTokenFCM(TestDb.AdminId + 999, new UsuariosController.TokenFCMDto { FcmToken = "tok-1" }));

        Assert.IsType<NoContentResult>(await controlador.QuitarTokenFCM(TestDb.MeseroId, new UsuariosController.TokenFCMDto { FcmToken = "tok-1" }));
        Assert.IsType<NoContentResult>(await controlador.QuitarTokenFCM(TestDb.MeseroId, new UsuariosController.TokenFCMDto { FcmToken = "tok-1" }));
        Assert.Equal("tok-2", Assert.Single(ctx.UsuariosFCM.AsNoTracking()).FcmToken);
    }
}
