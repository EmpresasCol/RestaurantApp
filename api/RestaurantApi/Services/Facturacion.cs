using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Dtos;
using RestaurantApi.Models;

namespace RestaurantApi.Services
{
    /// <summary>Regla de facturación que impide la operación; la API responde 409 con este mensaje.</summary>
    public class FacturacionException : Exception
    {
        public FacturacionException(string mensaje) : base(mensaje) { }
    }

    /// <summary>Consecutivo, datos del cliente y detalle de las facturas de caja.</summary>
    public static class Facturacion
    {
        // Consecutivo propio: FV-00000001, FV-00000002… (las facturas antiguas "FAC-…" se conservan).
        public const string PrefijoConsecutivo = "FV-";
        public const string NitConsumidorFinal = "222222222222";
        public const string NombreConsumidorFinal = "Consumidor final";

        /// <summary>Cédula o NIT: dígitos, con guion opcional antes del dígito de verificación.</summary>
        public static string? ValidarCliente(string? nit, string? nombre)
        {
            if (!string.IsNullOrWhiteSpace(nit) && !Regex.IsMatch(nit.Trim(), @"^\d{5,15}(-\d)?$"))
                return "La cédula o NIT solo lleva números (y un guion antes del dígito de verificación)";
            if (nombre?.Trim().Length > 150)
                return "El nombre del cliente admite máximo 150 caracteres";
            return null;
        }

        public static void AsignarCliente(Factura f, string? nit, string? nombre)
        {
            f.NitCliente = string.IsNullOrWhiteSpace(nit) ? NitConsumidorFinal : nit.Trim();
            f.NombreCliente = string.IsNullOrWhiteSpace(nombre) ? NombreConsumidorFinal : nombre.Trim();
        }

        public static readonly string[] TiposId = { "CC", "NIT", "CE", "TI", "PA" };

        /// <summary>
        /// Datos de quien pide factura a su nombre. La cédula o el NIT llevan solo números; cédula
        /// de extranjería y pasaporte admiten letras. Un NIT con dígito de verificación se comprueba.
        /// </summary>
        public static string? ValidarCliente(string? nit, string? nombre, string? tipoId, string? correo)
        {
            tipoId = string.IsNullOrWhiteSpace(tipoId) ? null : tipoId.Trim().ToUpperInvariant();
            if (tipoId != null && !TiposId.Contains(tipoId))
                return "Tipo de identificación inválido";
            if (nombre?.Trim().Length > 150)
                return "El nombre del cliente admite máximo 150 caracteres";
            if (!string.IsNullOrWhiteSpace(correo) && (correo.Trim().Length > 150 || !Regex.IsMatch(correo.Trim(), @"^[^@\s]+@[^@\s]+\.[^@\s]+$")))
                return "El correo del cliente no es válido";
            if (string.IsNullOrWhiteSpace(nit))
                return tipoId != null || !string.IsNullOrWhiteSpace(correo) ? "Escribe el número de identificación del cliente" : null;

            nit = nit.Trim();
            if (tipoId != null && string.IsNullOrWhiteSpace(nombre))
                return "Escribe el nombre o la razón social del cliente";
            if (tipoId is "CE" or "PA")
                return Regex.IsMatch(nit, @"^[A-Za-z0-9]{4,20}$") ? null : "El documento solo lleva letras y números";
            if (ValidarCliente(nit, nombre) is { } error)
                return error;
            if (tipoId == "NIT" && nit.Contains('-') && nit[^1] - '0' != DigitoVerificacion(nit[..^2]))
                return "El dígito de verificación del NIT no coincide";
            return null;
        }

        /// <summary>Dígito de verificación de un NIT (módulo 11 con los pesos de la DIAN).</summary>
        public static int DigitoVerificacion(string nit)
        {
            int[] pesos = { 3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71 };
            var suma = nit.Reverse().Select((c, i) => (c - '0') * pesos[i]).Sum();
            var resto = suma % 11;
            return resto > 1 ? 11 - resto : resto;
        }

        public static void AsignarCliente(Factura f, string? nit, string? nombre, string? tipoId, string? correo)
        {
            AsignarCliente(f, nit, nombre);
            var identificado = !string.IsNullOrWhiteSpace(nit);
            f.TipoIdCliente = !identificado ? null : string.IsNullOrWhiteSpace(tipoId) ? "CC" : tipoId.Trim().ToUpperInvariant();
            f.CorreoCliente = identificado && !string.IsNullOrWhiteSpace(correo) ? correo.Trim() : null;
        }

