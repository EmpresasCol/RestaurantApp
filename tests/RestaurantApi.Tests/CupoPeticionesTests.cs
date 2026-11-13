using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using RestaurantApi.Services;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>
/// [ALTO] En Render todas las peticiones llegaban con la IP del proxy: el límite de login
/// (10 por minuto) y el del QR eran uno solo para todos los usuarios.
/// </summary>
public class CupoPeticionesTests
{
    private static DefaultHttpContext Peticion(string ipProxy = "10.0.0.1", Dictionary<string, string>? cabeceras = null, string? query = null)
    {
        var ctx = new DefaultHttpContext();
        ctx.Connection.RemoteIpAddress = IPAddress.Parse(ipProxy);
        foreach (var (k, v) in cabeceras ?? new()) ctx.Request.Headers[k] = v;
        if (query != null) ctx.Request.QueryString = new QueryString(query);
        return ctx;
    }

    private static IConfiguration Config(Dictionary<string, string?> valores) => new ConfigurationBuilder().AddInMemoryCollection(valores).Build();

    [Fact]
    public void En_Render_cada_cliente_tiene_su_cupo_por_la_IP_que_pone_Cloudflare()
    {
        var cabecera = CupoPeticiones.CabeceraIp(Config(new() { ["RENDER"] = "true" }));
        Assert.Equal("CF-Connecting-IP", cabecera);

        var a = CupoPeticiones.Ip(Peticion(cabeceras: new() { ["CF-Connecting-IP"] = "181.50.1.2" }), cabecera);
        var b = CupoPeticiones.Ip(Peticion(cabeceras: new() { ["CF-Connecting-IP"] = "190.25.9.9" }), cabecera);
        Assert.Equal("181.50.1.2", a);
        Assert.NotEqual(a, b);
    }

    [Fact]
    public void Sin_proxy_configurado_no_se_cree_ninguna_cabecera_del_cliente()
    {
        var cabecera = CupoPeticiones.CabeceraIp(Config(new()));
        Assert.Null(cabecera);
        var ctx = Peticion("200.1.1.1", new() { ["CF-Connecting-IP"] = "1.2.3.4", ["X-Forwarded-For"] = "5.6.7.8" });
        Assert.Equal("200.1.1.1", CupoPeticiones.Ip(ctx, cabecera));
    }

    [Fact]
    public void Una_cabecera_de_ip_invalida_cae_en_la_conexion()
        => Assert.Equal("10.0.0.1", CupoPeticiones.Ip(Peticion(cabeceras: new() { ["CF-Connecting-IP"] = "no-es-ip" }), "CF-Connecting-IP"));

    [Fact]
    public void El_comensal_se_limita_por_mesa_tambien_en_el_hub_y_en_la_ruta_del_codigo()
    {
        const string codigo = "a1b2c3d4e5f6a1b2c3d4e5f6";
        Assert.Equal("m:" + codigo, CupoPeticiones.PorMesa(Peticion(cabeceras: new() { ["X-Mesa"] = codigo }), null));
        Assert.Equal("m:" + codigo, CupoPeticiones.PorMesa(Peticion(query: "?mesa=" + codigo), null));

        var ruta = Peticion();
        ruta.Request.RouteValues["codigo"] = codigo;
        Assert.Equal("m:" + codigo, CupoPeticiones.PorMesa(ruta, null));

        // Un valor que no parece un código cuenta por IP.
        Assert.Equal("ip:10.0.0.1", CupoPeticiones.PorMesa(Peticion(cabeceras: new() { ["X-Mesa"] = "x" }), null));
    }
}
