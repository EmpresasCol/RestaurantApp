using System.Security.Cryptography;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Hubs;
using RestaurantApi.Models;
using RestaurantApi.Services;
using Xunit;
using static RestaurantApi.Tests.OcupacionesTests;

namespace RestaurantApi.Tests;

/// <summary>Seguimiento del comensal y llamadas al mesero.</summary>
public class ClienteMesaTests
{
    internal static ClienteMesaController Cliente(RestauranteContext ctx, PushWeb? push = null)
        => new(ctx, NullLogger<ClienteMesaController>.Instance, push);

    private static LlamadasController Llamadas(RestauranteContext ctx, int usuarioId = TestDb.MeseroId, RolUsuario rol = RolUsuario.Mesero)
        => TestDb.Sesion(new LlamadasController(ctx), usuarioId, rol);

    internal static SeguimientoDto Seguir(RestauranteContext ctx, string? llave, string codigo = TestDb.CodigoMesaUno)
    {
        var r = Cliente(ctx).GetSeguimiento(codigo, llave).GetAwaiter().GetResult();
        return Assert.IsType<SeguimientoDto>(r.Value);
    }

    private static int? Codigo(IActionResult? r) => (r as ObjectResult)?.StatusCode;

    private static LlamadaClienteDto Llamada(ActionResult<LlamadaClienteDto> r) => (LlamadaClienteDto)Assert.IsType<OkObjectResult>(r.Result).Value!;

    private static void AntesDeLaEspera(RestauranteContext ctx)
    {
        foreach (var l in ctx.LlamadasMesero) l.Fecha = l.Fecha - ClienteMesaController.EsperaEntreLlamadas - TimeSpan.FromSeconds(1);
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();
    }

    // ── Seguimiento ───────────────────────────────────────────────────────

    [Fact]
    public async Task El_comensal_ve_su_pedido_y_el_que_agrego_el_mesero()
    {
        using var ctx = TestDb.Crear();
        var qr = await PedirPorQrAsync(ctx, 2);
        await PedirConMeseroAsync(ctx, 1);

        var s = Seguir(ctx, qr.Seguimiento);

        Assert.Equal(1, s.MesaNumero);
        Assert.Equal(2, s.Pedidos.Count);
        Assert.All(s.Pedidos, p => Assert.Equal("Recibido", p.Estado));
        Assert.Equal(75000m, s.Cuenta.Total);
        Assert.Equal(75000m, s.Cuenta.Pendiente);
        Assert.Equal(0m, s.Cuenta.Pagado);
    }

    [Fact]
    public async Task Distingue_recibido_en_preparacion_listo_y_servido()
    {
        using var ctx = TestDb.Crear();
        var qr = await PedirPorQrAsync(ctx);
        var cocina = TestDb.Sesion(Qr(ctx), TestDb.AdminId, RolUsuario.Cocina);

        await cocina.Preparar(qr.Id);
        Assert.Equal("EnPreparacion", Seguir(ctx, qr.Seguimiento).Pedidos[0].Estado);

        await cocina.ActualizarEstado(qr.Id, new ActualizarEstadoPedidoDto { Estado = "Listo" });
        Assert.Equal("Listo", Seguir(ctx, qr.Seguimiento).Pedidos[0].Estado);

        await Mesero(ctx).ActualizarEstado(qr.Id, new ActualizarEstadoPedidoDto { Estado = "Entregado" });
        Assert.Equal("Entregado", Seguir(ctx, qr.Seguimiento).Pedidos[0].Estado);
    }

    [Fact]
    public async Task Pago_parcial_se_refleja_sin_cerrar_el_seguimiento()
    {
        using var ctx = TestDb.Crear();
        var uno = await PedirPorQrAsync(ctx);
        var dos = await PedirConMeseroAsync(ctx, 2);
        Servir(ctx, uno.Id, dos.Id);

        await TestDb.Sesion(new PagosController(ctx), TestDb.AdminId, RolUsuario.Caja)
            .Cobrar(new CrearCobroDto { PedidoIds = { uno.Id }, MetodoPago = "Tarjeta" });

        var s = Seguir(ctx, uno.Seguimiento);
        Assert.Equal(25000m, s.Cuenta.Pagado);
        Assert.Equal(50000m, s.Cuenta.Pendiente);
        Assert.Equal("Pagado", s.Pedidos.Single(p => p.Id == uno.Id).Estado);
    }

