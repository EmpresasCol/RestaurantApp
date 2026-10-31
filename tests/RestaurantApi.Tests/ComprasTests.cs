using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>Trabajo diario del inventario: recibir con escáner, vencimientos, reposición, órdenes y conteo.</summary>
public class ComprasTests
{
    private const int ProveedorId = 1;
    private const int CajaCarneId = 1;
    private const string CodigoCaja = "7701234567890";

    private static ComprasController Compras(RestauranteContext ctx) => new(ctx);

    private static DateTime Hoy => HoraLocal.AhoraColombia().Date;

    /// <summary>Escenario base + proveedor + presentación "Caja 10 kg" con código de barras.</summary>
    private static RestauranteContext Crear()
    {
        var ctx = TestDb.Crear();
        ctx.Proveedores.Add(new Proveedor { Id = ProveedorId, Nombre = "Carnes del Sinú", Telefono = "3001112233" });
        ctx.PresentacionesCompra.Add(new PresentacionCompra
        {
            Id = CajaCarneId, ProductoId = TestDb.ProductoCarneId, Nombre = "Caja 10 kg", Factor = 10m,
            Codigo = CodigoCaja, ProveedorId = ProveedorId, CostoReferencia = 200000m
        });
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();
        return ctx;
    }

    private static T Valor<T>(ActionResult<object> r, string propiedad)
    {
        var ok = Assert.IsType<OkObjectResult>(r.Result);
        var json = JsonSerializer.SerializeToElement(ok.Value);
        return json.GetProperty(propiedad).Deserialize<T>()!;
    }

    private static string Mensaje(IActionResult? r)
    {
        var obj = r switch { BadRequestObjectResult b => b.Value, ConflictObjectResult c => c.Value, _ => throw new Xunit.Sdk.XunitException($"Se esperaba 400/409 y llegó {r?.GetType().Name}") };
        return JsonSerializer.SerializeToElement(obj).GetProperty("message").GetString()!;
    }

    private static RecepcionDto Recepcion(params RecepcionLineaDto[] lineas) => new() { AlmacenId = TestDb.AlmacenId, ProveedorId = ProveedorId, Lineas = lineas.ToList() };

    [Fact]
    public async Task Escanear_codigo_de_caja_devuelve_insumo_y_factor()
    {
        using var ctx = Crear();

        var r = await Compras(ctx).ResolverCodigo(CodigoCaja);

        var json = JsonSerializer.SerializeToElement(((OkObjectResult)r.Result!).Value);
        Assert.Equal(TestDb.ProductoCarneId, json.GetProperty("Insumo").GetProperty("Id").GetInt32());
        Assert.Equal(10m, json.GetProperty("Presentacion").GetProperty("Factor").GetDecimal());
    }

    [Fact]
    public async Task El_codigo_interno_del_insumo_tambien_se_reconoce_y_uno_desconocido_no()
    {
        using var ctx = Crear();

        Assert.IsType<OkObjectResult>((await Compras(ctx).ResolverCodigo("PROD-001")).Result);
        Assert.IsType<NotFoundObjectResult>((await Compras(ctx).ResolverCodigo("000")).Result);
    }

    [Fact]
    public async Task Un_codigo_no_se_puede_asociar_a_dos_presentaciones()
    {
        using var ctx = Crear();

        var r = await Compras(ctx).CrearPresentacion(new PresentacionCompraDto { ProductoId = TestDb.ProductoCarneId, Nombre = "Otra", Factor = 1, Codigo = CodigoCaja });

        Assert.Contains("ya está asociado", Mensaje(r.Result));
    }

    [Fact]
    public async Task Recibir_cajas_crea_lote_con_vencimiento_sube_stock_y_actualiza_costos()
    {
        using var ctx = Crear();
        var vence = Hoy.AddDays(5);

        var r = await Compras(ctx).Recibir(Recepcion(new RecepcionLineaDto
        {
            ProductoId = TestDb.ProductoCarneId, PresentacionId = CajaCarneId, Cantidad = 2, CostoUnitario = 300000m, FechaVencimiento = vence
        }));

        Assert.IsType<OkObjectResult>(r.Result);
        Assert.Equal(TestDb.StockInicialCarne + 20m, TestDb.StockCarne(ctx));
        var lote = Assert.Single(ctx.Lotes.AsNoTracking());
        Assert.Equal(20m, lote.CantidadActual);
        Assert.Equal(vence, lote.FechaVencimiento);
        Assert.Equal(30000m, lote.CostoUnitario);
        var mov = Assert.Single(ctx.MovimientosInventario.AsNoTracking());
        Assert.Equal("Entrada", mov.TipoMovimiento);
        Assert.Equal(lote.Id, mov.LoteId);
        // Costo promedio: (100 kg × 20.000 + 20 kg × 30.000) / 120 kg.
        Assert.Equal(21666.67m, ctx.Stock.AsNoTracking().Single().CostoPromedio);
        Assert.Equal(30000m, ctx.ProductosInventario.AsNoTracking().Single().PrecioCosto);
        Assert.Equal(300000m, ctx.PresentacionesCompra.AsNoTracking().Single().CostoReferencia);
    }

