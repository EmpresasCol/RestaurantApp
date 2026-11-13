using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Dtos;
using RestaurantApi.Models;
using RestaurantApi.Services;

namespace RestaurantApi.Controllers
{
    /// <summary>
    /// Lo que hace el comensal desde el QR sin iniciar sesión: llamar al mesero, seguir los
    /// pedidos de su visita y recibir avisos. El código del QR dice qué mesa es; ver la cuenta
    /// exige además la llave de la visita en curso (la recibe quien pide por el QR o quien
    /// escribe el código de 6 dígitos que le da el personal). Una llave de una visita cerrada
    /// solo recibe "cerrada": nunca los pedidos de quien se sentó después.
    /// </summary>
    [Route("api/cliente-mesa")]
    [ApiController]
    [AllowAnonymous]
    [EnableRateLimiting("cliente-mesa")]
    public class ClienteMesaController : ControllerBase
    {
        public const string CabeceraMesa = "X-Mesa";
        public const string CabeceraLlave = "X-Seguimiento";
        /// <summary>Tiempo mínimo entre dos llamadas de la misma mesa.</summary>
        public static readonly TimeSpan EsperaEntreLlamadas = TimeSpan.FromSeconds(45);
        public const int MaximoSuscripciones = 20;

        private const string QrInvalido = "Este código QR ya no es válido. Pide al mesero el código de tu mesa.";

        private readonly RestauranteContext _context;
        private readonly ILogger<ClienteMesaController> _logger;
        private readonly PushWeb? _push;

        public ClienteMesaController(RestauranteContext context, ILogger<ClienteMesaController> logger, PushWeb? push = null)
        {
            _context = context;
            _logger = logger;
            _push = push;
        }

        private Task<Mesa?> MesaAsync(string? codigo) => string.IsNullOrWhiteSpace(codigo)
            ? Task.FromResult<Mesa?>(null)
            : _context.Mesas.FirstOrDefaultAsync(m => m.CodigoQR == codigo.Trim());

        // ── Seguimiento ───────────────────────────────────────────────────

        /// <summary>Otro comensal de la mesa se suma al seguimiento con el código que le da el personal.</summary>
        [HttpPost("unirse")]
        public async Task<IActionResult> Unirse(UnirseDto dto)
        {
            var mesa = await MesaAsync(dto.CodigoMesa);
            if (mesa == null)
                return NotFound(new { message = QrInvalido });

            var ocupacion = await Ocupaciones.AbiertaAsync(_context, mesa.Id);
            if (ocupacion == null)
                return NotFound(new { message = "Tu mesa todavía no tiene pedidos. Haz tu pedido desde la carta o llama al mesero." });

            var pin = new string((dto.Pin ?? "").Where(char.IsDigit).ToArray());
            if (pin.Length != 6 || !CryptographicOperations.FixedTimeEquals(System.Text.Encoding.ASCII.GetBytes(pin), System.Text.Encoding.ASCII.GetBytes(ocupacion.Pin)))
            {
                // Tras varios intentos fallidos el código cambia: adivinarlo probando no avanza.
                if (++ocupacion.IntentosPin >= Ocupaciones.IntentosPinAntesDeCambiarlo)
                {
                    ocupacion.Pin = Ocupaciones.NuevoPin();
                    ocupacion.IntentosPin = 0;
                }
                await _context.SaveChangesAsync();
                return BadRequest(new { message = "Ese código no es el de tu mesa. Pídeselo de nuevo al mesero." });
            }

            if (ocupacion.IntentosPin != 0)
            {
                ocupacion.IntentosPin = 0;
                await _context.SaveChangesAsync();
            }
            return Ok(new { seguimiento = ocupacion.Token });
        }

