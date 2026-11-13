// api/RestaurantApi/Controllers/DomiciliosController.cs
using System.Linq.Expressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;
using RestaurantApi.Dtos;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Administrador,Caja,Cocina")]
    public class DomiciliosController : ControllerBase
    {
        private const int CantidadMaximaPorLinea = 100;
        private static readonly string[] EstadosActivos = { "EnPreparacion", "Listo", "Recogido", "EnCamino" };

        private readonly RestauranteContext _context;
        private readonly IInventarioService _inventarioService;

        public DomiciliosController(RestauranteContext context, IInventarioService inventarioService)
        {
            _context = context;
            _inventarioService = inventarioService;
        }

        // GET: api/domicilios
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DomicilioResponseDto>>> GetDomicilios()
        {
            var domicilios = await _context.Domicilios
                .OrderByDescending(d => d.FechaPedido)
                .Select(AResponseDto)
                .ToListAsync();

            return Ok(await ConFacturaAsync(domicilios));
        }

        // GET: api/domicilios/activos
        /// <summary>Domicilios en curso: en preparación, listos, recogidos o en camino.</summary>
        [HttpGet("activos")]
        public async Task<ActionResult<IEnumerable<DomicilioResponseDto>>> GetDomiciliosActivos()
        {
            var domicilios = await _context.Domicilios
                .Where(d => EstadosActivos.Contains(d.Estado))
                .OrderBy(d => d.FechaPedido)
                .Select(AResponseDto)
                .ToListAsync();

            return Ok(await ConFacturaAsync(domicilios));
        }

        // GET: api/domicilios/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<DomicilioResponseDto>> GetDomicilio(int id)
        {
            var domicilio = await _context.Domicilios
                .Where(d => d.Id == id)
                .Select(AResponseDto)
                .FirstOrDefaultAsync();

            if (domicilio == null)
                return NotFound(new { message = "Domicilio no encontrado" });

            return Ok((await ConFacturaAsync(new List<DomicilioResponseDto> { domicilio }))[0]);
        }

        // GET: api/domicilios/hoy
        /// <summary>Todo lo del día (hora de Colombia) más lo que sigue en curso de días anteriores.</summary>
        [HttpGet("hoy")]
        public async Task<ActionResult<IEnumerable<DomicilioResponseDto>>> GetDomiciliosHoy()
        {
            var hoy = HoraLocal.InicioDeHoyUtc();
            var domicilios = await _context.Domicilios
                .Where(d => d.FechaPedido >= hoy || EstadosActivos.Contains(d.Estado))
                .OrderByDescending(d => d.FechaPedido)
                .Select(AResponseDto)
                .ToListAsync();

            return Ok(await ConFacturaAsync(domicilios));
        }

        // POST: api/domicilios
        [HttpPost]
        [Authorize(Roles = "Administrador,Caja")]
        public async Task<ActionResult<DomicilioResponseDto>> CreateDomicilio([FromBody] CreateDomicilioDto dto)
        {
            if (dto.Detalles == null || dto.Detalles.Count == 0)
                return BadRequest(new { message = "El domicilio debe incluir al menos un platillo" });

            if (dto.Detalles.Any(d => d.Cantidad <= 0 || d.Cantidad > CantidadMaximaPorLinea))
                return BadRequest(new { message = $"La cantidad de cada platillo debe estar entre 1 y {CantidadMaximaPorLinea}" });

            if (dto.CostoEnvio < 0)
                return BadRequest(new { message = "El costo de envío no puede ser negativo" });

            var metodoPago = string.IsNullOrWhiteSpace(dto.MetodoPago) ? "Efectivo" : Entregas.Normalizar(dto.MetodoPago);
            if (metodoPago == null)
                return BadRequest(new { message = "Método de pago inválido" });

            if (!await _context.Clientes.AnyAsync(c => c.Id == dto.ClienteId))
                return BadRequest(new { message = "Cliente no encontrado" });

            if (!await _context.Direcciones.AnyAsync(d => d.Id == dto.DireccionId && d.ClienteId == dto.ClienteId))
                return BadRequest(new { message = "Dirección no encontrada para el cliente" });

            // Quien crea el domicilio es el usuario del token, no el que diga el cuerpo.
            var usuarioCreadorId = QproClaims.IdUsuario(HttpContext?.User) ?? dto.UsuarioCreadorId;
            if (!await _context.Usuarios.AnyAsync(u => u.Id == usuarioCreadorId))
                return BadRequest(new { message = "Usuario creador no válido" });

            var platilloIds = dto.Detalles.Select(d => d.PlatilloId).Distinct().ToList();
            var platillos = await _context.Platillos
                .Where(p => platilloIds.Contains(p.Id) && p.Activo)
                .ToDictionaryAsync(p => p.Id);

            var faltantes = platilloIds.Except(platillos.Keys).ToList();
            if (faltantes.Count > 0)
                return BadRequest(new { message = $"Platillo(s) que no existen o ya no están en la carta: {string.Join(", ", faltantes)}" });

            var sinStock = await _inventarioService.VerificarStockDomicilioAsync(0, dto.Detalles.Select(d => (d.PlatilloId, d.Cantidad)));
            if (sinStock != null)
                return BadRequest(new { message = sinStock });

            var detalles = dto.Detalles.Select(d => new DomicilioDetalle
            {
                PlatilloId = d.PlatilloId,
                Cantidad = d.Cantidad,
                PrecioUnitario = platillos[d.PlatilloId].Precio,
                Subtotal = platillos[d.PlatilloId].Precio * d.Cantidad,
                Nota = d.Nota ?? ""
            }).ToList();

            var subtotal = detalles.Sum(d => d.Subtotal);
            var errorPago = ValidarPagaCon(dto.PagaCon, metodoPago, dto.PagadoAnticipado, subtotal + dto.CostoEnvio);
            if (errorPago != null)
                return BadRequest(new { message = errorPago });

            // Domicilio y detalles en un solo SaveChanges.
            var domicilio = new Domicilio
            {
                ClienteId = dto.ClienteId,
                DireccionId = dto.DireccionId,
                FechaPedido = DateTime.UtcNow,
                Estado = "EnPreparacion",
                Subtotal = subtotal,
                CostoEnvio = dto.CostoEnvio,
                Total = subtotal + dto.CostoEnvio,
                MetodoPago = metodoPago,
                PagadoAnticipado = dto.PagadoAnticipado,
                PagaCon = metodoPago == "Efectivo" && !dto.PagadoAnticipado ? dto.PagaCon : null,
                NotasCliente = dto.NotasCliente ?? "",
                NotasInternas = dto.NotasInternas ?? "",
                UsuarioCreadorId = usuarioCreadorId,
                FechaEstimadaEntrega = DateTime.UtcNow.AddMinutes(30),
                Detalles = detalles
            };

            _context.Domicilios.Add(domicilio);
            await _context.SaveChangesAsync();

            await _inventarioService.DescontarStockPorDomicilioAsync(domicilio.Id);

            var domicilioCreado = await _context.Domicilios
                .Where(d => d.Id == domicilio.Id)
                .Select(AResponseDto)
                .FirstAsync();

            return CreatedAtAction(nameof(GetDomicilio), new { id = domicilio.Id }, domicilioCreado);
        }

        // PUT: api/domicilios/{id}/preparar
        /// <summary>
        /// La cocina empieza el domicilio (como "Empezar a preparar" en los pedidos de mesa).
        /// Desde ahí el cliente ya no lo edita desde su enlace de seguimiento.
        /// </summary>
        [HttpPut("{id}/preparar")]
        [Authorize(Roles = "Administrador,Cocina")]
        public async Task<IActionResult> Preparar(int id)
        {
            var domicilio = await _context.Domicilios.FindAsync(id);
            if (domicilio == null)
                return NotFound(new { message = "Domicilio no encontrado" });
            if (domicilio.Estado != "EnPreparacion")
                return Conflict(new { message = $"Un domicilio {domicilio.Estado} ya no se empieza a preparar" });

            domicilio.InicioPreparacion ??= DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // PUT: api/domicilios/{id}/estado
        /// <summary>
        /// Cocina: Listo. Caja o administrador: Entregado (cobrado en caja o sin domiciliario,
        /// con el método con que pagó de verdad) o Cancelado (con motivo). Recogido y En camino
        /// son del domiciliario desde la app.
        /// </summary>
        [HttpPut("{id}/estado")]
        public async Task<IActionResult> ActualizarEstado(int id, [FromBody] ActualizarEstadoDto dto)
        {
            var domicilio = await _context.Domicilios.FindAsync(id);

            if (domicilio == null)
                return NotFound(new { message = "Domicilio no encontrado" });

            if (string.IsNullOrWhiteSpace(dto.Estado) || !EstadosPedido.EsEstadoDomicilio(dto.Estado) || dto.Estado == "Recogido")
                return BadRequest(new { message = "Estado inválido" });

            if (!EstadosPedido.PuedeCambiarDomicilio(domicilio.Estado, dto.Estado))
                return Conflict(new { message = $"No se puede pasar un domicilio de {domicilio.Estado} a {dto.Estado}" });

            if (domicilio.Estado == dto.Estado)
                return NoContent();

            // La cocina prepara; entregar y cancelar son de caja o del administrador.
            if (User.IsInRole(nameof(RolUsuario.Cocina)) && dto.Estado is not ("Listo" or "EnPreparacion"))
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "La cocina solo marca el domicilio listo" });

            try
            {
                if (dto.Estado == "Entregado")
                {
                    var error = await Entregas.EntregarAsync(_context, domicilio, dto.MetodoPago, null, cobradoEnCaja: true);
                    if (error != null)
                        return BadRequest(new { message = error });
                }
                else
                {
                    domicilio.Estado = dto.Estado;
                    if (dto.Estado == "Listo")
                        domicilio.InicioPreparacion ??= DateTime.UtcNow;
                    if (dto.Estado == "Cancelado")
                    {
                        var motivo = string.IsNullOrWhiteSpace(dto.Motivo) ? "sin motivo" : dto.Motivo.Trim();
                        domicilio.NotasInternas = string.Join(" · ", new[] { domicilio.NotasInternas, $"Cancelado: {motivo}" }
                            .Where(n => !string.IsNullOrWhiteSpace(n)));
                    }
                    await _context.SaveChangesAsync();
                }
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(new { message = "El domicilio cambió mientras lo editabas. Recarga e intenta de nuevo." });
            }

            if (dto.Estado == "Cancelado")
                await _inventarioService.RevertirStockPorDomicilioAsync(id);
            else
                await _inventarioService.DescontarStockPorDomicilioAsync(id);

            return NoContent();
        }

        // PUT: api/domicilios/{id}/domiciliario
        /// <summary>
        /// Asigna el domicilio a un domiciliario (o lo devuelve a la bolsa común) antes de que lo
        /// recojan: el domiciliario lo ve en "Mis entregas" desde que está en cocina.
        /// </summary>
        [HttpPut("{id}/domiciliario")]
        [Authorize(Roles = "Administrador,Caja")]
        public async Task<IActionResult> AsignarDomiciliario(int id, [FromBody] AsignarDomiciliarioDto dto)
        {
            var domicilio = await _context.Domicilios.FindAsync(id);
            if (domicilio == null)
                return NotFound(new { message = "Domicilio no encontrado" });
            if (domicilio.Estado is not ("EnPreparacion" or "Listo"))
                return Conflict(new { message = "Ya salió del restaurante: no se puede reasignar" });

            if (dto.DomiciliarioId is { } domiciliarioId
                && !await _context.Usuarios.AnyAsync(u => u.Id == domiciliarioId && u.Rol == RolUsuario.Domiciliario && u.Activo))
                return BadRequest(new { message = "Ese usuario no es un domiciliario activo" });

            domicilio.DomiciliarioId = dto.DomiciliarioId;
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(new { message = "Otro domiciliario lo tomó primero. Recarga e intenta de nuevo." });
            }
            return NoContent();
        }

        // PUT: api/domicilios/{id}/metodo-pago
        [HttpPut("{id}/metodo-pago")]
        [Authorize(Roles = "Administrador,Caja")]
        public async Task<IActionResult> ActualizarMetodoPago(int id, [FromBody] ActualizarMetodoPagoDto dto)
        {
            var domicilio = await _context.Domicilios.FindAsync(id);

            if (domicilio == null)
                return NotFound(new { message = "Domicilio no encontrado" });

            if (domicilio.Estado is "Entregado" or "Cancelado")
                return Conflict(new { message = "Ya se cerró: su factura no se reescribe" });

            var metodo = Entregas.Normalizar(dto.MetodoPago);
            if (metodo == null)
                return BadRequest(new { message = "Método de pago inválido" });

            var errorPago = ValidarPagaCon(dto.PagaCon, metodo, dto.PagadoAnticipado, domicilio.Subtotal + domicilio.CostoEnvio);
            if (errorPago != null)
                return BadRequest(new { message = errorPago });

            domicilio.MetodoPago = metodo;
            domicilio.PagadoAnticipado = dto.PagadoAnticipado;
            domicilio.PagaCon = metodo == "Efectivo" && !dto.PagadoAnticipado ? dto.PagaCon : null;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // GET: api/domicilios/domiciliarios
        /// <summary>Domiciliarios activos, para asignarles domicilios.</summary>
        [HttpGet("domiciliarios")]
        [Authorize(Roles = "Administrador,Caja")]
        public async Task<ActionResult<IEnumerable<object>>> GetDomiciliarios()
            => await _context.Usuarios.AsNoTracking()
                .Where(u => u.Rol == RolUsuario.Domiciliario && u.Activo)
                .OrderBy(u => u.Nombre)
                .Select(u => new { u.Id, u.Nombre })
                .ToListAsync();

        // GET: api/domicilios/liquidaciones
        /// <summary>Efectivo que cada domiciliario cobró y no ha entregado en caja.</summary>
        [HttpGet("liquidaciones")]
        [Authorize(Roles = "Administrador,Caja")]
        public async Task<ActionResult<IEnumerable<LiquidacionPendienteDto>>> GetLiquidaciones()
        {
            var pendientes = await _context.Domicilios.AsNoTracking()
                .Include(d => d.Domiciliario)
                .Where(d => d.Estado == "Entregado" && d.MetodoPago == "Efectivo" && !d.PagadoAnticipado
                            && d.FechaLiquidacion == null && d.DomiciliarioId != null)
                .ToListAsync();

            return pendientes
                .GroupBy(d => d.DomiciliarioId!.Value)
                .Select(g => new LiquidacionPendienteDto
                {
                    DomiciliarioId = g.Key,
                    Nombre = g.First().Domiciliario?.Nombre ?? $"Domiciliario #{g.Key}",
                    Entregas = g.Count(),
                    Total = g.Sum(d => d.Subtotal + d.CostoEnvio),
                    Domicilios = g.Select(d => d.Id).OrderBy(x => x).ToList()
                })
                .OrderByDescending(l => l.Total)
                .ToList();
        }

        // POST: api/domicilios/liquidaciones/{domiciliarioId}
        /// <summary>La caja recibe del domiciliario el efectivo de sus entregas: entra al cuadre del día.</summary>
        [HttpPost("liquidaciones/{domiciliarioId}")]
        [Authorize(Roles = "Administrador,Caja")]
        public async Task<ActionResult<LiquidacionPendienteDto>> Liquidar(int domiciliarioId)
        {
            var pendientes = await _context.Domicilios
                .Include(d => d.Domiciliario)
                .Where(d => d.DomiciliarioId == domiciliarioId && d.Estado == "Entregado" && d.MetodoPago == "Efectivo"
                            && !d.PagadoAnticipado && d.FechaLiquidacion == null)
                .ToListAsync();
            if (pendientes.Count == 0)
                return NotFound(new { message = "Este domiciliario no tiene efectivo por entregar" });

            var ahora = DateTime.UtcNow;
            foreach (var d in pendientes) d.FechaLiquidacion = ahora;
            await _context.SaveChangesAsync();

            return new LiquidacionPendienteDto
            {
                DomiciliarioId = domiciliarioId,
                Nombre = pendientes[0].Domiciliario?.Nombre ?? $"Domiciliario #{domiciliarioId}",
                Entregas = pendientes.Count,
                Total = pendientes.Sum(d => d.Subtotal + d.CostoEnvio),
                Domicilios = pendientes.Select(d => d.Id).OrderBy(x => x).ToList()
            };
        }

        // GET: api/domicilios/{id}/comprobante
        [HttpGet("{id}/comprobante")]
        [Authorize(Roles = "Administrador,Caja")]
        public async Task<IActionResult> GetComprobante(int id)
        {
            var comprobante = await _context.Domicilios.Where(d => d.Id == id).Select(d => d.ComprobantePago).FirstOrDefaultAsync();
            if (comprobante == null)
                return NotFound(new { message = "Este domicilio no tiene comprobante" });
            return Ok(new { comprobante });
        }

        // GET: api/domicilios/estadisticas/hoy
        [HttpGet("estadisticas/hoy")]
        public async Task<ActionResult<EstadisticasDomiciliosDto>> GetEstadisticasHoy()
        {
            var hoy = HoraLocal.InicioDeHoyUtc();
            var manana = hoy.AddDays(1);

            var domiciliosHoy = await _context.Domicilios
                .Where(d => d.FechaPedido >= hoy && d.FechaPedido < manana)
                .ToListAsync();

            var porLiquidar = await _context.Domicilios.AsNoTracking()
                .Where(d => d.Estado == "Entregado" && d.MetodoPago == "Efectivo" && !d.PagadoAnticipado
                            && d.FechaLiquidacion == null && d.DomiciliarioId != null)
                .SumAsync(d => d.Subtotal + d.CostoEnvio);

            var estadisticas = new EstadisticasDomiciliosDto
            {
                TotalDomicilios = domiciliosHoy.Count,
                PorEmpezar = domiciliosHoy.Count(d => d.Estado == "EnPreparacion" && d.InicioPreparacion == null),
                EnPreparacion = domiciliosHoy.Count(d => d.Estado == "EnPreparacion"),
                Listo = domiciliosHoy.Count(d => d.Estado == "Listo"),
                EnCamino = domiciliosHoy.Count(d => d.Estado == "EnCamino" || d.Estado == "Recogido"),
                Entregados = domiciliosHoy.Count(d => d.Estado == "Entregado"),
                Cancelados = domiciliosHoy.Count(d => d.Estado == "Cancelado"),
                TotalVentas = domiciliosHoy.Where(d => d.Estado == "Entregado").Sum(d => d.Subtotal + d.CostoEnvio),
                EfectivoPorLiquidar = porLiquidar
            };

            return Ok(estadisticas);
        }

        /// <summary>En efectivo, el billete del cliente debe alcanzar para el total.</summary>
        private static string? ValidarPagaCon(decimal? pagaCon, string metodo, bool pagadoAnticipado, decimal total)
        {
            if (pagaCon == null || metodo != "Efectivo" || pagadoAnticipado) return null;
            return pagaCon < total ? $"Con {Cuentas.Pesos(pagaCon)} no alcanza para el total de {Cuentas.Pesos(total)}" : null;
        }

        /// <summary>Número de la factura de los domicilios entregados.</summary>
        private async Task<List<DomicilioResponseDto>> ConFacturaAsync(List<DomicilioResponseDto> domicilios)
        {
            var ids = domicilios.Where(d => d.Estado == "Entregado").Select(d => (int?)d.Id).ToList();
            if (ids.Count == 0) return domicilios;
            var numeros = await _context.Facturas.AsNoTracking()
                .Where(f => ids.Contains(f.DomicilioId))
                .ToDictionaryAsync(f => f.DomicilioId!.Value, f => f.NumeroFactura);
            foreach (var d in domicilios) d.NumeroFactura = numeros.GetValueOrDefault(d.Id);
            return domicilios;
        }

        private static readonly Expression<Func<Domicilio, DomicilioResponseDto>> AResponseDto = d => new DomicilioResponseDto
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
            FechaRecogida = d.FechaRecogida,
            FechaLiquidacion = d.FechaLiquidacion,
            CocinaEmpezo = d.Estado != "EnPreparacion" || d.InicioPreparacion != null,
            PagaCon = d.PagaCon,
            Cambio = d.MetodoPago == "Efectivo" && !d.PagadoAnticipado && d.PagaCon != null && d.PagaCon >= d.Subtotal + d.CostoEnvio
                ? d.PagaCon - (d.Subtotal + d.CostoEnvio)
                : null,
            TieneComprobante = d.ComprobantePago != null,
            OrigenPedido = d.OrigenPedido,
            PorLiquidar = d.Estado == "Entregado" && d.MetodoPago == "Efectivo" && !d.PagadoAnticipado
                          && d.FechaLiquidacion == null && d.DomiciliarioId != null,
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
        };
    }
}
