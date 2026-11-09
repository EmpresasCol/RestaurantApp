using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>Módulo de domicilios: página pública, panel admin y app del domiciliario.</summary>
public class DomiciliosTests
{
    // Sin archivo de credenciales Firebase, el servicio deja FCM deshabilitado (no envía nada).
    private static DomicilioRealtimeService Realtime(RestauranteContext ctx)
        => new(ctx, NullLogger<DomicilioRealtimeService>.Instance);

    private static DomiciliosPublicoController Publico(RestauranteContext ctx)
        => new(ctx, Realtime(ctx), TestDb.Inventario(ctx), NullLogger<DomiciliosPublicoController>.Instance);

    private static DomiciliariosController AppDomiciliario(RestauranteContext ctx)
        => new(ctx, Realtime(ctx), NullLogger<DomiciliariosController>.Instance);

    private static CreateDomicilioPublicoDto PedidoPublico(string nombre = "Laura", string telefono = "3001234567") => new()
    {
        ClienteNombre = nombre,
        ClienteTelefono = telefono,
        DireccionCompleta = "Calle 20 # 15-30",
        MetodoPago = "Efectivo",
        Detalles = { new CreateDomicilioDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 2 } }
    };

    private static int CrearDomicilioListo(RestauranteContext ctx)
    {
        ctx.Clientes.Add(new Cliente { Id = 50, Nombre = "Cliente", Telefono = "3110000000" });
        ctx.Direcciones.Add(new Direccion { Id = 50, ClienteId = 50, DireccionCompleta = "Cra 1 # 2-3" });
        ctx.Domicilios.Add(new Domicilio
        {
            Id = 50, ClienteId = 50, DireccionId = 50, Estado = "Listo",
            Subtotal = 25000m, CostoEnvio = 3000m, Total = 28000m, UsuarioCreadorId = TestDb.AdminId
        });
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();
        return 50;
    }

    [Fact]
    public async Task Pedido_publico_calcula_precios_en_servidor_y_entrega_token_seguro()
    {
        using var ctx = TestDb.Crear();

        var r = await Publico(ctx).Crear(PedidoPublico());

        var ok = Assert.IsType<OkObjectResult>(r.Result);
        var resp = Assert.IsType<CreateDomicilioPublicoResponseDto>(ok.Value);
        Assert.Matches("^[0-9a-f]{32}$", resp.TokenSeguimiento);
        var guardado = ctx.Domicilios.AsNoTracking().Single(d => d.Id == resp.DomicilioId);
        Assert.Equal(50000m, guardado.Subtotal); // 2 x 25.000, precio tomado de BD, no del cliente
    }

    [Fact]
    public async Task Seguimiento_con_token_malformado_retorna_400()
    {
        using var ctx = TestDb.Crear();
        var r = await Publico(ctx).Seguimiento("../../etc/passwd");
        Assert.IsType<BadRequestObjectResult>(r.Result);
    }

    [Fact]
    public async Task Domiciliario_recoge_un_pedido_listo()
    {
        using var ctx = TestDb.Crear();
        var id = CrearDomicilioListo(ctx);

        var r = await AppDomiciliario(ctx).MarcarRecogido(TestDb.DomiciliarioId, id);

        Assert.IsType<NoContentResult>(r);
        var d = ctx.Domicilios.AsNoTracking().Single(x => x.Id == id);
        Assert.Equal("Recogido", d.Estado);
        Assert.Equal(TestDb.DomiciliarioId, d.DomiciliarioId);
    }

    [Fact]
    public async Task Otro_domiciliario_no_puede_entregar_un_pedido_ajeno()
    {
        using var ctx = TestDb.Crear();
        var id = CrearDomicilioListo(ctx);
        await AppDomiciliario(ctx).MarcarRecogido(TestDb.DomiciliarioId, id);

        var r = await AppDomiciliario(ctx).MarcarEntregado(999, id);

        Assert.IsType<ForbidResult>(r);
    }

    /// <summary>
    /// [AUDITORÍA – ALTO] Cualquiera que conozca un teléfono puede cambiar el nombre
    /// registrado de ese cliente desde la página pública (integridad de datos personales).
    /// </summary>
    [Fact]
    public async Task AUDITORIA_pedido_publico_no_sobrescribe_datos_de_cliente_existente()
    {
        using var ctx = TestDb.Crear();
        await Publico(ctx).Crear(PedidoPublico(nombre: "Laura Gómez"));

        await Publico(ctx).Crear(PedidoPublico(nombre: "Nombre Falso"));

        Assert.Equal("Laura Gómez", ctx.Clientes.AsNoTracking().Single(c => c.Telefono == "3001234567").Nombre);
    }

    /// <summary>
    /// [AUDITORÍA – ALTO] El id del domiciliario viaja en la URL y no se valida su rol:
    /// un mesero (o cualquier id) puede "tomar" pedidos.
    /// </summary>
    [Fact]
    public async Task AUDITORIA_un_usuario_que_no_es_domiciliario_no_puede_recoger_pedidos()
    {
        using var ctx = TestDb.Crear();
        var id = CrearDomicilioListo(ctx);

        var r = await AppDomiciliario(ctx).MarcarRecogido(TestDb.MeseroId, id);

        Assert.IsNotType<NoContentResult>(r);
    }

    /// <summary>[AUDITORÍA – ALTO] El panel admin acepta cantidades negativas en domicilios.</summary>
    [Fact]
    public async Task AUDITORIA_domicilio_admin_rechaza_cantidades_negativas()
    {
        using var ctx = TestDb.Crear();
        ctx.Clientes.Add(new Cliente { Id = 60, Nombre = "C", Telefono = "3120000000" });
        ctx.Direcciones.Add(new Direccion { Id = 60, ClienteId = 60, DireccionCompleta = "Calle 1" });
        ctx.SaveChanges();

        var r = await new DomiciliosController(ctx, TestDb.Inventario(ctx)).CreateDomicilio(new CreateDomicilioDto
        {
            ClienteId = 60, DireccionId = 60, CostoEnvio = 3000m, UsuarioCreadorId = TestDb.AdminId,
            Detalles = { new CreateDomicilioDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = -2 } }
        });

        Assert.IsType<BadRequestObjectResult>(r.Result);
    }

    /// <summary>
    /// [AUDITORÍA – MEDIO] Al editar el pedido público (ventana de 5 min) el inventario
    /// no se resincroniza: lo quitado no vuelve al stock y lo agregado no se descuenta.
    /// </summary>
    [Fact]
    public async Task AUDITORIA_editar_pedido_publico_resincroniza_inventario()
    {
        using var ctx = TestDb.Crear();
        var creado = (CreateDomicilioPublicoResponseDto)((OkObjectResult)(await Publico(ctx).Crear(PedidoPublico())).Result!).Value!;
        ctx.ChangeTracker.Clear();

        await Publico(ctx).Editar(creado.TokenSeguimiento, new EditarDomicilioPublicoDto
        {
            Detalles = { new CreateDomicilioDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 5 } }
        });

        Assert.Equal(TestDb.StockInicialCarne - 5 * TestDb.CarnePorHamburguesa, TestDb.StockCarne(ctx));
    }
}
