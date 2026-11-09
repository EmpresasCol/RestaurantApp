namespace RestaurantApi.Dtos
{
    public class MesaDto
    {
        public int Id { get; set; }
        public int Numero { get; set; }
        public string Estado { get; set; } = string.Empty;
        /// <summary>Solo lo recibe el administrador (para generar los QR).</summary>
        public string? CodigoQR { get; set; }
    }

    /// <summary>Lo que el comensal ve de su mesa al abrir el QR.</summary>
    public class MesaPublicaDto
    {
        public int Numero { get; set; }
    }

    public class CantidadMesasDto
    {
        public int Cantidad { get; set; }
    }
}
