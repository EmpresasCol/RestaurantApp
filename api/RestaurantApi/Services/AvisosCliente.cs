using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Hubs;

namespace RestaurantApi.Services
{
    /// <summary>
    /// Después de guardar, avisa a los comensales de las mesas que cambiaron: "cambio" por SignalR
    /// al grupo de su visita (página abierta) y Web Push cuando el cambio amerita aviso (página
    /// cerrada). Nunca lleva datos: el cliente lee su seguimiento por REST. Un fallo aquí no
    /// deshace nada: el pedido o el cobro ya están guardados.
    /// </summary>
    public class AvisosCliente
    {
        private readonly IHubContext<ClienteHub> _hub;
        private readonly PushWeb _push;
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<AvisosCliente> _logger;

        public AvisosCliente(IHubContext<ClienteHub> hub, PushWeb push, IServiceScopeFactory scopes, ILogger<AvisosCliente> logger)
        {
            _hub = hub;
            _push = push;
            _scopes = scopes;
            _logger = logger;
        }

        /// <param name="esperarPush">Las pruebas esperan el envío; en producción va en segundo plano para no demorar la respuesta.</param>
        public async Task DespacharAsync(RestauranteContext db, bool esperarPush = false)
        {
            if (db.MesasTocadas.Count == 0) return;
            var mesas = db.MesasTocadas.ToList();
            var conAviso = db.MesasConAviso.ToHashSet();
            db.MesasTocadas.Clear();
            db.MesasConAviso.Clear();

            try
            {
                // La visita en curso de cada mesa y la que se acaba de cerrar (para su aviso final).
                var hace = DateTime.UtcNow.AddMinutes(-2);
                var visitas = await db.Ocupaciones.AsNoTracking()
                    .Where(o => mesas.Contains(o.MesaId) && (o.Abierta == true || o.Cierre > hace))
                    .Select(o => new { o.Id, o.MesaId, Cerrada = o.Abierta != true })
                    .ToListAsync();
                if (visitas.Count == 0) return;

                await _hub.Clients.Groups(visitas.Select(v => ClienteHub.Grupo(v.Id)).ToList()).SendAsync("cambio");

                var ids = visitas.Where(v => conAviso.Contains(v.MesaId)).Select(v => v.Id).ToList();
                if (!_push.Configurado || ids.Count == 0) return;
                var destinos = await db.SuscripcionesPush.AsNoTracking()
                    .Where(s => ids.Contains(s.OcupacionId))
                    .Select(s => new Destino(s.Id, s.OcupacionId, s.Endpoint))
                    .ToListAsync();
                if (destinos.Count == 0) return;

                var cerradas = visitas.Where(v => v.Cerrada).Select(v => v.Id).ToHashSet();
                var envio = EnviarPushAsync(destinos, cerradas);
                if (esperarPush) await envio;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo avisar a los comensales");
            }
        }

        private sealed record Destino(int Id, int OcupacionId, string Endpoint);

        /// <summary>
        /// Envía y limpia: se borran las suscripciones caducadas y, tras el aviso final, todas las de
        /// una visita cerrada (ese navegador no vuelve a recibir nada de esa mesa).
        /// </summary>
        private async Task EnviarPushAsync(List<Destino> destinos, HashSet<int> cerradas)
        {
            try
            {
                var resultados = await Task.WhenAll(destinos.Select(d => _push.EnviarAsync(d.Endpoint)));
                var sobran = destinos
                    .Where((d, i) => resultados[i] == PushWeb.Resultado.Caducada || cerradas.Contains(d.OcupacionId))
                    .Select(d => d.Id).ToList();
                if (sobran.Count == 0) return;

                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<RestauranteContext>();
                db.SuscripcionesPush.RemoveRange(await db.SuscripcionesPush.Where(s => sobran.Contains(s.Id)).ToListAsync());
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falló el envío de avisos Web Push");
            }
        }
    }
}
