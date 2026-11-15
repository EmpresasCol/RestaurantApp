using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>
/// Facturación electrónica: numeración autorizada, impuesto discriminado, cola de documentos con
/// reintentos idempotentes, rechazo, contingencia y anulación con nota.
/// </summary>
public class FacturacionElectronicaTests
{
    private const decimal Precio = 25000m;

    private static PagosController Caja(RestauranteContext ctx) => TestDb.Sesion(new PagosController(ctx), TestDb.AdminId, RolUsuario.Caja);

    private static FacturasController Facturas(RestauranteContext ctx) => TestDb.Sesion(new FacturasController(ctx), TestDb.AdminId, RolUsuario.Caja);

    private static FiscalController Fiscal(RestauranteContext ctx) => TestDb.ComoAdmin(new FiscalController(ctx));

    private static ReportesController Reportes(RestauranteContext ctx) => TestDb.ComoAdmin(new ReportesController(ctx));

    private static void Servido(RestauranteContext ctx, int id, int cantidad = 1, int mesa = TestDb.MesaUnoId)
    {
        TestDb.CrearPedidoDirecto(ctx, id, cantidad, mesa, EstadoPedido.Entregado);
        ctx.Mesas.Single(m => m.Id == mesa).Estado = EstadoMesa.Ocupada;
        ctx.SaveChanges();
    }

    /// <summary>Restaurante con facturación electrónica activa y un rango POS y otro de factura.</summary>
    private static RestauranteContext Electronica(long posHasta = 1100)
    {
        var ctx = TestDb.Crear();
        ctx.ConfiguracionFiscal.Add(new ConfiguracionFiscal
        {
            RazonSocial = "Restaurante de Prueba SAS", Nit = "900123456", DigitoVerificacion = "8",
            Direccion = "Calle 1 # 2-3", Municipio = "Sincelejo", FacturacionElectronica = true
        });
        ctx.NumeracionesDian.AddRange(
            new NumeracionDian { TipoDocumento = DocumentoElectronico.Pos, Prefijo = "POS", Resolucion = "18760000001", Desde = 1001, Hasta = posHasta, Siguiente = 1001 },
            new NumeracionDian { TipoDocumento = DocumentoElectronico.Fev, Prefijo = "FE", Resolucion = "18760000002", Desde = 1, Hasta = 500, Siguiente = 1 });
        ctx.SaveChanges();
        return ctx;
    }

    private static async Task<CobroDto> CobrarAsync(RestauranteContext ctx, int pedidoId, Action<CrearCobroDto>? ajustar = null)
    {
        var dto = new CrearCobroDto { PedidoIds = { pedidoId } };
        ajustar?.Invoke(dto);
        var r = await Caja(ctx).Cobrar(dto);
        return (CobroDto)Assert.IsType<OkObjectResult>(r.Result).Value!;
    }

    private static DocumentoElectronico Doc(RestauranteContext ctx, string tipo) => ctx.DocumentosElectronicos.AsNoTracking().Single(d => d.Tipo == tipo);

    /// <summary>Proveedor que responde lo que diga la prueba y anota cada clave que recibe.</summary>
    private sealed class ProveedorDePrueba : IProveedorFacturacion
    {
        public Func<DocumentoParaEnviar, ResultadoEnvio> Responder = d => new ResultadoEnvio(EstadoEnvio.Validado, "cude-" + d.ClaveIdempotencia);
        public List<DocumentoParaEnviar> Recibidos { get; } = new();

        public Task<ResultadoEnvio> EnviarAsync(DocumentoParaEnviar documento, CancellationToken ct)
        {
            Recibidos.Add(documento);
            return Task.FromResult(Responder(documento));
        }
    }

    // ── Impuesto y consecutivo ────────────────────────────────────────────

