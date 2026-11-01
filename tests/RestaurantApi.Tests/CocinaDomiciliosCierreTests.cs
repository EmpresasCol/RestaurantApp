using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
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
/// Cocina (empieza domicilios, no sirve mesas, ve lo editado), flujo real del domicilio
/// (asignar, cobrar al entregar, factura, efectivo que el domiciliario entrega en caja) y
/// el cierre de caja con base, arqueo y diferencias.
/// </summary>
public class CocinaDomiciliosCierreTests
{
    private const string Foto = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

    private static PedidosController Pedidos(RestauranteContext ctx, RolUsuario rol, int usuario = TestDb.MeseroId)
        => TestDb.Sesion(new PedidosController(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx)), usuario, rol);

    private static DomiciliosController Domicilios(RestauranteContext ctx, RolUsuario rol = RolUsuario.Caja)
        => TestDb.Sesion(new DomiciliosController(ctx, TestDb.Inventario(ctx)), TestDb.AdminId, rol);

    private static DomiciliariosController App(RestauranteContext ctx)
        => TestDb.Sesion(new DomiciliariosController(ctx, new DomicilioRealtimeService(ctx, NullLogger<DomicilioRealtimeService>.Instance),
            NullLogger<DomiciliariosController>.Instance), TestDb.DomiciliarioId, RolUsuario.Domiciliario);

    private static ReportesController Reportes(RestauranteContext ctx, RolUsuario rol = RolUsuario.Caja)
        => TestDb.Sesion(new ReportesController(ctx), TestDb.AdminId, rol);

    private static int Status(IActionResult r) => r switch
    {
        ObjectResult o => o.StatusCode ?? 200,
        StatusCodeResult s => s.StatusCode,
        _ => 0
    };

    // ==================== COCINA ====================

    [Fact]
    public async Task La_cocina_marca_listo_pero_servir_es_del_mesero()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1, estado: EstadoPedido.Listo);

        var cocina = await Pedidos(ctx, RolUsuario.Cocina, TestDb.AdminId).ActualizarEstado(1, new ActualizarEstadoPedidoDto { Estado = "Entregado" });
        Assert.Equal(StatusCodes.Status403Forbidden, Status(cocina));
        Assert.Equal(EstadoPedido.Listo, ctx.Pedidos.AsNoTracking().Single().Estado);

        Assert.IsType<OkObjectResult>(await Pedidos(ctx, RolUsuario.Mesero).ActualizarEstado(1, new ActualizarEstadoPedidoDto { Estado = "Entregado" }));
        Assert.Equal(EstadoPedido.Entregado, ctx.Pedidos.AsNoTracking().Single().Estado);
    }

    [Fact]
    public async Task Cuando_el_mesero_edita_la_cocina_lo_ve_marcado()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1);
        Assert.Null(Assert.Single((await Pedidos(ctx, RolUsuario.Cocina).GetPedidosActivos()).Value!).FechaEdicion);

        await Pedidos(ctx, RolUsuario.Mesero).ActualizarPedidoCompleto(1, new ActualizarPedidoCompletoDto
        {
            Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 3 } }
        });

        Assert.NotNull(Assert.Single((await Pedidos(ctx, RolUsuario.Cocina).GetPedidosActivos()).Value!).FechaEdicion);
    }

    // ==================== DOMICILIOS ====================

    private static async Task<int> NuevoDomicilio(RestauranteContext ctx, string metodo = "Efectivo", decimal? pagaCon = null, bool anticipado = false)
    {
        if (!ctx.Clientes.Any())
        {
            ctx.Clientes.Add(new Cliente { Id = 50, Nombre = "Laura", Telefono = "3110000000" });
            ctx.Direcciones.Add(new Direccion { Id = 50, ClienteId = 50, DireccionCompleta = "Cra 1 # 2-3" });
            ctx.SaveChanges();
        }
        var r = await Domicilios(ctx).CreateDomicilio(new CreateDomicilioDto
        {
            ClienteId = 50, DireccionId = 50, CostoEnvio = 3000m, MetodoPago = metodo, PagaCon = pagaCon, PagadoAnticipado = anticipado,
            Detalles = { new CreateDomicilioDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 1 } }
        });
        var creado = (DomicilioResponseDto)Assert.IsType<CreatedAtActionResult>(r.Result).Value!;
        ctx.ChangeTracker.Clear();
        return creado.Id;
    }

    private static async Task Listo(RestauranteContext ctx, int id)
    {
        Assert.IsType<NoContentResult>(await Domicilios(ctx, RolUsuario.Cocina).Preparar(id));
        Assert.IsType<NoContentResult>(await Domicilios(ctx, RolUsuario.Cocina).ActualizarEstado(id, new ActualizarEstadoDto { Estado = "Listo" }));
        ctx.ChangeTracker.Clear();
    }

    [Fact]
    public async Task La_cocina_empieza_el_domicilio_igual_que_un_pedido_de_mesa()
    {
        using var ctx = TestDb.Crear();
        var id = await NuevoDomicilio(ctx);
        var recibido = (await Domicilios(ctx).GetDomicilio(id)).Result as OkObjectResult;
        Assert.False(((DomicilioResponseDto)recibido!.Value!).CocinaEmpezo);

        Assert.IsType<NoContentResult>(await Domicilios(ctx, RolUsuario.Cocina).Preparar(id));

        ctx.ChangeTracker.Clear();
        var empezado = (DomicilioResponseDto)((OkObjectResult)(await Domicilios(ctx).GetDomicilio(id)).Result!).Value!;
        Assert.True(empezado.CocinaEmpezo);
        Assert.Equal("EnPreparacion", empezado.Estado);
    }

    [Fact]
    public async Task La_cocina_no_entrega_ni_cancela_domicilios()
    {
        using var ctx = TestDb.Crear();
        var id = await NuevoDomicilio(ctx);

        var cancelar = await Domicilios(ctx, RolUsuario.Cocina).ActualizarEstado(id, new ActualizarEstadoDto { Estado = "Cancelado" });

        Assert.Equal(StatusCodes.Status403Forbidden, Status(cancelar));
    }

    [Fact]
    public async Task Con_el_billete_del_cliente_se_calcula_el_cambio_y_no_puede_ser_menor_al_total()
    {
        using var ctx = TestDb.Crear();
        ctx.Clientes.Add(new Cliente { Id = 50, Nombre = "Laura", Telefono = "3110000000" });
        ctx.Direcciones.Add(new Direccion { Id = 50, ClienteId = 50, DireccionCompleta = "Cra 1 # 2-3" });
        ctx.SaveChanges();

        var noAlcanza = await Domicilios(ctx).CreateDomicilio(new CreateDomicilioDto
        {
            ClienteId = 50, DireccionId = 50, CostoEnvio = 3000m, PagaCon = 20000m,
            Detalles = { new CreateDomicilioDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 1 } }
        });
        Assert.IsType<BadRequestObjectResult>(noAlcanza.Result);

        var id = await NuevoDomicilio(ctx, pagaCon: 50000m);
        var d = (DomicilioResponseDto)((OkObjectResult)(await Domicilios(ctx).GetDomicilio(id)).Result!).Value!;
        Assert.Equal(22000m, d.Cambio); // 50.000 − (25.000 + 3.000)
    }

    [Fact]
    public async Task El_domiciliario_ve_desde_la_cocina_lo_que_le_asignan()
    {
        using var ctx = TestDb.Crear();
        var id = await NuevoDomicilio(ctx);

        Assert.IsType<NoContentResult>(await Domicilios(ctx).AsignarDomiciliario(id, new AsignarDomiciliarioDto { DomiciliarioId = TestDb.DomiciliarioId }));

        var lista = (IEnumerable<DomicilioDomiciliarioDto>)((OkObjectResult)(await App(ctx).GetPedidos(TestDb.DomiciliarioId)).Result!).Value!;
        var mio = Assert.Single(lista);
        Assert.Equal("EnPreparacion", mio.Estado);
        Assert.False(mio.CocinaEmpezo);
        Assert.IsType<BadRequestObjectResult>(await Domicilios(ctx).AsignarDomiciliario(id, new AsignarDomiciliarioDto { DomiciliarioId = TestDb.MeseroId }));
    }

    [Fact]
    public async Task Entregar_por_transferencia_exige_la_foto_y_emite_la_factura()
    {
        using var ctx = TestDb.Crear();
        var id = await NuevoDomicilio(ctx);
        await Listo(ctx, id);
        Assert.IsType<NoContentResult>(await App(ctx).MarcarRecogido(TestDb.DomiciliarioId, id));
        ctx.ChangeTracker.Clear();

        var sinFoto = await App(ctx).MarcarEntregado(TestDb.DomiciliarioId, id, new EntregarDomicilioDto { MetodoPago = "Nequi" });
        Assert.IsType<BadRequestObjectResult>(sinFoto);
        ctx.ChangeTracker.Clear();

        Assert.IsType<NoContentResult>(await App(ctx).MarcarEntregado(TestDb.DomiciliarioId, id, new EntregarDomicilioDto { MetodoPago = "Nequi", Comprobante = Foto }));

        var d = ctx.Domicilios.AsNoTracking().Single();
        Assert.Equal("Entregado", d.Estado);
        Assert.Equal("Nequi", d.MetodoPago);
        Assert.Equal(Foto, d.ComprobantePago);
        var factura = ctx.Facturas.AsNoTracking().Single();
        Assert.Equal(id, factura.DomicilioId);
        Assert.Null(factura.PagoId);
        Assert.Equal(28000m, factura.Total);
        Assert.Equal("Laura", factura.NombreCliente);

        var detalle = (await new FacturasController(ctx).GetFactura(factura.Id)).Value!;
        Assert.Contains(detalle.Items, i => i.Nombre == "Envío a domicilio" && i.Total == 3000m);
        Assert.Equal("Nequi", detalle.MetodoPago);
    }

    [Fact]
    public async Task El_efectivo_del_domiciliario_entra_al_cajon_cuando_lo_entrega_en_caja()
    {
        using var ctx = TestDb.Crear();
        var id = await NuevoDomicilio(ctx);
        await Listo(ctx, id);
        await App(ctx).MarcarRecogido(TestDb.DomiciliarioId, id);
        ctx.ChangeTracker.Clear();
        await App(ctx).MarcarEntregado(TestDb.DomiciliarioId, id);
        ctx.ChangeTracker.Clear();
        var hoy = HoraLocal.AhoraColombia().Date;

        var antes = (await Reportes(ctx).Cierre(hoy)).Value!;
        Assert.Equal(0m, antes.EfectivoDomicilios);
        Assert.Equal(28000m, Assert.Single(antes.EfectivoEnDomiciliarios).Total);
        var stats = (EstadisticasDomiciliarioDto)((OkObjectResult)(await App(ctx).GetEstadisticas(TestDb.DomiciliarioId)).Result!).Value!;
        Assert.Equal(28000m, stats.EfectivoPorEntregar);

        var pendientes = (await Domicilios(ctx).GetLiquidaciones()).Value!.ToList();
        Assert.Equal(new[] { id }, Assert.Single(pendientes).Domicilios);
        var liquidado = (await Domicilios(ctx).Liquidar(TestDb.DomiciliarioId)).Value!;
        Assert.Equal(28000m, liquidado.Total);

        var despues = (await Reportes(ctx).Cierre(hoy)).Value!;
        Assert.Equal(28000m, despues.EfectivoDomicilios);
        Assert.Empty(despues.EfectivoEnDomiciliarios);
        Assert.IsType<NotFoundObjectResult>((await Domicilios(ctx).Liquidar(TestDb.DomiciliarioId)).Result);
    }

    [Fact]
    public async Task Entregado_y_cobrado_en_caja_queda_facturado_y_en_el_cajon()
    {
        using var ctx = TestDb.Crear();
        var id = await NuevoDomicilio(ctx, metodo: "Transferencia");
        await Listo(ctx, id);

        Assert.IsType<NoContentResult>(await Domicilios(ctx).ActualizarEstado(id, new ActualizarEstadoDto { Estado = "Entregado", MetodoPago = "Efectivo" }));

        var d = ctx.Domicilios.AsNoTracking().Single();
        Assert.Equal("Efectivo", d.MetodoPago);
        Assert.NotNull(d.FechaLiquidacion);
        Assert.Single(ctx.Facturas.AsNoTracking().Where(f => f.DomicilioId == id));
        Assert.Equal(28000m, (await Reportes(ctx).Cierre(HoraLocal.AhoraColombia().Date)).Value!.EfectivoDomicilios);
    }

    [Fact]
    public async Task Cancelar_un_domicilio_guarda_el_motivo()
    {
        using var ctx = TestDb.Crear();
        var id = await NuevoDomicilio(ctx);

        await Domicilios(ctx).ActualizarEstado(id, new ActualizarEstadoDto { Estado = "Cancelado", Motivo = "El cliente no contestó" });

        Assert.Contains("El cliente no contestó", ctx.Domicilios.AsNoTracking().Single().NotasInternas);
    }

    // ==================== CIERRE DE CAJA ====================

    [Fact]
    public async Task Cierre_con_base_propinas_pagadas_y_diferencia_del_conteo()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 2, estado: EstadoPedido.Entregado);
        await TestDb.Sesion(new PagosController(ctx), TestDb.AdminId, RolUsuario.Caja).Cobrar(new CrearCobroDto
        {
            PedidoIds = { 1 },
            Propina = 5000m,
            Pagos = { new PagoCobroDto { MetodoPago = "Efectivo", Monto = 35000m }, new PagoCobroDto { MetodoPago = "Tarjeta", Monto = 20000m } }
        });
        var hoy = HoraLocal.AhoraColombia().Date;

        var abierto = (await Reportes(ctx).Abrir(new AperturaCajaDto { Fecha = hoy, Base = 100000m })).Value!;
        Assert.True(abierto.BaseRegistrada);
        Assert.Equal(135000m, abierto.EfectivoEsperado); // 100.000 de base + 35.000 en efectivo
        Assert.Equal(20000m, abierto.Tarjeta);

        // Se pagaron 3.000 de propinas desde el cajón y se contaron 131.000: faltan 1.000.
        var cerrado = (await Reportes(ctx).Cerrar(new CerrarCajaDto { Fecha = hoy, EfectivoContado = 131000m, PropinasPagadas = 3000m, TarjetaDatafono = 20000m })).Value!;
        Assert.True(cerrado.Cerrada);
        Assert.Equal(132000m, cerrado.EfectivoEsperado);
        Assert.Equal(-1000m, cerrado.Diferencia);
        Assert.Equal(132000m, ctx.CierresCaja.AsNoTracking().Single().EfectivoEsperado);

        // La caja no reescribe un cierre; el administrador lo reabre.
        Assert.IsType<ConflictObjectResult>((await Reportes(ctx).Cerrar(new CerrarCajaDto { Fecha = hoy, EfectivoContado = 132000m })).Result);
        Assert.IsType<ConflictObjectResult>((await Reportes(ctx).Abrir(new AperturaCajaDto { Fecha = hoy, Base = 0m })).Result);
        Assert.IsType<NoContentResult>(await Reportes(ctx, RolUsuario.Administrador).Reabrir(hoy));
        Assert.False((await Reportes(ctx).Cierre(hoy)).Value!.Cerrada);
    }

    /// <summary>
    /// Los [Authorize] de la clase y del método se suman: si la clase pide Administrador, la caja
    /// queda por fuera aunque el método diga "Administrador,Caja" (así fallaba el cierre del cajero).
    /// </summary>
    [Theory]
    [InlineData(nameof(ReportesController.Cierre), true)]
    [InlineData(nameof(ReportesController.Abrir), true)]
    [InlineData(nameof(ReportesController.Cerrar), true)]
    [InlineData(nameof(ReportesController.Reabrir), false)]
    [InlineData(nameof(ReportesController.Ventas), false)]
    public void La_caja_abre_ve_y_cierra_su_caja_pero_no_reabre_ni_ve_reportes(string metodo, bool caja)
    {
        var reglas = typeof(ReportesController).GetCustomAttributes<AuthorizeAttribute>()
            .Concat(typeof(ReportesController).GetMethod(metodo)!.GetCustomAttributes<AuthorizeAttribute>())
            .Select(a => a.Roles!.Split(','))
            .ToList();

        Assert.Equal(caja, reglas.All(r => r.Contains("Caja")));
        Assert.True(reglas.All(r => r.Contains("Administrador")));
    }

    [Fact]
    public async Task No_se_cierra_un_dia_que_no_ha_llegado_ni_con_valores_negativos()
    {
        using var ctx = TestDb.Crear();
        var hoy = HoraLocal.AhoraColombia().Date;

        Assert.IsType<BadRequestObjectResult>((await Reportes(ctx).Cerrar(new CerrarCajaDto { Fecha = hoy.AddDays(1), EfectivoContado = 0 })).Result);
        Assert.IsType<BadRequestObjectResult>((await Reportes(ctx).Cerrar(new CerrarCajaDto { Fecha = hoy, EfectivoContado = -1 })).Result);
        Assert.IsType<BadRequestObjectResult>((await Reportes(ctx).Abrir(new AperturaCajaDto { Fecha = hoy, Base = -5 })).Result);
    }
}
