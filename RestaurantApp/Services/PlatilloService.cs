// RestaurantApp/Services/PlatilloService.cs
using RestaurantApp.Models;

namespace RestaurantApp.Services
{
    public class PlatilloService
    {
        private readonly HttpService _httpService;

        public PlatilloService()
        {
            _httpService = new HttpService();
        }

        public async Task<List<Platillo>> ObtenerTodosAsync()
        {
            try
            {
                var platillos = await _httpService.GetAsync<List<PlatilloDto>>("api/platillos");
                return platillos.Select(dto => ConvertirDtoAModelo(dto)).ToList();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error obteniendo platillos: {ex.Message}");
                // ✅ Retornar lista vacía en lugar de datos hardcodeados
                return new List<Platillo>();
            }
        }

        public async Task<Platillo> ObtenerPorIdAsync(int id)
        {
            var platillo = await _httpService.GetAsync<PlatilloDto>($"api/platillos/{id}");
            return ConvertirDtoAModelo(platillo);
        }

        private Platillo ConvertirDtoAModelo(PlatilloDto dto)
        {
            return new Platillo
            {
                Id = dto.Id,
                Nombre = dto.Nombre,
                Descripcion = dto.Descripcion,
                Precio = dto.Precio,
                ImagenUrl = dto.ImagenUrl,
                CategoriaTexto = dto.Categoria, // ✅ Asignar la categoría de texto
                EstaDisponible = true,
                TiempoPreparacion = 15
            };
        }

        // ✅ ELIMINAR COMPLETAMENTE el método GenerarPlatillosPrueba()
    }

    public class PlatilloDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; }
        public string Descripcion { get; set; }
        public decimal Precio { get; set; }
        public string ImagenUrl { get; set; }
        public string Categoria { get; set; } // ✅ Categoría como string
    }
}