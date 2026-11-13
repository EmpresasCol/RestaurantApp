namespace RestaurantApi.Models
{
    /// <summary>
    /// Una visita a la mesa: se abre con su primer pedido y se cierra cuando ya no queda nada
    /// por cobrar. El comensal sigue sus pedidos con el <see cref="Token"/> de la ocupación, no
    /// con el QR impreso (que es el mismo para todos los que se sienten después).
    /// </summary>
    public class Ocupacion
    {
        public int Id { get; set; }
        public int MesaId { get; set; }
        /// <summary>Secreto de seguimiento (32 hexadecimales al azar); deja de servir al cerrar.</summary>
        public string Token { get; set; } = string.Empty;
        /// <summary>Código de 6 dígitos que el personal le dicta a otro comensal de la mesa para unirse.</summary>
        public string Pin { get; set; } = string.Empty;
        public int IntentosPin { get; set; }
        public DateTime Inicio { get; set; } = DateTime.UtcNow;
        public DateTime? Cierre { get; set; }
        /// <summary>
        /// true mientras está abierta y NULL al cerrar: el índice único (MesaId, Abierta) impide
        /// dos ocupaciones abiertas en la misma mesa (los NULL no chocan entre sí).
        /// </summary>
        public bool? Abierta { get; set; } = true;

        public Mesa? Mesa { get; set; }
    }

    /// <summary>El comensal pide que un mesero vaya a la mesa. Queda guardada hasta que se atiende.</summary>
    public class LlamadaMesero
    {
        public const string Pendiente = "Pendiente";
        public const string EnCamino = "EnCamino";
        public const string Atendida = "Atendida";
        /// <summary>La mesa se liberó antes de atenderla.</summary>
        public const string Cerrada = "Cerrada";

        public int Id { get; set; }
        public int MesaId { get; set; }
        public int? OcupacionId { get; set; }
        /// <summary>Secreto con que el comensal que llamó consulta el estado (aún sin ocupación).</summary>
        public string Clave { get; set; } = string.Empty;
        public DateTime Fecha { get; set; } = DateTime.UtcNow;
        public string Estado { get; set; } = Pendiente;
        /// <summary>Mesero que la tomó o la atendió.</summary>
        public int? MeseroId { get; set; }
        public DateTime? FechaTomada { get; set; }
        public DateTime? FechaAtendida { get; set; }
        /// <summary>true mientras sigue viva (Pendiente o EnCamino), NULL después: una sola llamada viva por mesa.</summary>
        public bool? Activa { get; set; } = true;

        public Mesa? Mesa { get; set; }
        public Usuario? Mesero { get; set; }
    }

    /// <summary>Suscripción Web Push de un navegador a los avisos de una ocupación.</summary>
    public class SuscripcionPush
    {
        public int Id { get; set; }
        public int OcupacionId { get; set; }
        public string Endpoint { get; set; } = string.Empty;
        /// <summary>SHA-256 del endpoint (hex): clave única corta para no indexar la URL completa.</summary>
        public string Huella { get; set; } = string.Empty;
        public DateTime Fecha { get; set; } = DateTime.UtcNow;
    }
}
