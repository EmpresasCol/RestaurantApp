using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>Módulo de facturación y caja.</summary>
public class PagosYFacturasTests
{
    [Fact]
    public async Task Pago_con_metodo_valido_retorna_201()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 2); // 2 x 25.000 = 50.000

        var r = await new PagosController(ctx).PostPago(new CrearPagoDto { PedidoId = 1, Monto = 50000m, MetodoPago = "Tarjeta" });

        var created = Assert.IsType<CreatedAtActionResult>(r.Result);
        Assert.Equal("Tarjeta", ((PagoDto)created.Value!).MetodoPago);
    }

    [Fact]
    public async Task Pago_con_metodo_invalido_retorna_400()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1);

        var r = await new PagosController(ctx).PostPago(new CrearPagoDto { PedidoId = 1, Monto = 25000m, MetodoPago = "Bitcoin" });

        Assert.IsType<BadRequestObjectResult>(r.Result);
    }

    [Fact]
    public async Task Factura_suma_subtotal_y_propina()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 2);
        var pago = (PagoDto)((CreatedAtActionResult)(await new PagosController(ctx)
            .PostPago(new CrearPagoDto { PedidoId = 1, Monto = 50000m, MontoPropina = 5000m, MetodoPago = "Efectivo" })).Result!).Value!;

        var r = await new FacturasController(ctx).PostFactura(new CrearFacturaDto { PagoId = pago.Id, NombreCliente = "Consumidor final" });

        var factura = (FacturaDto)((CreatedAtActionResult)r.Result!).Value!;
        Assert.Equal(55000m, factura.Total);
    }

    /// <summary>[AUDITORÍA – ALTO] El monto lo decide el cliente HTTP: se aceptan montos negativos.</summary>
    [Fact]
    public async Task AUDITORIA_pago_negativo_debe_rechazarse()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1);

        var r = await new PagosController(ctx).PostPago(new CrearPagoDto { PedidoId = 1, Monto = -25000m, MetodoPago = "Efectivo" });

        Assert.IsType<BadRequestObjectResult>(r.Result);
    }

    /// <summary>[AUDITORÍA – ALTO] El servidor no compara el pago con el consumo real del pedido.</summary>
    [Fact]
    public async Task AUDITORIA_pago_inferior_al_consumo_debe_rechazarse()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 4); // consumo 100.000

        var r = await new PagosController(ctx).PostPago(new CrearPagoDto { PedidoId = 1, Monto = 1000m, MetodoPago = "Efectivo" });

        Assert.IsNotType<CreatedAtActionResult>(r.Result);
    }

    /// <summary>[AUDITORÍA – ALTO] Se puede cobrar dos veces el mismo pedido.</summary>
    [Fact]
    public async Task AUDITORIA_no_se_puede_pagar_dos_veces_el_mismo_pedido()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1);
        var c = new PagosController(ctx);
        await c.PostPago(new CrearPagoDto { PedidoId = 1, Monto = 25000m, MetodoPago = "Efectivo" });

        var segundo = await c.PostPago(new CrearPagoDto { PedidoId = 1, Monto = 25000m, MetodoPago = "Efectivo" });

        Assert.IsNotType<CreatedAtActionResult>(segundo.Result);
    }

    /// <summary>[AUDITORÍA – MEDIO] Un mismo pago puede generar varias facturas.</summary>
    [Fact]
    public async Task AUDITORIA_un_pago_solo_genera_una_factura()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1);
        var pago = (PagoDto)((CreatedAtActionResult)(await new PagosController(ctx)
            .PostPago(new CrearPagoDto { PedidoId = 1, Monto = 25000m, MetodoPago = "Efectivo" })).Result!).Value!;
        var f = new FacturasController(ctx);
        await f.PostFactura(new CrearFacturaDto { PagoId = pago.Id });

        var segunda = await f.PostFactura(new CrearFacturaDto { PagoId = pago.Id });

        Assert.IsNotType<CreatedAtActionResult>(segunda.Result);
    }
}

/// <summary>Autenticación, roles y protección de datos (Ley 1581/2012).</summary>
public class SeguridadTests
{
    [Fact]
    public async Task Login_web_con_clave_incorrecta_retorna_401()
    {
        using var ctx = TestDb.Crear();
        var r = await new UsuariosController(ctx).Login(new LoginRequestDto { Usuario = "admin", Clave = "mala" });
        Assert.IsType<UnauthorizedObjectResult>(r.Result);
    }

    [Fact]
    public async Task Login_web_bloquea_meseros()
    {
        using var ctx = TestDb.Crear();
        var r = await new UsuariosController(ctx).Login(new LoginRequestDto { Usuario = "mesero", Clave = "123" });
        Assert.IsType<UnauthorizedObjectResult>(r.Result);
    }

    [Fact]
    public async Task Login_movil_solo_permite_meseros()
    {
        using var ctx = TestDb.Crear();
        var c = new UsuariosController(ctx);
        Assert.IsType<OkObjectResult>((await c.LoginMobile(new LoginRequestDto { Usuario = "mesero", Clave = "123" })).Result);
        Assert.IsType<UnauthorizedObjectResult>((await c.LoginMobile(new LoginRequestDto { Usuario = "admin", Clave = "123" })).Result);
    }

