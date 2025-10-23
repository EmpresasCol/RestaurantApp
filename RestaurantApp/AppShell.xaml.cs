namespace RestaurantApp
{
    public partial class AppShell : Shell
    {
        public AppShell()
        {
            InitializeComponent();

            // Registrar la ruta de editar pedido
            Routing.RegisterRoute("editarpedido", typeof(Views.EditarPedidoView));
        }
    }
}