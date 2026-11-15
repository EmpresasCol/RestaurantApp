using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Dtos;
using RestaurantApi.Hubs;
using RestaurantApi.Models;

namespace RestaurantApi.Services
{
    public enum EstadoEnvio { Validado, Rechazado, Reintentar }

    /// <summary>Respuesta del proveedor tecnológico. Reintentar = no hubo respuesta definitiva (caída, tiempo de espera).</summary>
    public record ResultadoEnvio(EstadoEnvio Estado, string? Cufe = null, string? Mensaje = null, string? UrlPdf = null, string? UrlXml = null, string? QrUrl = null);

    /// <summary>Todo lo que el proveedor necesita para armar, firmar y transmitir un documento.</summary>
    public record DocumentoParaEnviar(
        string ClaveIdempotencia, string Tipo, string Prefijo, long Numero, string? Resolucion,
        ConfiguracionFiscal Vendedor, FacturaDto Factura, DocumentoElectronico? Referencia, string? Motivo);

    /// <summary>
    /// Proveedor tecnológico habilitado por la DIAN. Debe ser idempotente por
    /// <see cref="DocumentoParaEnviar.ClaveIdempotencia"/>: el mismo documento puede llegar más de una vez.
    /// </summary>
    public interface IProveedorFacturacion
    {
        Task<ResultadoEnvio> EnviarAsync(DocumentoParaEnviar documento, CancellationToken ct);
    }

    /// <summary>Sin proveedor contratado: los documentos esperan en la cola, no se pierden.</summary>
    public class ProveedorSinConfigurar : IProveedorFacturacion
    {
        public Task<ResultadoEnvio> EnviarAsync(DocumentoParaEnviar documento, CancellationToken ct)
            => Task.FromResult(new ResultadoEnvio(EstadoEnvio.Reintentar, Mensaje: "El proveedor de facturación electrónica no está configurado"));
    }

    /// <summary>Para desarrollo y pruebas: valida todo con un código de mentira. Nunca se registra en producción.</summary>
    public class ProveedorSimulado : IProveedorFacturacion
    {
        public const string Aviso = "Documento de prueba: sin validez ante la DIAN";

        public Task<ResultadoEnvio> EnviarAsync(DocumentoParaEnviar d, CancellationToken ct)
        {
            var cufe = Convert.ToHexString(SHA384.HashData(Encoding.UTF8.GetBytes("SIMULADO-" + d.ClaveIdempotencia))).ToLowerInvariant();
            return Task.FromResult(new ResultadoEnvio(EstadoEnvio.Validado, cufe, Aviso,
                QrUrl: $"https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey={cufe}"));
        }
    }

    /// <summary>Cola de documentos electrónicos: anulación, armado del envío y transmisión.</summary>
    public static class DocumentosDian
    {
        public const int IntentosParaContingencia = 3;
        public const int LotePorCiclo = 20;

        public static DocumentoElectronicoDto ADto(DocumentoElectronico d) => new()
        {
            Id = d.Id,
            Tipo = d.Tipo,
            Numero = $"{d.Prefijo}{d.Numero}",
            Estado = d.Estado,
            EnContingencia = d.Estado == DocumentoElectronico.Pendiente && d.Intentos >= IntentosParaContingencia,
            Cufe = d.Cufe,
            Mensaje = d.Mensaje,
            UrlPdf = d.UrlPdf,
            QrUrl = d.QrUrl,
            FechaValidacion = d.FechaValidacion
        };

        private static bool EsVenta(string tipo) => tipo is DocumentoElectronico.Pos or DocumentoElectronico.Fev;

        /// <summary>
        /// Rechazados que alguien debe resolver antes de cerrar la caja. Una factura anulada cuyo
        /// documento de venta nunca validó la DIAN no deja nada pendiente: para la DIAN no existió.
        /// </summary>
        public static IQueryable<DocumentoElectronico> PorResolver(RestauranteContext ctx)
            => ctx.DocumentosElectronicos.Where(d => d.Estado == DocumentoElectronico.Rechazado
                && !(d.Factura!.Anulada && !ctx.DocumentosElectronicos.Any(o => o.FacturaId == d.FacturaId
                    && (o.Tipo == DocumentoElectronico.Pos || o.Tipo == DocumentoElectronico.Fev) && o.Estado == DocumentoElectronico.Validado)));

