namespace RestaurantApi.Dtos
{
    public class PagoDto
    {
        public int Id { get; set; }
        public int PedidoId { get; set; }
        public decimal Monto { get; set; }
        public decimal MontoPropina { get; set; }
        public string MetodoPago { get; set; } = string.Empty;
        public DateTime Fecha { get; set; }
    }

    public class CrearPagoDto
    {
        public int PedidoId { get; set; }
        public decimal Monto { get; set; }
        public decimal MontoPropina { get; set; } = 0;
        public string MetodoPago { get; set; } = "Efectivo";
    }
}