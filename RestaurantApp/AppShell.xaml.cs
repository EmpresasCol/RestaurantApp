using Microsoft.Extensions.Logging;

namespace RestaurantApp
{
    public partial class AppShell : Shell
    {
        public AppShell()
        {
            InitializeComponent();

            // Registrar rutas adicionales si es necesario
            RegisterRoutes();
        }

        private void RegisterRoutes()
        {
            // Aquí puedes registrar rutas adicionales para navegación
            // Routing.RegisterRoute("detallepedido", typeof(DetallePedidoView));
            // Routing.RegisterRoute("editarpedido", typeof(EditarPedidoView));
        }
    }
}