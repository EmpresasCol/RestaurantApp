namespace RestaurantApi.Dtos
{
    // Lo que ve el comensal desde el QR de su mesa. Sin nombres del personal, comprobantes ni Ids internos de más.

    public class UnirseDto
    {
        public string? CodigoMesa { get; set; }
        public string? Pin { get; set; }
    }

    public class LlamarMeseroDto
    {
        public string? CodigoMesa { get; set; }
    }

    public class SuscripcionPushDto
    {
        public string? Endpoint { get; set; }
    }

    public class SeguimientoDto
    {
        public int MesaNumero { get; set; }
        /// <summary>Código para que otro comensal de la mesa se sume al seguimiento.</summary>
        public string Pin { get; set; } = string.Empty;
        public DateTime Inicio { get; set; }
        public List<PedidoSeguimientoDto> Pedidos { get; set; } = new();
        public CuentaSeguimientoDto Cuenta { get; set; } = new();
        /// <summary>Estado de la llamada viva de la mesa (Pendiente o EnCamino); null si no hay.</summary>
        public string? Llamada { get; set; }
    }

    public class PedidoSeguimientoDto
    {
        public int Id { get; set; }
        public DateTime Fecha { get; set; }
        /// <summary>Recibido, EnPreparacion, Listo, Entregado, Pagado o Cancelado (ver EstadosPedido.ParaCliente).</summary>
        public string Estado { get; set; } = string.Empty;
        public List<PlatoSeguimientoDto> Platos { get; set; } = new();
    }

    public class PlatoSeguimientoDto
    {
        public string Nombre { get; set; } = string.Empty;
        public int Cantidad { get; set; }
        public string? Nota { get; set; }
        public decimal Precio { get; set; }
        public bool Pagado { get; set; }
    }

    public class CuentaSeguimientoDto
    {
        public decimal Total { get; set; }
        public decimal Pagado { get; set; }
        public decimal Pendiente { get; set; }
        /// <summary>El mesero ya pidió la cuenta a caja.</summary>
        public bool CuentaPedida { get; set; }
        /// <summary>El mesero avisó un pago que la caja todavía no confirma: aún no cuenta como pagado.</summary>
        public bool PagoPorConfirmar { get; set; }
    }

    public class LlamadaClienteDto
    {
        public string Clave { get; set; } = string.Empty;
        public string Estado { get; set; } = string.Empty;
        public DateTime Fecha { get; set; }
    }

    /// <summary>Llamada viva tal como la ve el personal.</summary>
    public class LlamadaDto
    {
        public int Id { get; set; }
        public int MesaId { get; set; }
        public int MesaNumero { get; set; }
        public DateTime Fecha { get; set; }
        public string Estado { get; set; } = string.Empty;
        public int? MeseroId { get; set; }
        public string? MeseroNombre { get; set; }
    }
}
