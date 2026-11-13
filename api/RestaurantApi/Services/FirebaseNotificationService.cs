using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;

namespace RestaurantApi.Services
{
    /// <summary>
    /// Push a la app de los meseros (FCM). Es un refuerzo: lo que avisa ya está guardado y la app
    /// lo ve por tiempo real o al recargar. Sin credenciales de Firebase simplemente no envía.
    /// </summary>
    public class FirebaseNotificationService
    {
        private readonly RestauranteContext _context;

        public FirebaseNotificationService(RestauranteContext context)
        {
            _context = context;

            if (FirebaseApp.DefaultInstance == null)
            {
                try
                {
                    var credential = GoogleCredential.FromFile("firebase-service-account.json");

                    FirebaseApp.Create(new AppOptions()
                    {
                        Credential = credential
                    });

                    System.Diagnostics.Debug.WriteLine("✅ Firebase Admin SDK inicializado");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"❌ Error inicializando Firebase: {ex.Message}");
                }
            }
        }

        public Task EnviarNotificacionPedidoListo(int pedidoId, int mesaNumero) => EnviarAMeserosAsync(
            "🔔 Pedido Listo",
            $"El pedido #{pedidoId} de la mesa {mesaNumero} está listo para entregar",
            new Dictionary<string, string>
            {
                { "pedidoId", pedidoId.ToString() },
                { "mesaNumero", mesaNumero.ToString() },
                { "tipo", "pedido_listo" }
            });

        public Task EnviarLlamadaAsync(int llamadaId, int mesaId, int mesaNumero) => EnviarAMeserosAsync(
            $"Mesa {mesaNumero} llama",
            $"Un cliente de la mesa {mesaNumero} pide que lo atiendan",
            new Dictionary<string, string>
            {
                { "llamadaId", llamadaId.ToString() },
                { "mesaId", mesaId.ToString() },
                { "mesaNumero", mesaNumero.ToString() },
                { "tipo", "llamada_mesero" }
            });

        /// <summary>
        /// A todos los meseros activos (no hay asignación de mesas). Los tokens que Firebase
        /// reporta como dados de baja se borran para no seguir enviándoles.
        /// </summary>
        private async Task EnviarAMeserosAsync(string titulo, string cuerpo, Dictionary<string, string> datos)
        {
            try
            {
                var tokens = await _context.UsuariosFCM
                    .Where(t => _context.Usuarios.Any(u => u.Id == t.UsuarioId && u.Rol == RolUsuario.Mesero && u.Activo))
                    .Select(t => t.FcmToken)
                    .Distinct()
                    .ToListAsync();

                // Sin tokens o sin credenciales de Firebase no hay a quién enviar (los tokens nunca se imprimen).
                if (tokens.Count == 0 || FirebaseMessaging.DefaultInstance == null)
                    return;

                var message = new MulticastMessage()
                {
                    Tokens = tokens,
                    Notification = new Notification { Title = titulo, Body = cuerpo },
                    Data = datos,
                    Android = new AndroidConfig
                    {
                        Priority = Priority.High,
                        Notification = new AndroidNotification
                        {
                            ChannelId = "pedidos_listos",
                            Sound = "default",
                            Priority = NotificationPriority.HIGH
                        }
                    }
                };

                var response = await FirebaseMessaging.DefaultInstance.SendEachForMulticastAsync(message);
                if (response.FailureCount == 0) return;

                var caducados = tokens
                    .Where((_, i) => response.Responses[i].Exception?.MessagingErrorCode == MessagingErrorCode.Unregistered)
                    .ToList();
                Console.WriteLine($"❌ Push a meseros: {response.FailureCount} fallo(s), {caducados.Count} token(s) dado(s) de baja");
                if (caducados.Count > 0)
                {
                    _context.UsuariosFCM.RemoveRange(_context.UsuariosFCM.Where(t => caducados.Contains(t.FcmToken)));
                    await _context.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error enviando notificación: {ex.Message}");
            }
        }
    }
}
