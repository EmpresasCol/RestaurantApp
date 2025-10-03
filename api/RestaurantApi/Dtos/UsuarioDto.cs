namespace RestaurantApi.Dtos
{
    public class UsuarioDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string NombreUsuario { get; set; } = string.Empty;  // ← AGREGAR ESTA LÍNEA
        public string Rol { get; set; } = string.Empty;
    }
}