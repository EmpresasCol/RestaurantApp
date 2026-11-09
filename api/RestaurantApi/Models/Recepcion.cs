namespace RestaurantApi.Models
{
    /// <summary>
    /// Una entrada de mercancía (con o sin orden de compra). Sus lotes y movimientos llevan la
    /// referencia "Recepción R-{Id}"; las fotos son la evidencia de lo que llegó.
    /// </summary>
    public class Recepcion
    {
        public int Id { get; set; }
        public DateTime Fecha { get; set; } = DateTime.UtcNow;
        public int? UsuarioId { get; set; }
        public int? ProveedorId { get; set; }
        public int? OrdenCompraId { get; set; }
        /// <summary>Número de factura o remisión del proveedor.</summary>
        public string? Documento { get; set; }
        public int Lineas { get; set; }
        public decimal Total { get; set; }

        public Proveedor? Proveedor { get; set; }
        public OrdenCompra? OrdenCompra { get; set; }
        public List<RecepcionFoto> Fotos { get; set; } = new();
    }

    public class RecepcionFoto
    {
        public int Id { get; set; }
        public int RecepcionId { get; set; }
        /// <summary>Data URI (image/jpeg) reducido en el navegador.</summary>
        public string Foto { get; set; } = string.Empty;
        public DateTime Fecha { get; set; } = DateTime.UtcNow;

        public Recepcion? Recepcion { get; set; }
    }
}
