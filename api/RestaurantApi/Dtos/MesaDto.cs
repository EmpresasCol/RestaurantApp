namespace RestaurantApi.Dtos
{
    public class MesaDto
    {
        public int Id { get; set; }
        public int Numero { get; set; }
        public string Estado { get; set; } = string.Empty;
    }

    public class CantidadMesasDto
    {
        public int Cantidad { get; set; }
    }
}
