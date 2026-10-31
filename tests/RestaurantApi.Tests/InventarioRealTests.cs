using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>Reglas del inventario que deben cumplirse como en la cocina real.</summary>
public class InventarioRealTests
{
    private const int BodegaId = 2;

    private static DateTime Hoy => HoraLocal.AhoraColombia().Date;

    private static ComprasController Compras(RestauranteContext ctx) => new(ctx);

    private static InventarioController Inventario(RestauranteContext ctx)
        => new(ctx, TestDb.Inventario(ctx), NullLogger<InventarioController>.Instance);

    private static PedidosController Pedidos(RestauranteContext ctx)
        => TestDb.ComoMesero(new PedidosController(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx)));

    private static CrearPedidoDto Pedido(int cantidad) => new()
    {
        MesaId = TestDb.MesaUnoId,
        Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = cantidad } }
    };

    /// <summary>Los 100 kg de carne: 15 kg en un lote vencido y el resto sin lote.</summary>
    private static RestauranteContext ConLoteVencido(decimal vencidos = 15m, decimal stock = 100m)
    {
        var ctx = TestDb.Crear();
        ctx.Stock.Single().Cantidad = stock;
        ctx.Lotes.Add(new Lote
        {
            Id = 1, ProductoId = TestDb.ProductoCarneId, AlmacenId = TestDb.AlmacenId, NumeroLote = "L-1",
            FechaIngreso = Hoy.AddDays(-10), FechaVencimiento = Hoy.AddDays(-1),
            CantidadInicial = vencidos, CantidadActual = vencidos, CostoUnitario = 20000m
        });
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();
        return ctx;
    }

    [Fact]
    public async Task Lo_vencido_no_se_vende_ni_se_gasta_en_recetas()
    {
        using var ctx = ConLoteVencido(vencidos: 15m, stock: 15m);

        var r = await Pedidos(ctx).PostPedido(Pedido(1));

        Assert.IsType<BadRequestObjectResult>(r.Result);
        Assert.Equal(0, (await TestDb.Inventario(ctx).PorcionesDisponiblesAsync())[TestDb.PlatilloHamburguesaId]);
        Assert.Equal(15m, TestDb.StockCarne(ctx));
    }

    [Fact]
    public async Task Con_stock_bueno_la_venta_no_toca_el_lote_vencido()
    {
        using var ctx = ConLoteVencido();

        Assert.IsType<CreatedAtActionResult>((await Pedidos(ctx).PostPedido(Pedido(5))).Result);

        Assert.Equal(99m, TestDb.StockCarne(ctx));
        Assert.Equal(15m, ctx.Lotes.AsNoTracking().Single().CantidadActual);
        // 85 kg utilizables − 1 kg vendido.
        Assert.Equal(420, (await TestDb.Inventario(ctx).PorcionesDisponiblesAsync())[TestDb.PlatilloHamburguesaId]);
    }

    [Fact]
    public async Task Corregir_la_fecha_de_un_lote_lo_vuelve_utilizable()
    {
        using var ctx = ConLoteVencido(vencidos: 15m, stock: 15m);

        Assert.IsType<NoContentResult>(await Compras(ctx).EditarLote(1, new EditarLoteDto { FechaVencimiento = Hoy.AddDays(20), NumeroLote = "L-1B" }));

        var lote = ctx.Lotes.AsNoTracking().Single();
        Assert.Equal(Hoy.AddDays(20), lote.FechaVencimiento);
        Assert.Equal("L-1B", lote.NumeroLote);
        Assert.Equal(75, (await TestDb.Inventario(ctx).PorcionesDisponiblesAsync())[TestDb.PlatilloHamburguesaId]);
    }

    [Fact]
    public async Task Un_perecedero_no_puede_quedar_sin_fecha()
    {
        using var ctx = ConLoteVencido();
        ctx.ProductosInventario.Single().RequiereCaducidad = true;
        ctx.SaveChanges();

        Assert.IsType<BadRequestObjectResult>(await Compras(ctx).EditarLote(1, new EditarLoteDto { FechaVencimiento = null }));
    }

    [Fact]
    public async Task Trasladar_mueve_stock_y_lotes_con_su_fecha_sin_llevar_lo_vencido()
    {
        using var ctx = ConLoteVencido();
        ctx.Almacenes.Add(new Almacen { Id = BodegaId, Codigo = "ALM-02", Nombre = "Bodega", Descripcion = "-", Ubicacion = "-" });
        ctx.Lotes.Add(new Lote
        {
            Id = 2, ProductoId = TestDb.ProductoCarneId, AlmacenId = TestDb.AlmacenId, NumeroLote = "L-2",
            FechaIngreso = Hoy, FechaVencimiento = Hoy.AddDays(6), CantidadInicial = 30m, CantidadActual = 30m, CostoUnitario = 20000m
        });
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();

        var demasiado = await Compras(ctx).Trasladar(new TrasladoDto { ProductoId = TestDb.ProductoCarneId, AlmacenOrigenId = TestDb.AlmacenId, AlmacenDestinoId = BodegaId, Cantidad = 90m });
        Assert.IsType<BadRequestObjectResult>(demasiado.Result);

        ctx.ChangeTracker.Clear();
        var ok = await Compras(ctx).Trasladar(new TrasladoDto { ProductoId = TestDb.ProductoCarneId, AlmacenOrigenId = TestDb.AlmacenId, AlmacenDestinoId = BodegaId, Cantidad = 20m });
        Assert.IsType<OkObjectResult>(ok.Result);

        var stock = ctx.Stock.AsNoTracking().ToDictionary(s => s.AlmacenId, s => s.Cantidad);
        Assert.Equal(80m, stock[TestDb.AlmacenId]);
        Assert.Equal(20m, stock[BodegaId]);
        var movido = ctx.Lotes.AsNoTracking().Single(l => l.AlmacenId == BodegaId);
        Assert.Equal(Hoy.AddDays(6), movido.FechaVencimiento);
        Assert.Equal(20m, movido.CantidadActual);
        Assert.Equal(15m, ctx.Lotes.AsNoTracking().Single(l => l.Id == 1).CantidadActual);
        Assert.Equal(2, ctx.MovimientosInventario.AsNoTracking().Count(m => m.TipoMovimiento == "Transferencia"));
    }

    [Fact]
    public async Task El_ajuste_registra_la_diferencia_en_el_kardex()
    {
        using var ctx = TestDb.Crear();

        await Inventario(ctx).CreateMovimiento(new MovimientoInventarioDTO
        {
            ProductoId = TestDb.ProductoCarneId, AlmacenId = TestDb.AlmacenId, TipoMovimiento = "Ajuste", Cantidad = 96m, Motivo = "Conteo"
        });

        var mov = ctx.MovimientosInventario.AsNoTracking().Single();
        Assert.Equal(4m, mov.Cantidad);
        Assert.Contains("100 → 96", mov.Motivo);

        var igual = await Inventario(ctx).CreateMovimiento(new MovimientoInventarioDTO
        {
            ProductoId = TestDb.ProductoCarneId, AlmacenId = TestDb.AlmacenId, TipoMovimiento = "Ajuste", Cantidad = 96m
        });
        Assert.IsType<BadRequestObjectResult>(igual.Result);
    }

    [Fact]
    public async Task Un_insumo_nuevo_recibe_codigo_interno_y_guarda_su_codigo_de_barras()
    {
        using var ctx = TestDb.Crear();
        var dto = new ProductoInventarioDto { Nombre = "Leche entera", CategoriaId = 1, UnidadMedida = "Litro", CodigoBarras = "7702001000011", StockMinimo = 2.5m };

        var r = await Inventario(ctx).CreateProducto(dto);

        Assert.IsType<CreatedAtActionResult>(r.Result);
        var leche = ctx.ProductosInventario.AsNoTracking().Single(p => p.Nombre == "Leche entera");
        Assert.Equal("PROD-002", leche.Codigo);
        Assert.Equal("7702001000011", leche.CodigoBarras);
        Assert.Equal(2.5m, leche.StockMinimo);

        var resuelto = await Compras(ctx).ResolverCodigo("7702001000011");
        Assert.Equal(leche.Id, JsonSerializer.SerializeToElement(((OkObjectResult)resuelto.Result!).Value).GetProperty("Insumo").GetProperty("Id").GetInt32());

        var repetido = await Inventario(ctx).CreateProducto(new ProductoInventarioDto { Nombre = "Otra", CategoriaId = 1, UnidadMedida = "Litro", CodigoBarras = "7702001000011" });
        Assert.IsType<BadRequestObjectResult>(repetido.Result);
    }

    [Fact]
    public async Task La_receta_usa_la_unidad_del_insumo_y_no_se_repite()
    {
        using var ctx = TestDb.Crear();
        ctx.Recetas.RemoveRange(ctx.Recetas);
        ctx.SaveChanges();

        await Inventario(ctx).CreateReceta(new CrearRecetaDto { PlatilloId = TestDb.PlatilloHamburguesaId, ProductoId = TestDb.ProductoCarneId, CantidadRequerida = 0.2m, UnidadMedida = "Gramos" });
        Assert.Equal(UnidadMedida.Kg, ctx.Recetas.AsNoTracking().Single().UnidadMedida);

        var otra = await Inventario(ctx).CreateReceta(new CrearRecetaDto { PlatilloId = TestDb.PlatilloHamburguesaId, ProductoId = TestDb.ProductoCarneId, CantidadRequerida = 0.1m });
        Assert.IsType<BadRequestObjectResult>(otra.Result);
    }
}
