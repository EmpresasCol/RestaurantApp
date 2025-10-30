using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;

namespace RestaurantApi.Services
{
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

        public async Task EnviarNotificacionPedidoListo(int pedidoId, int mesaNumero)
        {
            try
            {
                Console.WriteLine($"🔔 Iniciando envío de notificación para pedido {pedidoId}");

                // ✅ OBTENER TOKENS DE TODOS LOS MESEROS (no solo el que creó el pedido)
                var meseros = await _context.Usuarios
                    .Where(u => u.Rol == RolUsuario.Mesero)
                    .Select(u => u.Id)
                    .ToListAsync();

                Console.WriteLine($"👥 Meseros encontrados: {meseros.Count}");

                var tokens = await _context.UsuariosFCM
                    .Where(u => meseros.Contains(u.UsuarioId))
                    .Select(u => u.FcmToken)
                    .ToListAsync();

                Console.WriteLine($"📱 Tokens FCM encontrados: {tokens.Count}");

                if (!tokens.Any())
                {
                    Console.WriteLine($"⚠️ No hay tokens FCM registrados para meseros");
                    return;
                }

                foreach (var token in tokens)
                {
                    Console.WriteLine($"   Token: {token.Substring(0, 20)}...");
                }

                var message = new MulticastMessage()
                {
                    Tokens = tokens,
                    Notification = new Notification
                    {
                        Title = "🔔 Pedido Listo",
                        Body = $"El pedido #{pedidoId} de la mesa {mesaNumero} está listo para entregar"
                    },
                    Data = new Dictionary<string, string>()
            {
                { "pedidoId", pedidoId.ToString() },
                { "mesaNumero", mesaNumero.ToString() },
                { "tipo", "pedido_listo" }
            },
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

                Console.WriteLine($"📤 Enviando notificación a {tokens.Count} dispositivo(s)...");

                var response = await FirebaseMessaging.DefaultInstance.SendEachForMulticastAsync(message);

                Console.WriteLine($"✅ Notificaciones enviadas: {response.SuccessCount}/{tokens.Count}");

                if (response.FailureCount > 0)
                {
                    Console.WriteLine($"❌ Fallos: {response.FailureCount}");
                    for (int i = 0; i < response.Responses.Count; i++)
                    {
                        if (!response.Responses[i].IsSuccess)
                        {
                            Console.WriteLine($"   Error en token {i}: {response.Responses[i].Exception?.Message}");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error enviando notificación: {ex.Message}");
                Console.WriteLine($"   Stack: {ex.StackTrace}");
            }
        }
    }
}