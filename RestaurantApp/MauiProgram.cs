using Microsoft.Extensions.Logging;

namespace RestaurantApp
{
    public static class MauiProgram
    {
        public static MauiApp CreateMauiApp()
        {
            var builder = MauiApp.CreateBuilder();
            builder
                .UseMauiApp<App>()
                .ConfigureFonts(fonts =>
                {
                    fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                    fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
                });

            // Registrar servicios
            builder.Services.AddSingleton<MainPage>();

            // Registrar Views
            builder.Services.AddTransient<Views.MeseroMainView>();
            builder.Services.AddTransient<Views.NuevoPedidoView>();
            builder.Services.AddTransient<Views.PedidosActivosView>();
            builder.Services.AddTransient<Views.ConfiguracionView>();

            // Registrar ViewModels
            builder.Services.AddTransient<ViewModels.MeseroMainViewModel>();
            builder.Services.AddTransient<ViewModels.NuevoPedidoViewModel>();
            builder.Services.AddTransient<ViewModels.PedidosActivosViewModel>();
            builder.Services.AddTransient<ViewModels.ConfiguracionViewModel>();

#if DEBUG
            builder.Logging.AddDebug();
#endif

            return builder.Build();
        }
    }
}