    [Fact]
    public async Task Sin_facturacion_electronica_sigue_el_consecutivo_interno_y_se_discrimina_el_impuesto()
    {
        using var ctx = TestDb.Crear();
        Servido(ctx, 1, 2);

        var cobro = await CobrarAsync(ctx, 1, d => d.Propina = 5000);

        Assert.StartsWith(Facturacion.PrefijoConsecutivo, cobro.Factura.NumeroFactura);
        Assert.Empty(ctx.DocumentosElectronicos);
        // La carta ya incluye el impoconsumo del 8 %; la propina no entra en la base.
        Assert.Equal("Impoconsumo", cobro.Factura.NombreImpuesto);
        Assert.Equal(46296.30m, cobro.Factura.BaseImpuesto);
        Assert.Equal(3703.70m, cobro.Factura.ValorImpuesto);
        Assert.Equal(2 * Precio, cobro.Factura.BaseImpuesto + cobro.Factura.ValorImpuesto);
        Assert.Equal(2 * Precio + 5000, cobro.Factura.Total);
    }

    [Theory]
    [InlineData(ConfiguracionFiscal.Iva, 19, "IVA", 21008.40)]
    [InlineData(ConfiguracionFiscal.SinImpuesto, 0, null, 25000)]
    public void El_impuesto_sale_de_la_configuracion_del_restaurante(string tipo, decimal tarifa, string? nombre, decimal baseEsperada)
    {
        var f = new Factura { Subtotal = Precio };
        Facturacion.DiscriminarImpuesto(f, new ConfiguracionFiscal { TipoImpuesto = tipo, TarifaImpuesto = tarifa });

        Assert.Equal(nombre, f.NombreImpuesto);
        Assert.Equal(baseEsperada, f.BaseImpuesto);
        Assert.Equal(Precio, f.BaseImpuesto + f.ValorImpuesto);
    }

    [Theory]
    [InlineData("900123456", 8)]
    [InlineData("800197268", 4)] // NIT de la DIAN
    public void Digito_de_verificacion_del_nit(string nit, int esperado) => Assert.Equal(esperado, Facturacion.DigitoVerificacion(nit));

    // ── Numeración autorizada ─────────────────────────────────────────────

    [Fact]
    public async Task El_consumidor_final_recibe_pos_y_quien_se_identifica_factura_cada_uno_con_su_rango()
    {
        using var ctx = Electronica();
        Servido(ctx, 1);
        Servido(ctx, 2, mesa: TestDb.MesaDosId);

        var pos = await CobrarAsync(ctx, 1);
        var fev = await CobrarAsync(ctx, 2, d => (d.TipoIdCliente, d.NitCliente, d.NombreCliente, d.CorreoCliente) = ("NIT", "900123456-8", "Empresa SAS", "compras@empresa.co"));

        Assert.Equal("POS1001", pos.Factura.NumeroFactura);
        Assert.Equal("FE1", fev.Factura.NumeroFactura);
        Assert.Equal("NIT", fev.Factura.TipoIdCliente);
        Assert.Equal(DocumentoElectronico.Pendiente, Assert.Single(pos.Factura.Documentos).Estado);
        Assert.Equal("FEV-FE1", Doc(ctx, DocumentoElectronico.Fev).ClaveIdempotencia);
        Assert.Equal(1002, ctx.NumeracionesDian.AsNoTracking().Single(n => n.Prefijo == "POS").Siguiente);
    }

    [Theory]
    [InlineData("NIT", "900123456-7", "Empresa SAS", null)]    // dígito de verificación errado
    [InlineData("CC", "12ab", "Ana", null)]
    [InlineData("CC", "1102345678", null, null)]                // sin nombre
    [InlineData("CC", "1102345678", "Ana", "sin-arroba")]
    [InlineData("XX", "1102345678", "Ana", null)]
    public async Task Los_datos_de_la_factura_a_nombre_se_validan(string tipo, string nit, string? nombre, string? correo)
    {
        using var ctx = Electronica();
        Servido(ctx, 1);

        var r = await Caja(ctx).Cobrar(new CrearCobroDto { PedidoIds = { 1 }, TipoIdCliente = tipo, NitCliente = nit, NombreCliente = nombre, CorreoCliente = correo });

        Assert.IsType<BadRequestObjectResult>(r.Result);
        Assert.Empty(ctx.Facturas);
    }