        /// <summary>
        /// Anula una factura sin borrar nada: queda marcada con motivo y usuario y, si ya tenía
        /// documento electrónico, se encola su nota (de ajuste para el POS, crédito para la factura).
        /// Con <paramref name="nuevoCliente"/> la venta sigue en pie y pasa a una factura nueva a
        /// nombre de ese cliente; sin él, la venta se reversa y sale de los reportes y del cierre.
        /// Solo mientras la caja de ese día esté abierta. Devuelve la factura de reemplazo o el error.
        /// </summary>
        public static async Task<(Factura? Reemplazo, string? Error)> AnularAsync(
            RestauranteContext ctx, int facturaId, string motivo, int? usuarioId, ClienteFacturaDto? nuevoCliente)
        {
            var relacional = ctx.Database.IsRelational();
            await using var tx = relacional
                ? await ctx.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted)
                : await ctx.Database.BeginTransactionAsync();
            if (relacional)
                await ctx.Database.ExecuteSqlInterpolatedAsync($"SELECT Id FROM Facturas WHERE Id = {facturaId} FOR UPDATE");

            var f = await ctx.Facturas.FirstOrDefaultAsync(x => x.Id == facturaId);
            if (f == null) return (null, "Esa factura no existe");
            if (relacional) await ctx.Entry(f).ReloadAsync();
            if (f.Anulada) return (null, $"La factura {f.NumeroFactura} ya está anulada");

            var dia = (f.FechaEmision + HoraLocal.OffsetColombia).Date;
            if (await ctx.CierresCaja.AnyAsync(c => c.FechaCaja == dia && c.FechaCierre != null))
                return (null, $"La caja del {dia:dd/MM/yyyy} ya se cerró. Pide al administrador que la reabra para anular esta factura.");

            f.Anulada = true;
            f.FechaAnulacion = DateTime.UtcNow;
            f.MotivoAnulacion = motivo;
            f.UsuarioAnulaId = usuarioId;

            var original = await ctx.DocumentosElectronicos
                .Where(d => d.FacturaId == f.Id && (d.Tipo == DocumentoElectronico.Pos || d.Tipo == DocumentoElectronico.Fev))
                .OrderBy(d => d.Id).FirstOrDefaultAsync();
            // Un documento que la DIAN rechazó no existe para ella: no hay nada que anular con una nota.
            if (original != null && original.Estado != DocumentoElectronico.Rechazado)
            {
                // Candado de los consecutivos de notas: dos anulaciones a la vez no toman el mismo.
                if (relacional)
                    await ctx.Database.ExecuteSqlRawAsync("SELECT Id FROM ConfiguracionFiscal FOR UPDATE");
                var tipo = original.Tipo == DocumentoElectronico.Fev ? DocumentoElectronico.NotaCredito : DocumentoElectronico.NotaAjuste;
                var prefijo = tipo == DocumentoElectronico.NotaCredito ? "NC" : "NA";
                var numero = (await ctx.DocumentosElectronicos.Where(d => d.Tipo == tipo).MaxAsync(d => (long?)d.Numero) ?? 0) + 1;
                ctx.DocumentosElectronicos.Add(new DocumentoElectronico
                {
                    FacturaId = f.Id, Tipo = tipo, Prefijo = prefijo, Numero = numero,
                    DocumentoReferenciaId = original.Id, Motivo = motivo,
                    ClaveIdempotencia = $"{tipo}-{prefijo}{numero}",
                    FechaGeneracion = DateTime.UtcNow, ProximoIntento = DateTime.UtcNow
                });
            }