    [Fact]
    public async Task Un_aviso_de_pago_del_mesero_no_cuenta_como_pagado()
    {
        using var ctx = TestDb.Crear();
        var uno = await PedirPorQrAsync(ctx);
        Servir(ctx, uno.Id);

        await TestDb.ComoMesero(new CuentasController(ctx)).Solicitar(new SolicitarCuentaDto
        {
            MesaId = TestDb.MesaUnoId, Pagos = new() { new AvisarPagoDto { MetodoPago = "Efectivo", Monto = 25000m } }
        });

        var s = Seguir(ctx, uno.Seguimiento);
        Assert.True(s.Cuenta.CuentaPedida);
        Assert.True(s.Cuenta.PagoPorConfirmar);
        Assert.Equal(25000m, s.Cuenta.Pendiente);
        Assert.Equal(0m, s.Cuenta.Pagado);
    }

    [Fact]
    public async Task Pago_total_cierra_el_seguimiento_y_la_llave_vieja_no_ve_la_visita_siguiente()
    {
        using var ctx = TestDb.Crear();
        var anterior = await PedirPorQrAsync(ctx);
        Servir(ctx, anterior.Id);
        await TestDb.Sesion(new PagosController(ctx), TestDb.AdminId, RolUsuario.Caja)
            .Cobrar(new CrearCobroDto { PedidoIds = { anterior.Id }, MetodoPago = "Efectivo" });

        var cerrada = await Cliente(ctx).GetSeguimiento(TestDb.CodigoMesaUno, anterior.Seguimiento);
        Assert.Equal(StatusCodes.Status410Gone, Codigo(cerrada.Result));

        // Se sienta otra persona y pide: la llave anterior sigue sin ver nada.
        var nueva = await PedirPorQrAsync(ctx, 3);
        var otraVez = await Cliente(ctx).GetSeguimiento(TestDb.CodigoMesaUno, anterior.Seguimiento);
        Assert.Equal(StatusCodes.Status410Gone, Codigo(otraVez.Result));
        Assert.Single(Seguir(ctx, nueva.Seguimiento).Pedidos);
    }

    [Fact]
    public async Task Sin_llave_o_con_la_de_otra_mesa_no_hay_seguimiento()
    {
        using var ctx = TestDb.Crear();
        var mesaUno = await PedirPorQrAsync(ctx);
        await PedirPorQrAsync(ctx, codigo: TestDb.CodigoMesaDos);

        var sinLlave = await Cliente(ctx).GetSeguimiento(TestDb.CodigoMesaUno, null);
        var cruzada = await Cliente(ctx).GetSeguimiento(TestDb.CodigoMesaDos, mesaUno.Seguimiento);
        var qrFalso = await Cliente(ctx).GetSeguimiento("noexiste00000000", mesaUno.Seguimiento);

        Assert.IsType<NotFoundObjectResult>(sinLlave.Result);
        Assert.IsType<NotFoundObjectResult>(cruzada.Result);
        Assert.IsType<NotFoundObjectResult>(qrFalso.Result);
        Assert.Null(await Ocupaciones.IdParaSeguirAsync(ctx, TestDb.CodigoMesaDos, mesaUno.Seguimiento));
    }

    [Fact]
    public async Task Otro_comensal_se_une_con_el_codigo_y_los_intentos_fallidos_lo_cambian()
    {
        using var ctx = TestDb.Crear();
        var qr = await PedirPorQrAsync(ctx);
        var pin = ctx.Ocupaciones.AsNoTracking().Single().Pin;

        var ok = (OkObjectResult)await Cliente(ctx).Unirse(new UnirseDto { CodigoMesa = TestDb.CodigoMesaUno, Pin = pin });
        Assert.Contains(qr.Seguimiento!, ok.Value!.ToString());

        var malo = pin == "000000" ? "111111" : "000000";
        for (var i = 0; i < Ocupaciones.IntentosPinAntesDeCambiarlo; i++)
            Assert.IsType<BadRequestObjectResult>(await Cliente(ctx).Unirse(new UnirseDto { CodigoMesa = TestDb.CodigoMesaUno, Pin = malo }));

        Assert.NotEqual(pin, ctx.Ocupaciones.AsNoTracking().Single().Pin);
        Assert.IsType<BadRequestObjectResult>(await Cliente(ctx).Unirse(new UnirseDto { CodigoMesa = TestDb.CodigoMesaUno, Pin = pin }));
    }

