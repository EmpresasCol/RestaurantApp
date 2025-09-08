namespace RestaurantApi.Models
{
    public enum RolUsuario
    {
        Mesero,
        Cocina,
        Caja,
        Admin
    }

    public class Usuario
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = null!;
        public string UsuarioNombre { get; set; } = null!; // corresponde a "Usuario" en BD
        public string ClaveHash { get; set; } = null!;
        public RolUsuario Rol { get; set; }
    }
}
