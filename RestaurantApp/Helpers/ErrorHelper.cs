// RestaurantApp/Helpers/ErrorHelper.cs
namespace RestaurantApp.Helpers
{
    public static class ErrorHelper
    {
        public static string ObtenerMensajeError(Exception ex)
        {
            if (ex is HttpRequestException)
            {
                return "Error de conexión. Verifica tu conexión a internet.";
            }
            else if (ex is TaskCanceledException)
            {
                return "La operación tardó demasiado tiempo. Intenta nuevamente.";
            }
            else if (ex.Message.Contains("404"))
            {
                return "Recurso no encontrado en el servidor.";
            }
            else if (ex.Message.Contains("500"))
            {
                return "Error interno del servidor. Contacta al administrador.";
            }
            else if (ex.Message.Contains("401") || ex.Message.Contains("403"))
            {
                return "No tienes permisos para realizar esta acción.";
            }
            else
            {
                return $"Error: {ex.Message}";
            }
        }

        public static async Task MostrarErrorAsync(Exception ex, string titulo = "Error")
        {
            var mensaje = ObtenerMensajeError(ex);
            await Application.Current.MainPage.DisplayAlert(titulo, mensaje, "OK");
        }
    }
}