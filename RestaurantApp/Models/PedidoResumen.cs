namespace RestaurantApp.Models
{
    public class PedidoResumen
{
    public int Id { get; set; }
    public int NumeroMesa { get; set; }
    public DateTime FechaHora { get; set; }
    public int CantidadItems { get; set; }
    public decimal Total { get; set; }
    public string Estado { get; set; }
    public Color EstadoColor { get; set; }
    public string TiempoTranscurrido { get; set; }

    // Propiedades calculadas
    public string HoraTexto => FechaHora.ToString("HH:mm");
    public string FechaTexto => FechaHora.ToString("dd/MM");
    public string TotalTexto => $"${Total:N0}";
    public string ItemsTexto => $"{CantidadItems} item{(CantidadItems != 1 ? "s" : "")}";
}
}