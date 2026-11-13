using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Hubs;
using RestaurantApi.Models;
using RestaurantApi.Services;
using Xunit;
using static RestaurantApi.Tests.OcupacionesTests;

namespace RestaurantApi.Tests;

/// <summary>Avisos al comensal: SignalR por grupo de visita y Web Push sin contenido.</summary>
public class AvisosClienteTests
{
    private const string Fcm = "https://fcm.googleapis.com/fcm/send/";

    /// <summary>Servicio de push falso: responde con el código que se le indique por endpoint.</summary>
    private sealed class PushFalso : HttpMessageHandler
    {
        public readonly Dictionary<string, HttpStatusCode> Respuestas = new();
        public readonly List<HttpRequestMessage> Recibidas = new();
        public readonly List<int> Tamanos = new();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Recibidas.Add(request);
            Tamanos.Add(request.Content == null ? 0 : (await request.Content.ReadAsByteArrayAsync(cancellationToken)).Length);
            Assert.StartsWith("vapid t=", request.Headers.GetValues("Authorization").Single());
            var codigo = Respuestas.GetValueOrDefault(request.RequestUri!.ToString(), HttpStatusCode.Created);
            return new HttpResponseMessage(codigo);
        }
    }

    private sealed class HubFalso : IHubContext<ClienteHub>
    {
        public readonly ClientesFalsos Clientes = new();
        public List<string> Grupos => Clientes.Grupos;
        public IHubClients Clients => Clientes;
        public IGroupManager Groups => throw new NotSupportedException();
    }

    private sealed class ClientesFalsos : IHubClients, IClientProxy
    {
        public readonly List<string> Grupos = new();
        public IClientProxy Groups(IReadOnlyList<string> groupNames) { Grupos.AddRange(groupNames); return this; }
        public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public IClientProxy All => this;
        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => this;
        public IClientProxy Client(string connectionId) => this;
        public IClientProxy Clients(IReadOnlyList<string> connectionIds) => this;
        public IClientProxy Group(string groupName) => Groups(new[] { groupName });
        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => this;
        public IClientProxy User(string userId) => this;
        public IClientProxy Users(IReadOnlyList<string> userIds) => this;
    }

    private static PushOptions ClavesNuevas()
    {
        using var ec = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var p = ec.ExportParameters(true);
        var publica = new byte[65];
        publica[0] = 4;
        p.Q.X!.CopyTo(publica, 1);
        p.Q.Y!.CopyTo(publica, 33);
        return new PushOptions { ClavePublica = PushWeb.ABase64Url(publica), ClavePrivada = PushWeb.ABase64Url(p.D!) };
    }

    private static (AvisosCliente Avisos, PushFalso Http, HubFalso Hub, PushWeb Push) Montar(string nombreBd)
    {
        var http = new PushFalso();
        var push = new PushWeb(ClavesNuevas(), new HttpClient(http), NullLogger<PushWeb>.Instance);
        var servicios = new ServiceCollection()
            .AddDbContext<RestauranteContext>(o => o.UseInMemoryDatabase(nombreBd)
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning)))
            .BuildServiceProvider();
        var hub = new HubFalso();
        return (new AvisosCliente(hub, push, servicios.GetRequiredService<IServiceScopeFactory>(), NullLogger<AvisosCliente>.Instance), http, hub, push);
    }

    private static RestauranteContext Bd(string nombre)
    {
        var ctx = new RestauranteContext(new DbContextOptionsBuilder<RestauranteContext>().UseInMemoryDatabase(nombre)
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning)).Options);
        return ctx;
    }

    private static string NombreBd(RestauranteContext ctx)
        => Microsoft.EntityFrameworkCore.Infrastructure.AccessorExtensions.GetService<Microsoft.EntityFrameworkCore.Infrastructure.IDbContextOptions>(ctx)
            .Extensions.OfType<Microsoft.EntityFrameworkCore.InMemory.Infrastructure.Internal.InMemoryOptionsExtension>().Single().StoreName;

    [Fact]
    public void La_firma_vapid_es_un_jwt_es256_valido_para_el_servicio()
    {
        var claves = ClavesNuevas();
        var push = new PushWeb(claves, new HttpClient(), NullLogger<PushWeb>.Instance);

        var cabecera = push.Autorizacion(new Uri(Fcm + "abc"), DateTime.UtcNow);

        Assert.StartsWith("vapid t=", cabecera);
        Assert.EndsWith($", k={claves.ClavePublica}", cabecera);
        var jwt = cabecera["vapid t=".Length..cabecera.IndexOf(',')].Split('.');
        var datos = JsonDocument.Parse(PushWeb.DeBase64Url(jwt[1])).RootElement;
        Assert.Equal("https://fcm.googleapis.com", datos.GetProperty("aud").GetString());

        var publica = PushWeb.DeBase64Url(claves.ClavePublica);
        using var ec = ECDsa.Create(new ECParameters { Curve = ECCurve.NamedCurves.nistP256, Q = new ECPoint { X = publica[1..33], Y = publica[33..65] } });
        Assert.True(ec.VerifyData(Encoding.ASCII.GetBytes($"{jwt[0]}.{jwt[1]}"), PushWeb.DeBase64Url(jwt[2]), HashAlgorithmName.SHA256,
            DSASignatureFormat.IeeeP1363FixedFieldConcatenation));
    }

    [Theory]
    [InlineData("https://fcm.googleapis.com/fcm/send/x", true)]
    [InlineData("https://web.push.apple.com/abc", true)]
    [InlineData("https://updates.push.services.mozilla.com/wpush/v2/x", true)]
    [InlineData("http://fcm.googleapis.com/fcm/send/x", false)]
    [InlineData("https://169.254.169.254/latest", false)]
    [InlineData("https://evil.com/?fcm.googleapis.com", false)]
    [InlineData("https://fcm.googleapis.com.evil.com/x", false)]
    public void Solo_se_llama_a_servicios_de_push_conocidos_por_https(string endpoint, bool valido)
        => Assert.Equal(valido, PushWeb.EndpointValido(endpoint));

    [Fact]
    public async Task Un_cambio_avisa_al_grupo_de_la_visita_y_borra_la_suscripcion_vencida()
    {
        using var ctx = TestDb.Crear();
        var qr = await PedirPorQrAsync(ctx);
        var ocupacion = ctx.Ocupaciones.AsNoTracking().Single();
        var (avisos, http, hub, push) = Montar(NombreBd(ctx));
        var cliente = ClienteMesaTests.Cliente(ctx, push);
        await cliente.Suscribir(new SuscripcionPushDto { Endpoint = Fcm + "vivo" }, TestDb.CodigoMesaUno, qr.Seguimiento);
        await cliente.Suscribir(new SuscripcionPushDto { Endpoint = Fcm + "vencido" }, TestDb.CodigoMesaUno, qr.Seguimiento);
        http.Respuestas[Fcm + "vencido"] = HttpStatusCode.Gone;
        ctx.MesasTocadas.Clear();
        ctx.MesasConAviso.Clear();

        // La cocina deja el pedido listo: amerita aviso con la página cerrada.
        await TestDb.Sesion(Qr(ctx), TestDb.AdminId, RolUsuario.Cocina).ActualizarEstado(qr.Id, new ActualizarEstadoPedidoDto { Estado = "Listo" });
        await avisos.DespacharAsync(ctx, esperarPush: true);

        Assert.Contains(ClienteHub.Grupo(ocupacion.Id), hub.Grupos);
        Assert.Equal(2, http.Recibidas.Count);
        Assert.All(http.Tamanos, t => Assert.Equal(0, t)); // sin datos del pedido
        var quedan = Bd(NombreBd(ctx)).SuscripcionesPush.Select(s => s.Endpoint).ToList();
        Assert.Equal(new[] { Fcm + "vivo" }, quedan);
    }

    [Fact]
    public async Task Un_push_fallido_no_borra_la_suscripcion_ni_deshace_el_cambio()
    {
        using var ctx = TestDb.Crear();
        var qr = await PedirPorQrAsync(ctx);
        var (avisos, http, _, push) = Montar(NombreBd(ctx));
        await ClienteMesaTests.Cliente(ctx, push).Suscribir(new SuscripcionPushDto { Endpoint = Fcm + "a" }, TestDb.CodigoMesaUno, qr.Seguimiento);
        http.Respuestas[Fcm + "a"] = HttpStatusCode.InternalServerError;
        ctx.MesasTocadas.Clear();

        await TestDb.Sesion(Qr(ctx), TestDb.AdminId, RolUsuario.Cocina).ActualizarEstado(qr.Id, new ActualizarEstadoPedidoDto { Estado = "Listo" });
        await avisos.DespacharAsync(ctx, esperarPush: true);

        Assert.Single(Bd(NombreBd(ctx)).SuscripcionesPush);
        Assert.Equal(EstadoPedido.Listo, ctx.Pedidos.AsNoTracking().Single().Estado);
    }

    [Fact]
    public async Task Al_cerrar_la_visita_se_envia_el_aviso_final_y_se_desligan_los_navegadores()
    {
        using var ctx = TestDb.Crear();
        var qr = await PedirPorQrAsync(ctx);
        Servir(ctx, qr.Id);
        var (avisos, http, _, push) = Montar(NombreBd(ctx));
        await ClienteMesaTests.Cliente(ctx, push).Suscribir(new SuscripcionPushDto { Endpoint = Fcm + "a" }, TestDb.CodigoMesaUno, qr.Seguimiento);
        ctx.MesasTocadas.Clear();

        await TestDb.Sesion(new PagosController(ctx), TestDb.AdminId, RolUsuario.Caja)
            .Cobrar(new CrearCobroDto { PedidoIds = { qr.Id }, MetodoPago = "Efectivo" });
        await avisos.DespacharAsync(ctx, esperarPush: true);

        Assert.Single(http.Recibidas);
        Assert.Empty(Bd(NombreBd(ctx)).SuscripcionesPush);

        // La mesa vuelve a llenarse: ese navegador ya no recibe nada de la visita nueva.
        await PedirPorQrAsync(ctx);
        await avisos.DespacharAsync(ctx, esperarPush: true);
        Assert.Single(http.Recibidas);
    }

    [Fact]
    public async Task El_mismo_navegador_en_una_visita_nueva_deja_la_anterior()
    {
        using var ctx = TestDb.Crear();
        var uno = await PedirPorQrAsync(ctx);
        var dos = await PedirPorQrAsync(ctx, codigo: TestDb.CodigoMesaDos);
        var (_, _, _, push) = Montar(NombreBd(ctx));
        var c = ClienteMesaTests.Cliente(ctx, push);

        await c.Suscribir(new SuscripcionPushDto { Endpoint = Fcm + "a" }, TestDb.CodigoMesaUno, uno.Seguimiento);
        await c.Suscribir(new SuscripcionPushDto { Endpoint = Fcm + "a" }, TestDb.CodigoMesaDos, dos.Seguimiento);

        var s = Assert.Single(ctx.SuscripcionesPush.AsNoTracking());
        Assert.Equal(ctx.Ocupaciones.AsNoTracking().Single(o => o.MesaId == TestDb.MesaDosId).Id, s.OcupacionId);
    }

    [Fact]
    public async Task Sin_claves_vapid_no_se_ofrece_push_y_el_seguimiento_sigue()
    {
        using var ctx = TestDb.Crear();
        var qr = await PedirPorQrAsync(ctx);
        var sinClaves = new PushWeb(new PushOptions(), new HttpClient(), NullLogger<PushWeb>.Instance);

        Assert.IsType<Microsoft.AspNetCore.Mvc.NotFoundObjectResult>(ClienteMesaTests.Cliente(ctx, sinClaves).GetClavePush());
        Assert.Single(ClienteMesaTests.Seguir(ctx, qr.Seguimiento).Pedidos);
    }

    [Fact]
    public async Task Suscribirse_exige_la_llave_de_una_visita_abierta()
    {
        using var ctx = TestDb.Crear();
        var (_, _, _, push) = Montar(NombreBd(ctx));
        var c = ClienteMesaTests.Cliente(ctx, push);

        var r = await c.Suscribir(new SuscripcionPushDto { Endpoint = Fcm + "a" }, TestDb.CodigoMesaUno, "llave-inventada");

        Assert.IsType<Microsoft.AspNetCore.Mvc.NotFoundObjectResult>(r);
        Assert.Empty(ctx.SuscripcionesPush);
    }
}
