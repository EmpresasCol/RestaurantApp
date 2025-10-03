using RestaurantApp.Models;

namespace RestaurantApp.Services
{
    public class MesaService
    {
        private readonly HttpService _httpService;

        public MesaService()
        {
            _httpService = new HttpService();
        }

        public async Task<List<Mesa>> ObtenerTodasAsync()
        {
            try
            {
                var mesas = await _httpService.GetAsync<List<MesaDto>>(ApiConfig.Endpoints.Mesas);
                return mesas.Select(dto => ConvertirDtoAModelo(dto)).ToList();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error obteniendo mesas: {ex.Message}");
                // Retornar datos de prueba si falla la conexión
                return GenerarMesasPrueba();
            }
        }

        public async Task<Mesa> ObtenerPorIdAsync(int id)
        {
            try
            {
                var mesa = await _httpService.GetAsync<MesaDto>($"{ApiConfig.Endpoints.Mesas}/{id}");
                return ConvertirDtoAModelo(mesa);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error obteniendo mesa: {ex.Message}");
                throw;
            }
        }

        public async Task<Mesa> ActualizarEstadoAsync(int id, string estado)
        {
            try
            {
                var data = new { Estado = estado };
                var mesa = await _httpService.PutAsync<MesaDto>(
                    $"{ApiConfig.Endpoints.Mesas}/{id}/estado",
                    data
                );
                return ConvertirDtoAModelo(mesa);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error actualizando estado mesa: {ex.Message}");
                throw;
            }
        }

        private Mesa ConvertirDtoAModelo(MesaDto dto)
        {
            var mesa = new Mesa
            {
                Id = dto.Id,
                Numero = dto.Numero
            };

            // Convertir estado string a enum
            if (Enum.TryParse<EstadoMesa>(dto.Estado, out var estadoEnum))
            {
                mesa.Estado = estadoEnum;
            }

            return mesa;
        }

        private List<Mesa> GenerarMesasPrueba()
        {
            var mesas = new List<Mesa>();
            var random = new Random();

            for (int i = 1; i <= 12; i++)
            {
                var estado = random.Next(1, 5) == 1 ? EstadoMesa.Ocupada : EstadoMesa.Disponible;
                mesas.Add(new Mesa
                {
                    Id = i,
                    Numero = i,
                    Estado = estado,
                    Capacidad = random.Next(2, 7)
                });
            }

            return mesas;
        }
    }

    // DTO para la comunicación con la API
    public class MesaDto
    {
        public int Id { get; set; }
        public int Numero { get; set; }
        public string Estado { get; set; }
    }
}