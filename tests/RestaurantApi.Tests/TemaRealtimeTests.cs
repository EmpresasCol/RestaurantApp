using RestaurantApi.Services;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>Ruta de la escritura → tema que se avisa por SignalR.</summary>
public class TemaRealtimeTests
{
    [Theory]
    [InlineData("/api/pedidos", "pedidos")]
    [InlineData("/api/Pedidos/5/estado", "pedidos")]
    [InlineData("/api/PedidoDetalles/3", "pedidos")]
    [InlineData("/api/pagos", "pedidos")]
    [InlineData("/api/facturas/1", "pedidos")]
    [InlineData("/api/mesas/2/estado", "mesas")]
    [InlineData("/api/domicilios/4/estado", "domicilios")]
    [InlineData("/api/domiciliarios/1/pedidos/4/recoger", "domicilios")]
    [InlineData("/api/admin/domiciliarios", "domicilios")]
    [InlineData("/api/publico/domicilios/seguimiento/abc", "domicilios")]
    public void Ruta_de_escritura_da_su_tema(string ruta, string esperado)
        => Assert.Equal(esperado, TemaRealtime.Desde(ruta));

    [Theory]
    [InlineData("/api/domiciliarios/login")]
    [InlineData("/api/usuarios/login")]
    [InlineData("/api/platillos")]
    [InlineData("/api/inventario/sincronizar")]
    [InlineData("/health")]
    [InlineData("")]
    [InlineData(null)]
    public void Ruta_sin_tema_no_avisa(string? ruta)
        => Assert.Null(TemaRealtime.Desde(ruta));
}
