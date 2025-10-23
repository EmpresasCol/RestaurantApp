// RestaurantApp/MauiProgram.cs
using Microsoft.Extensions.Logging;
using RestaurantApp.Services;

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

            // Registrar servicios HTTP y de datos
            builder.Services.AddSingleton<HttpService>();
            builder.Services.AddSingleton<MesaService>();
            builder.Services.AddSingleton<PlatilloService>();
            builder.Services.AddSingleton<PedidoService>();
            builder.Services.AddSingleton<UsuarioService>();
            builder.Services.AddSingleton<SincronizacionService>();
            builder.Services.AddSingleton<PagoService>();

            // Registrar páginas
            builder.Services.AddSingleton<MainPage>();

            // Registrar Views
            builder.Services.AddTransient<Views.MeseroMainView>();
            builder.Services.AddTransient<Views.NuevoPedidoView>();
            builder.Services.AddTransient<Views.PedidosActivosView>();
            builder.Services.AddTransient<Views.ConfiguracionView>();
            builder.Services.AddTransient<Views.EditarPedidoView>();

            // Registrar ViewModels
            builder.Services.AddTransient<ViewModels.MeseroMainViewModel>();
            builder.Services.AddTransient<ViewModels.NuevoPedidoViewModel>();
            builder.Services.AddTransient<ViewModels.PedidosActivosViewModel>();
            builder.Services.AddTransient<ViewModels.ConfiguracionViewModel>();
            builder.Services.AddTransient<ViewModels.EditarPedidoViewModel>();

#if DEBUG
            builder.Logging.AddDebug();
#endif

            return builder.Build();
        }
    }
}