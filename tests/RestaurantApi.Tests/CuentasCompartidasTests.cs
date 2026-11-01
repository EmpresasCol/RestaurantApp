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
/// Cuentas compartidas y pagos de la vida real: cada quien paga lo suyo (aunque sea 1 de 2),
/// pago mixto, partes iguales, propina repartida y los pagos que avisó el mesero, que la caja
/// no puede cambiar cuando cubren toda la cuenta.
/// </summary>
public class CuentasCompartidasTests
{
    private const decimal Hamburguesa = 25000m;
    private const string Foto = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    private const string OtraFoto = "data:image/jpeg;base64,/9j/4BBQSkZJRg==";

    private static PagosController Caja(RestauranteContext ctx) => TestDb.Sesion(new PagosController(ctx), TestDb.AdminId, RolUsuario.Caja);

    private static CuentasController Mesero(RestauranteContext ctx) => TestDb.ComoMesero(new CuentasController(ctx));

    private static CobroDto Ok(ActionResult<CobroDto> r) => (CobroDto)Assert.IsType<OkObjectResult>(r.Result).Value!;

    private static SolicitudCuentaDto Aviso(ActionResult<SolicitudCuentaDto> r) => (SolicitudCuentaDto)Assert.IsType<OkObjectResult>(r.Result).Value!;

    private static int Detalle(RestauranteContext ctx, int pedidoId) => ctx.PedidoDetalles.AsNoTracking().First(d => d.PedidoId == pedidoId).Id;

    private static void Servido(RestauranteContext ctx, int id, int cantidad, int mesa = TestDb.MesaUnoId)
    {
        TestDb.CrearPedidoDirecto(ctx, id, cantidad, mesa, EstadoPedido.Entregado);
        ctx.Mesas.Single(m => m.Id == mesa).Estado = EstadoMesa.Ocupada;
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();
    }

    // ==================== DIVIDIR POR CONSUMO ====================

