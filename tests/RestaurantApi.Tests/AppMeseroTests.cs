using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>
/// Reglas de la app del mesero: edita o cancela solo lo que la cocina no ha empezado,
/// y pide la cuenta (con el comprobante si pagan por transferencia) para que la caja cobre.
/// </summary>
public class AppMeseroTests
{
    private const string Foto = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

    private static PedidosController Pedidos(RestauranteContext ctx)
        => TestDb.ComoMesero(new PedidosController(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx)));

    private static PedidosController Cocina(RestauranteContext ctx)
        => TestDb.Sesion(new PedidosController(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx)), TestDb.AdminId, RolUsuario.Cocina);

    private static CuentasController Cuentas(RestauranteContext ctx) => TestDb.ComoMesero(new CuentasController(ctx));

    private static ActualizarPedidoCompletoDto Hamburguesas(int cantidad) => new()
    {
        Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = cantidad } }
    };

    private static PedidoDto Creado(ActionResult<PedidoDto> r) => (PedidoDto)((CreatedAtActionResult)r.Result!).Value!;

    private static async Task<PedidoDto> PedidoDelMesero(RestauranteContext ctx, int cantidad = 1) => Creado(await Pedidos(ctx).PostPedido(new CrearPedidoDto
    {
        MesaId = TestDb.MesaUnoId,
        Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = cantidad } }
    }));

    private static SolicitudCuentaDto Solicitud(ActionResult<SolicitudCuentaDto> r)
        => (SolicitudCuentaDto)Assert.IsType<OkObjectResult>(r.Result).Value!;

    // ==================== EDITAR Y CANCELAR ====================

    [Fact]
    public async Task El_mesero_edita_un_pedido_que_la_cocina_no_ha_empezado_y_el_inventario_se_ajusta()
    {
        using var ctx = TestDb.Crear();
        var pedido = await PedidoDelMesero(ctx, 1);
        Assert.False(pedido.CocinaEmpezo);

        var r = await Pedidos(ctx).ActualizarPedidoCompleto(pedido.Id, Hamburguesas(3));

        Assert.Equal(3, Assert.IsType<PedidoDto>(r.Value).Detalles.Single().Cantidad);
        Assert.Equal(TestDb.StockInicialCarne - 3 * TestDb.CarnePorHamburguesa, TestDb.StockCarne(ctx));
    }

    [Fact]
    public async Task Cuando_la_cocina_empieza_el_mesero_ya_no_edita_ni_cancela()
    {
        using var ctx = TestDb.Crear();
        var pedido = await PedidoDelMesero(ctx, 1);

        Assert.IsType<NoContentResult>(await Cocina(ctx).Preparar(pedido.Id));

        var editar = await Pedidos(ctx).ActualizarPedidoCompleto(pedido.Id, Hamburguesas(3));
        var cancelar = await Pedidos(ctx).ActualizarEstado(pedido.Id, new ActualizarEstadoPedidoDto { Estado = "Cancelado" });

        Assert.IsType<ConflictObjectResult>(editar.Result);
        Assert.IsType<ConflictObjectResult>(cancelar);
        Assert.Equal(TestDb.StockInicialCarne - TestDb.CarnePorHamburguesa, TestDb.StockCarne(ctx));
        Assert.True((await Pedidos(ctx).GetPedido(pedido.Id)).Value!.CocinaEmpezo);
    }

    [Fact]
    public async Task El_mesero_cancela_un_pedido_sin_empezar_y_el_stock_vuelve()
    {
        using var ctx = TestDb.Crear();
        var pedido = await PedidoDelMesero(ctx, 2);

        var r = await Pedidos(ctx).ActualizarEstado(pedido.Id, new ActualizarEstadoPedidoDto { Estado = "Cancelado" });

        Assert.IsType<OkObjectResult>(r);
        Assert.Equal(TestDb.StockInicialCarne, TestDb.StockCarne(ctx));
    }

    [Fact]
    public async Task El_administrador_si_cancela_un_pedido_que_la_cocina_empezo()
    {
        using var ctx = TestDb.Crear();
        var pedido = await PedidoDelMesero(ctx, 1);
        await Cocina(ctx).Preparar(pedido.Id);

        var r = await TestDb.ComoAdmin(Pedidos(ctx)).ActualizarEstado(pedido.Id, new ActualizarEstadoPedidoDto { Estado = "Cancelado" });

        Assert.IsType<OkObjectResult>(r);
    }

    [Fact]
    public async Task Un_pedido_listo_ya_no_se_empieza_a_preparar()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1, estado: EstadoPedido.Listo);

        Assert.IsType<ConflictObjectResult>(await Cocina(ctx).Preparar(1));
    }

    // ==================== SOLICITUD DE CUENTA ====================

    [Fact]
    public async Task Una_mesa_sin_pedidos_abiertos_no_pide_la_cuenta()
    {
        using var ctx = TestDb.Crear();

        var r = await Cuentas(ctx).Solicitar(new SolicitarCuentaDto { MesaId = TestDb.MesaDosId });

        Assert.IsType<BadRequestObjectResult>(r.Result);
    }

    [Fact]
    public async Task Pedir_la_cuenta_y_luego_avisar_el_pago_usa_una_sola_solicitud()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1, estado: EstadoPedido.Entregado);

        var pedida = Solicitud(await Cuentas(ctx).Solicitar(new SolicitarCuentaDto { MesaId = TestDb.MesaUnoId }));
        var pagada = Solicitud(await Cuentas(ctx).Solicitar(new SolicitarCuentaDto { MesaId = TestDb.MesaUnoId, MetodoPago = "efectivo" }));

        Assert.Null(pedida.MetodoPago);
        Assert.Equal(pedida.Id, pagada.Id);
        Assert.Equal("Efectivo", pagada.MetodoPago);
        var pendiente = Assert.Single((await Cuentas(ctx).GetPendientes()).Value!);
        Assert.Equal(1, pendiente.MesaNumero);
        Assert.Equal("Mesero", pendiente.MeseroNombre);
    }

    [Fact]
    public async Task La_transferencia_exige_la_foto_y_cambiar_a_tarjeta_la_descarta()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1, estado: EstadoPedido.Entregado);

        var sinFoto = await Cuentas(ctx).Solicitar(new SolicitarCuentaDto { MesaId = TestDb.MesaUnoId, MetodoPago = "QR" });
        var noEsFoto = await Cuentas(ctx).Solicitar(new SolicitarCuentaDto { MesaId = TestDb.MesaUnoId, MetodoPago = "QR", Comprobante = "hola" });
        var conFoto = Solicitud(await Cuentas(ctx).Solicitar(new SolicitarCuentaDto { MesaId = TestDb.MesaUnoId, MetodoPago = "QR", Comprobante = Foto }));

        Assert.IsType<BadRequestObjectResult>(sinFoto.Result);
        Assert.IsType<BadRequestObjectResult>(noEsFoto.Result);
        Assert.True(conFoto.TieneComprobante);
        var foto = Assert.IsType<OkObjectResult>(await Cuentas(ctx).GetComprobante(conFoto.Id));
        Assert.Contains(Foto, foto.Value!.ToString());

        var tarjeta = Solicitud(await Cuentas(ctx).Solicitar(new SolicitarCuentaDto { MesaId = TestDb.MesaUnoId, MetodoPago = "Tarjeta" }));
        Assert.False(tarjeta.TieneComprobante);
    }

    [Fact]
    public async Task Al_cobrar_toda_la_cuenta_la_solicitud_queda_ligada_a_la_factura()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1, estado: EstadoPedido.Entregado);
        TestDb.CrearPedidoDirecto(ctx, 2, 1, estado: EstadoPedido.Entregado);
        Solicitud(await Cuentas(ctx).Solicitar(new SolicitarCuentaDto { MesaId = TestDb.MesaUnoId }));

        // Dividir la cuenta: el primer cobro deja la solicitud pendiente.
        await new PagosController(ctx).Cobrar(new CrearCobroDto { PedidoIds = { 1 }, MetodoPago = "QR" });
        Assert.Single((await Cuentas(ctx).GetPendientes()).Value!);

        var r = await new PagosController(ctx).Cobrar(new CrearCobroDto { PedidoIds = { 2 }, MetodoPago = "QR" });

        var factura = ((CobroDto)Assert.IsType<OkObjectResult>(r.Result).Value!).Factura;
        Assert.Empty((await Cuentas(ctx).GetPendientes()).Value!);
        var cerrada = ctx.SolicitudesCuenta.AsNoTracking().Single();
        Assert.Equal(SolicitudCuenta.Cobrada, cerrada.Estado);
        Assert.Equal(factura.Id, cerrada.FacturaId);
    }

    [Fact]
    public async Task Si_se_cancelan_todos_los_pedidos_la_solicitud_se_anula()
    {
        using var ctx = TestDb.Crear();
        var pedido = await PedidoDelMesero(ctx, 1);
        Solicitud(await Cuentas(ctx).Solicitar(new SolicitarCuentaDto { MesaId = TestDb.MesaUnoId }));

        await Pedidos(ctx).ActualizarEstado(pedido.Id, new ActualizarEstadoPedidoDto { Estado = "Cancelado" });

        Assert.Empty((await Cuentas(ctx).GetPendientes()).Value!);
        Assert.Equal(SolicitudCuenta.Anulada, ctx.SolicitudesCuenta.AsNoTracking().Single().Estado);
    }
}
