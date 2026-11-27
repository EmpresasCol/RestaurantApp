namespace RestaurantApi.Models
{
    /// <summary>
    /// Personalización del restaurante (una sola fila): marca, carta del comensal, facturas y
    /// operación. La leen la web, el menú QR, la tirilla y la app móvil; solo el administrador la
    /// cambia. Los valores por defecto dejan el sistema igual que antes de existir la tabla.
    /// </summary>
    public class ConfiguracionRestaurante
    {
        public const string ColorMarcaPorDefecto = "#C8955E";
        public const string ColorAccionPorDefecto = "#2A1D15";

        public int Id { get; set; } = 1;

        // Marca
        public string Nombre { get; set; } = "Qpro";
        public string? Eslogan { get; set; }
        /// <summary>Data URI (JPEG, PNG o WebP) reducido en el navegador. Nulo: el logo de Qpro.</summary>
        public string? Logo { get; set; }
        /// <summary>Color de la marca (#RRGGBB): resaltes, conteos y fondos suaves.</summary>
        public string ColorMarca { get; set; } = ColorMarcaPorDefecto;
        /// <summary>Color de las acciones (#RRGGBB): botones, títulos y texto principal. Oscuro.</summary>
        public string ColorAccion { get; set; } = ColorAccionPorDefecto;

        // Carta del comensal y contacto
        public string? MensajeBienvenida { get; set; }
        public string? Horario { get; set; }
        public string? Whatsapp { get; set; }
        public string? Instagram { get; set; }
        /// <summary>Apagado: el comensal ve la carta y llama al mesero, pero no envía pedidos por el QR.</summary>
        public bool PedidosQR { get; set; } = true;

        // Facturas
        /// <summary>Mensaje al pie de la factura. Nulo: "Gracias por su visita".</summary>
        public string? PieFactura { get; set; }
        public bool LogoEnFactura { get; set; }

        // Operación
        /// <summary>Propina voluntaria que sugieren la caja y la app del mesero, en porcentaje (0 = no sugerir).</summary>
        public int PropinaSugerida { get; set; } = 10;
        /// <summary>Costo del envío que propone un domicilio nuevo (caja y página pública).</summary>
        public decimal CostoEnvio { get; set; } = 3000;
        /// <summary>Minutos de espera para que una comanda salga "Demorada" y "Urgente" en cocina.</summary>
        public int MinutosAlerta { get; set; } = 10;
        public int MinutosUrgente { get; set; } = 15;

        public DateTime? FechaActualizacion { get; set; }
    }
}
