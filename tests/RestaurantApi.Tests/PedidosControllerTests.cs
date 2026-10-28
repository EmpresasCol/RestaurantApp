using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>Flujo de comandas: mesero → cocina → caja.</summary>
public class PedidosControllerTests
{
    private static PedidosController Controller(RestauranteContext ctx)
        => new(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx));

    private static CrearPedidoDto PedidoValido(int cantidad = 2) => new()
    {
        MesaId = TestDb.MesaUnoId,
        UsuarioId = TestDb.MeseroId,
        Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = cantidad, Nota = "sin cebolla" } }
    };

    [Fact]
    public async Task Crear_pedido_valido_retorna_201_ocupa_mesa_y_descuenta_inventario()
    {
        using var ctx = TestDb.Crear();

        var result = await Controller(ctx).PostPedido(PedidoValido(cantidad: 2));

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var dto = Assert.IsType<PedidoDto>(created.Value);
        Assert.Equal("EnProceso", dto.Estado);
        Assert.Single(dto.Detalles);
        Assert.Equal("sin cebolla", dto.Detalles[0].Nota); // exclusión de ingredientes llega a cocina
        Assert.Equal(EstadoMesa.Ocupada, ctx.Mesas.AsNoTracking().Single(m => m.Id == TestDb.MesaUnoId).Estado);
        Assert.Equal(TestDb.StockInicialCarne - 2 * TestDb.CarnePorHamburguesa, TestDb.StockCarne(ctx));
    }

    [Fact]
    public async Task Crear_pedido_en_mesa_inexistente_retorna_400()
    {
        using var ctx = TestDb.Crear();
        var dto = PedidoValido();
        dto.MesaId = 999;

        var result = await Controller(ctx).PostPedido(dto);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Marcar_pedido_como_pagado_libera_la_mesa()
    {
        using var ctx = TestDb.Crear();
        var creado = (PedidoDto)((CreatedAtActionResult)(await Controller(ctx).PostPedido(PedidoValido())).Result!).Value!;

        var r = await Controller(ctx).ActualizarEstado(creado.Id, new ActualizarEstadoPedidoDto { Estado = "Pagado" });

        Assert.IsType<OkObjectResult>(r);
        Assert.Equal(EstadoMesa.Disponible, ctx.Mesas.AsNoTracking().Single(m => m.Id == TestDb.MesaUnoId).Estado);
    }

    [Fact]
    public async Task Estado_invalido_retorna_400()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1);

        var r = await Controller(ctx).ActualizarEstado(1, new ActualizarEstadoPedidoDto { Estado = "Volando" });

        Assert.IsType<BadRequestObjectResult>(r);
    }

    [Fact]
    public async Task Cancelar_pedido_devuelve_stock()
    {
        using var ctx = TestDb.Crear();
        var creado = (PedidoDto)((CreatedAtActionResult)(await Controller(ctx).PostPedido(PedidoValido(3))).Result!).Value!;

        await Controller(ctx).ActualizarEstado(creado.Id, new ActualizarEstadoPedidoDto { Estado = "Cancelado" });

        Assert.Equal(TestDb.StockInicialCarne, TestDb.StockCarne(ctx));
    }

    /// <summary>
    /// [AUDITORÍA – ALTO] Si todos los platillos son inválidos se omiten en silencio
    /// y se crea un pedido VACÍO que además marca la mesa como Ocupada.
    /// </summary>
    [Fact]
    public async Task AUDITORIA_pedido_con_platillos_inexistentes_debe_rechazarse()
    {
        using var ctx = TestDb.Crear();
        var dto = PedidoValido();
        dto.Detalles[0].PlatilloId = 999;

        var result = await Controller(ctx).PostPedido(dto);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(EstadoMesa.Disponible, ctx.Mesas.AsNoTracking().Single(m => m.Id == TestDb.MesaUnoId).Estado);
    }

    /// <summary>[AUDITORÍA – ALTO] No se validan cantidades: 0 o negativas pasan la API.</summary>
    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    public async Task AUDITORIA_cantidad_no_positiva_debe_rechazarse(int cantidad)
    {
        using var ctx = TestDb.Crear();

        var result = await Controller(ctx).PostPedido(PedidoValido(cantidad));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    /// <summary>[AUDITORÍA – ALTO] Un pedido sin detalles no debería existir.</summary>
    [Fact]
    public async Task AUDITORIA_pedido_sin_detalles_debe_rechazarse()
    {
        using var ctx = TestDb.Crear();
        var dto = PedidoValido();
        dto.Detalles.Clear();

        var result = await Controller(ctx).PostPedido(dto);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    /// <summary>
    /// [AUDITORÍA – MEDIO] No hay máquina de estados: un pedido Pagado puede volver a EnProceso
    /// (y la mesa queda Disponible con un pedido abierto).
    /// </summary>
    [Fact]
    public async Task AUDITORIA_un_pedido_pagado_no_puede_volver_a_en_proceso()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1);
        var c = Controller(ctx);
        await c.ActualizarEstado(1, new ActualizarEstadoPedidoDto { Estado = "Pagado" });

        var r = await c.ActualizarEstado(1, new ActualizarEstadoPedidoDto { Estado = "EnProceso" });

        Assert.True(r is BadRequestObjectResult or ConflictObjectResult,
            $"Se permitió Pagado → EnProceso ({r.GetType().Name})");
    }

    /// <summary>
    /// [AUDITORÍA – ALTO] PUT api/Pedidos/{id}/actualizar borra y recrea los detalles:
    /// los nuevos detalles tienen otro Id, así que el inventario se descuenta dos veces.
    /// </summary>
    [Fact]
    public async Task AUDITORIA_reemplazar_detalles_no_duplica_el_descuento_de_inventario()
    {
        using var ctx = TestDb.Crear();
        var creado = (PedidoDto)((CreatedAtActionResult)(await Controller(ctx).PostPedido(PedidoValido(2))).Result!).Value!;
        ctx.ChangeTracker.Clear();

        await Controller(ctx).ActualizarPedidoCompleto(creado.Id, new ActualizarPedidoCompletoDto
        {
            Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 2 } }
        });

        // Mismo contenido (2 hamburguesas) ⇒ el consumo debe seguir siendo 0.4 kg
        Assert.Equal(TestDb.StockInicialCarne - 2 * TestDb.CarnePorHamburguesa, TestDb.StockCarne(ctx));
    }
}
