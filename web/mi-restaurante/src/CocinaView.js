import { useState, useEffect, useCallback, useRef } from "react"
import { AnimatePresence, motion } from "motion/react"
import { POLLING_DOMICILIOS_MS, ordenarPorPrioridad, transformarDomicilios } from "./utils/kds"
import { AlertCircle, Check, ChefHat, Clock, LogOut, MapPin, MessageSquareText, Phone, Truck, User } from "lucide-react"
import { useAuth } from "./context/AuthContext"
import { useCambios } from "./services/realtime"
import * as api from "./services/api"
import { getDomiciliosActivos, actualizarEstadoDomicilio } from "./services/domiciliosApi"
import logo from "./components/logo.jpg"

const ease = [0.16, 1, 0.3, 1]
const MINUTOS_ALERTA = 10
const MINUTOS_URGENTE = 15

// Color de la espera: a tiempo, en alerta y urgente.
const tonoEspera = (minutos) =>
  minutos >= MINUTOS_URGENTE
    ? { borde: "ring-red-500/70", chip: "bg-red-600 text-white", texto: "Urgente" }
    : minutos >= MINUTOS_ALERTA
      ? { borde: "ring-amber-400/60", chip: "bg-amber-400 text-espresso", texto: "Demorado" }
      : { borde: "ring-white/10", chip: "bg-white/10 text-orange-100", texto: "A tiempo" }

function Ticket({ pedido, minutos, enCarga, onListo }) {
  const [confirmando, setConfirmando] = useState(false)
  const temporizador = useRef(null)
  const esDomicilio = pedido.tipo === "domicilio"
  const idVisible = esDomicilio ? pedido.domicilioId : pedido.id
  // Un pedido ya listo (vista del administrador) pasa a Entregado.
  const siguiente = pedido.estado === "Listo" ? "Entregado" : "Listo"
  const tono = pedido.estado === "Listo"
    ? { borde: "ring-green-500/60", chip: "bg-green-700 text-white", texto: "Listo" }
    : tonoEspera(minutos)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  // Dos toques para marcar listo: evita errores sin bloquear la pantalla con un modal.
  const alTocar = () => {
    if (!confirmando) {
      setConfirmando(true)
      clearTimeout(temporizador.current)
      temporizador.current = setTimeout(() => setConfirmando(false), 3000)
      return
    }
    clearTimeout(temporizador.current)
    setConfirmando(false)
    onListo(pedido, siguiente)
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, filter: "blur(4px)" }}
      transition={{ duration: 0.45, ease }}
      className={`flex flex-col overflow-hidden rounded-[22px] bg-[#3a2a20] ring-2 ${tono.borde}`}
    >
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-white">
            {esDomicilio && <Truck size={20} className="text-purple-300" aria-hidden="true" />}
            {esDomicilio ? "Domicilio" : `Mesa ${pedido.mesa}`}
          </p>
          <p className="tabular mt-0.5 text-[15px] font-semibold text-orange-200">Orden #{idVisible}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-full px-3 py-1 text-[13px] font-bold uppercase tracking-[0.06em] ${tono.chip}`}>{tono.texto}</span>
          <span className="tabular flex items-center gap-1.5 text-[22px] font-extrabold text-white">
            <Clock size={20} aria-hidden="true" />
            {minutos} min
          </span>
        </div>
      </header>

      {esDomicilio && (
        <dl className="mx-5 mb-3 space-y-1 rounded-xl bg-purple-950/50 p-3 text-[13px] text-purple-100">
          <div className="flex items-center gap-2"><User size={13} aria-hidden="true" /><dd className="truncate">{pedido.cliente}</dd></div>
          <div className="flex items-center gap-2"><Phone size={13} aria-hidden="true" /><dd className="tabular">{pedido.telefono}</dd></div>
          <div className="flex items-center gap-2"><MapPin size={13} aria-hidden="true" /><dd className="truncate">{pedido.direccion}</dd></div>
        </dl>
      )}

      <ul className="flex-1 space-y-2 px-5 pb-4">
        {pedido.items.map((item, idx) => (
          <li key={idx} className="rounded-xl bg-black/20 px-3 py-2.5">
            <div className="flex items-baseline gap-3">
              <span className="tabular grid h-10 min-w-[2.5rem] place-items-center rounded-lg bg-orange-500 px-2 text-[20px] font-extrabold text-espresso">
                {item.cantidad}
              </span>
              <span className="flex-1 text-[22px] font-bold leading-snug text-white">{item.nombre}</span>
            </div>
            {item.notas && (
              <p className="mt-2 flex items-start gap-2 pl-[3.25rem] text-[17px] font-semibold text-amber-200">
                <MessageSquareText size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                {item.notas}
              </p>
            )}
          </li>
        ))}
        {pedido.notasCliente && (
          <li className="rounded-xl bg-amber-400/10 px-3 py-2.5 text-[14px] text-amber-100">
            <span className="font-bold">Nota del cliente:</span> {pedido.notasCliente}
          </li>
        )}
      </ul>

      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={alTocar}
          disabled={enCarga}
          aria-label={confirmando ? `Confirmar orden ${idVisible} como ${siguiente.toLowerCase()}` : `Marcar orden ${idVisible} como ${siguiente.toLowerCase()}`}
          className={`flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-extrabold transition-[background-color,transform] active:scale-[0.98] disabled:cursor-wait disabled:bg-white/10 disabled:text-white/60 ${
            confirmando
              ? "bg-white text-espresso"
              : siguiente === "Entregado"
                ? "bg-white/[0.08] text-orange-200 ring-1 ring-orange-300/40 hover:bg-orange-500 hover:text-espresso"
                : "bg-white/[0.08] text-green-300 ring-1 ring-green-400/40 hover:bg-green-700 hover:text-white"
          }`}
        >
          {enCarga ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
              Actualizando…
            </>
          ) : confirmando ? (
            "Toca otra vez para confirmar"
          ) : (
            <>
              <Check size={22} strokeWidth={3} />
              {siguiente}
            </>
          )}
        </button>
      </div>
    </motion.article>
  )
}

