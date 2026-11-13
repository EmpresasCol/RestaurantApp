using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>Ciclo de la mesa: la visita se abre con el primer pedido y se cierra al saldar o cancelar todo.</summary>
public class OcupacionesTests
{
    internal static PedidosController Qr(RestauranteContext ctx)
        => new(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx));

    internal static PedidosController Mesero(RestauranteContext ctx) => TestDb.ComoMesero(Qr(ctx));

    private static PagosController Caja(RestauranteContext ctx) => TestDb.Sesion(new PagosController(ctx), TestDb.AdminId, RolUsuario.Caja);

    internal static PedidoDto Creado(ActionResult<PedidoDto> r) => (PedidoDto)Assert.IsType<CreatedAtActionResult>(r.Result).Value!;

    internal static async Task<PedidoDto> PedirPorQrAsync(RestauranteContext ctx, int cantidad = 1, string codigo = TestDb.CodigoMesaUno)
        => Creado(await Qr(ctx).PostPedido(new CrearPedidoDto
        {
            CodigoMesa = codigo,
            Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = cantidad } }
        }));

    internal static async Task<PedidoDto> PedirConMeseroAsync(RestauranteContext ctx, int cantidad = 1, int mesaId = TestDb.MesaUnoId)
        => Creado(await Mesero(ctx).PostPedido(new CrearPedidoDto
        {
            MesaId = mesaId,
            Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = cantidad } }
        }));

    internal static void Servir(RestauranteContext ctx, params int[] pedidoIds)
    {
        foreach (var p in ctx.Pedidos.Where(p => pedidoIds.Contains(p.Id))) p.Estado = EstadoPedido.Entregado;
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();
    }

    private static Mesa Mesa(RestauranteContext ctx, int id = TestDb.MesaUnoId) => ctx.Mesas.AsNoTracking().Single(m => m.Id == id);

    [Fact]
    public async Task El_primer_pedido_abre_la_visita_y_los_siguientes_se_suman_a_ella()
    {
        using var ctx = TestDb.Crear();

        var porQr = await PedirPorQrAsync(ctx);
        var porMesero = await PedirConMeseroAsync(ctx);

        var ocupacion = Assert.Single(ctx.Ocupaciones.AsNoTracking());
        Assert.True(ocupacion.Abierta);
        Assert.Equal(32, ocupacion.Token.Length);
        Assert.Matches("^[0-9]{6}$", ocupacion.Pin);
        Assert.All(ctx.Pedidos.AsNoTracking(), p => Assert.Equal(ocupacion.Id, p.OcupacionId));
        Assert.Equal(EstadoMesa.Ocupada, Mesa(ctx).Estado);
        // Solo el comensal del QR recibe la llave; la respuesta al personal no la lleva.
        Assert.Equal(ocupacion.Token, porQr.Seguimiento);
        Assert.Null(porMesero.Seguimiento);
    }

    [Fact]
    public async Task Pago_parcial_mantiene_la_visita_y_la_mesa_ocupada()
    {
        using var ctx = TestDb.Crear();
        var uno = await PedirPorQrAsync(ctx);
        var dos = await PedirConMeseroAsync(ctx, 2);
        Servir(ctx, uno.Id, dos.Id);

        var cobro = await Caja(ctx).Cobrar(new CrearCobroDto { PedidoIds = { uno.Id }, MetodoPago = "Tarjeta" });

        Assert.False(((CobroDto)((OkObjectResult)cobro.Result!).Value!).CuentaSaldada);
        Assert.True(ctx.Ocupaciones.AsNoTracking().Single().Abierta);
        Assert.Equal(EstadoMesa.Ocupada, Mesa(ctx).Estado);
    }

    [Fact]
    public async Task Pago_total_cierra_la_visita_libera_la_mesa_y_resuelve_las_llamadas()
    {
        using var ctx = TestDb.Crear();
        var uno = await PedirPorQrAsync(ctx);
        var dos = await PedirConMeseroAsync(ctx);
        Servir(ctx, uno.Id, dos.Id);
        ctx.LlamadasMesero.Add(new LlamadaMesero { MesaId = TestDb.MesaUnoId, Clave = "c1" });
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();

        await Caja(ctx).Cobrar(new CrearCobroDto { PedidoIds = { uno.Id, dos.Id }, MetodoPago = "Efectivo" });

        var ocupacion = ctx.Ocupaciones.AsNoTracking().Single();
        Assert.Null(ocupacion.Abierta);
        Assert.NotNull(ocupacion.Cierre);
        Assert.Equal(EstadoMesa.Disponible, Mesa(ctx).Estado);
        var llamada = ctx.LlamadasMesero.AsNoTracking().Single();
        Assert.Equal(LlamadaMesero.Cerrada, llamada.Estado);
        Assert.Null(llamada.Activa);
        // Cerrar la visita no borra el historial contable.
        Assert.Equal(2, ctx.Pedidos.Count());
        Assert.Single(ctx.Facturas);
    }

    [Fact]
    public async Task Cancelar_todos_los_pedidos_cierra_la_visita()
    {
        using var ctx = TestDb.Crear();
        var uno = await PedirPorQrAsync(ctx);
        var dos = await PedirConMeseroAsync(ctx);

        await Mesero(ctx).ActualizarEstado(uno.Id, new ActualizarEstadoPedidoDto { Estado = "Cancelado" });
        Assert.True(ctx.Ocupaciones.AsNoTracking().Single().Abierta);
        await Mesero(ctx).ActualizarEstado(dos.Id, new ActualizarEstadoPedidoDto { Estado = "Cancelado" });

        Assert.Null(ctx.Ocupaciones.AsNoTracking().Single().Abierta);
        Assert.Equal(EstadoMesa.Disponible, Mesa(ctx).Estado);
    }

    [Fact]
    public async Task La_siguiente_visita_de_la_mesa_tiene_otra_llave()
    {
        using var ctx = TestDb.Crear();
        var primera = await PedirPorQrAsync(ctx);
        Servir(ctx, primera.Id);
        await Caja(ctx).Cobrar(new CrearCobroDto { PedidoIds = { primera.Id }, MetodoPago = "Tarjeta" });

        var segunda = await PedirPorQrAsync(ctx);

        Assert.NotEqual(primera.Seguimiento, segunda.Seguimiento);
        Assert.Equal(2, ctx.Ocupaciones.Count());
        Assert.Single(ctx.Ocupaciones.AsNoTracking().Where(o => o.Abierta == true));
    }

    [Fact]
    public async Task La_cuenta_pedida_deja_la_mesa_esperando_pago_hasta_que_se_anula_o_se_cobra()
    {
        using var ctx = TestDb.Crear();
        var uno = await PedirConMeseroAsync(ctx);
        Servir(ctx, uno.Id);
        var cuentas = TestDb.ComoMesero(new CuentasController(ctx));

        var pedida = (SolicitudCuentaDto)((OkObjectResult)(await cuentas.Solicitar(new SolicitarCuentaDto { MesaId = TestDb.MesaUnoId })).Result!).Value!;
        Assert.Equal(EstadoMesa.EsperandoPago, Mesa(ctx).Estado);

        // Un plato más no borra que la mesa ya pidió la cuenta.
        await PedirConMeseroAsync(ctx);
        Assert.Equal(EstadoMesa.EsperandoPago, Mesa(ctx).Estado);

        await cuentas.Anular(pedida.Id);
        Assert.Equal(EstadoMesa.Ocupada, Mesa(ctx).Estado);
    }

    [Fact]
    public async Task Liberar_una_mesa_sin_consumo_cierra_su_visita()
    {
        using var ctx = TestDb.Crear();
        var uno = await PedirPorQrAsync(ctx);
        ctx.Pedidos.Single(p => p.Id == uno.Id).Estado = EstadoPedido.Cancelado; // quedó ocupada sin consumo
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();

        var r = await TestDb.Sesion(new MesasController(ctx), TestDb.AdminId, RolUsuario.Caja)
            .ActualizarEstado(TestDb.MesaUnoId, new ActualizarEstadoMesaDto { Estado = "Disponible" });

        Assert.IsType<OkObjectResult>(r);
        Assert.Null(ctx.Ocupaciones.AsNoTracking().Single().Abierta);
    }

    [Fact]
    public async Task El_personal_del_salon_ve_el_codigo_de_la_visita_y_la_cocina_no()
    {
        using var ctx = TestDb.Crear();
        await PedirPorQrAsync(ctx);
        var pin = ctx.Ocupaciones.AsNoTracking().Single().Pin;

        var mesero = (await TestDb.ComoMesero(new MesasController(ctx)).GetMesas()).Value!.ToList();
        var cocina = (await TestDb.Sesion(new MesasController(ctx), TestDb.AdminId, RolUsuario.Cocina).GetMesas()).Value!.ToList();

        Assert.Equal(pin, mesero.Single(m => m.Id == TestDb.MesaUnoId).PinSeguimiento);
        Assert.Null(mesero.Single(m => m.Id == TestDb.MesaDosId).PinSeguimiento);
        Assert.All(cocina, m => Assert.Null(m.PinSeguimiento));
    }
}
