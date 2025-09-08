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
    }
}
