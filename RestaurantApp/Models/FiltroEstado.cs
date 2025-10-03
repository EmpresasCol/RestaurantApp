namespace RestaurantApp.Models
{
    public class FiltroEstado
    {
        public string Texto { get; set; }
        public string Valor { get; set; }
        public Color ColorFondo { get; set; }
        public bool EstaSeleccionado { get; set; }

        // Métodos estáticos para filtros predeterminados
        public static List<FiltroEstado> ObtenerFiltrosPedidos()
        {
            return new List<FiltroEstado>
            {
                new FiltroEstado { Texto = "Todos", Valor = "Todos", ColorFondo = Colors.Gray },
                new FiltroEstado { Texto = "En Proceso", Valor = "EnProceso", ColorFondo = Colors.Orange },
                new FiltroEstado { Texto = "Listos", Valor = "Listo", ColorFondo = Colors.Green },
                new FiltroEstado { Texto = "Entregados", Valor = "Entregado", ColorFondo = Colors.Blue }, // NUEVO
                new FiltroEstado { Texto = "Pagados", Valor = "Pagado", ColorFondo = Colors.Purple },
                new FiltroEstado { Texto = "Cancelados", Valor = "Cancelado", ColorFondo = Colors.Red }
            };
        }

        public static List<FiltroEstado> ObtenerFiltrosMesas()
        {
            return new List<FiltroEstado>
            {
                new FiltroEstado { Texto = "Todas", Valor = "Todas", ColorFondo = Colors.Gray },
                new FiltroEstado { Texto = "Disponibles", Valor = "Disponible", ColorFondo = Colors.Green },
                new FiltroEstado { Texto = "Ocupadas", Valor = "Ocupada", ColorFondo = Colors.Red },
                new FiltroEstado { Texto = "Esperando Pago", Valor = "EsperandoPago", ColorFondo = Colors.Orange }
            };
        }
    }
}