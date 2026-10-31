using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;

namespace RestaurantApi.Services
{
    /// <summary>Operaciones de lotes compartidas por los movimientos manuales, el conteo y las bajas.</summary>
    public static class LotesInventario
    {
        /// <summary>
        /// Cantidad en lotes ya vencidos por (producto, almacén). Sigue físicamente en bodega
        /// hasta que se da de baja, pero no se puede vender ni gastar en recetas.
        /// </summary>
        public static async Task<Dictionary<(int ProductoId, int AlmacenId), decimal>> VencidoAsync(RestauranteContext context, IEnumerable<int>? productoIds = null)
        {
            var hoy = HoraLocal.AhoraColombia().Date;
            var ids = productoIds?.ToList();
            return (await context.Lotes
                    .Where(l => l.CantidadActual > 0 && l.FechaVencimiento != null && l.FechaVencimiento < hoy
                                && (ids == null || ids.Contains(l.ProductoId)))
                    .Select(l => new { l.ProductoId, l.AlmacenId, l.CantidadActual })
                    .ToListAsync())
                .GroupBy(l => (l.ProductoId, l.AlmacenId))
                .ToDictionary(g => g.Key, g => g.Sum(x => x.CantidadActual));
        }

        /// <summary>
        /// Saca la cantidad de los lotes (el indicado primero, luego FIFO por vencimiento)
        /// para que los lotes no muestren más existencias que el stock.
        /// </summary>
        public static async Task DescontarAsync(RestauranteContext context, int productoId, int almacenId, int? loteId, decimal cantidad)
        {
            var lotes = (await context.Lotes
                    .Where(l => l.ProductoId == productoId && l.AlmacenId == almacenId && l.CantidadActual > 0)
                    .ToListAsync())
                .OrderByDescending(l => l.Id == loteId)
                .ThenBy(l => l.FechaVencimiento == null)
                .ThenBy(l => l.FechaVencimiento)
                .ThenBy(l => l.FechaIngreso);

            foreach (var lote in lotes)
            {
                if (cantidad <= 0) break;
                var tomar = Math.Min(cantidad, lote.CantidadActual);
                lote.CantidadActual -= tomar;
                if (lote.CantidadActual == 0 && lote.Estado == "Activo") lote.Estado = "Agotado";
                cantidad -= tomar;
            }
        }
    }
}