    [Fact]
    public async Task Listado_de_usuarios_no_expone_la_clave()
    {
        using var ctx = TestDb.Crear();
        var r = await new UsuariosController(ctx).GetUsuarios();
        Assert.Null(typeof(UsuarioDto).GetProperty("ClaveHash"));
        Assert.Equal(3, r.Value!.Count());
    }

    /// <summary>[AUDITORÍA – CRÍTICO] El login no emite JWT (requisito del proyecto).</summary>
    [Fact]
    public void AUDITORIA_login_debe_devolver_un_token_jwt()
    {
        Assert.NotNull(typeof(LoginResponseDto).GetProperty("Token"));
    }

    /// <summary>
    /// [AUDITORÍA – CRÍTICO] Ningún controlador tiene [Authorize] y Program.cs no registra
    /// autenticación: toda la API (usuarios, pagos, inventario, clientes) es pública.
    /// </summary>
    [Fact]
    public void AUDITORIA_endpoints_administrativos_requieren_autorizacion()
    {
        // Endpoints que sí pueden ser anónimos por diseño
        var anonimosPermitidos = new HashSet<string>
        {
            "UsuariosController.Login", "UsuariosController.LoginMobile",
            "DomiciliariosController.Login",
            "PlatillosController.GetPlatillos", "PlatillosController.GetPlatillo",
            "PedidosController.PostPedido", // menú QR del comensal
            "MesasController.GetMesaPorCodigo", // el comensal ve el número de su mesa
        };

        var controllers = typeof(UsuariosController).Assembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
            .Where(t => t.Name != "DomiciliosPublicoController");

        var expuestos = new List<string>();
        foreach (var t in controllers)
        {
            var claseProtegida = t.GetCustomAttribute<AuthorizeAttribute>(inherit: true) != null;
            var acciones = t.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
                .Where(m => m.GetCustomAttributes().Any(a => a is Microsoft.AspNetCore.Mvc.Routing.HttpMethodAttribute));
            foreach (var m in acciones)
            {
                var nombre = $"{t.Name}.{m.Name}";
                if (anonimosPermitidos.Contains(nombre)) continue;
                var protegida = (claseProtegida || m.GetCustomAttribute<AuthorizeAttribute>() != null)
                                && m.GetCustomAttribute<AllowAnonymousAttribute>() == null;
                if (!protegida) expuestos.Add(nombre);
            }
        }

        Assert.True(expuestos.Count == 0,
            $"{expuestos.Count} endpoints sin [Authorize], p. ej.: {string.Join(", ", expuestos.Take(10))}");
    }

    /// <summary>[AUDITORÍA – CRÍTICO] Las contraseñas se guardan y comparan en texto plano.</summary>
    [Fact]
    public async Task AUDITORIA_crear_usuario_guarda_la_clave_con_hash()
    {
        using var ctx = TestDb.Crear();
        await new UsuariosController(ctx).PostUsuario(new Usuario
        {
            Nombre = "Nueva Caja", NombreUsuario = "caja2", ClaveHash = "MiClave2026", Rol = RolUsuario.Caja
        });

        var guardada = ctx.Usuarios.AsNoTracking().Single(u => u.NombreUsuario == "caja2").ClaveHash;
        Assert.NotEqual("MiClave2026", guardada);
    }

    /// <summary>[AUDITORÍA – ALTO] POST api/usuarios devuelve la entidad completa, incluida ClaveHash.</summary>
    [Fact]
    public async Task AUDITORIA_crear_usuario_no_devuelve_la_clave()
    {
        using var ctx = TestDb.Crear();
        var r = await new UsuariosController(ctx).PostUsuario(new Usuario
        {
            Nombre = "Cocinero", NombreUsuario = "coc2", ClaveHash = "secreta", Rol = RolUsuario.Cocina
        });

        var created = Assert.IsType<CreatedAtActionResult>(r.Result);
        Assert.Null(created.Value!.GetType().GetProperty("ClaveHash"));
    }

    /// <summary>
    /// [AUDITORÍA – ALTO] Login responde "Usuario no encontrado" vs "Contraseña incorrecta":
    /// permite enumerar usuarios válidos.
    /// </summary>
    [Fact]
    public async Task AUDITORIA_login_no_revela_si_el_usuario_existe()
    {
        using var ctx = TestDb.Crear();
        var c = new UsuariosController(ctx);
        var noExiste = (UnauthorizedObjectResult)(await c.Login(new LoginRequestDto { Usuario = "nadie", Clave = "x" })).Result!;
        var claveMala = (UnauthorizedObjectResult)(await c.Login(new LoginRequestDto { Usuario = "admin", Clave = "x" })).Result!;

        Assert.Equal(
            System.Text.Json.JsonSerializer.Serialize(noExiste.Value),
            System.Text.Json.JsonSerializer.Serialize(claveMala.Value));
    }
}