        public static Task<ConfiguracionFiscal?> ConfiguracionAsync(RestauranteContext ctx)
            => ctx.ConfiguracionFiscal.AsNoTracking().FirstOrDefaultAsync();

        /// <summary>
        /// Separa el impuesto del precio (la carta ya lo incluye): base + impuesto = consumo. La
        /// propina no entra en la base. Sin configuración se asume impoconsumo del 8 %.
        /// </summary>
        public static void DiscriminarImpuesto(Factura f, ConfiguracionFiscal? cfg)
        {
            var tipo = cfg?.TipoImpuesto ?? ConfiguracionFiscal.Inc;
            var tarifa = cfg?.TarifaImpuesto ?? 8;
            if (tipo == ConfiguracionFiscal.SinImpuesto || tarifa <= 0)
            {
                (f.NombreImpuesto, f.TarifaImpuesto, f.BaseImpuesto, f.ValorImpuesto) = (null, 0, f.Subtotal, 0);
                return;
            }
            f.NombreImpuesto = tipo == ConfiguracionFiscal.Iva ? "IVA" : "Impoconsumo";
            f.TarifaImpuesto = tarifa;
            f.BaseImpuesto = Math.Round(f.Subtotal / (1 + tarifa / 100), 2, MidpointRounding.AwayFromZero);
            f.ValorImpuesto = f.Subtotal - f.BaseImpuesto;
        }

        /// <summary>Factura electrónica si el cliente se identificó; si no, el documento del consumidor final.</summary>
        public static string TipoDocumento(Factura f, ConfiguracionFiscal cfg)
            => f.NitCliente != null && f.NitCliente != NitConsumidorFinal ? DocumentoElectronico.Fev : cfg.DocumentoConsumidorFinal;

        public static string NombreTipo(string tipo) => tipo switch
        {
            DocumentoElectronico.Pos => "documento equivalente POS",
            DocumentoElectronico.Fev => "factura electrónica",
            DocumentoElectronico.NotaAjuste => "nota de ajuste",
            _ => "nota crédito"
        };

        /// <summary>Rango vigente hoy: activo, dentro de sus fechas y con números por entregar.</summary>
        public static bool Vigente(NumeracionDian n, DateTime hoyColombia)
            => n.Activa && n.Siguiente <= n.Hasta
               && (n.FechaDesde == null || n.FechaDesde.Value.Date <= hoyColombia.Date)
               && (n.FechaHasta == null || n.FechaHasta.Value.Date >= hoyColombia.Date);

        /// <summary>
        /// Entrega el siguiente número autorizado del tipo, con candado sobre los rangos: dos cajas
        /// a la vez nunca reciben el mismo. Requiere una transacción abierta. No guarda.
        /// </summary>
        private static async Task<NumeracionDian> TomarNumeroAsync(RestauranteContext ctx, string tipo)
        {
            if (ctx.Database.IsRelational())
                await ctx.Database.ExecuteSqlInterpolatedAsync($"SELECT Id FROM NumeracionesDian WHERE TipoDocumento = {tipo} FOR UPDATE");
            var hoy = HoraLocal.AhoraColombia();
            var rangos = await ctx.NumeracionesDian.Where(n => n.TipoDocumento == tipo && n.Activa).OrderBy(n => n.Id).ToListAsync();
            foreach (var r in rangos) await ctx.Entry(r).ReloadAsync(); // lo confirmado por quien tenía el candado
            return rangos.FirstOrDefault(n => Vigente(n, hoy))
                ?? throw new FacturacionException($"No hay numeración DIAN vigente para {NombreTipo(tipo)}: el rango se agotó o venció. Regístrala en Datos fiscales para seguir cobrando.");
        }

        /// <summary>
        /// Guarda la factura con su número. Con facturación electrónica toma el número autorizado
        /// por la DIAN y deja el documento en cola para el proveedor en la misma transacción; sin
        /// ella usa el consecutivo interno (si dos cajas chocan, reintenta).
        /// </summary>
        public static async Task EmitirAsync(RestauranteContext ctx, Factura factura)
        {
            var cfg = await ConfiguracionAsync(ctx);
            DiscriminarImpuesto(factura, cfg);

            if (cfg?.FacturacionElectronica == true)
            {
                await using var propia = ctx.Database.CurrentTransaction != null ? null
                    : ctx.Database.IsRelational() ? await ctx.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted)
                    : await ctx.Database.BeginTransactionAsync();
                var tipo = TipoDocumento(factura, cfg);
                var rango = await TomarNumeroAsync(ctx, tipo);
                var numero = rango.Siguiente++;
                factura.NumeroFactura = $"{rango.Prefijo}{numero}";
                ctx.DocumentosElectronicos.Add(new DocumentoElectronico
                {
                    Factura = factura, Tipo = tipo, Prefijo = rango.Prefijo, Numero = numero,
                    ClaveIdempotencia = $"{tipo}-{rango.Prefijo}{numero}",
                    FechaGeneracion = DateTime.UtcNow, ProximoIntento = DateTime.UtcNow
                });
                await ctx.SaveChangesAsync();
                if (propia != null) await propia.CommitAsync();
                return;
            }

