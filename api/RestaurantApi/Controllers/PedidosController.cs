using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;

namespace RestaurantApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PedidosController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public PedidosController(RestauranteContext context)
        {
            _context = context;
        }

        // GET: api/Pedidos
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PedidoDto>>> GetPedidos()
        {
            var pedidos = await _context.Pedidos
                .Include(p => p.Mesa)
                .Include(p => p.Detalles)
                    .ThenInclude(d => d.Platillo)
                .OrderByDescending(p => p.Fecha)
                .ToListAsync();

            return pedidos.Select(p => new PedidoDto
            {
                Id = p.Id,
                MesaId = p.MesaId,
                MesaNumero = p.Mesa?.Numero ?? 0,  // ← Operador ?? para manejar null
                Estado = p.Estado.ToString(),
                Fecha = p.Fecha,
                Detalles = p.Detalles.Select(d => new PedidoDetalleDto
                {
                    Id = d.Id,
                    PlatilloId = d.PlatilloId,
                    PlatilloNombre = d.Platillo?.Nombre ?? "Sin nombre",  // ← Manejar null
                    Cantidad = d.Cantidad,
                    Precio = d.Platillo?.Precio ?? 0,  // ← Manejar null
                    Nota = d.Nota,
                    Estado = d.Estado.ToString()
                }).ToList()
            }).ToList();
        }

        // GET: api/Pedidos/5
        [HttpGet("{id}")]
        public async Task<ActionResult<PedidoDto>> GetPedido(int id)
        {
            var pedido = await _context.Pedidos
                .Include(p => p.Mesa)
                .Include(p => p.Detalles)
                    .ThenInclude(d => d.Platillo)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (pedido == null)
                return NotFound();

            return new PedidoDto
            {
                Id = pedido.Id,
                MesaId = pedido.MesaId,
                MesaNumero = pedido.Mesa?.Numero ?? 0,
                Estado = pedido.Estado.ToString(),
                Fecha = pedido.Fecha,
                Detalles = pedido.Detalles.Select(d => new PedidoDetalleDto
                {
                    Id = d.Id,
                    PlatilloId = d.PlatilloId,
                    PlatilloNombre = d.Platillo?.Nombre ?? "Sin nombre",
                    Cantidad = d.Cantidad,
                    Precio = d.Platillo?.Precio ?? 0,
                    Nota = d.Nota,
                    Estado = d.Estado.ToString()
                }).ToList()
            };
        }

        // POST: api/Pedidos
        [HttpPost]
        public async Task<ActionResult<PedidoDto>> PostPedido(CrearPedidoDto crearPedido)
        {
            // Crear el pedido
            var pedido = new Pedido
            {
                MesaId = crearPedido.MesaId,
                UsuarioId = 1, // Por ahora usuario fijo
                Estado = EstadoPedido.EnProceso,
                Fecha = DateTime.Now
            };

            _context.Pedidos.Add(pedido);
            await _context.SaveChangesAsync();

            // Agregar los detalles
            foreach (var detalle in crearPedido.Detalles)
            {
                var pedidoDetalle = new PedidoDetalle
                {
                    PedidoId = pedido.Id,
                    PlatilloId = detalle.PlatilloId,
                    Cantidad = detalle.Cantidad,
                    Nota = detalle.Nota,
                    Estado = EstadoDetalle.Pendiente
                };
                _context.PedidoDetalles.Add(pedidoDetalle);
            }

            await _context.SaveChangesAsync();

            // Retornar el pedido completo
            var pedidoCreado = await _context.Pedidos
                .Include(p => p.Mesa)
                .Include(p => p.Detalles)
                    .ThenInclude(d => d.Platillo)
                .FirstOrDefaultAsync(p => p.Id == pedido.Id);

            if (pedidoCreado == null)
                return NotFound();

            var resultado = new PedidoDto
            {
                Id = pedidoCreado.Id,
                MesaId = pedidoCreado.MesaId,
                MesaNumero = pedidoCreado.Mesa?.Numero ?? 0,
                Estado = pedidoCreado.Estado.ToString(),
                Fecha = pedidoCreado.Fecha,
                Detalles = pedidoCreado.Detalles.Select(d => new PedidoDetalleDto
                {
                    Id = d.Id,
                    PlatilloId = d.PlatilloId,
                    PlatilloNombre = d.Platillo?.Nombre ?? "Sin nombre",
                    Cantidad = d.Cantidad,
                    Precio = d.Platillo?.Precio ?? 0,
                    Nota = d.Nota,
                    Estado = d.Estado.ToString()
                }).ToList()
            };

            return CreatedAtAction(nameof(GetPedido), new { id = resultado.Id }, resultado);
        }

        // PUT: api/Pedidos/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutPedido(int id, ActualizarPedidoDto actualizarPedido)
        {
            var pedido = await _context.Pedidos.FindAsync(id);
            if (pedido == null)
                return NotFound();

            // Actualizar estado
            if (!string.IsNullOrEmpty(actualizarPedido.Estado))
            {
                if (Enum.TryParse<EstadoPedido>(actualizarPedido.Estado, true, out var estadoEnum))
                {
                    pedido.Estado = estadoEnum;
                }
                else
                {
                    return BadRequest($"Estado inválido: {actualizarPedido.Estado}. Estados válidos: EnProceso, Listo, Pagado, Cancelado");
                }
            }

            _context.Entry(pedido).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.Pedidos.Any(e => e.Id == id))
                    return NotFound();
                throw;
            }

            return NoContent();
        }

        // DELETE: api/Pedidos/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePedido(int id)
        {
            var pedido = await _context.Pedidos.FindAsync(id);
            if (pedido == null)
                return NotFound();

            _context.Pedidos.Remove(pedido);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}