    [Fact]
    public async Task Sin_numeracion_vigente_no_se_cobra_y_el_motivo_es_claro()
    {
        using var ctx = Electronica(posHasta: 1001);
        Servido(ctx, 1);
        Servido(ctx, 2, mesa: TestDb.MesaDosId);
        await CobrarAsync(ctx, 1); // gasta el único número

        var error = await Assert.ThrowsAsync<FacturacionException>(() => Caja(ctx).Cobrar(new CrearCobroDto { PedidoIds = { 2 } }));

        Assert.Contains("numeración DIAN vigente", error.Message);
        Assert.Single(ctx.Facturas.AsNoTracking());
    }

    [Fact]
    public void Un_rango_vencido_o_que_aun_no_empieza_no_esta_vigente()
    {
        var hoy = new DateTime(2026, 11, 14);
        var rango = new NumeracionDian { Desde = 1, Hasta = 10, Siguiente = 5, Activa = true };

        Assert.True(Facturacion.Vigente(rango, hoy));
        rango.FechaHasta = hoy.AddDays(-1);
        Assert.False(Facturacion.Vigente(rango, hoy));
        (rango.FechaHasta, rango.FechaDesde) = (null, hoy.AddDays(1));
        Assert.False(Facturacion.Vigente(rango, hoy));
        (rango.FechaDesde, rango.Siguiente) = (null, 11);
        Assert.False(Facturacion.Vigente(rango, hoy));
    }

    [Fact]
    public async Task El_pago_suelto_sin_documento_no_se_usa_con_facturacion_electronica()
    {
        using var ctx = Electronica();
        Servido(ctx, 1);

        var r = await Caja(ctx).PostPago(new CrearPagoDto { PedidoId = 1, Monto = Precio, MetodoPago = "Efectivo" });

        Assert.IsType<ConflictObjectResult>(r.Result);
        Assert.Empty(ctx.Pagos);
    }

    // ── Cola de documentos ────────────────────────────────────────────────

    [Fact]
    public async Task El_documento_se_valida_en_segundo_plano_con_todo_lo_que_el_proveedor_necesita()
    {
        using var ctx = Electronica();
        Servido(ctx, 1, 2);
        await CobrarAsync(ctx, 1, d => d.Propina = 5000);
        var proveedor = new ProveedorDePrueba();

        Assert.Equal(1, await DocumentosDian.ProcesarAsync(ctx, proveedor, DateTime.UtcNow));
        Assert.Equal(0, await DocumentosDian.ProcesarAsync(ctx, proveedor, DateTime.UtcNow)); // ya validado: no se reenvía

        var enviado = Assert.Single(proveedor.Recibidos);
        Assert.Equal(("POS-POS1001", "18760000001", "900123456"), (enviado.ClaveIdempotencia, enviado.Resolucion, enviado.Vendedor.Nit));
        Assert.Equal(2, Assert.Single(enviado.Factura.Items).Cantidad);
        Assert.Equal((50000m, 5000m, 55000m), (enviado.Factura.Subtotal, enviado.Factura.Propina, enviado.Factura.Total));
        var doc = Doc(ctx, DocumentoElectronico.Pos);
        Assert.Equal((DocumentoElectronico.Validado, "cude-POS-POS1001"), (doc.Estado, doc.Cufe));
    }