            for (var intento = 0; ; intento++)
            {
                factura.NumeroFactura = await SiguienteNumeroAsync(ctx);
                ctx.Facturas.Add(factura);
                try
                {
                    await ctx.SaveChangesAsync();
                    return;
                }
                catch (DbUpdateException) when (intento < 2)
                {
                    ctx.Entry(factura).State = EntityState.Detached;
                }
            }
        }

        private static async Task<string> SiguienteNumeroAsync(RestauranteContext ctx)
        {
            // Ancho fijo: el orden alfabético coincide con el numérico.
            var ultimo = await ctx.Facturas
                .Where(f => f.NumeroFactura.StartsWith(PrefijoConsecutivo))
                .OrderByDescending(f => f.NumeroFactura)
                .Select(f => f.NumeroFactura)
                .FirstOrDefaultAsync();

            var n = ultimo != null && int.TryParse(ultimo[PrefijoConsecutivo.Length..], out var actual) ? actual + 1 : 1;
            return $"{PrefijoConsecutivo}{n:D8}";
        }

        /// <summary>
        /// Factura del domicilio: se emite al entregarlo y cobrarlo, a nombre del cliente.
        /// Si ya existe (se marcó entregado dos veces), devuelve la misma.
        /// </summary>
        public static async Task<Factura> EmitirDomicilioAsync(RestauranteContext ctx, Domicilio d, string nombreCliente)
        {
            var existente = await ctx.Facturas.FirstOrDefaultAsync(f => f.DomicilioId == d.Id);
            if (existente != null)
            {
                await ctx.SaveChangesAsync();
                return existente;
            }

            var factura = new Factura
            {
                DomicilioId = d.Id,
                Subtotal = d.Subtotal + d.CostoEnvio,
                Propina = 0,
                Total = d.Subtotal + d.CostoEnvio,
                FechaEmision = d.FechaEntrega ?? DateTime.UtcNow
            };
            AsignarCliente(factura, null, nombreCliente);
            await EmitirAsync(ctx, factura);
            return factura;
        }

