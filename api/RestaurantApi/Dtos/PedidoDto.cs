namespace RestaurantApi.Dtos
{
    public class PedidoDto
    {
        public int Id { get; set; }
        public int MesaId { get; set; }
        public int MesaNumero { get; set; }
        public string Estado { get; set; } = string.Empty;
        public DateTime Fecha { get; set; }

        public int UsuarioId { get; set; }
        public string MeseroNombre { get; set; } = "Sin asignar";

        /// <summary>Cocina ya lo empezó o terminó: el mesero no lo edita ni lo cancela.</summary>
        public bool CocinaEmpezo { get; set; }

        /// <summary>El mesero cambió los platos (null si nunca): la cocina lo resalta.</summary>
        public DateTime? FechaEdicion { get; set; }

        /// <summary>Lo que falta cobrar de este pedido (sin los platos ya facturados).</summary>
        public decimal PorCobrar { get; set; }

        /// <summary>Llave de seguimiento de la visita; solo se entrega al comensal que pidió por el QR.</summary>
        public string? Seguimiento { get; set; }

        public List<PedidoDetalleDto> Detalles { get; set; } = new();
    }
}