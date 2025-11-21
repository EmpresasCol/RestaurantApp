// api/RestaurantApi/Controllers/ClientesController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;

namespace RestaurantApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ClientesController : ControllerBase
    {
        private readonly RestauranteContext _context;

        public ClientesController(RestauranteContext context)
        {
            _context = context;
        }

        // GET: api/clientes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ClienteResponseDto>>> GetClientes()
        {
            var clientes = await _context.Clientes
                .Select(c => new ClienteResponseDto
                {
                    Id = c.Id,
                    Nombre = c.Nombre,
                    Telefono = c.Telefono,
                    Email = c.Email,
                    FechaRegistro = c.FechaRegistro
                })
                .ToListAsync();

            return Ok(clientes);
        }

        // GET: api/clientes/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<ClienteResponseDto>> GetCliente(int id)
        {
            var cliente = await _context.Clientes
                .Where(c => c.Id == id)
                .Select(c => new ClienteResponseDto
                {
                    Id = c.Id,
                    Nombre = c.Nombre,
                    Telefono = c.Telefono,
                    Email = c.Email,
                    FechaRegistro = c.FechaRegistro
                })
                .FirstOrDefaultAsync();

            if (cliente == null)
            {
                return NotFound(new { message = "Cliente no encontrado" });
            }

            return Ok(cliente);
        }

        // GET: api/clientes/telefono/{telefono}
        [HttpGet("telefono/{telefono}")]
        public async Task<ActionResult<ClienteResponseDto>> GetClientePorTelefono(string telefono)
        {
            var cliente = await _context.Clientes
                .Where(c => c.Telefono == telefono)
                .Select(c => new ClienteResponseDto
                {
                    Id = c.Id,
                    Nombre = c.Nombre,
                    Telefono = c.Telefono,
                    Email = c.Email,
                    FechaRegistro = c.FechaRegistro
                })
                .FirstOrDefaultAsync();

            if (cliente == null)
            {
                return NotFound(new { message = "Cliente no encontrado" });
            }

            return Ok(cliente);
        }

        // POST: api/clientes
        [HttpPost]
        public async Task<ActionResult<ClienteResponseDto>> CreateCliente([FromBody] ClienteDto dto)
        {
            // Validar que no exista un cliente con el mismo teléfono
            var existeTelefono = await _context.Clientes.AnyAsync(c => c.Telefono == dto.Telefono);
            if (existeTelefono)
            {
                return BadRequest(new { message = "Ya existe un cliente con este número de teléfono" });
            }

            var cliente = new Cliente
            {
                Nombre = dto.Nombre,
                Telefono = dto.Telefono,
                Email = dto.Email,
                FechaRegistro = DateTime.Now
            };

            _context.Clientes.Add(cliente);
            await _context.SaveChangesAsync();

            var clienteDto = new ClienteResponseDto
            {
                Id = cliente.Id,
                Nombre = cliente.Nombre,
                Telefono = cliente.Telefono,
                Email = cliente.Email,
                FechaRegistro = cliente.FechaRegistro
            };

            return CreatedAtAction(nameof(GetCliente), new { id = cliente.Id }, clienteDto);
        }

        // POST: api/clientes/con-direccion
        [HttpPost("con-direccion")]
        public async Task<ActionResult<ClienteConDireccionResponseDto>> CreateClienteConDireccion([FromBody] CreateClienteConDireccionDto dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // Validar que no exista un cliente con el mismo teléfono
                var existeTelefono = await _context.Clientes.AnyAsync(c => c.Telefono == dto.Cliente.Telefono);
                if (existeTelefono)
                {
                    return BadRequest(new { message = "Ya existe un cliente con este número de teléfono" });
                }

                // Crear cliente
                var cliente = new Cliente
                {
                    Nombre = dto.Cliente.Nombre,
                    Telefono = dto.Cliente.Telefono,
                    Email = dto.Cliente.Email,
                    FechaRegistro = DateTime.Now
                };

                _context.Clientes.Add(cliente);
                await _context.SaveChangesAsync();

                // Crear dirección
                var direccion = new Direccion
                {
                    ClienteId = cliente.Id,
                    DireccionCompleta = dto.Direccion.DireccionCompleta,
                    Barrio = dto.Direccion.Barrio,
                    ReferenciasAdicionales = dto.Direccion.ReferenciasAdicionales,
                    EsPrincipal = true
                };

                _context.Direcciones.Add(direccion);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new ClienteConDireccionResponseDto
                {
                    ClienteId = cliente.Id,
                    DireccionId = direccion.Id
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "Error al crear cliente y dirección", error = ex.Message });
            }
        }

        // PUT: api/clientes/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCliente(int id, [FromBody] ClienteDto dto)
        {
            var cliente = await _context.Clientes.FindAsync(id);

            if (cliente == null)
            {
                return NotFound(new { message = "Cliente no encontrado" });
            }

            // Validar que el teléfono no esté en uso por otro cliente
            var existeTelefono = await _context.Clientes
                .AnyAsync(c => c.Telefono == dto.Telefono && c.Id != id);

            if (existeTelefono)
            {
                return BadRequest(new { message = "El teléfono ya está en uso por otro cliente" });
            }

            cliente.Nombre = dto.Nombre;
            cliente.Telefono = dto.Telefono;
            cliente.Email = dto.Email;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/clientes/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCliente(int id)
        {
            var cliente = await _context.Clientes.FindAsync(id);

            if (cliente == null)
            {
                return NotFound(new { message = "Cliente no encontrado" });
            }

            _context.Clientes.Remove(cliente);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}