    [Fact]
    public async Task Si_el_proveedor_no_responde_la_caja_sigue_y_el_reintento_no_duplica()
    {
        using var ctx = Electronica();
        Servido(ctx, 1);
        await CobrarAsync(ctx, 1);
        var proveedor = new ProveedorDePrueba { Responder = _ => throw new HttpRequestException("tiempo de espera") };
        var ahora = DateTime.UtcNow;

        // Tres ciclos sin respuesta: sigue pendiente, con espera creciente, y entra en contingencia.
        for (var i = 1; i <= DocumentosDian.IntentosParaContingencia; i++)
        {
            Assert.Equal(0, await DocumentosDian.ProcesarAsync(ctx, proveedor, ahora));
            Assert.Equal(0, await DocumentosDian.ProcesarAsync(ctx, proveedor, ahora)); // aún no le toca
            Assert.Equal(i, proveedor.Recibidos.Count);
            ahora += DocumentosDian.Espera(i);
        }
        var pendiente = Doc(ctx, DocumentoElectronico.Pos);
        Assert.Equal(DocumentoElectronico.Pendiente, pendiente.Estado);
        Assert.True(DocumentosDian.ADto(pendiente).EnContingencia);

        proveedor.Responder = d => new ResultadoEnvio(EstadoEnvio.Validado, "cude-1");
        Assert.Equal(1, await DocumentosDian.ProcesarAsync(ctx, proveedor, ahora));

        // Siempre la misma clave: el proveedor reconoce el reintento y no crea otro documento.
        Assert.Single(proveedor.Recibidos.Select(r => r.ClaveIdempotencia).Distinct());
        Assert.Equal(DocumentoElectronico.Validado, Doc(ctx, DocumentoElectronico.Pos).Estado);
    }

    [Fact]
    public async Task Una_validacion_sin_codigo_no_se_da_por_buena()
    {
        using var ctx = Electronica();
        Servido(ctx, 1);
        await CobrarAsync(ctx, 1);

        await DocumentosDian.ProcesarAsync(ctx, new ProveedorDePrueba { Responder = _ => new ResultadoEnvio(EstadoEnvio.Validado) }, DateTime.UtcNow);

        Assert.Equal(DocumentoElectronico.Pendiente, Doc(ctx, DocumentoElectronico.Pos).Estado);
    }

    [Fact]
    public async Task Un_documento_rechazado_bloquea_el_cierre_hasta_reintentar_o_anular()
    {
        using var ctx = Electronica();
        Servido(ctx, 1);
        var cobro = await CobrarAsync(ctx, 1);
        var proveedor = new ProveedorDePrueba { Responder = _ => new ResultadoEnvio(EstadoEnvio.Rechazado, Mensaje: "Regla FAJ43: NIT del emisor no autorizado") };
        await DocumentosDian.ProcesarAsync(ctx, proveedor, DateTime.UtcNow);

        Assert.Equal("Regla FAJ43: NIT del emisor no autorizado", Doc(ctx, DocumentoElectronico.Pos).Mensaje);
        var hoy = HoraLocal.AhoraColombia().Date;
        Assert.IsType<ConflictObjectResult>((await Reportes(ctx).Cerrar(new CerrarCajaDto { Fecha = hoy, EfectivoContado = Precio })).Result);

        Assert.IsType<NoContentResult>(await Facturas(ctx).Reintentar(cobro.Factura.Id));
        proveedor.Responder = d => new ResultadoEnvio(EstadoEnvio.Validado, "cude-ok");
        await DocumentosDian.ProcesarAsync(ctx, proveedor, DateTime.UtcNow);

        Assert.Equal(DocumentoElectronico.Validado, Doc(ctx, DocumentoElectronico.Pos).Estado);
        Assert.IsNotType<ConflictObjectResult>((await Reportes(ctx).Cerrar(new CerrarCajaDto { Fecha = hoy, EfectivoContado = Precio })).Result);
    }

