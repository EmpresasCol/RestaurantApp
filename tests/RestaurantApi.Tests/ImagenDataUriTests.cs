using RestaurantApi.Services;
using Xunit;

namespace RestaurantApi.Tests;

/// <summary>Auditoría de subidas: se valida el contenido real de la foto, no solo el prefijo.</summary>
public class ImagenDataUriTests
{
    private static string Uri(string tipo, params byte[] bytes)
        => $"data:{tipo};base64,{Convert.ToBase64String(bytes.Concat(new byte[16]).ToArray())}";

    [Fact]
    public void Acepta_las_fotos_de_camara_y_galeria()
    {
        Assert.True(ImagenDataUri.EsFoto(Uri("image/jpeg", 0xFF, 0xD8, 0xFF, 0xE0), 10_000));
        Assert.True(ImagenDataUri.EsFoto(Uri("image/jpg", 0xFF, 0xD8, 0xFF, 0xE1), 10_000));
        Assert.True(ImagenDataUri.EsFoto(Uri("image/png", 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A), 10_000));
        Assert.True(ImagenDataUri.EsFoto(Uri("image/webp", "RIFF\0\0\0\0WEBP"u8.ToArray()), 10_000));
        Assert.True(ImagenDataUri.EsFoto(Uri("image/heic", "\0\0\0\u0018ftypheic"u8.ToArray()), 10_000));
    }

    [Fact]
    public void Rechaza_un_script_disfrazado_de_foto()
    {
        var script = System.Text.Encoding.UTF8.GetBytes("<?php system($_GET['c']); ?>");
        Assert.False(ImagenDataUri.EsFoto(Uri("image/jpeg", script), 10_000));
        Assert.False(ImagenDataUri.EsFoto("data:image/svg+xml;base64," + Convert.ToBase64String("<svg onload=alert(1)></svg>"u8.ToArray()), 10_000));
        Assert.False(ImagenDataUri.EsFoto("data:text/html;base64,PHNjcmlwdD4=", 10_000));
    }

    [Fact]
    public void Rechaza_tipo_que_no_coincide_base64_roto_y_exceso_de_peso()
    {
        Assert.False(ImagenDataUri.EsFoto(Uri("image/png", 0xFF, 0xD8, 0xFF, 0xE0), 10_000));
        Assert.False(ImagenDataUri.EsFoto("data:image/jpeg;base64,@@no-es-base64@@", 10_000));
        Assert.False(ImagenDataUri.EsFoto("data:image/jpeg,sin-base64", 10_000));
        Assert.False(ImagenDataUri.EsFoto(Uri("image/jpeg", 0xFF, 0xD8, 0xFF, 0xE0), 20));
        Assert.False(ImagenDataUri.EsFoto(null, 10_000));
    }
}
