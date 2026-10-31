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
/// Sin ingredientes no se vende: el pedido se rechaza antes de guardarse, la carta marca
/// el platillo como no disponible y el stock nunca queda negativo.
/// </summary>
public class DisponibilidadTests
{
    // 1 kg de carne alcanza para 5 hamburguesas (0,2 kg cada una).
    private const decimal CarneParaCinco = 1m;

    private static PedidosController Pedidos(RestauranteContext ctx)
        => TestDb.ComoMesero(new PedidosController(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx)));

    private static PlatillosController Platillos(RestauranteContext ctx) => new(ctx, TestDb.Inventario(ctx));

    private static InventarioController Inventario(RestauranteContext ctx)
        => new(ctx, TestDb.Inventario(ctx), NullLogger<InventarioController>.Instance);

    private static CrearPedidoDto Pedido(int cantidad) => new()
    {
        MesaId = TestDb.MesaUnoId,
        Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = cantidad } }
    };

    private static RestauranteContext ConCarne(decimal kilos)
    {
        var ctx = TestDb.Crear();
        ctx.Stock.Single().Cantidad = kilos;
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();
        return ctx;
    }

    private static string Mensaje(IActionResult? r) => Assert.IsType<BadRequestObjectResult>(r).Value switch
    {
        string s => s,
        var o => o!.GetType().GetProperty("message")!.GetValue(o)!.ToString()!
    };

    [Fact]
    public async Task Pedido_sin_ingredientes_se_rechaza_y_no_toca_stock_ni_mesa()
    {
        using var ctx = ConCarne(CarneParaCinco);

        var r = await Pedidos(ctx).PostPedido(Pedido(6));

        Assert.Contains("no disponible por el momento", Mensaje(r.Result));
        Assert.Contains("Hamburguesa Clasica", Mensaje(r.Result));
        Assert.Empty(ctx.Pedidos.AsNoTracking());
        Assert.Equal(CarneParaCinco, TestDb.StockCarne(ctx));
        Assert.Equal(EstadoMesa.Disponible, ctx.Mesas.AsNoTracking().Single(m => m.Id == TestDb.MesaUnoId).Estado);
    }

    [Fact]
    public async Task Pedido_justo_al_limite_deja_stock_en_cero_y_el_siguiente_se_rechaza()
    {
        using var ctx = ConCarne(CarneParaCinco);

        Assert.IsType<CreatedAtActionResult>((await Pedidos(ctx).PostPedido(Pedido(5))).Result);
        Assert.Equal(0m, TestDb.StockCarne(ctx));

        ctx.ChangeTracker.Clear();
        var r = await Pedidos(ctx).PostPedido(Pedido(1));
        Mensaje(r.Result);
        Assert.Equal(0m, TestDb.StockCarne(ctx));
    }

    [Fact]
    public async Task Editar_un_pedido_cuenta_lo_que_ya_consumio()
    {
        using var ctx = ConCarne(CarneParaCinco);
        var creado = (PedidoDto)((CreatedAtActionResult)(await Pedidos(ctx).PostPedido(Pedido(5))).Result!).Value!;
        ctx.ChangeTracker.Clear();

        // Mismas 5 porciones: lo consumido por este pedido sigue siendo suyo.
        var igual = await Pedidos(ctx).ActualizarPedidoCompleto(creado.Id, new ActualizarPedidoCompletoDto
        {
            Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 5 } }
        });
        Assert.IsNotType<BadRequestObjectResult>(igual.Result);

        ctx.ChangeTracker.Clear();
        var mas = await Pedidos(ctx).ActualizarPedidoCompleto(creado.Id, new ActualizarPedidoCompletoDto
        {
            Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 6 } }
        });
        Mensaje(mas.Result);
        Assert.Equal(0m, TestDb.StockCarne(ctx));
    }

    [Fact]
    public async Task Agregar_platos_con_put_parcial_tambien_valida_stock()
    {
        using var ctx = ConCarne(CarneParaCinco);
        TestDb.CrearPedidoDirecto(ctx, 1, 4);
        await TestDb.Inventario(ctx).DescontarStockPorPedidoAsync(1);
        ctx.ChangeTracker.Clear();

        var r = await Pedidos(ctx).PutPedido(1, new ActualizarPedidoDto
        {
            Detalles = new() { new ActualizarPedidoDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 2 } }
        });

        Mensaje(r);
        Assert.Equal(0.2m, TestDb.StockCarne(ctx));
    }

    [Fact]
    public async Task Domicilio_publico_sin_ingredientes_se_rechaza()
    {
        using var ctx = ConCarne(0.2m);
        var publico = new DomiciliosPublicoController(ctx,
            new DomicilioRealtimeService(ctx, NullLogger<DomicilioRealtimeService>.Instance),
            TestDb.Inventario(ctx), NullLogger<DomiciliosPublicoController>.Instance);

        var r = await publico.Crear(new CreateDomicilioPublicoDto
        {
            ClienteNombre = "Laura", ClienteTelefono = "3001234567", DireccionCompleta = "Calle 20 # 15-30",
            MetodoPago = "Efectivo",
            Detalles = { new CreateDomicilioDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 2 } }
        });

        Assert.Contains("no disponible", Mensaje(r.Result));
        Assert.Empty(ctx.Domicilios.AsNoTracking());
        Assert.Equal(0.2m, TestDb.StockCarne(ctx));
    }

    [Fact]
    public async Task La_carta_marca_no_disponible_y_cuenta_porciones()
    {
        using var ctx = ConCarne(CarneParaCinco);
        ctx.Platillos.Add(new Platillo { Id = 2, Nombre = "Plato sin receta", Precio = 1000m });
        ctx.SaveChanges();

        var carta = (await Platillos(ctx).GetPlatillos()).Value!.ToDictionary(p => p.Id);
        Assert.True(carta[TestDb.PlatilloHamburguesaId].Disponible);
        Assert.Equal(5, carta[TestDb.PlatilloHamburguesaId].PorcionesDisponibles);
        // Sin receta ni producto homónimo no hay control de inventario: se puede vender.
        Assert.True(carta[2].Disponible);
        Assert.Null(carta[2].PorcionesDisponibles);

        ctx.Stock.Single().Cantidad = 0.1m;
        ctx.SaveChanges();
        var agotado = (await Platillos(ctx).GetPlatillo(TestDb.PlatilloHamburguesaId)).Value!;
        Assert.False(agotado.Disponible);
        Assert.Equal(0, agotado.PorcionesDisponibles);
    }

    [Fact]
    public async Task Insumo_inactivo_deja_el_platillo_no_disponible()
    {
        using var ctx = ConCarne(CarneParaCinco);
        ctx.ProductosInventario.Single().Activo = false;
        ctx.SaveChanges();

        var porciones = await TestDb.Inventario(ctx).PorcionesDisponiblesAsync();

        Assert.Equal(0, porciones[TestDb.PlatilloHamburguesaId]);
    }

    [Fact]
    public async Task Ingrediente_opcional_agotado_no_bloquea_la_venta()
    {
        using var ctx = ConCarne(CarneParaCinco);
        ctx.ProductosInventario.Add(new ProductoInventario { Id = 2, Codigo = "PROD-099", Nombre = "Tocineta", CategoriaId = 1, UnidadMedida = "Kg", PrecioCosto = 1m });
        ctx.Recetas.Add(new Receta { Id = 2, PlatilloId = TestDb.PlatilloHamburguesaId, ProductoId = 2, CantidadRequerida = 0.05m, UnidadMedida = UnidadMedida.Kg, Opcional = true });
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();

        Assert.IsType<CreatedAtActionResult>((await Pedidos(ctx).PostPedido(Pedido(2))).Result);
        Assert.Equal(CarneParaCinco - 2 * TestDb.CarnePorHamburguesa, TestDb.StockCarne(ctx));
    }

    [Fact]
    public async Task Stock_negativo_heredado_cuenta_como_agotado()
    {
        using var ctx = ConCarne(-3m);

        var porciones = await TestDb.Inventario(ctx).PorcionesDisponiblesAsync();
        Mensaje((await Pedidos(ctx).PostPedido(Pedido(1))).Result);

        Assert.Equal(0, porciones[TestDb.PlatilloHamburguesaId]);
    }

    [Fact]
    public async Task Ajuste_a_cero_se_permite_y_salida_sin_cantidad_no()
    {
        using var ctx = TestDb.Crear();
        var ajuste = await Inventario(ctx).CreateMovimiento(new MovimientoInventarioDTO
        {
            ProductoId = TestDb.ProductoCarneId, AlmacenId = TestDb.AlmacenId, TipoMovimiento = "Ajuste", Cantidad = 0, Motivo = "Conteo"
        });
        Assert.IsType<CreatedAtActionResult>(ajuste.Result);
        Assert.Equal(0m, TestDb.StockCarne(ctx));

        var salida = await Inventario(ctx).CreateMovimiento(new MovimientoInventarioDTO
        {
            ProductoId = TestDb.ProductoCarneId, AlmacenId = TestDb.AlmacenId, TipoMovimiento = "Salida", Cantidad = 0
        });
        Assert.IsType<BadRequestObjectResult>(salida.Result);
    }

    [Fact]
    public async Task Salida_manual_descuenta_tambien_del_lote()
    {
        using var ctx = TestDb.Crear();
        ctx.Lotes.Add(new Lote
        {
            Id = 1, ProductoId = TestDb.ProductoCarneId, AlmacenId = TestDb.AlmacenId, NumeroLote = "L-1",
            FechaIngreso = DateTime.UtcNow, CantidadInicial = 100m, CantidadActual = 100m, CostoUnitario = 20000m
        });
        ctx.SaveChanges();

        await Inventario(ctx).CreateMovimiento(new MovimientoInventarioDTO
        {
            ProductoId = TestDb.ProductoCarneId, AlmacenId = TestDb.AlmacenId, TipoMovimiento = "Merma", Cantidad = 30m
        });

        Assert.Equal(70m, TestDb.StockCarne(ctx));
        Assert.Equal(70m, ctx.Lotes.AsNoTracking().Single().CantidadActual);
    }
}
