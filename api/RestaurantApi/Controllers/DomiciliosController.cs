// api/RestaurantApi/Controllers/DomiciliosController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;

namespace RestaurantApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DomiciliosController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public DomiciliosController(RestauranteContext context)
        {
            _context = context;
        }

        // GET: api/domicilios
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DomicilioResponseDto>>> GetDomicilios()
        {
            var domicilios = await _context.Domicilios
                .Include(d => d.Cliente)
                .Include(d => d.Direccion)
                .Include(d => d.Detalles)
                    .ThenInclude(dd => dd.Platillo)
                .Include(d => d.UsuarioCreador)
                .Include(d => d.Domiciliario)
                .OrderByDescending(d => d.FechaPedido)
                .Select(d => new DomicilioResponseDto
                {
                    Id = d.Id,
                    ClienteId = d.ClienteId,
                    ClienteNombre = d.Cliente.Nombre,
                    ClienteTelefono = d.Cliente.Telefono,
                    DireccionId = d.DireccionId,
                    DireccionCompleta = d.Direccion.DireccionCompleta,
                    Barrio = d.Direccion.Barrio ?? "",
                    ReferenciasAdicionales = d.Direccion.ReferenciasAdicionales ?? "",
                    FechaPedido = d.FechaPedido,
                    Estado = d.Estado,
                    Subtotal = d.Subtotal,
                    CostoEnvio = d.CostoEnvio,
                    Total = d.Total,
                    MetodoPago = d.MetodoPago,
                    PagadoAnticipado = d.PagadoAnticipado,
                    NotasCliente = d.NotasCliente ?? "",
                    NotasInternas = d.NotasInternas ?? "",
                    UsuarioCreadorId = d.UsuarioCreadorId,
                    UsuarioCreadorNombre = d.UsuarioCreador.Nombre,
                    DomiciliarioId = d.DomiciliarioId,
                    DomiciliarioNombre = d.Domiciliario != null ? d.Domiciliario.Nombre : null,
                    FechaEstimadaEntrega = d.FechaEstimadaEntrega,
                    FechaEntrega = d.FechaEntrega,
                    Detalles = d.Detalles.Select(dd => new DomicilioDetalleDto
                    {
                        Id = dd.Id,
                        PlatilloId = dd.PlatilloId,
                        PlatilloNombre = dd.Platillo.Nombre,
                        Cantidad = dd.Cantidad,
                        PrecioUnitario = dd.PrecioUnitario,
                        Subtotal = dd.Subtotal,
                        Nota = dd.Nota ?? ""
                    }).ToList()
                })
                .ToListAsync();

            return Ok(domicilios);
        }

        // GET: api/domicilios/activos
        [HttpGet("activos")]
        public async Task<ActionResult<IEnumerable<DomicilioResponseDto>>> GetDomiciliosActivos()
        {
            try
            {
                Console.WriteLine("📥 Obteniendo domicilios activos");

                var domicilios = await _context.Domicilios
                    .Include(d => d.Cliente)
                    .Include(d => d.Direccion)
                    .Include(d => d.Detalles)
                        .ThenInclude(dd => dd.Platillo)
                    .Include(d => d.UsuarioCreador)
                    .Include(d => d.Domiciliario)
                    .Where(d => d.Estado == "EnPreparacion" || d.Estado == "EnCamino")
                    .OrderBy(d => d.FechaPedido)
                    .ToListAsync();

                Console.WriteLine($"✅ Domicilios encontrados: {domicilios.Count}");

                var resultado = domicilios.Select(d => new DomicilioResponseDto
                {
                    Id = d.Id,
                    ClienteId = d.ClienteId,
                    ClienteNombre = d.Cliente.Nombre,
                    ClienteTelefono = d.Cliente.Telefono,
                    DireccionId = d.DireccionId,
                    DireccionCompleta = d.Direccion.DireccionCompleta,
                    Barrio = d.Direccion.Barrio ?? "",
                    ReferenciasAdicionales = d.Direccion.ReferenciasAdicionales ?? "",
                    FechaPedido = d.FechaPedido,
                    Estado = d.Estado,
                    Subtotal = d.Subtotal,
                    CostoEnvio = d.CostoEnvio,
                    Total = d.Total,
                    MetodoPago = d.MetodoPago,
                    PagadoAnticipado = d.PagadoAnticipado,
                    NotasCliente = d.NotasCliente ?? "",
                    NotasInternas = d.NotasInternas ?? "",
                    UsuarioCreadorId = d.UsuarioCreadorId,
                    UsuarioCreadorNombre = d.UsuarioCreador.Nombre,
                    DomiciliarioId = d.DomiciliarioId,
                    DomiciliarioNombre = d.Domiciliario != null ? d.Domiciliario.Nombre : null,
                    FechaEstimadaEntrega = d.FechaEstimadaEntrega,
                    FechaEntrega = d.FechaEntrega,
                    Detalles = d.Detalles.Select(dd => new DomicilioDetalleDto
                    {
                        Id = dd.Id,
                        PlatilloId = dd.PlatilloId,
                        PlatilloNombre = dd.Platillo.Nombre,
                        Cantidad = dd.Cantidad,
                        PrecioUnitario = dd.PrecioUnitario,
                        Subtotal = dd.Subtotal,
                        Nota = dd.Nota ?? ""
                    }).ToList()
                }).ToList();

                return Ok(resultado);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error: {ex.Message}");
                return StatusCode(500, new { message = "Error al obtener domicilios activos", error = ex.Message });
            }
        }

        // GET: api/domicilios/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<DomicilioResponseDto>> GetDomicilio(int id)
        {
            var domicilio = await _context.Domicilios
                .Include(d => d.Cliente)
                .Include(d => d.Direccion)
                .Include(d => d.Detalles)
                    .ThenInclude(dd => dd.Platillo)
                .Include(d => d.UsuarioCreador)
                .Include(d => d.Domiciliario)
                .Where(d => d.Id == id)
                .Select(d => new DomicilioResponseDto
                {
                    Id = d.Id,
                    ClienteId = d.ClienteId,
                    ClienteNombre = d.Cliente.Nombre,
                    ClienteTelefono = d.Cliente.Telefono,
                    DireccionId = d.DireccionId,
                    DireccionCompleta = d.Direccion.DireccionCompleta,
                    Barrio = d.Direccion.Barrio ?? "",
                    ReferenciasAdicionales = d.Direccion.ReferenciasAdicionales ?? "",
                    FechaPedido = d.FechaPedido,
                    Estado = d.Estado,
                    Subtotal = d.Subtotal,
                    CostoEnvio = d.CostoEnvio,
                    Total = d.Total,
                    MetodoPago = d.MetodoPago,
                    PagadoAnticipado = d.PagadoAnticipado,
                    NotasCliente = d.NotasCliente ?? "",
                    NotasInternas = d.NotasInternas ?? "",
                    UsuarioCreadorId = d.UsuarioCreadorId,
                    UsuarioCreadorNombre = d.UsuarioCreador.Nombre,
                    DomiciliarioId = d.DomiciliarioId,
                    DomiciliarioNombre = d.Domiciliario != null ? d.Domiciliario.Nombre : null,
                    FechaEstimadaEntrega = d.FechaEstimadaEntrega,
                    FechaEntrega = d.FechaEntrega,
                    Detalles = d.Detalles.Select(dd => new DomicilioDetalleDto
                    {
                        Id = dd.Id,
                        PlatilloId = dd.PlatilloId,
                        PlatilloNombre = dd.Platillo.Nombre,
                        Cantidad = dd.Cantidad,
                        PrecioUnitario = dd.PrecioUnitario,
                        Subtotal = dd.Subtotal,
                        Nota = dd.Nota ?? ""
                    }).ToList()
                })
                .FirstOrDefaultAsync();

            if (domicilio == null)
            {
                return NotFound(new { message = "Domicilio no encontrado" });
            }

            return Ok(domicilio);
        }

        // POST: api/domicilios
        [HttpPost]
        public async Task<ActionResult<DomicilioResponseDto>> CreateDomicilio([FromBody] CreateDomicilioDto dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                Console.WriteLine("📥 Recibiendo petición para crear domicilio");

                // Validar que el cliente exista
                var clienteExiste = await _context.Clientes.AnyAsync(c => c.Id == dto.ClienteId);
                if (!clienteExiste)
                {
                    return BadRequest(new { message = "Cliente no encontrado" });
                }

                // Validar que la dirección exista
                var direccionExiste = await _context.Direcciones.AnyAsync(d => d.Id == dto.DireccionId);
                if (!direccionExiste)
                {
                    return BadRequest(new { message = "Dirección no encontrada" });
                }

                // Validar platillos y calcular subtotal
                decimal subtotal = 0;
                var detallesConPrecios = new List<(int PlatilloId, int Cantidad, decimal PrecioUnitario, string Nota)>();

                foreach (var detalle in dto.Detalles)
                {
                    var platillo = await _context.Platillos.FindAsync(detalle.PlatilloId);
                    if (platillo == null)
                    {
                        return BadRequest(new { message = $"Platillo con ID {detalle.PlatilloId} no encontrado" });
                    }

                    decimal subtotalDetalle = platillo.Precio * detalle.Cantidad;
                    subtotal += subtotalDetalle;

                    detallesConPrecios.Add((
                        detalle.PlatilloId,
                        detalle.Cantidad,
                        platillo.Precio,
                        detalle.Nota ?? ""
                    ));
                }

                decimal total = subtotal + dto.CostoEnvio;

                // Crear domicilio con estado EnPreparacion
                var domicilio = new Domicilio
                {
                    ClienteId = dto.ClienteId,
                    DireccionId = dto.DireccionId,
                    FechaPedido = DateTime.Now,
                    Estado = "EnPreparacion",
                    Subtotal = subtotal,
                    CostoEnvio = dto.CostoEnvio,
                    Total = total,
                    MetodoPago = dto.MetodoPago ?? "Efectivo",
                    PagadoAnticipado = dto.PagadoAnticipado,
                    NotasCliente = dto.NotasCliente ?? "",
                    NotasInternas = dto.NotasInternas ?? "",
                    UsuarioCreadorId = dto.UsuarioCreadorId,
                    FechaEstimadaEntrega = DateTime.Now.AddMinutes(30)
                };

                _context.Domicilios.Add(domicilio);
                await _context.SaveChangesAsync();

                // Crear detalles
                foreach (var (platilloId, cantidad, precioUnitario, nota) in detallesConPrecios)
                {
                    var detalle = new DomicilioDetalle
                    {
                        DomicilioId = domicilio.Id,
                        PlatilloId = platilloId,
                        Cantidad = cantidad,
                        PrecioUnitario = precioUnitario,
                        Subtotal = precioUnitario * cantidad,
                        Nota = nota
                    };

                    _context.DomicilioDetalles.Add(detalle);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Retornar domicilio creado
                var domicilioCreado = await _context.Domicilios
                    .Include(d => d.Cliente)
                    .Include(d => d.Direccion)
                    .Include(d => d.Detalles)
                        .ThenInclude(dd => dd.Platillo)
                    .Include(d => d.UsuarioCreador)
                    .Where(d => d.Id == domicilio.Id)
                    .Select(d => new DomicilioResponseDto
                    {
                        Id = d.Id,
                        ClienteId = d.ClienteId,
                        ClienteNombre = d.Cliente.Nombre,
                        ClienteTelefono = d.Cliente.Telefono,
                        DireccionId = d.DireccionId,
                        DireccionCompleta = d.Direccion.DireccionCompleta,
                        Barrio = d.Direccion.Barrio ?? "",
                        ReferenciasAdicionales = d.Direccion.ReferenciasAdicionales ?? "",
                        FechaPedido = d.FechaPedido,
                        Estado = d.Estado,
                        Subtotal = d.Subtotal,
                        CostoEnvio = d.CostoEnvio,
                        Total = d.Total,
                        MetodoPago = d.MetodoPago,
                        PagadoAnticipado = d.PagadoAnticipado,
                        NotasCliente = d.NotasCliente ?? "",
                        NotasInternas = d.NotasInternas ?? "",
                        UsuarioCreadorId = d.UsuarioCreadorId,
                        UsuarioCreadorNombre = d.UsuarioCreador.Nombre,
                        DomiciliarioId = d.DomiciliarioId,
                        DomiciliarioNombre = d.Domiciliario != null ? d.Domiciliario.Nombre : null,
                        FechaEstimadaEntrega = d.FechaEstimadaEntrega,
                        FechaEntrega = d.FechaEntrega,
                        Detalles = d.Detalles.Select(dd => new DomicilioDetalleDto
                        {
                            Id = dd.Id,
                            PlatilloId = dd.PlatilloId,
                            PlatilloNombre = dd.Platillo.Nombre,
                            Cantidad = dd.Cantidad,
                            PrecioUnitario = dd.PrecioUnitario,
                            Subtotal = dd.Subtotal,
                            Nota = dd.Nota ?? ""
                        }).ToList()
                    })
                    .FirstOrDefaultAsync();

                return CreatedAtAction(nameof(GetDomicilio), new { id = domicilio.Id }, domicilioCreado);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                Console.WriteLine($"❌ Error: {ex.Message}");
                Console.WriteLine($"❌ Inner: {ex.InnerException?.Message}");
                return StatusCode(500, new
                {
                    message = "Error al crear domicilio",
                    error = ex.Message,
                    innerError = ex.InnerException?.Message
                });
            }
        }

        // PUT: api/domicilios/{id}/estado
        [HttpPut("{id}/estado")]
        public async Task<IActionResult> ActualizarEstado(int id, [FromBody] ActualizarEstadoDto dto)
        {
            var domicilio = await _context.Domicilios.FindAsync(id);

            if (domicilio == null)
            {
                return NotFound(new { message = "Domicilio no encontrado" });
            }

            var estadosValidos = new[] { "EnPreparacion", "Listo", "EnCamino", "Entregado", "Cancelado" };
            if (!estadosValidos.Contains(dto.Estado))
            {
                return BadRequest(new { message = "Estado inválido" });
            }

            domicilio.Estado = dto.Estado;

            if (dto.Estado == "Entregado")
            {
                domicilio.FechaEntrega = DateTime.Now;
            }

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // PUT: api/domicilios/{id}/metodo-pago
        [HttpPut("{id}/metodo-pago")]
        public async Task<IActionResult> ActualizarMetodoPago(int id, [FromBody] ActualizarMetodoPagoDto dto)
        {
            var domicilio = await _context.Domicilios.FindAsync(id);

            if (domicilio == null)
            {
                return NotFound(new { message = "Domicilio no encontrado" });
            }

            var metodosValidos = new[] { "Efectivo", "Transferencia", "Tarjeta", "Nequi", "Daviplata" };
            if (!metodosValidos.Contains(dto.MetodoPago))
            {
                return BadRequest(new { message = "Método de pago inválido" });
            }

            domicilio.MetodoPago = dto.MetodoPago;
            domicilio.PagadoAnticipado = dto.PagadoAnticipado;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // GET: api/domicilios/estadisticas/hoy
        [HttpGet("estadisticas/hoy")]
        public async Task<ActionResult<EstadisticasDomiciliosDto>> GetEstadisticasHoy()
        {
            var hoy = DateTime.Today;
            var manana = hoy.AddDays(1);

            var domiciliosHoy = await _context.Domicilios
                .Where(d => d.FechaPedido >= hoy && d.FechaPedido < manana)
                .ToListAsync();

            var estadisticas = new EstadisticasDomiciliosDto
            {
                TotalDomicilios = domiciliosHoy.Count,
                EnPreparacion = domiciliosHoy.Count(d => d.Estado == "EnPreparacion"),
                Listo = domiciliosHoy.Count(d => d.Estado == "Listo"),
                EnCamino = domiciliosHoy.Count(d => d.Estado == "EnCamino"),
                Entregados = domiciliosHoy.Count(d => d.Estado == "Entregado"),
                Cancelados = domiciliosHoy.Count(d => d.Estado == "Cancelado"),
                TotalVentas = domiciliosHoy.Where(d => d.Estado == "Entregado").Sum(d => d.Total)
            };

            return Ok(estadisticas);
        }
    }
}