    [Fact]
    public async Task Unirse_a_una_mesa_libre_o_con_el_pin_de_otra_mesa_falla()
    {
        using var ctx = TestDb.Crear();
        await PedirPorQrAsync(ctx, codigo: TestDb.CodigoMesaDos);
        var pinMesaDos = ctx.Ocupaciones.AsNoTracking().Single().Pin;

        Assert.IsType<NotFoundObjectResult>(await Cliente(ctx).Unirse(new UnirseDto { CodigoMesa = TestDb.CodigoMesaUno, Pin = pinMesaDos }));
    }

    [Fact]
    public async Task El_seguimiento_no_expone_datos_del_personal_ni_comprobantes()
    {
        using var ctx = TestDb.Crear();
        var qr = await PedirConMeseroAsync(ctx);
        await PedirPorQrAsync(ctx);
        var llave = ctx.Ocupaciones.AsNoTracking().Single().Token;

        var json = System.Text.Json.JsonSerializer.Serialize(Seguir(ctx, llave));

        Assert.DoesNotContain("Mesero", json);
        Assert.DoesNotContain("Comprobante", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("UsuarioId", json);
        Assert.DoesNotContain(TestDb.CodigoMesaUno, json);
    }

    // ── Llamadas ──────────────────────────────────────────────────────────

    [Fact]
    public async Task Se_puede_llamar_al_mesero_antes_de_pedir_y_queda_guardado()
    {
        using var ctx = TestDb.Crear();

        var r = Llamada(await Cliente(ctx).Llamar(new LlamarMeseroDto { CodigoMesa = TestDb.CodigoMesaUno }));

        Assert.Equal(LlamadaMesero.Pendiente, r.Estado);
        var guardada = ctx.LlamadasMesero.AsNoTracking().Single();
        Assert.Null(guardada.OcupacionId);
        Assert.Equal(r.Clave, guardada.Clave);
        var vivas = (await Llamadas(ctx).GetVivas()).Value!.ToList();
        Assert.Equal(1, Assert.Single(vivas).MesaNumero);
    }

    [Fact]
    public async Task Doble_toque_y_reintentos_devuelven_la_misma_llamada()
    {
        using var ctx = TestDb.Crear();
        var c = Cliente(ctx);

        var primera = Llamada(await c.Llamar(new LlamarMeseroDto { CodigoMesa = TestDb.CodigoMesaUno }));
        var segunda = Llamada(await c.Llamar(new LlamarMeseroDto { CodigoMesa = TestDb.CodigoMesaUno }));
        var otroTelefono = Llamada(await Cliente(ctx).Llamar(new LlamarMeseroDto { CodigoMesa = TestDb.CodigoMesaUno }));

        Assert.Equal(primera.Clave, segunda.Clave);
        Assert.Equal(primera.Clave, otroTelefono.Clave);
        Assert.Single(ctx.LlamadasMesero);
    }

    [Fact]
    public async Task Volver_a_llamar_justo_despues_de_atendida_tiene_espera()
    {
        using var ctx = TestDb.Crear();
        await Cliente(ctx).Llamar(new LlamarMeseroDto { CodigoMesa = TestDb.CodigoMesaUno });
        await Llamadas(ctx).Atender(ctx.LlamadasMesero.AsNoTracking().Single().Id);

        var deInmediato = await Cliente(ctx).Llamar(new LlamarMeseroDto { CodigoMesa = TestDb.CodigoMesaUno });
        Assert.Equal(StatusCodes.Status429TooManyRequests, Codigo(deInmediato.Result));

        AntesDeLaEspera(ctx);
        var despues = Llamada(await Cliente(ctx).Llamar(new LlamarMeseroDto { CodigoMesa = TestDb.CodigoMesaUno }));
        Assert.Equal(LlamadaMesero.Pendiente, despues.Estado);
        Assert.Equal(2, ctx.LlamadasMesero.Count());
    }

    [Fact]
    public async Task Llamar_con_un_qr_invalido_no_registra_nada()
    {
        using var ctx = TestDb.Crear();

        var r = await Cliente(ctx).Llamar(new LlamarMeseroDto { CodigoMesa = "codigoviejo123" });

        Assert.IsType<NotFoundObjectResult>(r.Result);
        Assert.Empty(ctx.LlamadasMesero);
    }

    [Fact]
    public async Task Dos_meseros_toman_la_misma_llamada_y_solo_uno_queda()
    {
        using var ctx = TestDb.Crear();
        ctx.Usuarios.Add(new Usuario { Id = 10, Nombre = "Otro", NombreUsuario = "otro", ClaveHash = "x", Rol = RolUsuario.Mesero });
        ctx.SaveChanges();
        var llamada = Llamada(await Cliente(ctx).Llamar(new LlamarMeseroDto { CodigoMesa = TestDb.CodigoMesaUno }));
        var id = ctx.LlamadasMesero.AsNoTracking().Single().Id;

        var primero = await Llamadas(ctx).Tomar(id);
        var segundo = await Llamadas(ctx, 10).Tomar(id);

        Assert.IsType<OkObjectResult>(primero);
        var conflicto = Assert.IsType<ConflictObjectResult>(segundo);
        Assert.Contains("ya va", conflicto.Value!.ToString());
        var guardada = ctx.LlamadasMesero.AsNoTracking().Single();
        Assert.Equal(LlamadaMesero.EnCamino, guardada.Estado);
        Assert.Equal(TestDb.MeseroId, guardada.MeseroId);
        // El comensal ve que alguien va en camino.
        Assert.Equal(LlamadaMesero.EnCamino, (await Cliente(ctx).GetLlamada(llamada.Clave)).Value!.Estado);
    }

    [Fact]
    public async Task Atender_es_idempotente_y_la_caja_tambien_puede()
    {
        using var ctx = TestDb.Crear();
        await Cliente(ctx).Llamar(new LlamarMeseroDto { CodigoMesa = TestDb.CodigoMesaUno });
        var id = ctx.LlamadasMesero.AsNoTracking().Single().Id;
        var caja = Llamadas(ctx, TestDb.AdminId, RolUsuario.Caja);

        Assert.IsType<OkObjectResult>(await caja.Atender(id));
        Assert.IsType<OkObjectResult>(await Llamadas(ctx).Atender(id));

        var l = ctx.LlamadasMesero.AsNoTracking().Single();
        Assert.Equal(LlamadaMesero.Atendida, l.Estado);
        Assert.Null(l.Activa);
        Assert.Empty((await Llamadas(ctx).GetVivas()).Value!);
    }

    [Fact]
    public async Task Una_llamada_de_una_mesa_ya_liberada_no_se_puede_tomar()
    {
        using var ctx = TestDb.Crear();
        var uno = await PedirPorQrAsync(ctx);
        await Cliente(ctx).Llamar(new LlamarMeseroDto { CodigoMesa = TestDb.CodigoMesaUno });
        await Mesero(ctx).ActualizarEstado(uno.Id, new ActualizarEstadoPedidoDto { Estado = "Cancelado" });
        var id = ctx.LlamadasMesero.AsNoTracking().Single().Id;

        Assert.IsType<ConflictObjectResult>(await Llamadas(ctx).Tomar(id));
        Assert.Equal(LlamadaMesero.Cerrada, ctx.LlamadasMesero.AsNoTracking().Single().Estado);
    }

    [Fact]
    public void Solo_mesero_o_admin_toman_llamadas()
    {
        var tomar = typeof(LlamadasController).GetMethod(nameof(LlamadasController.Tomar))!;
        var roles = ((Microsoft.AspNetCore.Authorization.AuthorizeAttribute)tomar
            .GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), false).Single()).Roles!;
        Assert.DoesNotContain("Caja", roles);
        Assert.DoesNotContain("Cocina", roles);
        var clase = (Microsoft.AspNetCore.Authorization.AuthorizeAttribute)typeof(LlamadasController)
            .GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), false).Single();
        Assert.DoesNotContain("Cocina", clase.Roles!);
    }

    [Fact]
    public void Los_temas_de_tiempo_real_incluyen_las_llamadas()
    {
        Assert.Equal(TemaRealtime.Llamadas, TemaRealtime.Desde("/api/cliente-mesa/llamadas"));
        Assert.Equal(TemaRealtime.Llamadas, TemaRealtime.Desde("/api/llamadas/3/tomar"));
        Assert.Null(TemaRealtime.Desde("/api/cliente-mesa/seguimiento"));
    }
}