    [Fact]
    public async Task Anular_un_documento_rechazado_no_emite_nota_y_libera_el_cierre()
    {
        using var ctx = Electronica();
        Servido(ctx, 1);
        var cobro = await CobrarAsync(ctx, 1);
        var proveedor = new ProveedorDePrueba { Responder = _ => new ResultadoEnvio(EstadoEnvio.Rechazado, Mensaje: "Regla FAK21") };
        await DocumentosDian.ProcesarAsync(ctx, proveedor, DateTime.UtcNow);

        Assert.IsType<OkObjectResult>(await Facturas(ctx).Anular(cobro.Factura.Id, new AnularFacturaDto { Motivo = "La DIAN la rechazó y no se puede corregir" }));

        // Para la DIAN ese documento no existió: ni nota, ni reenvío, ni bloqueo del cierre.
        Assert.Equal(DocumentoElectronico.Pos, ctx.DocumentosElectronicos.AsNoTracking().Single().Tipo);
        Assert.IsType<ConflictObjectResult>(await Facturas(ctx).Reintentar(cobro.Factura.Id));
        Assert.IsNotType<ConflictObjectResult>((await Reportes(ctx).Cerrar(new CerrarCajaDto { Fecha = HoraLocal.AhoraColombia().Date, EfectivoContado = 0 })).Result);
    }

    [Fact]
    public async Task Una_nota_rechazada_de_una_venta_validada_bloquea_el_cierre_y_se_reenvia()
    {
        using var ctx = Electronica();
        Servido(ctx, 1);
        var cobro = await CobrarAsync(ctx, 1);
        var proveedor = new ProveedorDePrueba();
        await DocumentosDian.ProcesarAsync(ctx, proveedor, DateTime.UtcNow);
        await Facturas(ctx).Anular(cobro.Factura.Id, new AnularFacturaDto { Motivo = "Se cobró a la mesa equivocada" });
        proveedor.Responder = _ => new ResultadoEnvio(EstadoEnvio.Rechazado, Mensaje: "Regla NAA01");
        await DocumentosDian.ProcesarAsync(ctx, proveedor, DateTime.UtcNow);

        var hoy = HoraLocal.AhoraColombia().Date;
        Assert.IsType<ConflictObjectResult>((await Reportes(ctx).Cerrar(new CerrarCajaDto { Fecha = hoy, EfectivoContado = 0 })).Result);

        Assert.IsType<NoContentResult>(await Facturas(ctx).Reintentar(cobro.Factura.Id));
        proveedor.Responder = d => new ResultadoEnvio(EstadoEnvio.Validado, "cude-nota");
        await DocumentosDian.ProcesarAsync(ctx, proveedor, DateTime.UtcNow);
        Assert.Equal(DocumentoElectronico.Validado, Doc(ctx, DocumentoElectronico.NotaAjuste).Estado);
        Assert.IsNotType<ConflictObjectResult>((await Reportes(ctx).Cerrar(new CerrarCajaDto { Fecha = hoy, EfectivoContado = 0 })).Result);
    }

    [Fact]
    public async Task Sin_proveedor_conectado_no_se_activa_la_facturacion_electronica()
    {
        using var ctx = Electronica();
        var cfg = ctx.ConfiguracionFiscal.Single();
        cfg.FacturacionElectronica = false;
        ctx.SaveChanges();
        var dto = ctx.ConfiguracionFiscal.AsNoTracking().Single();
        dto.FacturacionElectronica = true;

        Assert.IsType<BadRequestObjectResult>(await TestDb.ComoAdmin(new FiscalController(ctx, new ProveedorSinConfigurar())).Put(dto));
        Assert.IsType<NoContentResult>(await TestDb.ComoAdmin(new FiscalController(ctx, new ProveedorDePrueba())).Put(dto));
    }