    [Fact]
    public async Task Cada_quien_paga_lo_suyo_aunque_sea_una_de_dos_hamburguesas()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 2);
        var plato = Detalle(ctx, 1);

        var primera = Ok(await Caja(ctx).Cobrar(new CrearCobroDto { Lineas = { new LineaCobroDto { DetalleId = plato, Cantidad = 1 } }, MetodoPago = "Tarjeta" }));

        Assert.Equal(Hamburguesa, primera.Factura.Total);
        Assert.Equal(1, Assert.Single(primera.Factura.Items).Cantidad);
        Assert.False(primera.CuentaSaldada);
        Assert.Equal(Hamburguesa, primera.Pendiente);
        Assert.Equal(EstadoPedido.Entregado, ctx.Pedidos.AsNoTracking().Single().Estado);
        Assert.Equal(EstadoMesa.Ocupada, ctx.Mesas.AsNoTracking().Single(m => m.Id == TestDb.MesaUnoId).Estado);

        var segunda = Ok(await Caja(ctx).Cobrar(new CrearCobroDto { PedidoIds = { 1 }, MetodoPago = "Efectivo" }));

        Assert.True(segunda.CuentaSaldada);
        Assert.Equal(Hamburguesa, segunda.Factura.Total);
        Assert.Equal(EstadoPedido.Pagado, ctx.Pedidos.AsNoTracking().Single().Estado);
        Assert.Equal(EstadoMesa.Disponible, ctx.Mesas.AsNoTracking().Single(m => m.Id == TestDb.MesaUnoId).Estado);
        // Las dos unidades quedan en dos líneas, cada una con su factura.
        var lineas = ctx.PedidoDetalles.AsNoTracking().Where(d => d.PedidoId == 1).ToList();
        Assert.Equal(2, lineas.Sum(d => d.Cantidad));
        Assert.Equal(new[] { primera.Factura.Id, segunda.Factura.Id }.OrderBy(x => x), lineas.Select(d => d.FacturaId!.Value).OrderBy(x => x));
    }

    [Fact]
    public async Task Un_plato_cobrado_no_se_cobra_otra_vez_ni_se_cobran_mas_unidades_de_las_que_hay()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 2);
        var plato = Detalle(ctx, 1);

        Assert.IsType<BadRequestObjectResult>((await Caja(ctx).Cobrar(new CrearCobroDto { Lineas = { new LineaCobroDto { DetalleId = plato, Cantidad = 3 } } })).Result);

        Ok(await Caja(ctx).Cobrar(new CrearCobroDto { Lineas = { new LineaCobroDto { DetalleId = plato, Cantidad = 2 } } }));

        Assert.IsType<ConflictObjectResult>((await Caja(ctx).Cobrar(new CrearCobroDto { Lineas = { new LineaCobroDto { DetalleId = plato, Cantidad = 1 } } })).Result);
        Assert.Equal(1, ctx.Facturas.Count());
    }

    [Fact]
    public async Task Lo_ya_cobrado_de_un_pedido_no_se_cancela_ni_se_edita()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 2);
        Ok(await Caja(ctx).Cobrar(new CrearCobroDto { Lineas = { new LineaCobroDto { DetalleId = Detalle(ctx, 1), Cantidad = 1 } } }));
        var admin = TestDb.ComoAdmin(new PedidosController(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx)));

        Assert.IsType<ConflictObjectResult>(await admin.ActualizarEstado(1, new ActualizarEstadoPedidoDto { Estado = "Cancelado" }));
        var editar = await admin.PutPedido(1, new ActualizarPedidoDto
        {
            Detalles = new List<ActualizarPedidoDetalleDto> { new() { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 1 } }
        });
        Assert.IsType<ConflictObjectResult>(editar);
    }

    [Fact]
    public async Task La_cuenta_abierta_muestra_que_platos_ya_se_pagaron()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 2);
        Ok(await Caja(ctx).Cobrar(new CrearCobroDto { Lineas = { new LineaCobroDto { DetalleId = Detalle(ctx, 1), Cantidad = 1 } } }));

        var pedidos = (await new PedidosController(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx)).GetPedidosActivos()).Value!.ToList();

        var pedido = Assert.Single(pedidos);
        Assert.Equal(Hamburguesa, pedido.PorCobrar);
        Assert.Single(pedido.Detalles, d => d.Pagado);
        Assert.Single(pedido.Detalles, d => !d.Pagado);
    }

    // ==================== PAGO MIXTO Y PARTES IGUALES ====================

    [Fact]
    public async Task Pago_mixto_efectivo_y_tarjeta_en_una_sola_factura_con_su_cambio()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 2); // 50.000

        var cobro = Ok(await Caja(ctx).Cobrar(new CrearCobroDto
        {
            PedidoIds = { 1 },
            Pagos =
            {
                new PagoCobroDto { MetodoPago = "Efectivo", Monto = 30000m, Recibido = 50000m },
                new PagoCobroDto { MetodoPago = "Tarjeta", Monto = 20000m }
            }
        }));

        Assert.Equal(20000m, cobro.Cambio);
        Assert.Equal(50000m, cobro.Recibido);
        Assert.Equal("Efectivo + Tarjeta", cobro.Factura.MetodoPago);
        Assert.Equal(2, cobro.Factura.Pagos.Count);
        var pagos = ctx.Pagos.AsNoTracking().ToList();
        Assert.Equal(2, pagos.Count);
        Assert.All(pagos, p => Assert.Equal(cobro.Factura.Id, p.FacturaId));
        Assert.Equal(50000m, pagos.Sum(p => p.Monto));
    }

    [Fact]
    public async Task Los_pagos_deben_sumar_exacto_la_cuenta_mas_la_propina()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 2); // 50.000

        CrearCobroDto Con(params decimal[] montos) => new()
        {
            PedidoIds = { 1 },
            Propina = 5000m,
            Pagos = montos.Select(m => new PagoCobroDto { MetodoPago = "Tarjeta", Monto = m }).ToList()
        };

        Assert.IsType<BadRequestObjectResult>((await Caja(ctx).Cobrar(Con(30000m, 20000m))).Result);  // falta la propina
        Assert.IsType<BadRequestObjectResult>((await Caja(ctx).Cobrar(Con(30000m, 30000m))).Result);  // se pasa
        Assert.IsType<BadRequestObjectResult>((await Caja(ctx).Cobrar(Con(55000m, 0m))).Result);      // un pago en cero
        Assert.False(ctx.Facturas.Any());

        Ok(await Caja(ctx).Cobrar(Con(27500m, 27500m)));
    }

    [Fact]
    public async Task En_partes_iguales_la_propina_se_reparte_entre_los_pagos()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 4); // 100.000

        Ok(await Caja(ctx).Cobrar(new CrearCobroDto
        {
            PedidoIds = { 1 },
            Propina = 10000m,
            Pagos = { new PagoCobroDto { MetodoPago = "Tarjeta", Monto = 55000m }, new PagoCobroDto { MetodoPago = "QR", Monto = 55000m } }
        }));

        var pagos = ctx.Pagos.AsNoTracking().ToList();
        Assert.All(pagos, p => Assert.Equal(5000m, p.MontoPropina));
        Assert.Equal(100000m, pagos.Sum(p => p.Monto));
        Assert.Equal(10000m, ctx.Facturas.Single().Propina);
    }

    [Fact]
    public void Repartir_la_propina_suma_exacto_aunque_no_divida_parejo()
    {
        var reparto = Cuentas.RepartirPropina(new[] { 10000m, 10000m, 10000m }, 1000m);

        Assert.Equal(1000m, reparto.Sum());
        Assert.Equal(new[] { 333m, 333m, 334m }, reparto);
        Assert.Equal(new[] { 0m, 0m }, Cuentas.RepartirPropina(new[] { 5000m, 5000m }, 0m));
    }

    // ==================== LO QUE AVISA EL MESERO ====================

    private static SolicitarCuentaDto PagoAvisado(decimal propina = 0, params AvisarPagoDto[] pagos)
        => new() { MesaId = TestDb.MesaUnoId, Propina = propina, Pagos = pagos.ToList() };

    private static AvisarPagoDto Efectivo(decimal monto) => new() { MetodoPago = "Efectivo", Monto = monto };

    private static AvisarPagoDto Transferencia(decimal monto, string? foto = Foto) => new() { MetodoPago = "QR", Monto = monto, Comprobante = foto };

    [Fact]
    public async Task Varias_transferencias_cada_una_con_su_foto()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 2); // 50.000

        Assert.IsType<BadRequestObjectResult>((await Mesero(ctx).Solicitar(PagoAvisado(0, Transferencia(25000m), Transferencia(25000m, null)))).Result);

        var aviso = Aviso(await Mesero(ctx).Solicitar(PagoAvisado(0, Transferencia(25000m), Transferencia(25000m, OtraFoto))));

        Assert.True(aviso.Cuadra);
        Assert.Equal(2, aviso.Pagos.Count);
        var fotos = new List<string>();
        foreach (var p in aviso.Pagos)
        {
            var r = Assert.IsType<OkObjectResult>(await Mesero(ctx).GetComprobantePago(p.Id));
            fotos.Add((string)r.Value!.GetType().GetProperty("comprobante")!.GetValue(r.Value)!);
        }
        Assert.Equal(new[] { Foto, OtraFoto }, fotos);
    }

    [Fact]
    public async Task El_mesero_no_avisa_mas_de_lo_que_debe_la_mesa()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 2); // 50.000

        var r = await Mesero(ctx).Solicitar(PagoAvisado(0, Efectivo(60000m)));

        Assert.IsType<BadRequestObjectResult>(r.Result);
    }

    [Fact]
    public async Task Si_el_aviso_cubre_toda_la_cuenta_la_caja_no_cambia_valores_metodos_ni_propina()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 2); // 50.000
        var aviso = Aviso(await Mesero(ctx).Solicitar(PagoAvisado(5000m, Efectivo(30000m), Transferencia(25000m))));
        Assert.True(aviso.Cuadra);
        var efectivo = aviso.Pagos.Single(p => p.MetodoPago == "Efectivo");
        var qr = aviso.Pagos.Single(p => p.MetodoPago == "QR");

        // Otro método en lugar del avisado.
        var otroMetodo = await Caja(ctx).Cobrar(new CrearCobroDto { PedidoIds = { 1 }, Propina = 5000m, MetodoPago = "Tarjeta" });
        // Mismos pagos pero sin propina.
        var sinPropina = await Caja(ctx).Cobrar(new CrearCobroDto
        {
            PedidoIds = { 1 },
            Pagos = { new PagoCobroDto { MetodoPago = "Efectivo", Monto = 25000m, AvisoId = efectivo.Id }, new PagoCobroDto { MetodoPago = "QR", Monto = 25000m, AvisoId = qr.Id } }
        });
        Assert.IsType<ConflictObjectResult>(otroMetodo.Result);
        Assert.IsType<ConflictObjectResult>(sinPropina.Result);

        var cobro = Ok(await Caja(ctx).Cobrar(new CrearCobroDto
        {
            PedidoIds = { 1 },
            Propina = 5000m,
            Pagos = { new PagoCobroDto { MetodoPago = "Efectivo", Monto = 30000m, AvisoId = efectivo.Id }, new PagoCobroDto { MetodoPago = "QR", Monto = 25000m, AvisoId = qr.Id } }
        }));

        Assert.True(cobro.CuentaSaldada);
        Assert.Equal(55000m, cobro.Factura.Total);
        Assert.All(ctx.PagosAvisados.AsNoTracking().ToList(), a => Assert.Equal(cobro.Factura.Id, a.FacturaId));
        Assert.Equal(SolicitudCuenta.Cobrada, ctx.SolicitudesCuenta.AsNoTracking().Single().Estado);
    }

    [Fact]
    public async Task Si_el_aviso_no_cubre_la_cuenta_la_caja_completa_el_resto_sin_tocar_lo_avisado()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 2); // 50.000
        var aviso = Aviso(await Mesero(ctx).Solicitar(PagoAvisado(0, Transferencia(20000m))));
        Assert.False(aviso.Cuadra);
        var qr = Assert.Single(aviso.Pagos);

        var cambiado = await Caja(ctx).Cobrar(new CrearCobroDto
        {
            PedidoIds = { 1 },
            Pagos = { new PagoCobroDto { MetodoPago = "QR", Monto = 25000m, AvisoId = qr.Id }, new PagoCobroDto { MetodoPago = "Efectivo", Monto = 25000m } }
        });
        Assert.IsType<ConflictObjectResult>(cambiado.Result);

        var cobro = Ok(await Caja(ctx).Cobrar(new CrearCobroDto
        {
            PedidoIds = { 1 },
            Pagos = { new PagoCobroDto { MetodoPago = "QR", Monto = 20000m, AvisoId = qr.Id }, new PagoCobroDto { MetodoPago = "Efectivo", Monto = 30000m, Recibido = 30000m } }
        }));
        Assert.Equal("QR + Efectivo", cobro.Factura.MetodoPago);
    }

    [Fact]
    public async Task Avisar_otra_vez_reemplaza_los_pagos_que_la_caja_no_ha_usado()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 2);
        await Mesero(ctx).Solicitar(PagoAvisado(0, Efectivo(10000m)));

        var nuevo = Aviso(await Mesero(ctx).Solicitar(PagoAvisado(0, Efectivo(20000m), Efectivo(30000m))));

        Assert.Equal(2, ctx.PagosAvisados.Count());
        Assert.Equal(50000m, nuevo.TotalAvisado);
        Assert.Equal("Efectivo", nuevo.MetodoPago);
    }

    [Fact]
    public async Task Si_la_mesa_pide_algo_mas_el_aviso_deja_de_cuadrar()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 2);
        Aviso(await Mesero(ctx).Solicitar(PagoAvisado(0, Efectivo(50000m))));
        Servido(ctx, 2, 1);

        var pendiente = Assert.Single((await Mesero(ctx).GetPendientes()).Value!);

        Assert.False(pendiente.Cuadra);
        Assert.Equal(75000m, pendiente.PorCobrar);
    }

    // ==================== REPORTES ====================

    [Fact]
    public async Task Una_cuenta_dividida_no_duplica_los_platos_vendidos_ni_las_ventas_del_mesero()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 2);
        Ok(await Caja(ctx).Cobrar(new CrearCobroDto { Lineas = { new LineaCobroDto { DetalleId = Detalle(ctx, 1), Cantidad = 1 } }, MetodoPago = "Tarjeta" }));
        Ok(await Caja(ctx).Cobrar(new CrearCobroDto
        {
            PedidoIds = { 1 },
            Pagos = { new PagoCobroDto { MetodoPago = "Efectivo", Monto = 10000m }, new PagoCobroDto { MetodoPago = "QR", Monto = 15000m } }
        }));

        var hoy = HoraLocal.AhoraColombia().Date;
        var r = (await new ReportesController(ctx).Ventas(hoy, hoy)).Value!;

        Assert.Equal(2, Assert.Single(r.Platillos).Cantidad);
        Assert.Equal(50000m, r.Ventas);
        Assert.Equal(2, r.NumeroVentas);
        var mesero = Assert.Single(r.Meseros);
        Assert.Equal(50000m, mesero.Ventas);
        Assert.Equal(1, mesero.Pedidos);
    }
}
