using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>Auditoría de acceso: usuarios técnicos, bloqueo por cuenta y largo mínimo de clave.</summary>
public class SeguridadAccesoTests
{
    private static DomiciliariosController Domiciliarios(RestauranteContext ctx, IntentosLogin intentos)
        => new(ctx, new DomicilioRealtimeService(ctx, NullLogger<DomicilioRealtimeService>.Instance),
            NullLogger<DomiciliariosController>.Instance, intentos: intentos);

    private static int? Estado(IConvertToActionResult r) => (r.Convert() as ObjectResult)?.StatusCode;

    [Fact]
    public async Task El_usuario_tecnico_del_QR_no_inicia_sesion_aunque_sepan_su_clave()
    {
        using var ctx = TestDb.Crear();
        ctx.Usuarios.Add(new Usuario { Id = 30, Nombre = "Cliente QR", NombreUsuario = UsuariosSistema.ClienteQR, ClaveHash = "123", Rol = RolUsuario.Mesero });
        ctx.SaveChanges();
        var c = new UsuariosController(ctx);

        Assert.IsType<UnauthorizedObjectResult>((await c.LoginMobile(new LoginRequestDto { Usuario = "cliente_qr", Clave = "123" })).Result);
        Assert.IsType<UnauthorizedObjectResult>((await c.LoginMobile(new LoginRequestDto { Usuario = "CLIENTE_QR ", Clave = "123" })).Result);
    }

    [Fact]
    public async Task El_usuario_tecnico_tampoco_entra_como_domiciliario()
    {
        using var ctx = TestDb.Crear();
        ctx.Usuarios.Add(new Usuario { Id = 31, Nombre = "Público", NombreUsuario = UsuariosSistema.ClientePublico, ClaveHash = "123", Rol = RolUsuario.Domiciliario });
        ctx.SaveChanges();

        var r = await Domiciliarios(ctx, new IntentosLogin()).Login(new LoginRequestDto { Usuario = "cliente_publico", Clave = "123" });
        Assert.IsType<UnauthorizedObjectResult>(r.Result);
    }

    [Fact]
    public async Task Tras_cinco_claves_erradas_la_cuenta_se_bloquea_aunque_luego_acierten()
    {
        using var ctx = TestDb.Crear();
        var c = new UsuariosController(ctx, intentos: new IntentosLogin());

        for (var i = 0; i < IntentosLogin.MaximoFallos; i++)
            Assert.Equal(401, Estado(await c.Login(new LoginRequestDto { Usuario = "admin", Clave = "mala" + i })));

        Assert.Equal(StatusCodes.Status429TooManyRequests, Estado(await c.Login(new LoginRequestDto { Usuario = "Admin", Clave = "123" })));
    }

    [Fact]
    public async Task Un_ingreso_correcto_reinicia_la_cuenta_de_fallos()
    {
        using var ctx = TestDb.Crear();
        var c = new UsuariosController(ctx, intentos: new IntentosLogin());

        for (var i = 0; i < IntentosLogin.MaximoFallos - 1; i++)
            await c.Login(new LoginRequestDto { Usuario = "admin", Clave = "mala" });
        Assert.IsType<OkObjectResult>((await c.Login(new LoginRequestDto { Usuario = "admin", Clave = "123" })).Result);

        await c.Login(new LoginRequestDto { Usuario = "admin", Clave = "mala" });
        Assert.IsType<OkObjectResult>((await c.Login(new LoginRequestDto { Usuario = "admin", Clave = "123" })).Result);
    }

    [Fact]
    public async Task El_bloqueo_es_compartido_entre_la_web_y_la_app_del_domiciliario()
    {
        using var ctx = TestDb.Crear();
        var intentos = new IntentosLogin();
        var web = new UsuariosController(ctx, intentos: intentos);
        for (var i = 0; i < IntentosLogin.MaximoFallos; i++)
            await web.LoginMobile(new LoginRequestDto { Usuario = "domi", Clave = "mala" });

        var r = await Domiciliarios(ctx, intentos).Login(new LoginRequestDto { Usuario = "domi", Clave = "123" });
        Assert.Equal(StatusCodes.Status429TooManyRequests, Estado(r));
    }

    [Fact]
    public async Task Una_clave_nueva_de_siete_caracteres_responde_400()
    {
        using var ctx = TestDb.Crear();
        var r = await new UsuariosController(ctx).PostUsuario(new Usuario { Nombre = "Caja", NombreUsuario = "caja3", ClaveHash = "1234567", Rol = RolUsuario.Caja });
        Assert.IsType<BadRequestObjectResult>(r.Result);
    }
}
