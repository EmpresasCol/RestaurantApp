using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>
/// Pruebas del descuento automático de inventario por recetas (fichas técnicas).
/// Las marcadas con [AUDITORÍA] documentan defectos encontrados: fallan con el código actual
/// y deben pasar una vez se aplique la corrección.
/// </summary>
public class InventarioServiceTests
{
    [Fact]
    public async Task Descontar_aplica_la_receta_multiplicada_por_la_cantidad()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, pedidoId: 1, cantidad: 3);

        var res = await TestDb.Inventario(ctx).DescontarStockPorPedidoAsync(1);

        Assert.True(res.Exitoso);
        Assert.Equal(TestDb.StockInicialCarne - 3 * TestDb.CarnePorHamburguesa, TestDb.StockCarne(ctx));
    }

    [Fact]
    public async Task Descontar_es_idempotente_si_se_llama_dos_veces()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, pedidoId: 1, cantidad: 2);
        var svc = TestDb.Inventario(ctx);

        await svc.DescontarStockPorPedidoAsync(1);
        await svc.DescontarStockPorPedidoAsync(1);

        Assert.Equal(TestDb.StockInicialCarne - 2 * TestDb.CarnePorHamburguesa, TestDb.StockCarne(ctx));
    }

    [Fact]
    public async Task Cancelar_un_pedido_devuelve_los_insumos()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, pedidoId: 1, cantidad: 2);
        var svc = TestDb.Inventario(ctx);

        await svc.DescontarStockPorPedidoAsync(1);
        await svc.RevertirStockPorPedidoAsync(1);

        Assert.Equal(TestDb.StockInicialCarne, TestDb.StockCarne(ctx));
    }

    [Fact]
    public async Task Pedido_sin_detalles_no_genera_movimientos()
    {
        using var ctx = TestDb.Crear();
        ctx.Pedidos.Add(new Pedido { Id = 5, MesaId = TestDb.MesaUnoId, UsuarioId = TestDb.MeseroId, Fecha = DateTime.Now });
        ctx.SaveChanges();

        var res = await TestDb.Inventario(ctx).DescontarStockPorPedidoAsync(5);

        Assert.False(res.Exitoso);
        Assert.Equal(TestDb.StockInicialCarne, TestDb.StockCarne(ctx));
    }

    /// <summary>
    /// [AUDITORÍA – CRÍTICO] RevertirStockPorPedidoAsync usa Referencia.StartsWith("Pedido #1"),
    /// que también coincide con "Pedido #10", "Pedido #11", "Pedido #100"...
    /// Cancelar el pedido 1 devuelve al stock los insumos de OTROS pedidos.
    /// </summary>
    [Fact]
    public async Task AUDITORIA_cancelar_pedido_1_no_debe_revertir_el_pedido_10()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, pedidoId: 1, cantidad: 1);
        TestDb.CrearPedidoDirecto(ctx, pedidoId: 10, cantidad: 5, mesaId: TestDb.MesaDosId);
        var svc = TestDb.Inventario(ctx);

        await svc.DescontarStockPorPedidoAsync(1);
        await svc.DescontarStockPorPedidoAsync(10);
        await svc.RevertirStockPorPedidoAsync(1);

        // Solo debe seguir descontado lo del pedido 10 (5 x 0.2 = 1.0)
        Assert.Equal(TestDb.StockInicialCarne - 5 * TestDb.CarnePorHamburguesa, TestDb.StockCarne(ctx));
    }

    /// <summary>
    /// [AUDITORÍA – ALTO] La verificación "ya revertido" usa StartsWith("Cancelación #1"),
    /// que coincide con "Cancelación #12 - Mov #..". Si el pedido 12 se canceló antes,
    /// la cancelación del pedido 1 se ignora y su stock nunca vuelve.
    /// </summary>
    [Fact]
    public async Task AUDITORIA_cancelar_pedido_1_despues_del_12_si_devuelve_su_stock()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, pedidoId: 1, cantidad: 1);
        TestDb.CrearPedidoDirecto(ctx, pedidoId: 12, cantidad: 1, mesaId: TestDb.MesaDosId);
        var svc = TestDb.Inventario(ctx);

        await svc.DescontarStockPorPedidoAsync(12);
        await svc.RevertirStockPorPedidoAsync(12);
        await svc.DescontarStockPorPedidoAsync(1);
        await svc.RevertirStockPorPedidoAsync(1);

        Assert.Equal(TestDb.StockInicialCarne, TestDb.StockCarne(ctx));
    }

    /// <summary>
    /// [AUDITORÍA – ALTO] Si se modifica la cantidad de un detalle ya descontado,
    /// el servicio lo considera "ya descontado" y no ajusta la diferencia.
    /// </summary>
    [Fact]
    public async Task AUDITORIA_aumentar_cantidad_de_un_detalle_descuenta_la_diferencia()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, pedidoId: 1, cantidad: 1);
        var svc = TestDb.Inventario(ctx);
        await svc.DescontarStockPorPedidoAsync(1);

        var detalle = ctx.PedidoDetalles.Single(d => d.PedidoId == 1);
        detalle.Cantidad = 3;
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();

        await svc.DescontarStockPorPedidoAsync(1);

        Assert.Equal(TestDb.StockInicialCarne - 3 * TestDb.CarnePorHamburguesa, TestDb.StockCarne(ctx));
    }

    /// <summary>
    /// [AUDITORÍA – MEDIO] Sin stock suficiente, el servicio deja la existencia en negativo
    /// en lugar de alertar o bloquear (no hay control de stock mínimo en la venta).
    /// </summary>
    [Fact]
    public async Task AUDITORIA_el_stock_nunca_debe_quedar_negativo()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, pedidoId: 1, cantidad: 1000); // 1000 x 0.2 = 200 kg > 100 kg
        await TestDb.Inventario(ctx).DescontarStockPorPedidoAsync(1);

        Assert.True(TestDb.StockCarne(ctx) >= 0, $"Stock quedó en {TestDb.StockCarne(ctx)}");
    }

    /// <summary>
    /// [AUDITORÍA – MEDIO] El emparejamiento "por nombre" sin receta usa Contains en ambos sentidos:
    /// un insumo llamado "Pan" se descuenta al vender "Panna cotta" o "Pan de bono".
    /// </summary>
    [Fact]
    public async Task AUDITORIA_un_platillo_sin_receta_no_descuenta_insumos_por_nombre_parecido()
    {
        using var ctx = TestDb.Crear();
        ctx.ProductosInventario.Add(new ProductoInventario
        {
            Id = 2, Codigo = "PROD-PAN", Nombre = "Pan", CategoriaId = 1, UnidadMedida = "Unidad", PrecioCosto = 500m
        });
        ctx.Stock.Add(new Stock { Id = 2, ProductoId = 2, AlmacenId = TestDb.AlmacenId, Cantidad = 50m, CostoPromedio = 500m });
        ctx.Platillos.Add(new Platillo { Id = 2, Nombre = "Panna Cotta", Precio = 12000m, Categoria = "Postres" });
        ctx.Pedidos.Add(new Pedido
        {
            Id = 7, MesaId = TestDb.MesaUnoId, UsuarioId = TestDb.MeseroId, Fecha = DateTime.Now,
            Detalles = { new PedidoDetalle { PlatilloId = 2, Cantidad = 2 } }
        });
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();

        await TestDb.Inventario(ctx).DescontarStockPorPedidoAsync(7);

        var pan = ctx.Stock.AsNoTracking().Single(s => s.ProductoId == 2).Cantidad;
        Assert.Equal(50m, pan);
    }
}
