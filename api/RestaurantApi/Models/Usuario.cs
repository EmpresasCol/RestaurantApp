namespace RestaurantApi.Models
{
    public enum RolUsuario
    {
        Mesero,
        Cocina,
        Caja
    }

    public class Usuarios
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = null!;
        public string Usuario { get; set; } = null!;
        public string ClaveHash { get; set; } = null!;
        public RolUsuario Rol { get; set; }
    }
}