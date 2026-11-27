using System.IO.Compression;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using RestaurantApi;
using RestaurantApi.Hubs;
using RestaurantApi.Services;

var builder = WebApplication.CreateBuilder(args);

// ── JWT ──────────────────────────────────────────────────────────────────
var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
var jwtSinConfigurar = string.IsNullOrWhiteSpace(jwtOptions.Key);
if (jwtSinConfigurar) jwtOptions.Key = JwtOptions.ClaveAleatoria();
builder.Services.AddSingleton(jwtOptions);
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddSingleton<IntentosLogin>();

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
        // El navegador no envía cabeceras en WebSocket: SignalR manda el JWT por query string.
        options.Events = new JwtBearerEvents
        {
            // Un usuario desactivado, o al que le cambiaron el rol, pierde el acceso aunque su token
            // siga vigente: los permisos salen de la base, no de lo que diga un token de hace horas.
            OnTokenValidated = async ctx =>
            {
                var id = QproClaims.IdUsuario(ctx.Principal);
                if (id == null)
                {
                    ctx.Fail("Token sin usuario");
                    return;
                }
                var db = ctx.HttpContext.RequestServices.GetRequiredService<RestauranteContext>();
                var actual = await db.Usuarios.AsNoTracking()
                    .Where(u => u.Id == id)
                    .Select(u => new { u.Activo, u.Rol, u.NombreUsuario })
                    .FirstOrDefaultAsync();
                if (actual == null || !actual.Activo)
                    ctx.Fail("Usuario desactivado");
                else if (actual.Rol.ToString() != ctx.Principal?.FindFirst(QproClaims.Rol)?.Value)
                    ctx.Fail("El rol del usuario cambió");
                else if (UsuariosSistema.Es(actual.NombreUsuario))
                    ctx.Fail("Usuario técnico");
            },
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && ctx.HttpContext.Request.Path.StartsWithSegments("/api/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

// Todo endpoint exige token salvo los marcados con [AllowAnonymous].
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
});

// ── Límite de intentos (login y endpoints públicos) ──────────────────────
// Detrás de Render todas las conexiones traen la IP del proxy: la real viene en la cabecera de Cloudflare.
var cabeceraIp = CupoPeticiones.CabeceraIp(builder.Configuration);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    // Techo por IP para todo lo del comensal (holgado: un local entero sale por una sola IP).
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        CupoPeticiones.EsDelComensal(ctx.Request.Path)
            ? RateLimitPartition.GetFixedWindowLimiter(CupoPeticiones.Ip(ctx, cabeceraIp),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 1500, Window = TimeSpan.FromMinutes(1) })
            : RateLimitPartition.GetNoLimiter("resto"));
    options.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(
        CupoPeticiones.Ip(ctx, cabeceraIp),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    // Meseros autenticados comparten la IP del restaurante: se limita por usuario.
    options.AddPolicy("publico", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.User.Identity?.IsAuthenticated == true
            ? "u:" + ctx.User.Identity.Name
            : "ip:" + CupoPeticiones.Ip(ctx, cabeceraIp),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1) }));
    // Comensal del QR: se limita por mesa, no por IP. Todas las mesas del local salen por la misma
    // IP y el seguimiento de una no debe agotar el cupo de las demás.
    options.AddPolicy("cliente-mesa", ctx => RateLimitPartition.GetFixedWindowLimiter(
        CupoPeticiones.PorMesa(ctx, cabeceraIp),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 90, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.AddControllers();

// JSON comprimido (Brotli o gzip): las listas de inventario y la carta viajan varias veces más livianas.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
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
builder.Services.AddSignalR();
builder.Services.AddScoped<DomicilioRealtimeService>();
builder.Services.AddScoped<IInventarioService, InventarioService>();

// Avisos al comensal: Web Push (VAPID) solo si están las claves Push:ClavePublica y Push:ClavePrivada.
var pushOptions = builder.Configuration.GetSection("Push").Get<PushOptions>() ?? new PushOptions();
builder.Services.AddSingleton(pushOptions);
builder.Services.AddHttpClient<PushWeb>(c => c.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddScoped<AvisosCliente>();

// Facturación electrónica: la cola de documentos la vacía un servicio en segundo plano. El
// proveedor simulado (Facturacion:Proveedor=Simulado) solo existe fuera de producción: sus códigos
// no valen ante la DIAN. Sin proveedor los documentos esperan en la cola.
var proveedorSimulado = !builder.Environment.IsProduction()
    && string.Equals(builder.Configuration["Facturacion:Proveedor"], "Simulado", StringComparison.OrdinalIgnoreCase);
if (proveedorSimulado) builder.Services.AddSingleton<IProveedorFacturacion, ProveedorSimulado>();
else builder.Services.AddSingleton<IProveedorFacturacion, ProveedorSinConfigurar>();
builder.Services.AddHostedService<EnvioDocumentos>();

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
            .AllowAnyHeader()
            .AllowCredentials(); // lo exige el negotiate de SignalR
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
    // Una regla de facturación (sin numeración vigente) detiene el cobro con su motivo; la
    // transacción del cobro no se confirma, así que no queda nada a medias.
    var conflicto = error is DbUpdateConcurrencyException or FacturacionException;
    context.Response.StatusCode = conflicto ? StatusCodes.Status409Conflict : StatusCodes.Status500InternalServerError;
    await context.Response.WriteAsJsonAsync(new
    {
        message = error is FacturacionException ? error.Message
            : conflicto ? "El registro fue modificado por otro usuario. Recarga e intenta de nuevo."
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

app.UseResponseCompression();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

// Tras cada escritura exitosa se avisa por SignalR qué tema cambió.
app.Use(async (context, next) =>
{
    await next();

    if (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsOptions(context.Request.Method)) return;

    // Lo que esta petición guardó sobre una mesa se avisa a sus comensales (canal aparte del personal).
    await context.RequestServices.GetRequiredService<AvisosCliente>()
        .DespacharAsync(context.RequestServices.GetRequiredService<RestauranteContext>());

    if (context.Response.StatusCode is < 200 or >= 300) return;
    var tema = TemaRealtime.Desde(context.Request.Path.Value);
    if (tema is null) return;

    try
    {
        var hub = context.RequestServices.GetRequiredService<IHubContext<QproHub>>();
        await hub.Clients.All.SendAsync("cambio", tema);
    }
    catch (Exception ex)
    {
        // Un aviso fallido no debe romper la petición: el polling de respaldo lo cubre.
        app.Logger.LogWarning(ex, "No se pudo avisar el cambio '{Tema}' por SignalR", tema);
    }
});

// Endpoint de salud para Docker healthcheck
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow })).AllowAnonymous();
app.MapGet("/api/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow })).AllowAnonymous();

app.MapControllers();
app.MapHub<QproHub>("/api/hubs/qpro");
app.MapHub<ClienteHub>("/api/hubs/mesa").RequireRateLimiting("cliente-mesa");

if (!pushOptions.ClavePublica.Any())
    app.Logger.LogInformation("Push:ClavePublica no está configurada: los comensales no recibirán avisos con la página cerrada.");

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
