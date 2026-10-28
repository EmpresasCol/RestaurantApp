using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using RestaurantApi;
using RestaurantApi.Services;

var builder = WebApplication.CreateBuilder(args);

// ── JWT ──────────────────────────────────────────────────────────────────
var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
var jwtSinConfigurar = string.IsNullOrWhiteSpace(jwtOptions.Key);
if (jwtSinConfigurar) jwtOptions.Key = JwtOptions.ClaveAleatoria();
builder.Services.AddSingleton(jwtOptions);
builder.Services.AddSingleton<JwtTokenService>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = jwtOptions.ClaveFirma(),
            NameClaimType = QproClaims.Usuario,
            RoleClaimType = QproClaims.Rol,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

// Todo endpoint exige token salvo los marcados con [AllowAnonymous].
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
});

// ── Límite de intentos (login y endpoints públicos) ──────────────────────
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    // Meseros autenticados comparten la IP del restaurante: se limita por usuario.
    options.AddPolicy("publico", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.User.Identity?.IsAuthenticated == true
            ? "u:" + ctx.User.Identity.Name
            : "ip:" + (ctx.Connection.RemoteIpAddress?.ToString() ?? "anon"),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = Array.Empty<string>()
    });
});
builder.Services.AddScoped<DomicilioRealtimeService>();
builder.Services.AddScoped<IInventarioService, InventarioService>();

// ── CORS: solo los frontends conocidos (Cors:Origenes separados por coma) ──
var origenes = (builder.Configuration["Cors:Origenes"]
                ?? "http://localhost:3000,http://localhost:3001,https://empresascol.github.io,https://qpro-web.onrender.com")
    .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(origenes)
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

// Agregar DbContext para MySQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException(
        "Falta ConnectionStrings:DefaultConnection (variable de entorno ConnectionStrings__DefaultConnection).");

builder.Services.AddDbContext<RestauranteContext>(options =>
   options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 36))));

var app = builder.Build();

if (jwtSinConfigurar)
    app.Logger.LogWarning("Jwt:Key no está configurada: se usa una clave temporal y las sesiones se invalidan al reiniciar.");

// Errores no controlados: se registran en el log y el cliente solo recibe un mensaje genérico.
app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    var error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
    var conflicto = error is DbUpdateConcurrencyException;
    context.Response.StatusCode = conflicto ? StatusCodes.Status409Conflict : StatusCodes.Status500InternalServerError;
    await context.Response.WriteAsJsonAsync(new
    {
        message = conflicto
            ? "El registro fue modificado por otro usuario. Recarga e intenta de nuevo."
            : "Error interno del servidor.",
        traceId = context.TraceIdentifier
    });
}));

// Swagger solo en desarrollo o si se activa explícitamente (EnableSwagger=true).
if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("EnableSwagger"))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

// Endpoint de salud para Docker healthcheck
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow })).AllowAnonymous();
app.MapGet("/api/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow })).AllowAnonymous();

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
