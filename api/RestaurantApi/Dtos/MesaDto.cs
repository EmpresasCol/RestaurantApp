namespace RestaurantApi.Dtos
{
    public class MesaDto
    {
        public int Id { get; set; }
        public int Numero { get; set; }
        public string Estado { get; set; } = string.Empty;
        /// <summary>Solo lo recibe el administrador (para generar los QR).</summary>
        public string? CodigoQR { get; set; }
        /// <summary>Código de 6 dígitos de la visita en curso (null si la mesa está libre); solo para el personal del salón.</summary>
        public string? PinSeguimiento { get; set; }
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