        /// <summary>Pedidos, estados y cuenta de la visita en curso. 410 cuando la visita ya se cerró.</summary>
        [HttpGet("seguimiento")]
        public async Task<ActionResult<SeguimientoDto>> GetSeguimiento(
            [FromHeader(Name = CabeceraMesa)] string? codigoMesa, [FromHeader(Name = CabeceraLlave)] string? llave)
        {
            var mesa = await MesaAsync(codigoMesa);
            if (mesa == null)
                return NotFound(new { message = QrInvalido });

            var ocupacion = string.IsNullOrWhiteSpace(llave)
                ? null
                : await _context.Ocupaciones.AsNoTracking().FirstOrDefaultAsync(o => o.Token == llave && o.MesaId == mesa.Id);
            if (ocupacion == null)
                return NotFound(new { message = "No encontramos tu seguimiento. Pide el código de la mesa al mesero." });

            if (ocupacion.Abierta != true)
            {
                var pagada = await _context.Pedidos.AnyAsync(p => p.OcupacionId == ocupacion.Id && p.Estado == EstadoPedido.Pagado);
                return StatusCode(StatusCodes.Status410Gone, new
                {
                    cerrada = true,
                    pagada,
                    message = pagada ? "Tu cuenta quedó pagada. ¡Gracias por tu visita!" : "Tu pedido se canceló y la mesa quedó libre."
                });
            }

            // Solo las columnas que ve el comensal: sin la foto del platillo (Base64) ni datos del personal.
            var pedidos = await _context.Pedidos.AsNoTracking()
                .Where(p => p.OcupacionId == ocupacion.Id)
                .OrderBy(p => p.Fecha)
                .Select(p => new Pedido
                {
                    Id = p.Id,
                    Fecha = p.Fecha,
                    Estado = p.Estado,
                    Detalles = p.Detalles.OrderBy(d => d.Id).Select(d => new PedidoDetalle
                    {
                        Cantidad = d.Cantidad, Nota = d.Nota, Estado = d.Estado, PrecioUnitario = d.PrecioUnitario, FacturaId = d.FacturaId,
                        Platillo = new Platillo { Nombre = d.Platillo!.Nombre, Precio = d.Platillo.Precio }
                    }).ToList()
                })
                .ToListAsync();

            var solicitud = await _context.SolicitudesCuenta.AsNoTracking()
                .Where(s => s.MesaId == mesa.Id && s.Estado == SolicitudCuenta.Pendiente)
                .Select(s => new { PorConfirmar = s.Pagos.Any(p => p.FacturaId == null) })
                .FirstOrDefaultAsync();
            var llamada = await _context.LlamadasMesero.AsNoTracking()
                .Where(l => l.MesaId == mesa.Id && l.Activa == true).Select(l => l.Estado).FirstOrDefaultAsync();

            var vigentes = pedidos.Where(p => p.Estado != EstadoPedido.Cancelado).ToList();
            var total = vigentes.Sum(p => p.Detalles.Where(d => d.Estado != EstadoDetalle.Cancelado).Sum(d => Cuentas.Precio(d) * d.Cantidad));
            var pendiente = vigentes.Where(p => Cuentas.Abierto(p.Estado)).Sum(Cuentas.ConsumoPorCobrar);

            return new SeguimientoDto
            {
                MesaNumero = mesa.Numero,
                Pin = ocupacion.Pin,
                Inicio = ocupacion.Inicio,
                Llamada = llamada,
                Pedidos = pedidos.Select(p => new PedidoSeguimientoDto
                {
                    Id = p.Id,
                    Fecha = p.Fecha,
                    Estado = EstadosPedido.ParaCliente(p),
                    Platos = p.Detalles.Where(d => d.Estado != EstadoDetalle.Cancelado).Select(d => new PlatoSeguimientoDto
                    {
                        Nombre = d.Platillo?.Nombre ?? "Plato",
                        Cantidad = d.Cantidad,
                        Nota = string.IsNullOrWhiteSpace(d.Nota) ? null : d.Nota,
                        Precio = Cuentas.Precio(d),
                        Pagado = d.FacturaId != null || p.Estado == EstadoPedido.Pagado
                    }).ToList()
                }).ToList(),
                Cuenta = new CuentaSeguimientoDto
                {
                    Total = total,
                    Pendiente = pendiente,
                    Pagado = total - pendiente,
                    CuentaPedida = solicitud != null,
                    PagoPorConfirmar = solicitud?.PorConfirmar == true
                }
            };
        }

        // ── Llamar al mesero ──────────────────────────────────────────────

