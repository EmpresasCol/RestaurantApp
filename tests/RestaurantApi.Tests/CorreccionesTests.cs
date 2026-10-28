using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RestaurantApi.Controllers;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>Comportamiento agregado al corregir los hallazgos de la auditoría.</summary>
public class CorreccionesTests
{
    private static PedidosController Pedidos(RestauranteContext ctx)
        => new(ctx, NullLogger<PedidosController>.Instance, TestDb.Inventario(ctx));

    private static CrearPedidoDto Pedido(int cantidad, int mesaId = TestDb.MesaUnoId) => new()
    {
        MesaId = mesaId,
        Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = cantidad } }
    };

    [Fact]
    public async Task Login_migra_la_clave_heredada_a_bcrypt_y_emite_jwt_con_el_rol()
    {
        using var ctx = TestDb.Crear();
        var c = new UsuariosController(ctx);

        var r = await c.Login(new LoginRequestDto { Usuario = "admin", Clave = "123" });

        var login = (LoginResponseDto)((OkObjectResult)r.Result!).Value!;
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(login.Token);
        Assert.Equal("Administrador", jwt.Claims.Single(x => x.Type == QproClaims.Rol).Value);
        Assert.StartsWith("$2", ctx.Usuarios.AsNoTracking().Single(u => u.Id == TestDb.AdminId).ClaveHash);

        // La clave migrada sigue funcionando
        Assert.IsType<OkObjectResult>((await c.Login(new LoginRequestDto { Usuario = "admin", Clave = "123" })).Result);
    }

    [Fact]
    public async Task Editar_usuario_sin_clave_conserva_la_clave_y_cambia_el_rol()
    {
        using var ctx = TestDb.Crear();
        var c = new UsuariosController(ctx);

        var r = await c.PutUsuario(TestDb.DomiciliarioId, new ActualizarUsuarioDto
        {
            Id = TestDb.DomiciliarioId, Nombre = "Domi", NombreUsuario = "domi", Rol = RolUsuario.Domiciliario
        });

        Assert.IsType<NoContentResult>(r);
        var u = ctx.Usuarios.AsNoTracking().Single(x => x.Id == TestDb.DomiciliarioId);
        Assert.Equal(RolUsuario.Domiciliario, u.Rol);
        Assert.Equal("123", u.ClaveHash);
    }

    [Fact]
    public async Task Las_facturas_usan_un_consecutivo()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1);
        TestDb.CrearPedidoDirecto(ctx, 2, 1, TestDb.MesaDosId);
        var pagos = new PagosController(ctx);
        var facturas = new FacturasController(ctx);

        var numeros = new List<string>();
        foreach (var pedidoId in new[] { 1, 2 })
        {
            var pago = (PagoDto)((CreatedAtActionResult)(await pagos.PostPago(
                new CrearPagoDto { PedidoId = pedidoId, Monto = 25000m, MetodoPago = "Efectivo" })).Result!).Value!;
            var f = (FacturaDto)((CreatedAtActionResult)(await facturas.PostFactura(new CrearFacturaDto { PagoId = pago.Id })).Result!).Value!;
            numeros.Add(f.NumeroFactura);
        }

        Assert.Equal(new[] { "FV-00000001", "FV-00000002" }, numeros);
    }

    [Fact]
    public async Task Pagar_cierra_el_pedido_pero_la_mesa_sigue_ocupada_si_tiene_otro_pedido_abierto()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1);
        TestDb.CrearPedidoDirecto(ctx, 2, 1);
        ctx.Mesas.Single(m => m.Id == TestDb.MesaUnoId).Estado = EstadoMesa.Ocupada;
        ctx.SaveChanges();

        await new PagosController(ctx).PostPago(new CrearPagoDto { PedidoId = 1, Monto = 25000m, MetodoPago = "Efectivo" });

        Assert.Equal(EstadoPedido.Pagado, ctx.Pedidos.AsNoTracking().Single(p => p.Id == 1).Estado);
        Assert.Equal(EstadoMesa.Ocupada, ctx.Mesas.AsNoTracking().Single(m => m.Id == TestDb.MesaUnoId).Estado);
    }

    [Fact]
    public async Task Reducir_la_cantidad_de_un_pedido_devuelve_el_sobrante_al_stock()
    {
        using var ctx = TestDb.Crear();
        var creado = (PedidoDto)((CreatedAtActionResult)(await Pedidos(ctx).PostPedido(Pedido(3))).Result!).Value!;
        ctx.ChangeTracker.Clear();

        await Pedidos(ctx).ActualizarPedidoCompleto(creado.Id, new ActualizarPedidoCompletoDto
        {
            Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 1 } }
        });

        Assert.Equal(TestDb.StockInicialCarne - 1 * TestDb.CarnePorHamburguesa, TestDb.StockCarne(ctx));
    }

    [Fact]
    public async Task Un_pedido_pagado_no_se_puede_editar()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1);
        await Pedidos(ctx).ActualizarEstado(1, new ActualizarEstadoPedidoDto { Estado = "Pagado" });

        var r = await Pedidos(ctx).ActualizarPedidoCompleto(1, new ActualizarPedidoCompletoDto
        {
            Detalles = { new CrearDetalleDto { PlatilloId = TestDb.PlatilloHamburguesaId, Cantidad = 5 } }
        });

        Assert.IsType<ConflictObjectResult>(r.Result);
    }

    [Fact]
    public async Task Sin_stock_suficiente_se_descuenta_lo_disponible_y_se_genera_alerta()
    {
        using var ctx = TestDb.Crear();
        TestDb.CrearPedidoDirecto(ctx, 1, 1000);

        await TestDb.Inventario(ctx).DescontarStockPorPedidoAsync(1);

        Assert.Equal(0m, TestDb.StockCarne(ctx));
        var alerta = Assert.Single(ctx.AlertasInventario.AsNoTracking());
        Assert.Equal(TipoAlerta.StockCritico, alerta.TipoAlerta);
    }

    [Fact]
    public async Task Un_domicilio_entregado_no_puede_volver_a_preparacion()
    {
        using var ctx = TestDb.Crear();
        ctx.Clientes.Add(new Cliente { Id = 70, Nombre = "C", Telefono = "3130000000" });
        ctx.Direcciones.Add(new Direccion { Id = 70, ClienteId = 70, DireccionCompleta = "Calle 2" });
        ctx.Domicilios.Add(new Domicilio
        {
            Id = 70, ClienteId = 70, DireccionId = 70, Estado = "Entregado",
            Subtotal = 25000m, CostoEnvio = 3000m, Total = 28000m, UsuarioCreadorId = TestDb.AdminId
        });
        ctx.SaveChanges();

        var r = await new DomiciliosController(ctx, TestDb.Inventario(ctx))
            .ActualizarEstado(70, new ActualizarEstadoDto { Estado = "EnPreparacion" });

        Assert.IsType<ConflictObjectResult>(r);
    }

    [Theory]
    [InlineData(EstadoPedido.Pagado, EstadoPedido.EnProceso, false)]
    [InlineData(EstadoPedido.Cancelado, EstadoPedido.Listo, false)]
    [InlineData(EstadoPedido.EnProceso, EstadoPedido.Listo, true)]
    [InlineData(EstadoPedido.Listo, EstadoPedido.Pagado, true)]
    [InlineData(EstadoPedido.Pagado, EstadoPedido.Pagado, true)]
    public void Maquina_de_estados_de_pedidos(EstadoPedido de, EstadoPedido a, bool permitido)
        => Assert.Equal(permitido, EstadosPedido.PuedeCambiar(de, a));
}