    [Fact]
    public async Task Insumo_perecedero_exige_fecha_o_la_sugiere_por_dias_de_vida()
    {
        using var ctx = Crear();
        var carne = ctx.ProductosInventario.Single();
        carne.RequiereCaducidad = true;
        ctx.SaveChanges();

        var sinFecha = await Compras(ctx).Recibir(Recepcion(new RecepcionLineaDto { ProductoId = TestDb.ProductoCarneId, Cantidad = 5 }));
        Assert.Contains("fecha de vencimiento", Mensaje(sinFecha.Result));

        carne.DiasVencimiento = 4;
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();
        await Compras(ctx).Recibir(Recepcion(new RecepcionLineaDto { ProductoId = TestDb.ProductoCarneId, Cantidad = 5 }));

        Assert.Equal(Hoy.AddDays(4), ctx.Lotes.AsNoTracking().Single().FechaVencimiento);
    }

    [Fact]
    public async Task No_se_recibe_mercancia_ya_vencida()
    {
        using var ctx = Crear();

        var r = await Compras(ctx).Recibir(Recepcion(new RecepcionLineaDto { ProductoId = TestDb.ProductoCarneId, Cantidad = 1, FechaVencimiento = Hoy.AddDays(-1) }));

        Assert.Contains("ya pasó", Mensaje(r.Result));
        Assert.Equal(TestDb.StockInicialCarne, TestDb.StockCarne(ctx));
    }

    [Fact]
    public async Task Orden_de_compra_se_completa_con_recepciones_parciales()
    {
        using var ctx = Crear();
        var creada = await Compras(ctx).CrearOrden(new CrearOrdenCompraDto
        {
            ProveedorId = ProveedorId, AlmacenDestinoId = TestDb.AlmacenId,
            Lineas = { new OrdenCompraLineaDto { ProductoId = TestDb.ProductoCarneId, Cantidad = 30, PrecioUnitario = 20000m } }
        });
        var ordenId = Valor<int>(creada, "Id");
        Assert.Equal("OC-00001", Valor<string>(creada, "NumeroOrden"));

        ctx.ChangeTracker.Clear();
        var parcial = await Compras(ctx).Recibir(new RecepcionDto
        {
            AlmacenId = TestDb.AlmacenId, OrdenCompraId = ordenId,
            Lineas = { new RecepcionLineaDto { ProductoId = TestDb.ProductoCarneId, PresentacionId = CajaCarneId, Cantidad = 1 } }
        });
        Assert.Equal("EnTransito", Valor<string>(parcial, "OrdenEstado"));

        ctx.ChangeTracker.Clear();
        var completa = await Compras(ctx).Recibir(new RecepcionDto
        {
            AlmacenId = TestDb.AlmacenId, OrdenCompraId = ordenId,
            Lineas = { new RecepcionLineaDto { ProductoId = TestDb.ProductoCarneId, PresentacionId = CajaCarneId, Cantidad = 2 } }
        });
        Assert.Equal("Recibida", Valor<string>(completa, "OrdenEstado"));
        Assert.Equal(30m, ctx.DetallesOrdenCompra.AsNoTracking().Single().CantidadRecibida);

        ctx.ChangeTracker.Clear();
        var otra = await Compras(ctx).Recibir(new RecepcionDto
        {
            AlmacenId = TestDb.AlmacenId, OrdenCompraId = ordenId,
            Lineas = { new RecepcionLineaDto { ProductoId = TestDb.ProductoCarneId, Cantidad = 1 } }
        });
        Mensaje(otra.Result);
    }

