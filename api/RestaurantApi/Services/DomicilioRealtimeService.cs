using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;

namespace RestaurantApi.Services
{
    public class DomicilioRealtimeService
    {
        private readonly RestauranteContext _context;
        private readonly ILogger<DomicilioRealtimeService> _logger;

        public DomicilioRealtimeService(
            RestauranteContext context,
            ILogger<DomicilioRealtimeService> logger)
        {
            _context = context;
            _logger  = logger;

            // Reutiliza la inicialización del FirebaseApp del resto del sistema.
            if (FirebaseApp.DefaultInstance is null)
            {
                try
                {
                    var candidates = new[] { "firebase-service-account.json", "firebase-credentials.json" };
                    var path = candidates.FirstOrDefault(File.Exists);
                    if (path is not null)
                    {
                        FirebaseApp.Create(new AppOptions
                        {
                            Credential = GoogleCredential.FromFile(path)
                        });
                        _logger.LogInformation("🔥 Firebase Admin SDK inicializado desde {Path}", path);
                    }
                    else
                    {
                        _logger.LogWarning("⚠️ Credenciales Firebase no encontradas; FCM deshabilitado.");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ Error inicializando FirebaseApp");
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // Notificaciones por evento
        // ══════════════════════════════════════════════════════════════════

        public async Task NotificarNuevoDomicilioAsync(Domicilio d)
        {
            await SendToTopicAsync("admin_domicilios",
                "🚲 Nuevo pedido a domicilio",
                $"Pedido #{d.Id} por ${d.Total:N0}",
                new Dictionary<string, string>
                {
                    ["tipo"]        = "nuevo_domicilio",
                    ["domicilioId"] = d.Id.ToString(),
                    ["estado"]      = d.Estado,
                    ["total"]       = d.Total.ToString("0.##")
                });
        }

        public async Task NotificarCambioEstadoAsync(Domicilio d)
        {
            // Topic al domiciliario (si está "libre" interesa a todos; si ya tiene dueño,
            // igual se envía al topic general porque FCM no tiene filtro por usuario nativo).
            await SendToTopicAsync("domiciliarios",
                TituloPorEstado(d.Estado),
                $"Pedido #{d.Id} · {d.Estado}",
                new Dictionary<string, string>
                {
                    ["tipo"]           = "cambio_estado_domicilio",
                    ["domicilioId"]    = d.Id.ToString(),
                    ["estado"]         = d.Estado,
                    ["domiciliarioId"] = d.DomiciliarioId?.ToString() ?? ""
                });

            await SendToTopicAsync("admin_domicilios",
                "Estado actualizado",
                $"Pedido #{d.Id} → {d.Estado}",
                new Dictionary<string, string>
                {
                    ["tipo"]        = "cambio_estado_domicilio",
                    ["domicilioId"] = d.Id.ToString(),
                    ["estado"]      = d.Estado
                });

            // Topic específico del cliente (su página pública).
            if (!string.IsNullOrEmpty(d.TokenSeguimiento))
            {
                await SendToTopicAsync($"domicilio_{d.TokenSeguimiento}",
                    "Tu pedido se actualizó",
                    $"Estado: {d.Estado}",
                    new Dictionary<string, string>
                    {
                        ["tipo"]        = "cambio_estado_domicilio",
                        ["domicilioId"] = d.Id.ToString(),
                        ["estado"]      = d.Estado
                    });
            }
        }

        public async Task NotificarObservacionAsync(Domicilio d)
        {
            await SendToTopicAsync("admin_domicilios",
                "💬 Nueva observación recibida",
                $"Pedido #{d.Id}: {Truncar(d.ObservacionCliente ?? "", 80)}",
                new Dictionary<string, string>
                {
                    ["tipo"]        = "observacion_cliente",
                    ["domicilioId"] = d.Id.ToString()
                });
        }

        // ══════════════════════════════════════════════════════════════════
        // Helpers
        // ══════════════════════════════════════════════════════════════════

        private async Task SendToTopicAsync(string topic, string titulo, string cuerpo,
                                            Dictionary<string, string> data)
        {
            if (FirebaseApp.DefaultInstance is null) return;

            try
            {
                var message = new Message
                {
                    Topic = topic,
                    Notification = new Notification { Title = titulo, Body = cuerpo },
                    Data = data,
                    Android = new AndroidConfig
                    {
                        Priority = Priority.High,
                        Notification = new AndroidNotification
                        {
                            ChannelId = "domicilios",
                            Sound     = "default",
                            Priority  = NotificationPriority.HIGH
                        }
                    }
                };

                var resp = await FirebaseMessaging.DefaultInstance.SendAsync(message);
                _logger.LogInformation("📤 FCM → topic '{Topic}' · id={Id}", topic, resp);
            }
            catch (Exception ex)
            {
                // No se propaga: un fallo de notificación no debe romper el flujo.
                _logger.LogWarning(ex, "⚠️ No se pudo enviar FCM al topic '{Topic}'", topic);
            }
        }

        private static string TituloPorEstado(string estado) => estado switch
        {
            "Listo"     => "🔔 Pedido listo para recoger",
            "Recogido"  => "📦 Pedido recogido del restaurante",
            "EnCamino"  => "🛵 Pedido en camino",
            "Entregado" => "✅ Pedido entregado",
            "Cancelado" => "❌ Pedido cancelado",
            _           => "Actualización de pedido"
        };

        private static string Truncar(string s, int max)
            => s.Length <= max ? s : s[..max] + "…";
    }
}