        /// <summary>
        /// Facturas con sus platos, mesa y pagos. Los platos de una cuenta de mesa llevan su FacturaId;
        /// las facturas anteriores a la cuenta dividida se reconstruyen con los pedidos de sus pagos.
        /// </summary>
        public static async Task<List<FacturaDto>> ConDetalleAsync(RestauranteContext ctx, List<Factura> facturas)
        {
            var ids = facturas.Select(f => f.Id).ToList();
            var pagoIds = facturas.Where(f => f.PagoId != null).Select(f => f.PagoId!.Value).ToList();
            var pagos = await ctx.Pagos.AsNoTracking()
                .Where(p => (p.FacturaId != null && ids.Contains(p.FacturaId.Value)) || pagoIds.Contains(p.Id))
                .ToListAsync();
            var detalles = await ctx.PedidoDetalles.AsNoTracking()
                .Include(d => d.Platillo)
                .Include(d => d.Pedido).ThenInclude(p => p!.Mesa)
                .Where(d => d.FacturaId != null && ids.Contains(d.FacturaId.Value))
                .ToListAsync();
            var pedidoIds = pagos.Select(p => p.PedidoId).Distinct().ToList();
            var pedidos = await ctx.Pedidos.AsNoTracking()
                .Include(p => p.Mesa)
                .Include(p => p.Detalles).ThenInclude(d => d.Platillo)
                .Where(p => pedidoIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id);
            var documentos = (await ctx.DocumentosElectronicos.AsNoTracking()
                .Where(d => ids.Contains(d.FacturaId)).OrderBy(d => d.Id).ToListAsync()).ToLookup(d => d.FacturaId);
            var domicilioIds = facturas.Where(f => f.DomicilioId != null).Select(f => f.DomicilioId!.Value).ToList();
            var domicilios = await ctx.Domicilios.AsNoTracking()
                .Include(d => d.Cliente)
                .Include(d => d.Direccion)
                .Include(d => d.Detalles).ThenInclude(x => x.Platillo)
                .Where(d => domicilioIds.Contains(d.Id))
                .ToDictionaryAsync(d => d.Id);

            return facturas.Select(f =>
            {
                var dto = new FacturaDto
                {
                    Id = f.Id,
                    PagoId = f.PagoId,
                    DomicilioId = f.DomicilioId,
                    NumeroFactura = f.NumeroFactura,
                    NitCliente = f.NitCliente,
                    NombreCliente = f.NombreCliente,
                    Subtotal = f.Subtotal,
                    Propina = f.Propina,
                    Total = f.Total,
                    ArchivoUrl = f.ArchivoUrl,
                    FechaEmision = f.FechaEmision,
                    TipoIdCliente = f.TipoIdCliente,
                    CorreoCliente = f.CorreoCliente,
                    NombreImpuesto = f.NombreImpuesto,
                    TarifaImpuesto = f.TarifaImpuesto,
                    BaseImpuesto = f.BaseImpuesto,
                    ValorImpuesto = f.ValorImpuesto,
                    Anulada = f.Anulada,
                    MotivoAnulacion = f.MotivoAnulacion,
                    ReemplazaAId = f.ReemplazaAId,
                    Documentos = documentos[f.Id].Select(DocumentosDian.ADto).ToList()
                };

                if (f.DomicilioId is { } domicilioId && domicilios.TryGetValue(domicilioId, out var dom))
                {
                    dto.Domicilio = $"Domicilio #{dom.Id} · {dom.Cliente?.Nombre} · {dom.Direccion?.DireccionCompleta}";
                    dto.MetodoPago = dom.MetodoPago;
                    dto.Pagos = new List<FacturaPagoDto> { new() { MetodoPago = dom.MetodoPago, Monto = f.Total } };
                    dto.Items = dom.Detalles
                        .GroupBy(d => new { d.PlatilloId, d.PrecioUnitario })
                        .Select(g => new FacturaItemDto
                        {
                            Nombre = g.First().Platillo?.Nombre ?? "Plato",
                            Cantidad = g.Sum(d => d.Cantidad),
                            PrecioUnitario = g.Key.PrecioUnitario,
                            Total = g.Key.PrecioUnitario * g.Sum(d => d.Cantidad)
                        })
                        .OrderBy(i => i.Nombre)
                        .ToList();
                    if (dom.CostoEnvio > 0)
                        dto.Items.Add(new FacturaItemDto { Nombre = "Envío a domicilio", Cantidad = 1, PrecioUnitario = dom.CostoEnvio, Total = dom.CostoEnvio });
                    return dto;
                }

                var suyos = pagos.Where(p => p.FacturaId == f.Id || p.Id == f.PagoId).DistinctBy(p => p.Id).OrderBy(p => p.Id).ToList();
                var platos = detalles.Where(d => d.FacturaId == f.Id).ToList();
                if (platos.Count == 0)
                    platos = suyos.Select(p => pedidos.GetValueOrDefault(p.PedidoId)).OfType<Pedido>()
                        .DistinctBy(p => p.Id).SelectMany(p => p.Detalles).ToList();

                dto.MesaNumero = platos.Select(d => d.Pedido?.Mesa?.Numero).FirstOrDefault(n => n != null)
                                 ?? suyos.Select(p => pedidos.GetValueOrDefault(p.PedidoId)?.Mesa?.Numero).FirstOrDefault(n => n != null);
                dto.MetodoPago = string.Join(" + ", suyos.Select(p => p.MetodoPago.ToString()).Distinct());
                dto.Pagos = suyos.Select(p => new FacturaPagoDto { MetodoPago = p.MetodoPago.ToString(), Monto = p.Monto + p.MontoPropina }).ToList();
                dto.PedidoIds = platos.Select(d => d.PedidoId).Distinct().OrderBy(x => x).ToList();
                // El mismo plato al mismo precio en varios pedidos va en una sola línea.
                dto.Items = platos
                    .GroupBy(d => new { d.PlatilloId, Precio = Cuentas.Precio(d) })
                    .Select(g => new FacturaItemDto
                    {
                        Nombre = g.First().Platillo?.Nombre ?? "Plato",
                        Cantidad = g.Sum(d => d.Cantidad),
                        PrecioUnitario = g.Key.Precio,
                        Total = g.Key.Precio * g.Sum(d => d.Cantidad)
                    })
                    .OrderBy(i => i.Nombre)
                    .ToList();
                return dto;
            }).ToList();
        }
    }
}
