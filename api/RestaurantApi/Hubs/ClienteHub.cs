using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using RestaurantApi.Services;

namespace RestaurantApi.Hubs
{
    /// <summary>
    /// Canal de tiempo real del comensal, separado del hub del personal. El cliente solo puede
    /// pedir que lo sumen al grupo de SU visita (con el código del QR y la llave de seguimiento);
    /// el servidor emite "cambio" sin datos y la página vuelve a leer su seguimiento por REST.
    /// </summary>
    [AllowAnonymous]
    public class ClienteHub : Hub
    {
        private readonly RestauranteContext _context;

        public ClienteHub(RestauranteContext context)
        {
            _context = context;
        }

        public static string Grupo(int ocupacionId) => $"ocupacion-{ocupacionId}";

        public async Task<bool> Seguir(string? codigoMesa, string? llave)
        {
            var ocupacionId = await Ocupaciones.IdParaSeguirAsync(_context, codigoMesa, llave);
            if (ocupacionId == null) return false;
            await Groups.AddToGroupAsync(Context.ConnectionId, Grupo(ocupacionId.Value));
            return true;
        }
    }
}
