namespace RestaurantApp.Models
{
    public class LoginRequestDto
    {
        public string Usuario { get; set; } = string.Empty;
        public string Clave { get; set; } = string.Empty;
    }

    public class LoginResponseDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string NombreUsuario { get; set; } = string.Empty;
        public string Rol { get; set; } = string.Empty;
    }

    public class ResultadoAutenticacion
    {
        public bool Exito { get; set; }
        public string MensajeError { get; set; } = string.Empty;
        public LoginResponseDto? Usuario { get; set; }
    }
}