        /// <summary>
        /// Registra la llamada de la mesa y avisa a los meseros. Si la mesa ya tiene una llamada
        /// viva devuelve esa misma (doble toque, reintento, otro teléfono de la mesa): nunca dos.
        /// </summary>
        [HttpPost("llamadas")]
        public async Task<ActionResult<LlamadaClienteDto>> Llamar(LlamarMeseroDto dto)
        {
            var mesa = await MesaAsync(dto.CodigoMesa);
            if (mesa == null)
                return NotFound(new { message = QrInvalido });

            LlamadaMesero llamada;
            await using (var tx = await Ocupaciones.BloquearMesaAsync(_context, mesa.Id))
            {
                var viva = await _context.LlamadasMesero.FirstOrDefaultAsync(l => l.MesaId == mesa.Id && l.Activa == true);
                if (viva != null)
                    return Ok(ADto(viva));

                var ultima = await _context.LlamadasMesero.Where(l => l.MesaId == mesa.Id)
                    .OrderByDescending(l => l.Fecha).Select(l => (DateTime?)l.Fecha).FirstOrDefaultAsync();
                if (ultima != null && DateTime.UtcNow - ultima < EsperaEntreLlamadas)
                    return StatusCode(StatusCodes.Status429TooManyRequests, new { message = "Acabas de llamar al mesero. Espera un momento antes de volver a llamar." });

                llamada = new LlamadaMesero
                {
                    MesaId = mesa.Id,
                    OcupacionId = (await Ocupaciones.AbiertaAsync(_context, mesa.Id))?.Id,
                    Clave = MesasController.NuevoCodigo(),
                    Fecha = DateTime.UtcNow
                };
                _context.LlamadasMesero.Add(llamada);
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
            }

            // La llamada ya está guardada: si el push falla, el mesero la ve igual en la app.
            try
            {
                await new FirebaseNotificationService(_context).EnviarLlamadaAsync(llamada.Id, mesa.Id, mesa.Numero);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo enviar el push de la llamada de la mesa {Mesa}", mesa.Numero);
            }
            return Ok(ADto(llamada));
        }

        /// <summary>Estado de una llamada para quien la hizo (sirve aunque la mesa aún no tenga pedidos).</summary>
        [HttpGet("llamadas/{clave}")]
        public async Task<ActionResult<LlamadaClienteDto>> GetLlamada(string clave)
        {
            var llamada = await _context.LlamadasMesero.AsNoTracking().FirstOrDefaultAsync(l => l.Clave == clave);
            if (llamada == null)
                return NotFound(new { message = "No encontramos esa llamada" });
            return ADto(llamada);
        }

        private static LlamadaClienteDto ADto(LlamadaMesero l) => new() { Clave = l.Clave, Estado = l.Estado, Fecha = l.Fecha };

        // ── Avisos (Web Push) ─────────────────────────────────────────────

        /// <summary>Clave pública VAPID para suscribirse; 404 si el servidor no tiene Web Push configurado.</summary>
        [HttpGet("push")]
        public IActionResult GetClavePush()
            => _push?.Configurado == true ? Ok(new { clavePublica = _push.ClavePublica }) : NotFound(new { message = "Los avisos no están disponibles" });

        /// <summary>Liga este navegador a los avisos de la visita. Se desliga sola al cerrar la visita.</summary>
        [HttpPost("push")]
        public async Task<IActionResult> Suscribir(SuscripcionPushDto dto,
            [FromHeader(Name = CabeceraMesa)] string? codigoMesa, [FromHeader(Name = CabeceraLlave)] string? llave)
        {
            if (_push?.Configurado != true)
                return NotFound(new { message = "Los avisos no están disponibles" });
            var ocupacionId = await Ocupaciones.IdParaSeguirAsync(_context, codigoMesa, llave);
            if (ocupacionId == null)
                return NotFound(new { message = "No encontramos tu seguimiento" });
            if (!PushWeb.EndpointValido(dto.Endpoint))
                return BadRequest(new { message = "Este navegador no permite recibir avisos" });

            var huella = PushWeb.Huella(dto.Endpoint!);
            var existente = await _context.SuscripcionesPush.FirstOrDefaultAsync(s => s.Huella == huella);
            if (existente != null)
            {
                // El mismo navegador en una visita nueva: deja de recibir los avisos de la anterior.
                existente.OcupacionId = ocupacionId.Value;
            }
            else
            {
                if (await _context.SuscripcionesPush.CountAsync(s => s.OcupacionId == ocupacionId) >= MaximoSuscripciones)
                    return Conflict(new { message = "Esta mesa ya tiene demasiados teléfonos con avisos" });
                _context.SuscripcionesPush.Add(new SuscripcionPush { OcupacionId = ocupacionId.Value, Endpoint = dto.Endpoint!, Huella = huella, Fecha = DateTime.UtcNow });
            }
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("push")]
        public async Task<IActionResult> Desuscribir(SuscripcionPushDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Endpoint)) return NoContent();
            var huella = PushWeb.Huella(dto.Endpoint);
            _context.SuscripcionesPush.RemoveRange(_context.SuscripcionesPush.Where(s => s.Huella == huella));
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
