using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RestaurantApi.Models;

namespace RestaurantApi.Services
{
    /// <summary>
    /// Ciclo de la mesa en un solo lugar: abrir la ocupación con el primer pedido, cerrarla cuando
    /// no queda consumo abierto y serializar las operaciones que compiten por la misma mesa.
    /// </summary>
    public static class Ocupaciones
    {
        public const int IntentosPinAntesDeCambiarlo = 5;

        public static string NuevoToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();

        public static string NuevoPin() => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

        /// <summary>
        /// Abre una transacción y toma el candado de la mesa (SELECT … FOR UPDATE). Pedido nuevo,
        /// cobro, cancelación, liberación y llamada pasan por aquí: así el cobro final no libera
        /// una mesa a la que le acaba de entrar un pedido ni se cobra dos veces la misma cuenta.
        /// EF InMemory (pruebas) no tiene candados: allí solo abre la transacción.
        /// </summary>
        public static async Task<IDbContextTransaction> BloquearMesaAsync(RestauranteContext ctx, int mesaId)
        {
            if (!ctx.Database.IsRelational())
                return await ctx.Database.BeginTransactionAsync();

            // READ COMMITTED: lo que se lee después de esperar el candado es lo ya confirmado por
            // quien lo tenía (en MySQL y en TiDB), no una foto tomada antes de la espera.
            var tx = await ctx.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
            await ctx.Database.ExecuteSqlInterpolatedAsync($"SELECT Id FROM Mesas WHERE Id = {mesaId} FOR UPDATE");
            return tx;
        }

        public static Task<Ocupacion?> AbiertaAsync(RestauranteContext ctx, int mesaId)
            => ctx.Ocupaciones.FirstOrDefaultAsync(o => o.MesaId == mesaId && o.Abierta == true);

        /// <summary>
        /// La ocupación abierta de la mesa o una nueva. Una mesa libre pasa a Ocupada; la que
        /// espera el pago sigue así (la cuenta pedida no se pierde por un plato más). No guarda.
        /// </summary>
        public static async Task<Ocupacion> AbrirAsync(RestauranteContext ctx, Mesa mesa)
        {
            var ocupacion = await AbiertaAsync(ctx, mesa.Id);
            if (ocupacion == null)
            {
                ocupacion = new Ocupacion { MesaId = mesa.Id, Token = NuevoToken(), Pin = NuevoPin(), Inicio = DateTime.UtcNow };
                ctx.Ocupaciones.Add(ocupacion);
            }
            if (mesa.Estado == EstadoMesa.Disponible) mesa.Estado = EstadoMesa.Ocupada;
            return ocupacion;
        }

        /// <summary>
        /// Cierra la mesa si ya no le quedan pedidos abiertos. <paramref name="pedidoQueSeCierra"/>
        /// es el pedido que se está pagando o cancelando en esta misma operación (aún sin guardar).
        /// </summary>
        public static async Task<bool> CerrarSiSaldadaAsync(RestauranteContext ctx, Mesa mesa, int? pedidoQueSeCierra = null)
        {
            var quedan = await ctx.Pedidos.AnyAsync(p =>
                p.MesaId == mesa.Id && p.Id != pedidoQueSeCierra &&
                p.Estado != EstadoPedido.Pagado && p.Estado != EstadoPedido.Cancelado);
            if (quedan) return false;
            await CerrarAsync(ctx, mesa);
            return true;
        }

        /// <summary>
        /// Libera la mesa: cierra la ocupación (su token deja de servir), resuelve las llamadas vivas
        /// y anula la cuenta pedida que quedó sin cobrar. No borra pedidos, pagos ni facturas. No guarda.
        /// </summary>
        public static async Task CerrarAsync(RestauranteContext ctx, Mesa mesa)
        {
            mesa.Estado = EstadoMesa.Disponible;

            var ocupacion = await AbiertaAsync(ctx, mesa.Id);
            if (ocupacion != null)
            {
                ocupacion.Cierre = DateTime.UtcNow;
                ocupacion.Abierta = null;
            }

            var llamadas = await ctx.LlamadasMesero.Where(l => l.MesaId == mesa.Id && l.Activa == true).ToListAsync();
            foreach (var l in llamadas)
            {
                l.Estado = LlamadaMesero.Cerrada;
                l.Activa = null;
            }

            // El cobro pudo marcarla Cobrada en esta misma operación: se respeta lo que hay en memoria.
            var solicitudes = await ctx.SolicitudesCuenta
                .Where(s => s.MesaId == mesa.Id && s.Estado == SolicitudCuenta.Pendiente).ToListAsync();
            foreach (var s in solicitudes.Where(s => s.Estado == SolicitudCuenta.Pendiente))
                s.Estado = SolicitudCuenta.Anulada;
        }
    }
}
