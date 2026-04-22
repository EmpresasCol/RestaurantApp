// api/RestaurantApi/Controllers/DomiciliosPublicoController.cs
// Endpoints públicos (sin autenticación) para:
//   · Crear un pedido desde la página abierta del cliente final.
//   · Consultar el seguimiento del pedido por token.
//   · Editar el pedido dentro de una ventana de 5 minutos.
//   · Enviar observación al domiciliario tras la entrega.
//
// Consideraciones de seguridad:
//   · Todos los endpoints van por ruta `api/publico/*` para aislarlos del resto.
//   · El token es la única credencial del cliente. Se genera con RandomNumberGenerator
//     (criptográficamente seguro), 16 bytes → 32 hex chars → espacio de 2^128.
//   · Un token solo permite operar sobre su propio domicilio (comparación directa).
//   · Validaciones vía DataAnnotations + checks explícitos antes de persistir.
//   · Rate limiting recomendado a nivel de infraestructura (AWS WAF / API Gateway).

using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    [ApiController]
    [Route("api/publico/domicilios")]
    public class DomiciliosPublicoController : ControllerBase
    {
        private readonly RestauranteContext _context;
        private readonly DomicilioRealtimeService _realtime;
        private readonly ILogger<DomiciliosPublicoController> _logger;

        // Ventana de edición: el cliente puede modificar/agregar platillos
        // durante los primeros 5 minutos tras hacer el pedido.
        private static readonly TimeSpan VentanaEdicion = TimeSpan.FromMinutes(5);

        // ID del usuario "sistema" para los pedidos creados por clientes públicos.
        // Se crea on-demand igual que el usuario `cliente_qr`.
        private const string UsuarioSistemaPublico = "cliente_publico";

        public DomiciliosPublicoController(
            RestauranteContext context,
            DomicilioRealtimeService realtime,
            ILogger<DomiciliosPublicoController> logger)
        {
            _context  = context;
            _realtime = realtime;
            _logger   = logger;
        }

        // ══════════════════════════════════════════════════════════════════
        // 1. CREAR PEDIDO desde la página pública
        // ══════════════════════════════════════════════════════════════════
        [HttpPost]
        public async Task<ActionResult<CreateDomicilioPublicoResponseDto>> Crear(
            [FromBody] CreateDomicilioPublicoDto dto)
        {
            if (!ModelState.IsValid) return ValidationProblem(ModelState);

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Resolver o crear cliente por teléfono (clave natural).
                var cliente = await _context.Clientes
                    .FirstOrDefaultAsync(c => c.Telefono == dto.ClienteTelefono);

                if (cliente is null)
                {
                    cliente = new Cliente
                    {
                        Nombre   = dto.ClienteNombre.Trim(),
                        Telefono = dto.ClienteTelefono.Trim(),
                        Email    = dto.ClienteEmail?.Trim()
                    };
                    _context.Clientes.Add(cliente);
                    await _context.SaveChangesAsync();
                }
                else
                {
                    // Actualizar el nombre si cambió (UX: el cliente puede ajustar).
                    if (!string.IsNullOrWhiteSpace(dto.ClienteNombre)
                        && cliente.Nombre != dto.ClienteNombre.Trim())
                    {
                        cliente.Nombre = dto.ClienteNombre.Trim();
                    }
                }

                // 2. Crear una nueva dirección para este pedido (puede haber múltiples).
                var direccion = new Direccion
                {
                    ClienteId              = cliente.Id,
                    DireccionCompleta      = dto.DireccionCompleta.Trim(),
                    Barrio                 = dto.Barrio?.Trim(),
                    ReferenciasAdicionales = dto.ReferenciasAdicionales?.Trim(),
                    EsPrincipal            = false
                };
                _context.Direcciones.Add(direccion);
                await _context.SaveChangesAsync();

                // 3. Validar platillos y calcular subtotal.
                if (dto.Detalles.Count == 0)
                    return BadRequest(new { message = "Debe incluir al menos un platillo" });

                var platilloIds = dto.Detalles.Select(d => d.PlatilloId).Distinct().ToList();
                var platillos = await _context.Platillos
                    .Where(p => platilloIds.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id);

                if (platillos.Count != platilloIds.Count)
                    return BadRequest(new { message = "Uno o más platillos no existen" });

                decimal subtotal = 0m;
                var detalles = new List<DomicilioDetalle>();
                foreach (var d in dto.Detalles)
                {
                    if (d.Cantidad <= 0)
                        return BadRequest(new { message = "Cantidad inválida" });

                    var platillo = platillos[d.PlatilloId];
                    var lineaSubtotal = platillo.Precio * d.Cantidad;
                    subtotal += lineaSubtotal;

                    detalles.Add(new DomicilioDetalle
                    {
                        PlatilloId     = platillo.Id,
                        Cantidad       = d.Cantidad,
                        PrecioUnitario = platillo.Precio,
                        Subtotal       = lineaSubtotal,
                        Nota           = d.Nota
                    });
                }

                // 4. Costo de envío base (leer de ConfiguracionDomicilios en versiones futuras).
                const decimal costoEnvioBase = 3000m;

                // 5. Crear el domicilio.
                var ahora = DateTime.Now;
                var token = GenerarTokenSeguro();

                var domicilio = new Domicilio
                {
                    ClienteId            = cliente.Id,
                    DireccionId          = direccion.Id,
                    FechaPedido          = ahora,
                    Estado               = "EnPreparacion",
                    Subtotal             = subtotal,
                    CostoEnvio           = costoEnvioBase,
                    Total                = subtotal + costoEnvioBase,
                    MetodoPago           = dto.MetodoPago,
                    PagadoAnticipado     = false,
                    NotasCliente         = dto.NotasCliente,
                    UsuarioCreadorId     = await ResolverUsuarioSistemaPublico(),
                    FechaEstimadaEntrega = ahora.AddMinutes(50), // 30 prep + 20 entrega
                    TokenSeguimiento     = token,
                    PuedeEditarHasta     = ahora.Add(VentanaEdicion),
                    OrigenPedido         = "Publico"
                };

                _context.Domicilios.Add(domicilio);
                await _context.SaveChangesAsync();

                // 6. Persistir detalles.
                foreach (var det in detalles)
                    det.DomicilioId = domicilio.Id;
                _context.DomicilioDetalles.AddRange(detalles);
                await _context.SaveChangesAsync();

                await tx.CommitAsync();

                // 7. Notificar a cocina/admin por FCM.
                await _realtime.NotificarNuevoDomicilioAsync(domicilio);

                _logger.LogInformation("📥 Domicilio público creado #{Id} · token {Token}", domicilio.Id, token);

                return Ok(new CreateDomicilioPublicoResponseDto
                {
                    DomicilioId      = domicilio.Id,
                    TokenSeguimiento = token,
                    PuedeEditarHasta = domicilio.PuedeEditarHasta!.Value,
                    Total            = domicilio.Total
                });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "❌ Error creando domicilio público");
                return StatusCode(500, new { message = "No fue posible procesar tu pedido. Intenta de nuevo." });
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // 2. SEGUIMIENTO por token (lo que ve el cliente)
        // ══════════════════════════════════════════════════════════════════
        [HttpGet("seguimiento/{token}")]
        public async Task<ActionResult<SeguimientoPublicoDto>> Seguimiento(string token)
        {
            if (!EsTokenValido(token))
                return BadRequest(new { message = "Token inválido" });

            var d = await _context.Domicilios
                .AsNoTracking()
                .Include(x => x.Cliente)
                .Include(x => x.Direccion)
                .Include(x => x.Domiciliario)
                .Include(x => x.Detalles).ThenInclude(dd => dd.Platillo)
                .FirstOrDefaultAsync(x => x.TokenSeguimiento == token);

            if (d is null) return NotFound(new { message = "Pedido no encontrado" });

            var ahora = DateTime.Now;

            return Ok(new SeguimientoPublicoDto
            {
                DomicilioId            = d.Id,
                Estado                 = d.Estado,
                FechaPedido            = d.FechaPedido,
                FechaEstimadaEntrega   = d.FechaEstimadaEntrega,
                FechaRecogida          = d.FechaRecogida,
                FechaEntrega           = d.FechaEntrega,
                PuedeEditarHasta       = d.PuedeEditarHasta,
                PuedeEditarAhora       = d.Estado == "EnPreparacion"
                                         && d.PuedeEditarHasta.HasValue
                                         && ahora <= d.PuedeEditarHasta.Value,
                PuedeEnviarObservacion = d.Estado == "Entregado"
                                         && string.IsNullOrWhiteSpace(d.ObservacionCliente),
                ClienteNombre          = d.Cliente.Nombre,
                DireccionCompleta      = d.Direccion.DireccionCompleta,
                Subtotal               = d.Subtotal,
                CostoEnvio             = d.CostoEnvio,
                Total                  = d.Total,
                MetodoPago             = d.MetodoPago,
                NotasCliente           = d.NotasCliente,
                DomiciliarioNombre     = d.Domiciliario?.Nombre,
                Detalles = d.Detalles.Select(dd => new DomicilioDetalleDto
                {
                    Id             = dd.Id,
                    PlatilloId     = dd.PlatilloId,
                    PlatilloNombre = dd.Platillo.Nombre,
                    Cantidad       = dd.Cantidad,
                    PrecioUnitario = dd.PrecioUnitario,
                    Subtotal       = dd.Subtotal,
                    Nota           = dd.Nota ?? ""
                }).ToList()
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // 3. EDITAR dentro de la ventana de 5 minutos
        // ══════════════════════════════════════════════════════════════════
        [HttpPut("seguimiento/{token}")]
        public async Task<IActionResult> Editar(string token, [FromBody] EditarDomicilioPublicoDto dto)
        {
            if (!EsTokenValido(token))
                return BadRequest(new { message = "Token inválido" });

            if (!ModelState.IsValid) return ValidationProblem(ModelState);

            using var tx = await _context.Database.BeginTransactionAsync();

            var domicilio = await _context.Domicilios
                .Include(d => d.Detalles)
                .FirstOrDefaultAsync(d => d.TokenSeguimiento == token);

            if (domicilio is null) return NotFound();

            // Reglas de edición (explícitas, auditables):
            if (domicilio.Estado != "EnPreparacion")
                return Conflict(new { message = "El pedido ya está en una fase que no permite edición" });

            if (!domicilio.PuedeEditarHasta.HasValue || DateTime.Now > domicilio.PuedeEditarHasta.Value)
                return Conflict(new { message = "La ventana de edición ha expirado" });

            // Validar platillos
            var ids = dto.Detalles.Select(d => d.PlatilloId).Distinct().ToList();
            var platillos = await _context.Platillos
                .Where(p => ids.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id);

            if (platillos.Count != ids.Count)
                return BadRequest(new { message = "Uno o más platillos no existen" });

            // Reemplazar detalles (más simple que intentar reconciliar; el cliente edita poco).
            _context.DomicilioDetalles.RemoveRange(domicilio.Detalles);

            decimal subtotal = 0m;
            foreach (var d in dto.Detalles)
            {
                if (d.Cantidad <= 0)
                    return BadRequest(new { message = "Cantidad inválida" });

                var p = platillos[d.PlatilloId];
                var lineaSubtotal = p.Precio * d.Cantidad;
                subtotal += lineaSubtotal;

                _context.DomicilioDetalles.Add(new DomicilioDetalle
                {
                    DomicilioId    = domicilio.Id,
                    PlatilloId     = p.Id,
                    Cantidad       = d.Cantidad,
                    PrecioUnitario = p.Precio,
                    Subtotal       = lineaSubtotal,
                    Nota           = d.Nota
                });
            }

            domicilio.Subtotal     = subtotal;
            domicilio.Total        = subtotal + domicilio.CostoEnvio;
            domicilio.NotasCliente = dto.NotasCliente ?? domicilio.NotasCliente;

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            await _realtime.NotificarCambioEstadoAsync(domicilio);

            return NoContent();
        }

        // ══════════════════════════════════════════════════════════════════
        // 4. OBSERVACIÓN post-entrega
        // ══════════════════════════════════════════════════════════════════
        [HttpPost("seguimiento/{token}/observacion")]
        public async Task<IActionResult> EnviarObservacion(string token, [FromBody] EnviarObservacionDto dto)
        {
            if (!EsTokenValido(token))
                return BadRequest(new { message = "Token inválido" });

            if (!ModelState.IsValid) return ValidationProblem(ModelState);

            var domicilio = await _context.Domicilios
                .FirstOrDefaultAsync(d => d.TokenSeguimiento == token);

            if (domicilio is null) return NotFound();

            if (domicilio.Estado != "Entregado")
                return Conflict(new { message = "Solo puedes enviar observación tras la entrega" });

            if (!string.IsNullOrWhiteSpace(domicilio.ObservacionCliente))
                return Conflict(new { message = "Ya enviaste una observación para este pedido" });

            domicilio.ObservacionCliente = dto.Observacion.Trim();
            domicilio.FechaObservacion   = DateTime.Now;

            await _context.SaveChangesAsync();
            await _realtime.NotificarObservacionAsync(domicilio);

            _logger.LogInformation("💬 Observación recibida en #{Id}", domicilio.Id);
            return NoContent();
        }

        // ══════════════════════════════════════════════════════════════════
        // Helpers privados
        // ══════════════════════════════════════════════════════════════════

        /// <summary>Genera un token criptográficamente seguro de 32 chars hex.</summary>
        private static string GenerarTokenSeguro()
        {
            Span<byte> bytes = stackalloc byte[16];
            RandomNumberGenerator.Fill(bytes);
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }

        private static bool EsTokenValido(string token)
            => !string.IsNullOrWhiteSpace(token)
               && token.Length == 32
               && token.All(c => (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'));

        /// <summary>
        /// Obtiene (o crea) el usuario genérico del sistema usado para marcar
        /// quién creó pedidos "públicos" (FK obligatorio en Domicilios).
        /// </summary>
        private async Task<int> ResolverUsuarioSistemaPublico()
        {
            var user = await _context.Usuarios
                .FirstOrDefaultAsync(u => u.NombreUsuario == UsuarioSistemaPublico);

            if (user is not null) return user.Id;

            user = new Usuario
            {
                Nombre        = "Cliente Público",
                NombreUsuario = UsuarioSistemaPublico,
                ClaveHash     = Guid.NewGuid().ToString("N"),  // inutilizable para login
                Rol           = RolUsuario.Mesero              // placeholder, nunca se usa para login
            };
            _context.Usuarios.Add(user);
            await _context.SaveChangesAsync();
            return user.Id;
        }
    }
}