    // ── Anulación ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Anular_reversa_la_venta_con_nota_de_ajuste_y_no_reutiliza_el_numero()
    {
        using var ctx = Electronica();
        Servido(ctx, 1);
        Servido(ctx, 2, mesa: TestDb.MesaDosId);
        var cobro = await CobrarAsync(ctx, 1);
        var proveedor = new ProveedorDePrueba();
        var hoy = HoraLocal.AhoraColombia().Date;
        Assert.Equal(Precio, (await Reportes(ctx).Cierre(hoy)).Value!.VentasMesa);

        Assert.IsType<BadRequestObjectResult>(await Facturas(ctx).Anular(cobro.Factura.Id, new AnularFacturaDto { Motivo = "x" }));
        Assert.IsType<OkObjectResult>(await Facturas(ctx).Anular(cobro.Factura.Id, new AnularFacturaDto { Motivo = "Se cobró a la mesa equivocada" }));
        Assert.IsType<ConflictObjectResult>(await Facturas(ctx).Anular(cobro.Factura.Id, new AnularFacturaDto { Motivo = "Otra vez la misma" }));

        // La nota espera a que la DIAN conozca el documento original y lo cita.
        await DocumentosDian.ProcesarAsync(ctx, proveedor, DateTime.UtcNow);
        await DocumentosDian.ProcesarAsync(ctx, proveedor, DateTime.UtcNow);
        Assert.Equal(new[] { DocumentoElectronico.Pos, DocumentoElectronico.NotaAjuste }, proveedor.Recibidos.Select(r => r.Tipo));
        Assert.Equal("cude-POS-POS1001", proveedor.Recibidos[1].Referencia!.Cufe);
        Assert.Equal("Se cobró a la mesa equivocada", proveedor.Recibidos[1].Motivo);
        Assert.Single(proveedor.Recibidos[1].Factura.Items);

        var anulada = ctx.Facturas.AsNoTracking().Single();
        Assert.True(anulada.Anulada);
        Assert.Equal(TestDb.AdminId, anulada.UsuarioAnulaId);
        Assert.Equal(0, (await Reportes(ctx).Cierre(hoy)).Value!.VentasMesa);
        Assert.Equal("POS1002", (await CobrarAsync(ctx, 2)).Factura.NumeroFactura);
        Assert.Single(ctx.Pagos.AsNoTracking().Where(p => p.FacturaId == anulada.Id)); // nada se borra
    }

    [Fact]
    public async Task Corregir_el_cliente_anula_y_vuelve_a_facturar_sin_perder_la_venta()
    {
        using var ctx = Electronica();
        Servido(ctx, 1, 2);
        var cobro = await CobrarAsync(ctx, 1);

        var r = await Facturas(ctx).Anular(cobro.Factura.Id, new AnularFacturaDto
        {
            Motivo = "El cliente pidió factura a nombre de su empresa",
            NuevoCliente = new ClienteFacturaDto { TipoId = "NIT", Nit = "900123456-8", Nombre = "Empresa SAS", Correo = "compras@empresa.co" }
        });

        Assert.IsType<OkObjectResult>(r);
        var nueva = ctx.Facturas.AsNoTracking().Single(f => !f.Anulada);
        Assert.Equal(("FE1", cobro.Factura.Id, 2 * Precio), (nueva.NumeroFactura, nueva.ReemplazaAId, nueva.Total));
        Assert.All(ctx.Pagos.AsNoTracking(), p => Assert.Equal(nueva.Id, p.FacturaId));
        Assert.All(ctx.PedidoDetalles.AsNoTracking(), d => Assert.Equal(nueva.Id, d.FacturaId));
        Assert.Equal(2 * Precio, (await Reportes(ctx).Cierre(HoraLocal.AhoraColombia().Date)).Value!.VentasMesa);
        Assert.Equal(new[] { DocumentoElectronico.Pos, DocumentoElectronico.NotaAjuste, DocumentoElectronico.Fev },
            ctx.DocumentosElectronicos.AsNoTracking().OrderBy(d => d.Id).Select(d => d.Tipo));

        // La nota de la factura anulada conserva los platos aunque ya pertenezcan a la nueva.
        var proveedor = new ProveedorDePrueba();
        await DocumentosDian.ProcesarAsync(ctx, proveedor, DateTime.UtcNow);
        await DocumentosDian.ProcesarAsync(ctx, proveedor, DateTime.UtcNow);
        Assert.Equal(2, proveedor.Recibidos.Single(d => d.Tipo == DocumentoElectronico.NotaAjuste).Factura.Items.Single().Cantidad);
    }

