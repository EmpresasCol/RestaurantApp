namespace RestaurantApi.Dtos
{
    public class RecetaDto
    {
        public int Id { get; set; }
        public int PlatilloId { get; set; }
        public string PlatilloNombre { get; set; } = string.Empty;
        public int ProductoId { get; set; }
        public string ProductoNombre { get; set; } = string.Empty;
        public decimal CantidadRequerida { get; set; }
        public string UnidadMedida { get; set; } = string.Empty;
        public decimal? CostoUnitario { get; set; }
        public decimal? CostoTotal { get; set; }
        public bool Opcional { get; set; }
        public string? Notas { get; set; }
        public bool DisponibleEnStock { get; set; }
    }

    public class CrearRecetaDto
    {
        public int PlatilloId { get; set; }
        public int ProductoId { get; set; }
        public decimal CantidadRequerida { get; set; }
        public string UnidadMedida { get; set; } = "Unidad";
        public bool Opcional { get; set; } = false;
        public string? Notas { get; set; }
    }

    public class RecetaPlatilloDto
    {
        public int PlatilloId { get; set; }
        public string PlatilloNombre { get; set; } = string.Empty;
        public List<RecetaDto> Ingredientes { get; set; } = new();
        public decimal CostoTotalReceta { get; set; }
        public bool TodosIngredientesDisponibles { get; set; }
    }
}