            Factura? nueva = null;
            if (nuevoCliente != null)
            {
                nueva = new Factura
                {
                    PagoId = f.PagoId, DomicilioId = f.DomicilioId, Subtotal = f.Subtotal, Propina = f.Propina, Total = f.Total,
                    FechaEmision = DateTime.UtcNow, ReemplazaAId = f.Id
                };
                Facturacion.AsignarCliente(nueva, nuevoCliente.Nit, nuevoCliente.Nombre, nuevoCliente.TipoId, nuevoCliente.Correo);
                f.DomicilioId = null; // el índice único del domicilio pasa a la factura nueva
                await ctx.SaveChangesAsync();
                await Facturacion.EmitirAsync(ctx, nueva);

                // Lo cobrado (pagos, platos y avisos del mesero) queda ligado a la factura vigente.
                foreach (var p in await ctx.Pagos.Where(p => p.FacturaId == f.Id).ToListAsync()) p.FacturaId = nueva.Id;
                foreach (var d in await ctx.PedidoDetalles.Where(d => d.FacturaId == f.Id).ToListAsync()) d.FacturaId = nueva.Id;
                foreach (var a in await ctx.PagosAvisados.Where(a => a.FacturaId == f.Id).ToListAsync()) a.FacturaId = nueva.Id;
                foreach (var s in await ctx.SolicitudesCuenta.Where(s => s.FacturaId == f.Id).ToListAsync()) s.FacturaId = nueva.Id;
            }

            await ctx.SaveChangesAsync();
            await tx.CommitAsync();
            return (nueva, null);
        }

        /// <summary>Vuelve a poner en cola los documentos rechazados de la factura (ya corregida la causa).</summary>
        public static async Task<int> ReencolarAsync(RestauranteContext ctx, int facturaId)
        {
            // De una factura anulada solo se reenvía la nota: su venta rechazada no debe llegar a validarse.
            var rechazados = await PorResolver(ctx).Where(d => d.FacturaId == facturaId).ToListAsync();
            foreach (var d in rechazados)
                (d.Estado, d.ProximoIntento, d.Mensaje) = (DocumentoElectronico.Pendiente, DateTime.UtcNow, null);
            await ctx.SaveChangesAsync();
            return rechazados.Count;
        }

        private static async Task<DocumentoParaEnviar> ParaEnviarAsync(RestauranteContext db, DocumentoElectronico doc, ConfiguracionFiscal vendedor)
        {
            var factura = (await Facturacion.ConDetalleAsync(db, new List<Factura> { doc.Factura! }))[0];
            // Una factura reemplazada cedió sus platos y pagos a la nueva: la nota los toma de ahí.
            if (factura.Items.Count == 0 && doc.Factura!.Anulada)
            {
                var reemplazo = await db.Facturas.AsNoTracking().FirstOrDefaultAsync(f => f.ReemplazaAId == doc.FacturaId);
                if (reemplazo != null)
                {
                    var actual = (await Facturacion.ConDetalleAsync(db, new List<Factura> { reemplazo }))[0];
                    (factura.Items, factura.Pagos, factura.MetodoPago) = (actual.Items, actual.Pagos, actual.MetodoPago);
                }
            }
            var resolucion = await db.NumeracionesDian.AsNoTracking()
                .Where(n => n.TipoDocumento == doc.Tipo && n.Prefijo == doc.Prefijo && n.Desde <= doc.Numero && n.Hasta >= doc.Numero)
                .Select(n => n.Resolucion).FirstOrDefaultAsync();
            var referencia = doc.DocumentoReferenciaId == null ? null
                : await db.DocumentosElectronicos.AsNoTracking().FirstOrDefaultAsync(d => d.Id == doc.DocumentoReferenciaId);
            return new DocumentoParaEnviar(doc.ClaveIdempotencia, doc.Tipo, doc.Prefijo, doc.Numero, resolucion, vendedor, factura, referencia, doc.Motivo);
        }

        /// <summary>Espera creciente entre intentos: 30 s, 1 min, 2 min… hasta 30 min.</summary>
        public static TimeSpan Espera(int intentos)
            => TimeSpan.FromSeconds(Math.Min(30 * Math.Pow(2, Math.Clamp(intentos - 1, 0, 10)), 1800));

