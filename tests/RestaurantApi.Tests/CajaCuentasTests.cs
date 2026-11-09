using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>Cobro por cuenta de mesa, factura, precio congelado, cierre de caja y reportes.</summary>
public class CajaCuentasTests
{
    private const decimal Hamburguesa = 25000m;

    private static PagosController Pagos(RestauranteContext ctx) => new(ctx);

    private static CrearCobroDto Cobro(params int[] pedidos) => new() { PedidoIds = pedidos.ToList(), MetodoPago = "Efectivo" };

    private static CobroDto Ok(ActionResult<CobroDto> r) => (CobroDto)Assert.IsType<OkObjectResult>(r.Result).Value!;

    private static void Entregado(RestauranteContext ctx, int id, int cantidad, int mesa = TestDb.MesaUnoId)
        => TestDb.CrearPedidoDirecto(ctx, id, cantidad, mesa, EstadoPedido.Entregado);

    /// <summary>
    /// Dos relaciones entre las mismas tablas pueden hacer que EF invente columnas como PagoId1,
    /// que no existen en MySQL ni en TiDB (la base en memoria no lo nota). Ninguna debe aparecer.
    /// </summary>
    [Fact]
    public void El_modelo_no_inventa_columnas_que_no_existen()
    {
        using var ctx = TestDb.Crear(sembrar: false);
        var fantasmas = ctx.Model.GetEntityTypes()
            .SelectMany(t => t.GetProperties().Where(p => p.IsShadowProperty() && System.Text.RegularExpressions.Regex.IsMatch(p.Name, @"\d$"))
                .Select(p => $"{t.ClrType.Name}.{p.Name}"))
            .ToList();

        Assert.Empty(fantasmas);
    }

    // ==================== COBRO DE LA CUENTA ====================

    [Fact]
    public async Task Una_mesa_con_dos_pedidos_paga_una_sola_vez_con_una_factura()
    {
        using var ctx = TestDb.Crear();
        Entregado(ctx, 1, 1);
        Entregado(ctx, 2, 2);

        var cobro = Ok(await Pagos(ctx).Cobrar(Cobro(1, 2)));

        Assert.Equal(3 * Hamburguesa, cobro.Factura.Total);
        Assert.Equal(new[] { 1, 2 }, cobro.Factura.PedidoIds);
        var linea = Assert.Single(cobro.Factura.Items);
        Assert.Equal(3, linea.Cantidad);
        Assert.Equal(1, ctx.Facturas.Count());
        Assert.All(ctx.Pagos.AsNoTracking().ToList(), p => Assert.Equal(cobro.Factura.Id, p.FacturaId));
        Assert.All(ctx.Pedidos.AsNoTracking().ToList(), p => Assert.Equal(EstadoPedido.Pagado, p.Estado));
        Assert.Equal(EstadoMesa.Disponible, ctx.Mesas.AsNoTracking().Single(m => m.Id == TestDb.MesaUnoId).Estado);
    }

    [Fact]
    public async Task Dividir_la_cuenta_deja_la_mesa_ocupada_hasta_cobrar_el_resto()
    {
        using var ctx = TestDb.Crear();
        Entregado(ctx, 1, 1);
        Entregado(ctx, 2, 1);
        ctx.Mesas.Single(m => m.Id == TestDb.MesaUnoId).Estado = EstadoMesa.Ocupada;
        ctx.SaveChanges();

        Ok(await Pagos(ctx).Cobrar(Cobro(1)));

        Assert.Equal(EstadoMesa.Ocupada, ctx.Mesas.AsNoTracking().Single(m => m.Id == TestDb.MesaUnoId).Estado);
        Assert.Equal(EstadoPedido.Entregado, ctx.Pedidos.AsNoTracking().Single(p => p.Id == 2).Estado);
    }

