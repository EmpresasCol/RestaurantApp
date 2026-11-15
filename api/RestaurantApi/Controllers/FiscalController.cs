using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    /// <summary>
    /// Datos fiscales del restaurante, numeraciones autorizadas por la DIAN y estado de la cola de
    /// documentos electrónicos. La caja los lee (tirilla y avisos); solo el administrador los cambia.
    /// </summary>
    [Route("api/fiscal")]
    [ApiController]
    [Authorize(Roles = "Administrador,Caja")]
    public class FiscalController : ControllerBase
    {
        /// <summary>Se avisa cuando al rango le queda este porcentaje o estos días.</summary>
        public const decimal PorcentajeAviso = 0.10m;
        public const int DiasAviso = 30;

        private static readonly string[] Impuestos = { ConfiguracionFiscal.Inc, ConfiguracionFiscal.Iva, ConfiguracionFiscal.SinImpuesto };
        private static readonly string[] TiposConRango = { DocumentoElectronico.Pos, DocumentoElectronico.Fev };

        private readonly RestauranteContext _context;
        private readonly bool _proveedorConectado;

        public FiscalController(RestauranteContext context, IProveedorFacturacion? proveedor = null)
        {
            _context = context;
            _proveedorConectado = proveedor is not ProveedorSinConfigurar;
        }

        public class NumeracionDto
        {
            public int Id { get; set; }
            public string TipoDocumento { get; set; } = DocumentoElectronico.Pos;
            public string? Resolucion { get; set; }
            public string Prefijo { get; set; } = string.Empty;
            public long Desde { get; set; }
            public long Hasta { get; set; }
            public DateTime? FechaDesde { get; set; }
            public DateTime? FechaHasta { get; set; }
            public long Siguiente { get; set; }
            public bool Activa { get; set; } = true;
            public bool Vigente { get; set; }
            public long Restantes { get; set; }
            /// <summary>Texto para mostrar cuando está por agotarse, por vencer o ya no sirve.</summary>
            public string? Aviso { get; set; }
        }

        private static NumeracionDto ADto(NumeracionDian n, DateTime hoy)
        {
            var restantes = Math.Max(0, n.Hasta - n.Siguiente + 1);
            var vigente = Facturacion.Vigente(n, hoy);
            var dias = n.FechaHasta == null ? (int?)null : (n.FechaHasta.Value.Date - hoy.Date).Days;
            string? aviso = null;
            if (n.Activa)
            {
                if (restantes == 0) aviso = "Se agotó: solicita una numeración nueva a la DIAN";
                else if (dias < 0) aviso = "Venció: solicita una numeración nueva a la DIAN";
                else if (!vigente) aviso = "Todavía no empieza su vigencia";
                else if (dias <= DiasAviso) aviso = $"Vence en {dias} día(s)";
                else if (restantes <= (n.Hasta - n.Desde + 1) * PorcentajeAviso) aviso = $"Quedan {restantes} números";
            }
            return new NumeracionDto
            {
                Id = n.Id, TipoDocumento = n.TipoDocumento, Resolucion = n.Resolucion, Prefijo = n.Prefijo, Desde = n.Desde, Hasta = n.Hasta,
                FechaDesde = n.FechaDesde, FechaHasta = n.FechaHasta, Siguiente = n.Siguiente, Activa = n.Activa,
                Vigente = vigente, Restantes = restantes, Aviso = aviso
            };
        }

        /// <summary>Configuración (o la de fábrica si aún no se guardó), numeraciones y documentos por resolver.</summary>
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var hoy = HoraLocal.AhoraColombia();
            var config = await Facturacion.ConfiguracionAsync(_context) ?? new ConfiguracionFiscal();
            var numeraciones = await _context.NumeracionesDian.AsNoTracking().OrderByDescending(n => n.Activa).ThenBy(n => n.TipoDocumento).ThenBy(n => n.Id).ToListAsync();
            var cola = await _context.DocumentosElectronicos.AsNoTracking()
                .Where(d => d.Estado != DocumentoElectronico.Validado)
                .GroupBy(d => d.Estado).Select(g => new { Estado = g.Key, Cuenta = g.Count() }).ToListAsync();
            var enContingencia = await _context.DocumentosElectronicos.AsNoTracking()
                .CountAsync(d => d.Estado == DocumentoElectronico.Pendiente && d.Intentos >= DocumentosDian.IntentosParaContingencia);

            return Ok(new
            {
                config,
                proveedorConectado = _proveedorConectado,
                numeraciones = numeraciones.Select(n => ADto(n, hoy)),
                documentos = new
                {
                    pendientes = cola.FirstOrDefault(c => c.Estado == DocumentoElectronico.Pendiente)?.Cuenta ?? 0,
                    rechazados = await DocumentosDian.PorResolver(_context).CountAsync(),
                    enContingencia
                }
            });
        }

        [HttpPut]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> Put(ConfiguracionFiscal dto)
        {
            dto.TipoImpuesto = Impuestos.FirstOrDefault(i => string.Equals(i, dto.TipoImpuesto?.Trim(), StringComparison.OrdinalIgnoreCase)) ?? "";
            if (dto.TipoImpuesto.Length == 0)
                return BadRequest(new { message = "El impuesto debe ser INC, IVA o Ninguno" });
            if (dto.TarifaImpuesto is < 0 or > 50)
                return BadRequest(new { message = "La tarifa del impuesto debe estar entre 0 y 50" });
            if (dto.TipoImpuesto == ConfiguracionFiscal.SinImpuesto) dto.TarifaImpuesto = 0;
            if (!TiposConRango.Contains(dto.DocumentoConsumidorFinal))
                return BadRequest(new { message = "El documento del consumidor final debe ser POS o FEV" });

            dto.Nit = new string((dto.Nit ?? "").Where(char.IsDigit).ToArray());
            dto.DigitoVerificacion = string.IsNullOrWhiteSpace(dto.DigitoVerificacion) ? null : dto.DigitoVerificacion.Trim();
            if (dto.Nit.Length > 0 && (dto.Nit.Length is < 5 or > 15))
                return BadRequest(new { message = "El NIT lleva entre 5 y 15 números, sin el dígito de verificación" });
            if (dto.DigitoVerificacion != null && dto.Nit.Length > 0 && dto.DigitoVerificacion != Facturacion.DigitoVerificacion(dto.Nit).ToString())
                return BadRequest(new { message = "El dígito de verificación no coincide con el NIT" });
            var largos = new[] { (dto.RazonSocial, 150), (dto.NombreComercial, 150), (dto.Direccion, 200), (dto.Municipio, 100), (dto.Telefono, 30), (dto.Correo, 150), (dto.Regimen, 200) };
            if (largos.Any(x => x.Item1?.Length > x.Item2))
                return BadRequest(new { message = "Uno de los datos es demasiado largo" });

            if (dto.FacturacionElectronica)
            {
                // Sin proveedor los documentos tomarían números de la DIAN y nunca se transmitirían.
                if (!_proveedorConectado && (await Facturacion.ConfiguracionAsync(_context))?.FacturacionElectronica != true)
                    return BadRequest(new { message = "Todavía no hay un proveedor tecnológico de facturación conectado a Qpro. Pide a soporte que lo conecte antes de activarla." });
                if (string.IsNullOrWhiteSpace(dto.RazonSocial) || dto.Nit.Length == 0 || string.IsNullOrWhiteSpace(dto.Direccion) || string.IsNullOrWhiteSpace(dto.Municipio))
                    return BadRequest(new { message = "Para facturar electrónicamente completa razón social, NIT, dirección y municipio" });
                var hoy = HoraLocal.AhoraColombia();
                var rangos = await _context.NumeracionesDian.AsNoTracking().Where(n => n.Activa).ToListAsync();
                var faltan = new[] { dto.DocumentoConsumidorFinal, DocumentoElectronico.Fev }.Distinct()
                    .Where(t => !rangos.Any(n => n.TipoDocumento == t && Facturacion.Vigente(n, hoy))).Select(Facturacion.NombreTipo).ToList();
                if (faltan.Count > 0)
                    return BadRequest(new { message = $"Antes de activarla registra una numeración vigente para: {string.Join(" y ", faltan)}" });
            }

            dto.Id = 1;
            dto.RazonSocial = dto.RazonSocial?.Trim() ?? "";
            var actual = await _context.ConfiguracionFiscal.FirstOrDefaultAsync();
            if (actual == null) _context.ConfiguracionFiscal.Add(dto);
            else _context.Entry(actual).CurrentValues.SetValues(dto);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// Registra o corrige un rango. Un rango que ya entregó números solo cambia fechas,
        /// resolución, tope y si está activo: lo emitido no se renumera.
        /// </summary>
        [HttpPost("numeraciones")]
        [Authorize(Roles = "Administrador")]
        public async Task<IActionResult> GuardarNumeracion(NumeracionDto dto)
        {
            var prefijo = (dto.Prefijo ?? "").Trim().ToUpperInvariant();
            if (!TiposConRango.Contains(dto.TipoDocumento))
                return BadRequest(new { message = "El tipo debe ser POS o FEV" });
            if (prefijo.Length is < 1 or > 6 || !prefijo.All(char.IsLetterOrDigit))
                return BadRequest(new { message = "El prefijo lleva de 1 a 6 letras o números, como aparece en la resolución" });
            if (prefijo.StartsWith("FV") && prefijo.Length == 2 || prefijo is "NA" or "NC")
                return BadRequest(new { message = "Ese prefijo lo usa Qpro para otros consecutivos: usa el de la resolución" });
            if (dto.Desde < 1 || dto.Hasta < dto.Desde || dto.Hasta > 999_999_999)
                return BadRequest(new { message = "El rango no es válido: revisa desde y hasta" });
            if (dto.FechaDesde != null && dto.FechaHasta != null && dto.FechaHasta < dto.FechaDesde)
                return BadRequest(new { message = "La vigencia termina antes de empezar" });
            if (dto.Resolucion?.Length > 50)
                return BadRequest(new { message = "El número de resolución admite máximo 50 caracteres" });

            // El número de factura es único: dos rangos activos no comparten prefijo y números.
            var cruza = await _context.NumeracionesDian.AnyAsync(n => n.Id != dto.Id && n.Prefijo == prefijo && n.Desde <= dto.Hasta && n.Hasta >= dto.Desde);
            if (cruza)
                return Conflict(new { message = $"Ya hay una numeración con el prefijo {prefijo} que se cruza con ese rango" });

            NumeracionDian n;
            if (dto.Id == 0)
            {
                n = new NumeracionDian { TipoDocumento = dto.TipoDocumento, Prefijo = prefijo, Desde = dto.Desde, Siguiente = Math.Max(dto.Siguiente, dto.Desde) };
                _context.NumeracionesDian.Add(n);
            }
            else
            {
                n = await _context.NumeracionesDian.FirstOrDefaultAsync(x => x.Id == dto.Id) ?? null!;
                if (n == null) return NotFound(new { message = "Esa numeración no existe" });
                var usada = n.Siguiente > n.Desde;
                if (usada && (n.Prefijo != prefijo || n.Desde != dto.Desde || n.TipoDocumento != dto.TipoDocumento))
                    return Conflict(new { message = "Esta numeración ya entregó números: no se le cambia tipo, prefijo ni inicio. Desactívala y registra otra." });
                if (dto.Hasta < n.Siguiente - 1)
                    return Conflict(new { message = $"Ya se emitió hasta el {n.Siguiente - 1}: el tope no puede ser menor" });
                if (!usada) (n.TipoDocumento, n.Prefijo, n.Desde, n.Siguiente) = (dto.TipoDocumento, prefijo, dto.Desde, dto.Desde);
            }
            if (n.Siguiente > dto.Hasta + 1)
                return BadRequest(new { message = "El siguiente número queda fuera del rango" });
            (n.Hasta, n.Resolucion, n.FechaDesde, n.FechaHasta, n.Activa) = (dto.Hasta, dto.Resolucion?.Trim(), dto.FechaDesde?.Date, dto.FechaHasta?.Date, dto.Activa);

            await _context.SaveChangesAsync();
            return Ok(ADto(n, HoraLocal.AhoraColombia()));
        }
    }
}