    [Fact]
    public async Task Con_la_caja_del_dia_cerrada_no_se_anula()
    {
        using var ctx = Electronica();
        Servido(ctx, 1);
        var cobro = await CobrarAsync(ctx, 1);
        await DocumentosDian.ProcesarAsync(ctx, new ProveedorDePrueba(), DateTime.UtcNow);
        Assert.IsNotType<ConflictObjectResult>((await Reportes(ctx).Cerrar(new CerrarCajaDto { Fecha = HoraLocal.AhoraColombia().Date, EfectivoContado = Precio })).Result);

        var r = await Facturas(ctx).Anular(cobro.Factura.Id, new AnularFacturaDto { Motivo = "Error al cobrar la cuenta" });

        Assert.IsType<ConflictObjectResult>(r);
        Assert.False(ctx.Facturas.AsNoTracking().Single().Anulada);
    }

    // ── Datos fiscales ────────────────────────────────────────────────────

    [Fact]
    public async Task No_se_activa_la_facturacion_electronica_sin_datos_ni_numeracion()
    {
        using var ctx = TestDb.Crear();
        var config = new ConfiguracionFiscal { RazonSocial = "Restaurante SAS", Nit = "900123456", DigitoVerificacion = "8", Direccion = "Calle 1", Municipio = "Sincelejo", FacturacionElectronica = true };

        Assert.IsType<BadRequestObjectResult>(await Fiscal(ctx).Put(config));

        var rango = new FiscalController.NumeracionDto { TipoDocumento = DocumentoElectronico.Pos, Prefijo = "pos", Desde = 1, Hasta = 100 };
        Assert.IsType<OkObjectResult>(await Fiscal(ctx).GuardarNumeracion(rango));
        Assert.IsType<ConflictObjectResult>(await Fiscal(ctx).GuardarNumeracion(new FiscalController.NumeracionDto { TipoDocumento = DocumentoElectronico.Fev, Prefijo = "POS", Desde = 50, Hasta = 200 }));
        Assert.IsType<OkObjectResult>(await Fiscal(ctx).GuardarNumeracion(new FiscalController.NumeracionDto { TipoDocumento = DocumentoElectronico.Fev, Prefijo = "FE", Desde = 1, Hasta = 100 }));

        Assert.IsType<NoContentResult>(await Fiscal(ctx).Put(config));
        Assert.True(ctx.ConfiguracionFiscal.AsNoTracking().Single().FacturacionElectronica);

        config.DigitoVerificacion = "1";
        Assert.IsType<BadRequestObjectResult>(await Fiscal(ctx).Put(config));
    }

    [Fact]
    public async Task Una_numeracion_usada_no_cambia_de_prefijo_ni_baja_su_tope()
    {
        using var ctx = Electronica();
        Servido(ctx, 1);
        Servido(ctx, 2, mesa: TestDb.MesaDosId);
        await CobrarAsync(ctx, 1);
        await CobrarAsync(ctx, 2);
        var id = ctx.NumeracionesDian.AsNoTracking().Single(n => n.Prefijo == "POS").Id;
        FiscalController.NumeracionDto Rango(string prefijo, long hasta) => new() { Id = id, TipoDocumento = DocumentoElectronico.Pos, Prefijo = prefijo, Desde = 1001, Hasta = hasta };

        Assert.IsType<ConflictObjectResult>(await Fiscal(ctx).GuardarNumeracion(Rango("XYZ", 1100)));
        Assert.IsType<ConflictObjectResult>(await Fiscal(ctx).GuardarNumeracion(Rango("POS", 1001)));
        Assert.IsType<OkObjectResult>(await Fiscal(ctx).GuardarNumeracion(Rango("POS", 2000)));
        Assert.Equal(1003, ctx.NumeracionesDian.AsNoTracking().Single(n => n.Id == id).Siguiente);
    }
}
