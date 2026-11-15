namespace RestaurantApi.Models
{
    /// <summary>Datos del restaurante como vendedor (una sola fila). Salen en la tirilla y en el documento electrónico.</summary>
    public class ConfiguracionFiscal
    {
        public const string Inc = "INC";
        public const string Iva = "IVA";
        public const string SinImpuesto = "Ninguno";
        public const string DocPos = "POS";
        public const string DocFactura = "FEV";

        public int Id { get; set; } = 1;
        public string RazonSocial { get; set; } = string.Empty;
        public string? NombreComercial { get; set; }
        public string Nit { get; set; } = string.Empty;
        public string? DigitoVerificacion { get; set; }
        public string? Direccion { get; set; }
        public string? Municipio { get; set; }
        public string? Telefono { get; set; }
        public string? Correo { get; set; }
        /// <summary>Texto libre para la tirilla: "Responsable del impuesto al consumo", "No responsable de IVA"…</summary>
        public string? Regimen { get; set; }
        /// <summary>INC (restaurante), IVA (franquicia) o Ninguno (no responsable). Lo define el contador.</summary>
        public string TipoImpuesto { get; set; } = Inc;
        /// <summary>Tarifa en porcentaje (8 = 8 %). Los precios de la carta ya la incluyen.</summary>
        public decimal TarifaImpuesto { get; set; } = 8;
        /// <summary>
        /// Apagada: consecutivo interno FV- sin validez fiscal. Encendida: cada venta toma un número
        /// de la numeración autorizada por la DIAN y queda en cola para el proveedor tecnológico.
        /// </summary>
        public bool FacturacionElectronica { get; set; }
        /// <summary>Documento del consumidor final que no pide factura a su nombre: POS electrónico o factura electrónica.</summary>
        public string DocumentoConsumidorFinal { get; set; } = DocPos;
    }

    /// <summary>Rango de numeración que la DIAN autorizó para un tipo de documento.</summary>
    public class NumeracionDian
    {
        public int Id { get; set; }
        /// <summary>POS, FEV, NotaAjuste o NotaCredito (ver <see cref="DocumentoElectronico"/>).</summary>
        public string TipoDocumento { get; set; } = ConfiguracionFiscal.DocPos;
        public string? Resolucion { get; set; }
        public string Prefijo { get; set; } = string.Empty;
        public long Desde { get; set; }
        public long Hasta { get; set; }
        public DateTime? FechaDesde { get; set; }
        public DateTime? FechaHasta { get; set; }
        /// <summary>Próximo número a entregar; nunca retrocede (un número anulado no se reutiliza).</summary>
        public long Siguiente { get; set; }
        public bool Activa { get; set; } = true;
    }

    /// <summary>
    /// Documento que se transmite a la DIAN por el proveedor tecnológico. Se guarda en la misma
    /// transacción que el cobro (cola de salida) y un servicio en segundo plano lo envía: la caja
    /// nunca espera al proveedor y un reintento no duplica el documento.
    /// </summary>
    public class DocumentoElectronico
    {
        public const string Pos = ConfiguracionFiscal.DocPos;
        public const string Fev = ConfiguracionFiscal.DocFactura;
        public const string NotaAjuste = "NotaAjuste";
        public const string NotaCredito = "NotaCredito";

        public const string Pendiente = "Pendiente";
        public const string Validado = "Validado";
        public const string Rechazado = "Rechazado";

        public int Id { get; set; }
        public int FacturaId { get; set; }
        public string Tipo { get; set; } = Pos;
        public string Prefijo { get; set; } = string.Empty;
        public long Numero { get; set; }
        /// <summary>CUFE (factura) o CUDE (POS y notas) que devuelve la DIAN al validar.</summary>
        public string? Cufe { get; set; }
        public string Estado { get; set; } = Pendiente;
        public string? Mensaje { get; set; }
        public string? UrlPdf { get; set; }
        public string? UrlXml { get; set; }
        public string? QrUrl { get; set; }
        public int Intentos { get; set; }
        public DateTime? ProximoIntento { get; set; }
        public DateTime FechaGeneracion { get; set; } = DateTime.UtcNow;
        public DateTime? FechaValidacion { get; set; }
        /// <summary>En una nota: el documento que anula o corrige.</summary>
        public int? DocumentoReferenciaId { get; set; }
        public string? Motivo { get; set; }
        /// <summary>Única: el proveedor la recibe en cada intento y no crea dos documentos.</summary>
        public string ClaveIdempotencia { get; set; } = string.Empty;

        public Factura? Factura { get; set; }
    }
}
