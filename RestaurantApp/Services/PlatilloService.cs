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
                return GenerarPlatillosPrueba();
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
                EstaDisponible = true,
                TiempoPreparacion = 15
            };
        }

        private List<Platillo> GenerarPlatillosPrueba()
        {
            return new List<Platillo>
            {
                new Platillo { Id = 1, Nombre = "Ensalada César", Descripcion = "Lechuga romana, pollo grillado, crutones", Precio = 12000, CategoriaId = 1, TiempoPreparacion = 10 },
                new Platillo { Id = 2, Nombre = "Bruschetta", Descripcion = "Pan tostado con tomate fresco y albahaca", Precio = 8000, CategoriaId = 1, TiempoPreparacion = 8 },
                new Platillo { Id = 3, Nombre = "Hamburguesa Clásica", Descripcion = "Carne de res, lechuga, tomate, cebolla", Precio = 15000, CategoriaId = 2, TiempoPreparacion = 15 },
                new Platillo { Id = 4, Nombre = "Pizza Margherita", Descripcion = "Salsa de tomate, mozzarella, albahaca", Precio = 22000, CategoriaId = 2, TiempoPreparacion = 20 },
                new Platillo { Id = 5, Nombre = "Pasta Alfredo", Descripcion = "Fettuccine con salsa cremosa de queso", Precio = 18000, CategoriaId = 2, TiempoPreparacion = 18 },
                new Platillo { Id = 6, Nombre = "Coca Cola", Descripcion = "Bebida gaseosa 350ml", Precio = 3000, CategoriaId = 3, TiempoPreparacion = 1 },
                new Platillo { Id = 7, Nombre = "Jugo Natural", Descripcion = "Jugo de fruta natural 400ml", Precio = 4500, CategoriaId = 3, TiempoPreparacion = 3 },
                new Platillo { Id = 8, Nombre = "Cerveza", Descripcion = "Cerveza nacional 330ml", Precio = 5000, CategoriaId = 3, TiempoPreparacion = 1 },
                new Platillo { Id = 9, Nombre = "Tiramisu", Descripcion = "Postre italiano con café y mascarpone", Precio = 8000, CategoriaId = 4, TiempoPreparacion = 5 },
                new Platillo { Id = 10, Nombre = "Cheesecake", Descripcion = "Tarta de queso con frutos rojos", Precio = 7000, CategoriaId = 4, TiempoPreparacion = 5 }
            };
        }
    }

    public class PlatilloDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; }
        public string Descripcion { get; set; }
        public decimal Precio { get; set; }
        public string ImagenUrl { get; set; }
    }
}