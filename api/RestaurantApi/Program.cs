using Microsoft.EntityFrameworkCore;
using RestaurantApi;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ? Configurar CORS para permitir ngrok
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.WithOrigins(
            "http://localhost:3000",                          // React local
            "https://empresascol.github.io",                  // GitHub Pages
            "https://*.ngrok-free.app"                        // ? Cualquier subdominio de ngrok
        )
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
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ? NO usar HTTPS redirect cuando se usa ngrok
// app.UseHttpsRedirection();

// Usar CORS
app.UseCors("AllowAll");

app.UseAuthorization();

app.MapControllers();

app.Run();