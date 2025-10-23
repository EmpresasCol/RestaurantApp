using RestaurantApp.ViewModels;

namespace RestaurantApp.Views
{
    public partial class EditarPedidoView : ContentPage
    {
        public EditarPedidoView()
        {
            InitializeComponent();
            BindingContext = new EditarPedidoViewModel();
        }
    }
}