    [Fact]
    public async Task Un_pedido_que_sigue_en_cocina_no_se_cobra()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1); // EnProceso

        var r = await Pagos(ctx).Cobrar(Cobro(1));

        Assert.IsType<ConflictObjectResult>(r.Result);
        Assert.False(ctx.Pagos.Any());
    }

    [Fact]
    public async Task Pedidos_de_mesas_distintas_no_se_cobran_juntos()
    {
        using var ctx = TestDb.Crear();
        Entregado(ctx, 1, 1);
        Entregado(ctx, 2, 1, TestDb.MesaDosId);

        Assert.IsType<BadRequestObjectResult>((await Pagos(ctx).Cobrar(Cobro(1, 2))).Result);
    }

    [Fact]
    public async Task Una_cuenta_cobrada_no_se_cobra_dos_veces()
    {
        using var ctx = TestDb.Crear();
        Entregado(ctx, 1, 1);
        var c = Pagos(ctx);
        Ok(await c.Cobrar(Cobro(1)));

        Assert.IsType<ConflictObjectResult>((await c.Cobrar(Cobro(1))).Result);
        Assert.Equal(1, ctx.Facturas.Count());
    }

    [Fact]
    public async Task La_propina_va_en_la_factura_y_en_el_primer_pago()
    {
        using var ctx = TestDb.Crear();
        Entregado(ctx, 1, 2);
        Entregado(ctx, 2, 2);
        var dto = Cobro(1, 2);
        dto.Propina = 10000m;

        var cobro = Ok(await Pagos(ctx).Cobrar(dto));

        Assert.Equal(100000m, cobro.Factura.Subtotal);
        Assert.Equal(10000m, cobro.Factura.Propina);
        Assert.Equal(110000m, cobro.Factura.Total);
        Assert.Equal(10000m, ctx.Pagos.AsNoTracking().Sum(p => p.MontoPropina));
    }

    [Fact]
    public async Task En_efectivo_calcula_el_cambio_y_rechaza_si_no_alcanza()
    {
        using var ctx = TestDb.Crear();
        Entregado(ctx, 1, 1);
        var dto = Cobro(1);

        dto.Recibido = 20000m;
        Assert.IsType<BadRequestObjectResult>((await Pagos(ctx).Cobrar(dto)).Result);

        dto.Recibido = 50000m;
        Assert.Equal(25000m, Ok(await Pagos(ctx).Cobrar(dto)).Cambio);
    }

    [Fact]
    public async Task Con_tarjeta_el_recibido_no_aplica()
    {
        using var ctx = TestDb.Crear();
        Entregado(ctx, 1, 1);
        var dto = Cobro(1);
        dto.MetodoPago = "Tarjeta";
        dto.Recibido = 1000m;

        var cobro = Ok(await Pagos(ctx).Cobrar(dto));

        Assert.Null(cobro.Recibido);
        Assert.Equal(0m, cobro.Cambio);
    }

    [Fact]
    public async Task La_factura_lleva_los_datos_del_cliente_si_los_pide()
    {
        using var ctx = TestDb.Crear();
        Entregado(ctx, 1, 1);
        Entregado(ctx, 2, 1, TestDb.MesaDosId);
        var dto = Cobro(1);
        dto.NitCliente = "900123456-7";
        dto.NombreCliente = "  Ferretería El Clavo SAS ";

        var cobro = Ok(await Pagos(ctx).Cobrar(dto));
        Assert.Equal("900123456-7", cobro.Factura.NitCliente);
        Assert.Equal("Ferretería El Clavo SAS", cobro.Factura.NombreCliente);

        var malo = Cobro(2);
        malo.NitCliente = "abc";
        Assert.IsType<BadRequestObjectResult>((await Pagos(ctx).Cobrar(malo)).Result);
    }

    [Fact]
    public async Task Sin_datos_la_factura_es_a_consumidor_final_y_sigue_el_consecutivo()
    {
        using var ctx = TestDb.Crear();
        Entregado(ctx, 1, 1);
        Entregado(ctx, 2, 1, TestDb.MesaDosId);

        var a = Ok(await Pagos(ctx).Cobrar(Cobro(1))).Factura;
        var b = Ok(await Pagos(ctx).Cobrar(Cobro(2))).Factura;

        Assert.Equal("Consumidor final", a.NombreCliente);
        Assert.Equal("222222222222", a.NitCliente);
        Assert.Equal(new[] { "FV-00000001", "FV-00000002" }, new[] { a.NumeroFactura, b.NumeroFactura });
    }

    // ==================== PRECIO CONGELADO ====================

    private static PedidosController Pedidos(RestauranteContext ctx)
        => TestDb.ComoMesero(new PedidosController(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx)));

    private static void CambiarPrecio(RestauranteContext ctx, decimal precio)
    {
        ctx.Platillos.Single(p => p.Id == TestDb.PlatilloHamburguesaId).Precio = precio;
        ctx.SaveChanges();
        ctx.ChangeTracker.Clear();
    }

    [Fact]
    public async Task Si_cambia_el_precio_la_cuenta_abierta_se_cobra_al_precio_con_que_se_pidio()
    {
        using var ctx = TestDb.Crear();
        var creado = (PedidoDto)((CreatedAtActionResult)(await Pedidos(ctx).PostPedido(new CrearPedidoDto
        {
            MesaId = TestDb.MesaUnoId,
            Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 2 } }
        })).Result!).Value!;
        await Pedidos(ctx).ActualizarEstado(creado.Id, new ActualizarEstadoPedidoDto { Estado = "Entregado" });

        CambiarPrecio(ctx, 30000m);

        var cobro = Ok(await Pagos(ctx).Cobrar(Cobro(creado.Id)));
        Assert.Equal(2 * Hamburguesa, cobro.Factura.Total);
    }

    [Fact]
    public async Task Editar_el_pedido_conserva_el_precio_de_lo_que_ya_estaba()
    {
        using var ctx = TestDb.Crear();
        var creado = (PedidoDto)((CreatedAtActionResult)(await Pedidos(ctx).PostPedido(new CrearPedidoDto
        {
            MesaId = TestDb.MesaUnoId,
            Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 1 } }
        })).Result!).Value!;
        CambiarPrecio(ctx, 30000m);

        var editado = (await Pedidos(ctx).ActualizarPedidoCompleto(creado.Id, new ActualizarPedidoCompletoDto
        {
            Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 3 } }
        })).Value!;

        Assert.Equal(Hamburguesa, Assert.Single(editado.Detalles).Precio);
    }

    // ==================== CORRECCIONES ====================

    [Fact]
    public async Task Anular_un_pago_sin_factura_reabre_la_cuenta()
    {
        using var ctx = TestDb.Crear();
        Entregado(ctx, 1, 1);
        var pago = (PagoDto)((CreatedAtActionResult)(await Pagos(ctx).PostPago(new CrearPagoDto { PedidoId = 1, Monto = Hamburguesa })).Result!).Value!;

        Assert.IsType<NoContentResult>(await Pagos(ctx).DeletePago(pago.Id));

        Assert.Equal(EstadoPedido.Entregado, ctx.Pedidos.AsNoTracking().Single(p => p.Id == 1).Estado);
        Assert.Equal(EstadoMesa.Ocupada, ctx.Mesas.AsNoTracking().Single(m => m.Id == TestDb.MesaUnoId).Estado);
    }

    [Fact]
    public async Task La_propina_de_un_pago_facturado_no_se_reescribe_pero_el_metodo_si()
    {
        using var ctx = TestDb.Crear();
        Entregado(ctx, 1, 1);
        Ok(await Pagos(ctx).Cobrar(Cobro(1)));
        var pagoId = ctx.Pagos.Single().Id;

        Assert.IsType<ConflictObjectResult>(await Pagos(ctx).PutPago(pagoId, new CrearPagoDto { MetodoPago = "Efectivo", MontoPropina = 5000m }));
        Assert.IsType<NoContentResult>(await Pagos(ctx).PutPago(pagoId, new CrearPagoDto { MetodoPago = "Tarjeta", MontoPropina = 0m }));
        Assert.Equal(MetodoPago.Tarjeta, ctx.Pagos.AsNoTracking().Single().MetodoPago);
    }

    [Fact]
    public async Task Las_facturas_del_dia_traen_su_detalle()
    {
        using var ctx = TestDb.Crear();
        Entregado(ctx, 1, 2);
        Ok(await Pagos(ctx).Cobrar(Cobro(1)));

        var hoy = HoraLocal.AhoraColombia().Date;
        var facturas = (await new FacturasController(ctx).GetFacturas(hoy)).Value!.ToList();
        var ayer = (await new FacturasController(ctx).GetFacturas(hoy.AddDays(-1))).Value!;

        var f = Assert.Single(facturas);
        Assert.Equal(1, f.MesaNumero);
        Assert.Equal("Efectivo", f.MetodoPago);
        Assert.Equal(2, Assert.Single(f.Items).Cantidad);
        Assert.Empty(ayer);
    }

    // ==================== CIERRE Y REPORTES ====================

    private static readonly DateTime Dia = new(2026, 10, 30);

    /// <summary>Pago directo a una hora de Colombia dada.</summary>
    private static void Pagado(RestauranteContext ctx, int pedidoId, int mesa, int usuarioId, string metodo, decimal propina, int hora, int minuto = 0)
    {
        var fecha = HoraLocal.AUtc(Dia.AddHours(hora).AddMinutes(minuto));
        ctx.Pedidos.Add(new Pedido
        {
            Id = pedidoId, MesaId = mesa, UsuarioId = usuarioId, Estado = EstadoPedido.Pagado, Fecha = fecha,
            Detalles = { new PedidoDetalle { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 1, PrecioUnitario = 20000m } }
        });
        ctx.Pagos.Add(new Pago { PedidoId = pedidoId, Monto = 20000m, MontoPropina = propina, MetodoPago = Enum.Parse<MetodoPago>(metodo), Fecha = fecha });
        ctx.SaveChanges();
    }

    private static void DomicilioEntregado(RestauranteContext ctx, int id, string metodo, int hora)
    {
        ctx.Clientes.Add(new Cliente { Id = id, Nombre = "Cliente", Telefono = "3110000000" });
        ctx.Direcciones.Add(new Direccion { Id = id, ClienteId = id, DireccionCompleta = "Cra 1 # 2-3" });
        ctx.Domicilios.Add(new Domicilio
        {
            Id = id, ClienteId = id, DireccionId = id, Estado = "Entregado", MetodoPago = metodo,
            Subtotal = 25000m, CostoEnvio = 3000m, Total = 28000m, UsuarioCreadorId = TestDb.AdminId,
            FechaPedido = HoraLocal.AUtc(Dia.AddHours(hora - 1)), FechaEntrega = HoraLocal.AUtc(Dia.AddHours(hora)),
            Detalles = { new DomicilioDetalle { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 1, PrecioUnitario = 25000m } }
        });
        ctx.SaveChanges();
    }

    [Fact]
    public async Task El_cierre_suma_por_metodo_mesa_y_domicilios()
    {
        using var ctx = TestDb.Crear();
        Pagado(ctx, 1, TestDb.MesaUnoId, TestDb.MeseroId, "Efectivo", 2000m, 12);
        Pagado(ctx, 2, TestDb.MesaDosId, TestDb.MeseroId, "Tarjeta", 0m, 13);
        DomicilioEntregado(ctx, 70, "Nequi", 14);

        var cierre = (await new ReportesController(ctx).Cierre(Dia)).Value!;

        Assert.Equal(40000m, cierre.VentasMesa);
        Assert.Equal(2000m, cierre.Propinas);
        Assert.Equal(25000m, cierre.VentasDomicilio);
        Assert.Equal(3000m, cierre.Envios);
        Assert.Equal(70000m, cierre.TotalRecaudado);
        Assert.Equal(22000m, cierre.PorMetodo.Single(m => m.Metodo == "Efectivo").Total);
        Assert.Equal(28000m, cierre.PorMetodo.Single(m => m.Metodo == "Transferencia o QR").Domicilios);
        Assert.Equal(2, cierre.CuentasMesa);
        Assert.Equal(1, cierre.Domicilios);
    }

    [Fact]
    public async Task El_cierre_avisa_las_cuentas_que_siguen_abiertas()
    {
        using var ctx = TestDb.Crear();
        Entregado(ctx, 1, 1);
        Entregado(ctx, 2, 1);

        var cierre = (await new ReportesController(ctx).Cierre(HoraLocal.AhoraColombia().Date)).Value!;

        Assert.Equal(1, cierre.CuentasAbiertas);
        Assert.Equal(2 * Hamburguesa, cierre.ValorAbierto);
    }

    [Fact]
    public async Task Una_venta_a_las_8_de_la_noche_cuenta_en_ese_dia_no_en_el_siguiente()
    {
        using var ctx = TestDb.Crear();
        Pagado(ctx, 1, TestDb.MesaUnoId, TestDb.MeseroId, "Efectivo", 0m, 20); // 01:00 UTC del día siguiente

        var r = (await new ReportesController(ctx).Ventas(Dia, Dia)).Value!;
        var siguiente = (await new ReportesController(ctx).Ventas(Dia.AddDays(1), Dia.AddDays(1))).Value!;

        Assert.Equal(20000m, Assert.Single(r.PorDia).Total);
        Assert.Equal(20000m, r.PorHora[20].Total);
        Assert.Equal(0m, siguiente.Ventas);
    }

    [Fact]
    public async Task Los_pedidos_del_qr_no_cuentan_como_mesero_y_tienen_su_canal()
    {
        using var ctx = TestDb.Crear();
        ctx.Usuarios.Add(new Usuario { Id = 20, Nombre = "Cliente QR", NombreUsuario = ReportesVentas.UsuarioQR, ClaveHash = "x", Rol = RolUsuario.Mesero });
        ctx.SaveChanges();
        Pagado(ctx, 1, TestDb.MesaUnoId, TestDb.MeseroId, "Efectivo", 1000m, 12);
        Pagado(ctx, 2, TestDb.MesaDosId, 20, "Efectivo", 0m, 12, 30);

        var r = (await new ReportesController(ctx).Ventas(Dia, Dia)).Value!;

        var mesero = Assert.Single(r.Meseros);
        Assert.Equal(TestDb.MeseroId, mesero.UsuarioId);
        Assert.Equal(1000m, mesero.Propinas);
        Assert.Equal(1, r.Canales.Single(c => c.Canal == "QR de la mesa").Ventas);
    }

    [Fact]
    public async Task Los_platos_se_reportan_con_el_precio_con_que_se_vendieron()
    {
        using var ctx = TestDb.Crear();
        Pagado(ctx, 1, TestDb.MesaUnoId, TestDb.MeseroId, "Efectivo", 0m, 12); // vendido a 20.000
        DomicilioEntregado(ctx, 71, "Efectivo", 15);                             // vendido a 25.000
        CambiarPrecio(ctx, 99000m);

        var r = (await new ReportesController(ctx).Ventas(Dia, Dia)).Value!;

        var plato = Assert.Single(r.Platillos);
        Assert.Equal(2, plato.Cantidad);
        Assert.Equal(45000m, plato.Ingresos);
        Assert.Equal(2, r.NumeroVentas);
        Assert.Equal(22500m, r.TicketPromedio);
    }

    [Fact]
    public async Task Un_rango_al_reves_responde_400()
    {
        using var ctx = TestDb.Crear();
        var r = await new ReportesController(ctx).Ventas(Dia, Dia.AddDays(-1));
        Assert.IsType<BadRequestObjectResult>(r.Result);
    }
}
