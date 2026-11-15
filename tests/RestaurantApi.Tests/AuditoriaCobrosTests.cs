using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>
/// Hallazgos de la auditoría del 14/11/2026: lo ya facturado no se cobra dos veces ni se
/// reescribe, el pedido en cocina no se edita por otra ruta y el código de la mesa no se adivina
/// a fuerza de intentos.
/// </summary>
public class AuditoriaCobrosTests
{
    private static PedidosController Pedidos(RestauranteContext ctx, RolUsuario rol)
        => TestDb.Sesion(new PedidosController(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx)), TestDb.MeseroId, rol);

    private static PagosController Caja(RestauranteContext ctx) => TestDb.Sesion(new PagosController(ctx), TestDb.AdminId, RolUsuario.Caja);

    private static PedidoDetallesController Detalles(RestauranteContext ctx)
        => TestDb.ComoAdmin(new PedidoDetallesController(ctx, TestDb.Inventario(ctx)));

    private static int? Codigo(IActionResult? r) => (r as ObjectResult)?.StatusCode ?? (r as StatusCodeResult)?.StatusCode;

    private static void Servido(RestauranteContext ctx, int id, int cantidad)
    {
        TestDb.CrearPedidoDirecto(ctx, id, cantidad, TestDb.MesaUnoId, EstadoPedido.Entregado);
        ctx.Mesas.Single(m => m.Id == TestDb.MesaUnoId).Estado = EstadoMesa.Ocupada;
        ctx.SaveChanges();
    }

    /// <summary>Cobra 1 de las 2 unidades del pedido 1 y devuelve el Id de la línea ya facturada.</summary>
    private static async Task<int> CobrarUnaDeDosAsync(RestauranteContext ctx)
    {
        Servido(ctx, 1, 2);
        var detalle = ctx.PedidoDetalles.AsNoTracking().First(d => d.PedidoId == 1).Id;
        var cobro = await Caja(ctx).Cobrar(new CrearCobroDto { Lineas = { new LineaCobroDto { DetalleId = detalle, Cantidad = 1 } } });
        Assert.IsType<OkObjectResult>(cobro.Result);
        ctx.ChangeTracker.Clear();
        return ctx.PedidoDetalles.AsNoTracking().Single(d => d.PedidoId == 1 && d.FacturaId != null).Id;
    }

    /// <summary>[ALTO] POST api/pagos cobraba el pedido entero aunque parte ya estuviera en una factura.</summary>
    [Fact]
    public async Task El_pago_suelto_no_vuelve_a_cobrar_lo_ya_facturado()
    {
        using var ctx = TestDb.Crear();
        await CobrarUnaDeDosAsync(ctx);
        var consumo = Cuentas.Consumo(ctx.Pedidos.Include(p => p.Detalles).ThenInclude(d => d.Platillo).AsNoTracking().Single());

        var r = await Caja(ctx).PostPago(new CrearPagoDto { PedidoId = 1, Monto = consumo, MetodoPago = "Efectivo" });

        Assert.IsType<ConflictObjectResult>(r.Result);
        Assert.Single(ctx.Pagos.AsNoTracking());
        Assert.Equal(EstadoPedido.Entregado, ctx.Pedidos.AsNoTracking().Single().Estado);
    }

    /// <summary>[ALTO] El administrador borraba un pedido cobrado y la factura quedaba sin sus platos.</summary>
    [Fact]
    public async Task Un_pedido_con_platos_facturados_no_se_elimina()
    {
        using var ctx = TestDb.Crear();
        await CobrarUnaDeDosAsync(ctx);

        var r = await Pedidos(ctx, RolUsuario.Administrador).DeletePedido(1);

        Assert.IsType<ConflictObjectResult>(r);
        Assert.Equal(2, ctx.PedidoDetalles.AsNoTracking().Count());
    }

    /// <summary>[ALTO] El CRUD de detalles dejaba cambiar o quitar un plato de una factura emitida.</summary>
    [Fact]
    public async Task Un_plato_facturado_no_se_edita_ni_se_borra_por_el_crud_de_detalles()
    {
        using var ctx = TestDb.Crear();
        var facturado = await CobrarUnaDeDosAsync(ctx);

        var editar = await Detalles(ctx).PutPedidoDetalle(facturado, new PedidoDetalle { Id = facturado, PedidoId = 1, PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 5 });
        var borrar = await Detalles(ctx).DeletePedidoDetalle(facturado);

        Assert.IsType<ConflictObjectResult>(editar);
        Assert.IsType<ConflictObjectResult>(borrar);
        Assert.Equal(1, ctx.PedidoDetalles.AsNoTracking().Single(d => d.Id == facturado).Cantidad);
    }

    [Fact]
    public async Task Una_linea_nueva_no_nace_marcada_como_cobrada()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1);
        ctx.ChangeTracker.Clear();

        var r = await Detalles(ctx).PostPedidoDetalle(new PedidoDetalle { PedidoId = 1, PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 1, FacturaId = 99 });

        Assert.IsType<CreatedAtActionResult>(r.Result);
        Assert.All(ctx.PedidoDetalles.AsNoTracking(), d => Assert.Null(d.FacturaId));
    }

    /// <summary>
    /// [MEDIO] PUT api/pedidos/{id} dejaba al mesero bajar la cantidad de un pedido ya servido (la
    /// otra ruta de edición sí lo impedía) y a la cocina cambiar los platos.
    /// </summary>
    [Theory]
    [InlineData(RolUsuario.Mesero, StatusCodes.Status409Conflict)]
    [InlineData(RolUsuario.Caja, StatusCodes.Status409Conflict)]
    [InlineData(RolUsuario.Cocina, StatusCodes.Status403Forbidden)]
    public async Task Un_pedido_servido_no_se_edita_por_la_edicion_completa(RolUsuario rol, int esperado)
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 3);
        var detalle = ctx.PedidoDetalles.AsNoTracking().Single().Id;
        ctx.ChangeTracker.Clear();

        var r = await Pedidos(ctx, rol).PutPedido(1, new ActualizarPedidoDto
        {
            Detalles = new List<ActualizarPedidoDetalleDto> { new() { Id = detalle, PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 1 } }
        });

        Assert.Equal(esperado, Codigo(r));
        Assert.Equal(3, ctx.PedidoDetalles.AsNoTracking().Single().Cantidad);
    }

    /// <summary>
    /// [ALTO] El cupo del comensal se parte por la cabecera X-Mesa, que pone el cliente: cambiándola
    /// se probaban códigos sin límite. Ahora la visita deja de escuchar tras varios fallos.
    /// </summary>
    [Fact]
    public async Task El_codigo_de_la_mesa_no_se_adivina_a_fuerza_de_intentos()
    {
        using var ctx = TestDb.Crear();
        await OcupacionesTests.PedirPorQrAsync(ctx);
        ClienteMesaController Cliente() => ClienteMesaTests.Cliente(ctx);

        for (var i = 0; i < ClienteMesaController.MaximoFallosPin; i++)
        {
            var pin = ctx.Ocupaciones.AsNoTracking().Single().Pin;
            var malo = pin == "000000" ? "111111" : "000000";
            Assert.IsType<BadRequestObjectResult>(await Cliente().Unirse(new UnirseDto { CodigoMesa = TestDb.CodigoMesaUno, Pin = malo }));
        }

        // Ni con el código correcto: quien lo intenta ya no distingue si acertó.
        var bueno = ctx.Ocupaciones.AsNoTracking().Single().Pin;
        var r = await Cliente().Unirse(new UnirseDto { CodigoMesa = TestDb.CodigoMesaUno, Pin = bueno });
        Assert.Equal(StatusCodes.Status429TooManyRequests, Codigo(r));
    }

    [Theory]
    [InlineData("/api/cliente-mesa/unirse", true)]
    [InlineData("/api/hubs/mesa/negotiate", true)]
    [InlineData("/api/mesas/qr/abc", true)]
    [InlineData("/api/mesas", false)]
    [InlineData("/api/pedidos", false)]
    public void El_techo_por_ip_cubre_solo_las_rutas_del_comensal(string ruta, bool esperado)
        => Assert.Equal(esperado, CupoPeticiones.EsDelComensal(new PathString(ruta)));
}
