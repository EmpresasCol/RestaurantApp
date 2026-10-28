using System.ComponentModel.DataAnnotations;
using RestaurantApi.Models;

namespace RestaurantApi.Dtos
{
    public class UsuarioDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string NombreUsuario { get; set; } = string.Empty;
        public string Rol { get; set; } = string.Empty;
    }

    /// <summary>Edición de usuario: ClaveHash es opcional (texto plano, se re-hashea si viene).</summary>
    public class ActualizarUsuarioDto
    {
        public int Id { get; set; }

        [Required]
        public string Nombre { get; set; } = string.Empty;

        [Required]
        public string NombreUsuario { get; set; } = string.Empty;

        public RolUsuario Rol { get; set; }

        public string? ClaveHash { get; set; }
    }
}
