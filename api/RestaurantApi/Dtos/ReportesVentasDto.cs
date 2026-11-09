namespace RestaurantApi.Dtos
{
    /// <summary>Lo recaudado con un método de pago (mesa más domicilios).</summary>
    public class MetodoRecaudoDto
    {
        public string Metodo { get; set; } = string.Empty;
        public decimal Mesa { get; set; }
        public decimal Propinas { get; set; }
        public decimal Domicilios { get; set; }
        public decimal Total { get; set; }
        public int Cobros { get; set; }
    }

    /// <summary>Cuadre de caja de un día (hora de Colombia).</summary>
    public class CierreCajaDto
    {
        public string Fecha { get; set; } = string.Empty;
        /// <summary>Consumo cobrado en mesa (impuesto incluido, sin propina).</summary>
        public decimal VentasMesa { get; set; }
        public decimal Propinas { get; set; }
        /// <summary>Platos de domicilios entregados (impuesto incluido, sin envío).</summary>
        public decimal VentasDomicilio { get; set; }
        public decimal Envios { get; set; }
        public decimal TotalRecaudado { get; set; }
        public int CuentasMesa { get; set; }
        public int Domicilios { get; set; }
        public List<MetodoRecaudoDto> PorMetodo { get; set; } = new();
        public int FacturasEmitidas { get; set; }
        public string? PrimeraFactura { get; set; }
        public string? UltimaFactura { get; set; }
        public int PedidosAnulados { get; set; }
        public decimal ValorAnulado { get; set; }
        /// <summary>Cuentas que siguen abiertas ahora mismo (para no cerrar con mesas sin cobrar).</summary>
        public int CuentasAbiertas { get; set; }
        public decimal ValorAbierto { get; set; }
        /// <summary>Domicilios que siguen en curso ahora mismo.</summary>
        public int DomiciliosEnCurso { get; set; }
        public bool EsHoy { get; set; }

        // ── Arqueo del cajón ──
        /// <summary>Efectivo con que se abrió la caja.</summary>
        public decimal Base { get; set; }
        public bool BaseRegistrada { get; set; }
        /// <summary>Cobros de mesa en efectivo (consumo y propina).</summary>
        public decimal EfectivoMesa { get; set; }
        public decimal PropinasEfectivo { get; set; }
        /// <summary>Efectivo de domicilios que llegó al cajón ese día (entregado por el domiciliario o cobrado en caja).</summary>
        public decimal EfectivoDomicilios { get; set; }
        /// <summary>Efectivo que los domiciliarios cobraron y no han entregado (no está en el cajón).</summary>
        public List<LiquidacionPendienteDto> EfectivoEnDomiciliarios { get; set; } = new();
        public decimal PropinasPagadas { get; set; }
        public decimal Retiros { get; set; }
        /// <summary>Base + efectivo de mesa + efectivo de domicilios − propinas pagadas − retiros.</summary>
        public decimal EfectivoEsperado { get; set; }
        public decimal? EfectivoContado { get; set; }
        public decimal? Diferencia { get; set; }
        /// <summary>Lo que el sistema dice que entró por datáfono y por transferencia o QR.</summary>
        public decimal Tarjeta { get; set; }
        public decimal Transferencias { get; set; }
        public decimal? TarjetaDatafono { get; set; }
        public decimal? TransferenciasBanco { get; set; }
        public string? Observaciones { get; set; }
        public bool Cerrada { get; set; }
        public DateTime? FechaCierre { get; set; }
        public string? CerradaPor { get; set; }
    }

    public class AperturaCajaDto
    {
        public DateTime Fecha { get; set; }
        public decimal Base { get; set; }
    }

    /// <summary>Arqueo al cerrar: lo que se contó y lo que se pagó con efectivo del cajón.</summary>
    public class CerrarCajaDto
    {
        public DateTime Fecha { get; set; }
        public decimal EfectivoContado { get; set; }
        public decimal PropinasPagadas { get; set; }
        public decimal Retiros { get; set; }
        public decimal? TarjetaDatafono { get; set; }
        public decimal? TransferenciasBanco { get; set; }
        public string? Observaciones { get; set; }
    }

    public class VentaDiaDto
    {
        public string Fecha { get; set; } = string.Empty;
        public decimal Mesa { get; set; }
        public decimal Domicilios { get; set; }
        public decimal Total { get; set; }
        public int Ventas { get; set; }
    }

    public class VentaHoraDto
    {
        public int Hora { get; set; }
        public decimal Total { get; set; }
        public int Ventas { get; set; }
    }

    public class PlatilloVendidoDto
    {
        public int PlatilloId { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Categoria { get; set; } = string.Empty;
        public int Cantidad { get; set; }
        public decimal Ingresos { get; set; }
    }

    public class CanalVentaDto
    {
        public string Canal { get; set; } = string.Empty;
        public int Ventas { get; set; }
        public decimal Total { get; set; }
    }

    public class MeseroVentaDto
    {
        public int UsuarioId { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public int Pedidos { get; set; }
        public int Mesas { get; set; }
        public decimal Ventas { get; set; }
        public decimal Propinas { get; set; }
    }

    /// <summary>Ventas de un rango de días (hora de Colombia, ambos días incluidos).</summary>
    public class ReporteVentasDto
    {
        public string Desde { get; set; } = string.Empty;
        public string Hasta { get; set; } = string.Empty;
        /// <summary>Platos vendidos en mesa y domicilio (impuesto incluido; sin propinas ni envíos).</summary>
        public decimal Ventas { get; set; }
        public decimal Propinas { get; set; }
        public decimal Envios { get; set; }
        /// <summary>Cuentas cobradas en mesa más domicilios entregados.</summary>
        public int NumeroVentas { get; set; }
        public decimal TicketPromedio { get; set; }
        public int PedidosAnulados { get; set; }
        public decimal ValorAnulado { get; set; }
        public List<VentaDiaDto> PorDia { get; set; } = new();
        public List<VentaHoraDto> PorHora { get; set; } = new();
        public List<MetodoRecaudoDto> PorMetodo { get; set; } = new();
        public List<PlatilloVendidoDto> Platillos { get; set; } = new();
        public List<CanalVentaDto> Canales { get; set; } = new();
        public List<MeseroVentaDto> Meseros { get; set; } = new();
    }
}
