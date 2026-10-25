using Microsoft.EntityFrameworkCore;
using RestaurantApi;
using RestaurantApi.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddScoped<DomicilioRealtimeService>();
builder.Services.AddScoped<IInventarioService, InventarioService>();

// Configurar CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// Agregar DbContext para MySQL
builder.Services.AddDbContext<RestauranteContext>(options =>
   options.UseMySql(
       builder.Configuration.GetConnectionString("DefaultConnection"),
       new MySqlServerVersion(new Version(8, 0, 36))
   )
);

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("EnableSwagger", true))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Endpoint de salud para Docker healthcheck
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow }));
app.MapGet("/api/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow }));

// Usar CORS
app.UseCors("AllowAll");

app.UseAuthorization();

app.MapControllers();

// Inicializar recetas predeterminadas en arranque de la aplicación
try
{
    using var scope = app.Services.CreateScope();
    var inventarioService = scope.ServiceProvider.GetRequiredService<IInventarioService>();
    await inventarioService.InicializarRecetasPredeterminadasAsync();
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "⚠️ Advertencia al verificar/sembrar recetas predeterminadas en arranque");
}

app.Run();