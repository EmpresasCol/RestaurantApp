using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;

namespace RestaurantApi.Services
{
    public class NotificationService
    {
        public NotificationService()
        {
            if (FirebaseApp.DefaultInstance == null)
            {
                FirebaseApp.Create(new AppOptions()
                {
                    Credential = GoogleCredential.FromFile("firebase-credentials.json")
                });
            }
        }

        public async Task EnviarNotificacionPedidoListo(int pedidoId, int mesaNumero, string fcmToken)
        {
            var message = new Message()
            {
                Token = fcmToken,
                Notification = new Notification
                {
                    Title = "🔔 Pedido Listo",
                    Body = $"El pedido #{pedidoId} de la mesa {mesaNumero} está listo para entregar"
                },
                Data = new Dictionary<string, string>()
                {
                    { "pedidoId", pedidoId.ToString() },
                    { "mesaNumero", mesaNumero.ToString() }
                }
            };

            string response = await FirebaseMessaging.DefaultInstance.SendAsync(message);
            Console.WriteLine($"✅ Notificación enviada: {response}");
        }
    }
}