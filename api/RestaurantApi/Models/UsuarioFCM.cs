namespace RestaurantApi.Models
{
    public class UsuarioFCM
    {
        public int Id { get; set; }
        public int UsuarioId { get; set; }
        public string FcmToken { get; set; }
        public DateTime FechaRegistro { get; set; }
    }
}