    [Fact]
    public async Task Reposicion_sugiere_cajas_completas_y_descuenta_lo_ya_pedido()
    {
        using var ctx = Crear();
        var carne = ctx.ProductosInventario.Single();
        carne.PuntoReorden = 20; carne.StockMaximo = 50; carne.ProveedorId = ProveedorId;
        ctx.Stock.Single().Cantidad = 8m;
        ctx.SaveChanges();

        var antes = JsonSerializer.SerializeToElement(((OkObjectResult)(await Compras(ctx).GetReposicion()).Result!).Value);
        var item = antes[0].GetProperty("Insumos")[0];
        // Faltan 42 kg para el máximo → 5 cajas de 10 kg = 50 kg.
        Assert.Equal(5m, item.GetProperty("Presentacion").GetProperty("Paquetes").GetDecimal());
        Assert.Equal(50m, item.GetProperty("Cantidad").GetDecimal());

        ctx.ChangeTracker.Clear();
        await Compras(ctx).CrearOrden(new CrearOrdenCompraDto
        {
            ProveedorId = ProveedorId, AlmacenDestinoId = TestDb.AlmacenId,
            Lineas = { new OrdenCompraLineaDto { ProductoId = TestDb.ProductoCarneId, Cantidad = 40, PrecioUnitario = 20000m } }
        });
        var despues = JsonSerializer.SerializeToElement(((OkObjectResult)(await Compras(ctx).GetReposicion()).Result!).Value);
        // 8 en stock + 40 pedidos: faltan 2 kg → 1 caja.
        Assert.Equal(1m, despues[0].GetProperty("Insumos")[0].GetProperty("Presentacion").GetProperty("Paquetes").GetDecimal());
    }

    [Fact]
    public async Task Lote_vencido_aparece_en_alertas_y_al_darlo_de_baja_sale_del_stock()
    {
        using var ctx = Crear();
        ctx.Lotes.Add(new Lote
        {
            Id = 7, ProductoId = TestDb.ProductoCarneId, AlmacenId = TestDb.AlmacenId, NumeroLote = "L-7",
            FechaIngreso = Hoy.AddDays(-10), FechaVencimiento = Hoy.AddDays(-1), CantidadInicial = 15m, CantidadActual = 15m, CostoUnitario = 20000m
        });
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();

        var resumen = await Compras(ctx).GetResumen();
        Assert.Equal(1, Valor<int>(resumen, "Vencidos"));

        var baja = await Compras(ctx).DarDeBaja(7, null);

        Assert.Equal(300000m, Valor<decimal>(baja, "Perdida"));
        Assert.Equal(TestDb.StockInicialCarne - 15m, TestDb.StockCarne(ctx));
        var lote = ctx.Lotes.AsNoTracking().Single();
        Assert.Equal(0m, lote.CantidadActual);
        Assert.Equal("Vencido", lote.Estado);
        Assert.Equal("Merma", ctx.MovimientosInventario.AsNoTracking().Single().TipoMovimiento);
        Assert.Equal(0, Valor<int>(await Compras(ctx).GetResumen(), "Vencidos"));
    }

    [Fact]
    public async Task Conteo_fisico_ajusta_solo_las_diferencias_y_descuenta_lotes()
    {
        using var ctx = Crear();
        ctx.Lotes.Add(new Lote
        {
            Id = 1, ProductoId = TestDb.ProductoCarneId, AlmacenId = TestDb.AlmacenId, NumeroLote = "L-1",
            FechaIngreso = Hoy, CantidadInicial = 100m, CantidadActual = 100m, CostoUnitario = 20000m
        });
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();

        var r = await Compras(ctx).RegistrarConteo(new ConteoDto
        {
            AlmacenId = TestDb.AlmacenId,
            Lineas = { new ConteoLineaDto { ProductoId = TestDb.ProductoCarneId, CantidadContada = 92m } }
        });

        Assert.Equal(-160000m, Valor<decimal>(r, "Valor"));
        Assert.Equal(92m, TestDb.StockCarne(ctx));
        Assert.Equal(92m, ctx.Lotes.AsNoTracking().Single().CantidadActual);
        var ajuste = Assert.Single(ctx.MovimientosInventario.AsNoTracking());
        Assert.Equal(8m, ajuste.Cantidad);

        ctx.ChangeTracker.Clear();
        await Compras(ctx).RegistrarConteo(new ConteoDto
        {
            AlmacenId = TestDb.AlmacenId,
            Lineas = { new ConteoLineaDto { ProductoId = TestDb.ProductoCarneId, CantidadContada = 92m } }
        });
        Assert.Single(ctx.MovimientosInventario.AsNoTracking());
    }

    [Fact]
    public async Task Ficha_muestra_consumo_por_ventas_y_cobertura()
    {
        using var ctx = Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 14);
        await TestDb.Inventario(ctx).DescontarStockPorPedidoAsync(1);
        ctx.ChangeTracker.Clear();

        var ficha = await Compras(ctx).GetFicha(TestDb.ProductoCarneId);

        // 14 hamburguesas × 0,2 kg en 14 días = 0,2 kg/día; quedan 97,2 kg → 486 días.
        Assert.Equal(0.2m, Valor<decimal>(ficha, "ConsumoDiario"));
        Assert.Equal(486m, Valor<decimal>(ficha, "DiasCobertura"));
    }
}
