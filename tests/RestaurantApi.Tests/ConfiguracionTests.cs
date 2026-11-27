using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>
/// Configuración del restaurante: valores de fábrica, validación de lo que guarda el administrador
/// y los efectos en el pedido por QR y el tiempo real.
/// </summary>
public class ConfiguracionTests
{
    private static ConfiguracionController Admin(RestauranteContext ctx) => TestDb.ComoAdmin(new ConfiguracionController(ctx));

    private static ConfiguracionRestaurante Valida() => new()
    {
        Nombre = "  La Fonda de Ana ", ColorMarca = "#2f7d88", ColorAccion = "#1b414a",
        Instagram = "https://www.instagram.com/lafonda/", Whatsapp = "+57 300 123 4567"
    };

    [Fact]
    public async Task Sin_guardar_nada_devuelve_la_configuracion_de_fabrica()
    {
        using var ctx = TestDb.Crear();

        var c = (await new ConfiguracionController(ctx).Get()).Value!;

        Assert.Equal("Qpro", c.Nombre);
        Assert.Equal(ConfiguracionRestaurante.ColorMarcaPorDefecto, c.ColorMarca);
        Assert.Equal(10, c.PropinaSugerida);
        Assert.True(c.PedidosQR);
    }

    [Fact]
    public async Task Guardar_normaliza_textos_colores_y_redes()
    {
        using var ctx = TestDb.Crear();

        var r = await Admin(ctx).Put(Valida());

        Assert.IsType<OkObjectResult>(r.Result);
        var guardada = ctx.ConfiguracionRestaurante.Single();
        Assert.Equal("La Fonda de Ana", guardada.Nombre);
        Assert.Equal("#2F7D88", guardada.ColorMarca);
        Assert.Equal("lafonda", guardada.Instagram);
        Assert.Equal("573001234567", guardada.Whatsapp);
        Assert.NotNull(guardada.FechaActualizacion);

        // Guardar otra vez actualiza la misma fila.
        var otra = Valida();
        otra.Nombre = "Fonda Ana";
        await Admin(ctx).Put(otra);
        Assert.Equal("Fonda Ana", ctx.ConfiguracionRestaurante.Single().Nombre);
    }

    [Theory]
    [InlineData("nombre-vacio")]
    [InlineData("accion-clara")]
    [InlineData("color-invalido")]
    [InlineData("tiempos")]
    [InlineData("propina")]
    [InlineData("logo")]
    public async Task Rechaza_lo_que_romperia_la_pantalla(string caso)
    {
        using var ctx = TestDb.Crear();
        var c = Valida();
        switch (caso)
        {
            case "nombre-vacio": c.Nombre = "   "; break;
            case "accion-clara": c.ColorAccion = "#F5E9DA"; break; // el texto blanco de los botones no se leería
            case "color-invalido": c.ColorMarca = "rojo"; break;
            case "tiempos": c.MinutosAlerta = 20; c.MinutosUrgente = 15; break;
            case "propina": c.PropinaSugerida = 45; break;
            case "logo": c.Logo = "data:image/png;base64,PHNjcmlwdD4="; break; // un script disfrazado de PNG
        }

        var r = await Admin(ctx).Put(c);

        Assert.IsType<BadRequestObjectResult>(r.Result);
        Assert.Empty(ctx.ConfiguracionRestaurante);
    }

    [Fact]
    public void El_contraste_sigue_la_formula_de_wcag()
    {
        Assert.Equal(21, Personalizacion.Contraste("#000000", "#FFFFFF"), 1);
        Assert.True(Personalizacion.Contraste(ConfiguracionRestaurante.ColorAccionPorDefecto, "#FFFFFF") >= Personalizacion.ContrasteMinimoAccion);
    }

    [Fact]
    public async Task Con_los_pedidos_por_qr_pausados_el_comensal_no_pide_pero_el_mesero_si()
    {
        using var ctx = TestDb.Crear();
        var c = Valida();
        c.PedidosQR = false;
        await Admin(ctx).Put(c);
        var linea = new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 1 };

        var delQr = await new PedidosController(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx))
            .PostPedido(new CrearPedidoDto { CodigoMesa = TestDb.CodigoMesaUno, Detalles = { linea } });
        Assert.IsType<BadRequestObjectResult>(delQr.Result);
        Assert.Empty(ctx.Pedidos);

        var delMesero = await TestDb.ComoMesero(new PedidosController(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx)))
            .PostPedido(new CrearPedidoDto { MesaId = TestDb.MesaUnoId, Detalles = { linea } });
        Assert.IsNotType<BadRequestObjectResult>(delMesero.Result);
        Assert.Single(ctx.Pedidos);
    }

    [Fact]
    public void Guardar_la_configuracion_avisa_su_tema_en_tiempo_real()
        => Assert.Equal(TemaRealtime.Configuracion, TemaRealtime.Desde("/api/configuracion"));
}
