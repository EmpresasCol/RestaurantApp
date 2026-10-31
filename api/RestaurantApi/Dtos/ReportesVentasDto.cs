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