// `incrustada`: vista del administrador dentro de su barra (filtro por mesa y
// pedidos listos por entregar); sin ella es la pantalla completa del rol Cocina.
function CocinaView({ pedidos = [], onActualizarPedidos, incrustada = false }) {
  const { usuario, logout } = useAuth()

  const [filtroMesa, setFiltroMesa] = useState("todas")
  const [cargandoEstado, setCargandoEstado] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [domicilios, setDomicilios] = useState([])
  const [horaActual, setHoraActual] = useState(new Date())

  // Reloj del header (segundo a segundo)
  useEffect(() => {
    const t = setInterval(() => setHoraActual(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const cargarTodosLosDatos = useCallback(async () => {
    try {
      setDomicilios(transformarDomicilios(await getDomiciliosActivos()))
    } catch (error) {
      console.error("Error al cargar domicilios:", error)
    }
  }, [])

  // Domicilios por SignalR con polling de respaldo (los pedidos de mesa los
  // refresca el padre y llegan por props).
  useCambios("domicilios", cargarTodosLosDatos)
  useEffect(() => {
    cargarTodosLosDatos()
    const interval = setInterval(cargarTodosLosDatos, POLLING_DOMICILIOS_MS)
    return () => clearInterval(interval)
  }, [cargarTodosLosDatos])

  useEffect(() => {
    if (!aviso) return undefined
    const t = setTimeout(() => setAviso(null), aviso.tipo === "error" ? 3500 : 2000)
    return () => clearTimeout(t)
  }, [aviso])

  const todosLosPedidos = [...(pedidos || []).map((p) => ({ ...p, tipo: "mesa" })), ...domicilios]

  const calcularTiempoTranscurrido = (horaInicio) => Math.max(0, Math.floor((horaActual - horaInicio) / 60000))

  // Listo para cocina; Entregado solo aparece en la vista del administrador.
  const marcarComoListo = async (pedido, nuevoEstado = "Listo") => {
    const pedidoId = pedido.tipo === "domicilio" ? pedido.domicilioId : pedido.id
    setCargandoEstado(pedidoId)
    try {
      if (pedido.tipo === "domicilio") {
        await actualizarEstadoDomicilio(pedido.domicilioId, "Listo")
      } else {
        await api.actualizarEstadoPedido(pedidoId, nuevoEstado)
      }

      if (onActualizarPedidos) await onActualizarPedidos()
      await cargarTodosLosDatos()

      setAviso({
        tipo: "exito",
        texto: pedido.tipo === "domicilio"
          ? `Domicilio #${pedidoId} listo para envío`
          : nuevoEstado === "Entregado"
            ? `Mesa ${pedido.mesa} entregada`
            : `Mesa ${pedido.mesa} lista para servir`,
      })
    } catch (error) {
      console.error("Error al marcar como listo:", error)
      setAviso({ tipo: "error", texto: "No se pudo marcar como listo. Revisa la conexión e inténtalo de nuevo." })
    } finally {
      setCargandoEstado(null)
    }
  }

  // Solo se muestran pedidos en preparación, por prioridad (espera + volumen).
  const estadosVisibles = incrustada ? ["EnProceso", "EnPreparacion", "Listo"] : ["EnProceso", "EnPreparacion"]
  const visibles = todosLosPedidos.filter((p) => estadosVisibles.includes(p.estado))
  const mesas = [...new Set(visibles.filter((p) => p.tipo === "mesa").map((p) => p.mesa))].sort((a, b) => a - b)
  const pedidosEnPreparacion = ordenarPorPrioridad(
    visibles.filter((p) => filtroMesa === "todas" || (p.tipo === "mesa" && String(p.mesa) === filtroMesa)),
    horaActual
  )

  const cantidadActivas = pedidosEnPreparacion.length
  const urgentes = pedidosEnPreparacion.filter((p) => p.estado !== "Listo" && calcularTiempoTranscurrido(p.hora) >= MINUTOS_URGENTE).length

  const chipFiltro = (valor, texto) => (
    <button
      key={valor}
      type="button"
      onClick={() => setFiltroMesa(valor)}
      aria-pressed={filtroMesa === valor}
      className={`h-9 shrink-0 rounded-full px-4 text-[14px] font-bold transition-colors ${
        filtroMesa === valor ? "bg-orange-500 text-espresso" : "bg-white/10 text-orange-100 hover:bg-white/15"
      }`}
    >
      {texto}
    </button>
  )

  return (
    <div className={`${incrustada ? "min-h-[calc(100vh-4rem)]" : "min-h-screen"} bg-espresso text-white`}>
      {incrustada && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
          <div className="qp-rail flex gap-2 overflow-x-auto">
            {chipFiltro("todas", "Todas")}
            {mesas.map((m) => chipFiltro(String(m), `Mesa ${m}`))}
          </div>
          <span className="tabular text-[15px] font-bold text-orange-100">
            {cantidadActivas} {cantidadActivas === 1 ? "orden" : "órdenes"}
            {urgentes > 0 && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-[13px] text-white">{urgentes} urgentes</span>}
          </span>
        </div>
      )}
      {!incrustada && (
      <header className="sticky top-0 z-30 border-b border-white/10 bg-espresso">
        <div className="flex h-[72px] items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Qpro" className="h-11 w-11 rounded-xl bg-white object-contain p-0.5" />
            <div>
              <h1 className="text-[20px] font-extrabold leading-tight tracking-[-0.01em]">Cocina</h1>
              <p className="text-[13px] font-medium text-orange-200">{usuario?.nombre || "Cocinero"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-white/10 px-4 py-2 sm:flex">
              <span className={`h-2.5 w-2.5 rounded-full ${cantidadActivas > 0 ? "bg-green-400" : "bg-white/40"}`} aria-hidden="true" />
              <span className="tabular text-[15px] font-bold">
                {cantidadActivas} {cantidadActivas === 1 ? "orden" : "órdenes"}
              </span>
              {urgentes > 0 && (
                <span className="tabular ml-1 rounded-full bg-red-600 px-2 py-0.5 text-[13px] font-bold">{urgentes} urgentes</span>
              )}
            </div>
            <time className="tabular hidden text-[22px] font-extrabold md:block">
              {horaActual.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
            </time>
            <button
              type="button"
              onClick={logout}
              aria-label="Cerrar sesión"
              className="flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] font-semibold transition-colors hover:bg-white/15"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>
      )}

      <main className="px-6 py-6">
        {cantidadActivas === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="mx-auto mt-24 max-w-md text-center"
          >
            <ChefHat className="mx-auto text-orange-300" size={56} strokeWidth={1.5} />
            <h2 className="mt-5 text-[26px] font-extrabold tracking-[-0.02em]">Sin órdenes pendientes</h2>
            <p className="mt-2 text-[16px] text-orange-100">Las nuevas comandas aparecen aquí solas, ordenadas por prioridad.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {pedidosEnPreparacion.map((pedido) => {
                const idVisible = pedido.tipo === "domicilio" ? pedido.domicilioId : pedido.id
                return (
                  <Ticket
                    key={pedido.id}
                    pedido={pedido}
                    minutos={calcularTiempoTranscurrido(pedido.hora)}
                    enCarga={cargandoEstado === idVisible}
                    onListo={marcarComoListo}
                  />
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        <AnimatePresence>
          {aviso && (
            <motion.div
              role={aviso.tipo === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.35, ease }}
              className={`flex items-center gap-3 rounded-full px-5 py-3.5 text-[15px] font-bold shadow-lift ${
                aviso.tipo === "error" ? "bg-red-700 text-white" : "bg-white text-espresso"
              }`}
            >
              {aviso.tipo === "error" ? <AlertCircle size={20} /> : <Check size={20} className="text-green-600" strokeWidth={3} />}
              {aviso.texto}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default CocinaView
