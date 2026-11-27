namespace RestaurantApi.Dtos
{
    public class LoginRequestDto
    {
        // Topes holgados: evitan que un cuerpo enorme llegue a BCrypt.
        [System.ComponentModel.DataAnnotations.StringLength(100)]
        public string Usuario { get; set; } = string.Empty;
        [System.ComponentModel.DataAnnotations.StringLength(200)]
        public string Clave { get; set; } = string.Empty;
    }

    public class LoginResponseDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string NombreUsuario { get; set; } = string.Empty;
        public string Rol { get; set; } = string.Empty;
        public string Token { get; set; } = string.Empty;
    }
}
