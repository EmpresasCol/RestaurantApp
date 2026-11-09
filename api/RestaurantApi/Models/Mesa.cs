namespace RestaurantApi.Models
{
    public enum EstadoMesa
    {
        Disponible,
        Ocupada,
        EsperandoPago
    }

    public class Mesa
    {
        public int Id { get; set; }
        public int Numero { get; set; }
        public EstadoMesa Estado { get; set; }
        /// <summary>Código secreto del QR de la mesa: el comensal pide con él, no con el Id.</summary>
        public string? CodigoQR { get; set; }
    }
}
