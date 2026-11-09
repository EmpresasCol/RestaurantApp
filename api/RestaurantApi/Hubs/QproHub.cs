using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace RestaurantApi.Hubs
{
    /// <summary>
    /// Canal de tiempo real del personal. Solo el servidor emite: el evento "cambio"
    /// lleva el tema (ver <see cref="Services.TemaRealtime"/>) y el cliente recarga por REST.
    /// </summary>
    [Authorize]
    public class QproHub : Hub
    {
    }
}