        /// <summary>
        /// Envía los documentos pendientes que ya tocan. Cada uno se guarda por separado: una caída
        /// a mitad del lote no repite los ya resueltos. Devuelve cuántos cambiaron de estado.
        /// </summary>
        public static async Task<int> ProcesarAsync(RestauranteContext db, IProveedorFacturacion proveedor, DateTime ahora, CancellationToken ct = default)
        {
            var vendedor = await Facturacion.ConfiguracionAsync(db);
            if (vendedor == null) return 0;

            var pendientes = await db.DocumentosElectronicos.Include(d => d.Factura)
                .Where(d => d.Estado == DocumentoElectronico.Pendiente && (d.ProximoIntento == null || d.ProximoIntento <= ahora))
                .OrderBy(d => d.Id).Take(LotePorCiclo).ToListAsync(ct);

            var resueltos = 0;
            foreach (var doc in pendientes)
            {
                ct.ThrowIfCancellationRequested();
                ResultadoEnvio r;
                if (!EsVenta(doc.Tipo))
                {
                    // Una nota va después de su documento: la DIAN debe conocer primero el original.
                    var estadoOriginal = await db.DocumentosElectronicos.AsNoTracking()
                        .Where(d => d.Id == doc.DocumentoReferenciaId).Select(d => d.Estado).FirstOrDefaultAsync(ct);
                    if (estadoOriginal == DocumentoElectronico.Pendiente)
                    {
                        doc.ProximoIntento = ahora.AddSeconds(30); // no ocupa el lote mientras espera
                        await db.SaveChangesAsync(ct);
                        continue;
                    }
                    if (estadoOriginal != DocumentoElectronico.Validado)
                    {
                        (doc.Estado, doc.Mensaje) = (DocumentoElectronico.Rechazado, "La DIAN rechazó el documento original: no hay nada que anular ante ella");
                        await db.SaveChangesAsync(ct);
                        resueltos++;
                        continue;
                    }
                }

                try
                {
                    r = await proveedor.EnviarAsync(await ParaEnviarAsync(db, doc, vendedor), ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
                {
                    r = new ResultadoEnvio(EstadoEnvio.Reintentar, Mensaje: "Sin respuesta del proveedor: " + ex.Message);
                }

                doc.Intentos++;
                doc.Mensaje = r.Mensaje?.Length > 500 ? r.Mensaje[..500] : r.Mensaje;
                switch (r.Estado)
                {
                    case EstadoEnvio.Validado when !string.IsNullOrWhiteSpace(r.Cufe):
                        (doc.Estado, doc.Cufe, doc.UrlPdf, doc.UrlXml, doc.QrUrl, doc.FechaValidacion, doc.ProximoIntento)
                            = (DocumentoElectronico.Validado, r.Cufe, r.UrlPdf, r.UrlXml, r.QrUrl, ahora, null);
                        resueltos++;
                        break;
                    case EstadoEnvio.Rechazado:
                        (doc.Estado, doc.ProximoIntento) = (DocumentoElectronico.Rechazado, null);
                        resueltos++;
                        break;
                    default:
                        // Sin código no hay validación: se trata como falta de respuesta.
                        doc.ProximoIntento = ahora + Espera(doc.Intentos);
                        break;
                }
                await db.SaveChangesAsync(ct);
            }
            return resueltos;
        }
    }

    /// <summary>Servicio en segundo plano que vacía la cola de documentos electrónicos.</summary>
    public class EnvioDocumentos : BackgroundService
    {
        private static readonly TimeSpan Ciclo = TimeSpan.FromSeconds(15);
        private readonly IServiceScopeFactory _scopes;
        private readonly IHubContext<QproHub> _hub;
        private readonly ILogger<EnvioDocumentos> _logger;

        public EnvioDocumentos(IServiceScopeFactory scopes, IHubContext<QproHub> hub, ILogger<EnvioDocumentos> logger)
        {
            _scopes = scopes;
            _hub = hub;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<RestauranteContext>();
                    var proveedor = scope.ServiceProvider.GetRequiredService<IProveedorFacturacion>();
                    if (await DocumentosDian.ProcesarAsync(db, proveedor, DateTime.UtcNow, ct) > 0)
                        await _hub.Clients.All.SendAsync("cambio", TemaRealtime.Pedidos, ct); // la caja recarga sus facturas
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Falló el envío de documentos electrónicos; se reintenta en el próximo ciclo");
                }
                try { await Task.Delay(Ciclo, ct); } catch (OperationCanceledException) { }
            }
        }
    }
}
