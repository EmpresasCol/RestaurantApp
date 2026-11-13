using Xunit;

namespace RestaurantApi.Tests;

public class FormatoPesosTests
{
    /// <summary>[BAJO] Los mensajes decían "25,000 pesos": en Colombia se lee como 25 con decimales.</summary>
    [Theory]
    [InlineData(25000, "25.000")]
    [InlineData(1234567.6, "1.234.568")]
    [InlineData(900, "900")]
    [InlineData(-3000, "-3.000")]
    public void Los_montos_de_los_mensajes_usan_punto_de_miles(double valor, string esperado)
        => Assert.Equal(esperado, RestaurantApi.Services.Cuentas.Pesos((decimal)valor));
}
