import { useState, useEffect, useCallback } from "react"
import {
  ChefHat,
  Clock,
  CheckCircle,
  Truck,
  AlertCircle,
  LogOut,
} from "lucide-react"
import { useAuth } from "./context/AuthContext"
import * as api from "./services/api"
import {
  getDomiciliosActivos,
  actualizarEstadoDomicilio,
} from "./services/domiciliosApi"

const POLLING_DOMICILIOS_MS = 5000

function CocinaView({ pedidos = [], onActualizarPedidos }) {
  const { usuario, logout } = useAuth()

  const [cargandoEstado, setCargandoEstado] = useState(null)
  const [modalConfirmacion, setModalConfirmacion] = useState(null)
  const [todosLosPedidos, setTodosLosPedidos] = useState([])
  const [horaActual, setHoraActual] = useState(new Date())

  // Reloj del header (segundo a segundo)
  useEffect(() => {
    const t = setInterval(() => setHoraActual(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const transformarDomicilios = useCallback((domiciliosData) => {
    if (!Array.isArray(domiciliosData)) return []
    return domiciliosData
      .filter((d) => d.estado === "EnPreparacion")
      .map((d) => ({
        id: `D${d.id}`,
        domicilioId: d.id,
        mesa: `Domicilio #${d.id}`,
        cliente: d.clienteNombre,
        telefono: d.clienteTelefono,
        direccion: d.direccionCompleta,
        items: d.detalles.map((det) => ({
          id: det.id,
          nombre: det.platilloNombre,
          cantidad: det.cantidad,
          notas: det.nota || "",
        })),
        hora: new Date(d.fechaPedido),
        estado: "EnPreparacion",
        tipo: "domicilio",
        notasCliente: d.notasCliente,
      }))
  }, [])

  const cargarTodosLosDatos = useCallback(async () => {
    try {
      const domiciliosData = await getDomiciliosActivos()
      const domicilios = transformarDomicilios(domiciliosData)
      const mesas = (pedidos || []).map((p) => ({ ...p, tipo: "mesa" }))
      setTodosLosPedidos([...mesas, ...domicilios])
    } catch (error) {
      console.error("Error al cargar datos:", error)
    }
  }, [pedidos, transformarDomicilios])

  useEffect(() => {
    cargarTodosLosDatos()
  }, [cargarTodosLosDatos])

  // Polling solo de domicilios (los pedidos de mesa los refresca el padre)
  useEffect(() => {
    const interval = setInterval(cargarTodosLosDatos, POLLING_DOMICILIOS_MS)
    return () => clearInterval(interval)
  }, [cargarTodosLosDatos])

  const calcularTiempoTranscurrido = (horaInicio) =>
    Math.floor((new Date() - horaInicio) / 60000)

  // Marca un pedido/domicilio como Listo. El cocinero NO puede marcar Entregado.
  const marcarComoListo = async (pedido) => {
    const pedidoId =
      pedido.tipo === "domicilio" ? pedido.domicilioId : pedido.id
    setCargandoEstado(pedidoId)
    try {
      if (pedido.tipo === "domicilio") {
        await actualizarEstadoDomicilio(pedido.domicilioId, "Listo")
      } else {
        await api.actualizarEstadoPedido(pedidoId, "Listo")
      }

      if (onActualizarPedidos) await onActualizarPedidos()
      await cargarTodosLosDatos()

      setModalConfirmacion({
        tipo: "exito",
        mensaje:
          pedido.tipo === "domicilio"
            ? "Domicilio listo para envío"
            : "Pedido marcado como listo",
      })
      setTimeout(() => setModalConfirmacion(null), 1600)
    } catch (error) {
      console.error("Error al marcar como listo:", error)
      setModalConfirmacion({
        tipo: "error",
        mensaje: "No se pudo actualizar el estado. Inténtalo de nuevo.",
      })
      setTimeout(() => setModalConfirmacion(null), 2500)
    } finally {
      setCargandoEstado(null)
    }
  }

  const confirmarMarcarListo = (pedido) => {
    const ref =
      pedido.tipo === "domicilio"
        ? `Domicilio #${pedido.domicilioId}`
        : `Mesa ${pedido.mesa} · Orden #${pedido.id}`
    setModalConfirmacion({
      tipo: "confirmar",
      titulo: "¿Marcar como listo?",
      mensaje: ref,
      onConfirmar: () => {
        marcarComoListo(pedido)
        setModalConfirmacion(null)
      },
      onCancelar: () => setModalConfirmacion(null),
    })
  }

  // Solo se muestran pedidos en preparación. Los "Listo" salen de la vista.
  const pedidosEnPreparacion = todosLosPedidos
    .filter(
      (p) => p.estado === "EnProceso" || p.estado === "EnPreparacion"
    )
    .sort((a, b) => new Date(a.hora) - new Date(b.hora))

  const cantidadActivas = pedidosEnPreparacion.length

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* HEADER COMPACTO Y ALINEADO */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
        <div className="px-6 py-3 flex items-center justify-between">
          {/* Izquierda: identidad de la pantalla */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ChefHat size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Cocina</h1>
              <p className="text-xs text-gray-400">Restaurante Délice</p>
            </div>
          </div>

          {/* Derecha: estado + usuario + salir */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-gray-700 px-3 py-1.5 rounded-lg">
              <span
                className={`w-2 h-2 rounded-full ${
                  cantidadActivas > 0 ? "bg-green-500 animate-pulse" : "bg-gray-500"
                }`}
              />
              <span className="text-sm text-gray-200 font-medium">
                {cantidadActivas}{" "}
                {cantidadActivas === 1 ? "orden activa" : "órdenes activas"}
              </span>
            </div>

            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold leading-tight">
                {usuario?.nombre || "Cocinero"}
              </p>
              <p className="text-xs text-gray-400">
                {horaActual.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <button
              onClick={logout}
              aria-label="Cerrar sesión"
              className="bg-red-600 hover:bg-red-700 active:scale-95 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* CUERPO */}
      <main className="px-6 py-6">
        {pedidosEnPreparacion.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-16 text-center max-w-2xl mx-auto mt-12 border border-gray-700">
            <ChefHat className="mx-auto text-gray-500 mb-4" size={72} />
            <h2 className="text-2xl font-semibold text-gray-300 mb-2">
              No hay órdenes pendientes
            </h2>
            <p className="text-gray-500">
              Las nuevas órdenes aparecerán aquí automáticamente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pedidosEnPreparacion.map((pedido) => {
              const idVisible =
                pedido.tipo === "domicilio" ? pedido.domicilioId : pedido.id
              const enCarga = cargandoEstado === idVisible
              const minutos = calcularTiempoTranscurrido(pedido.hora)
              const esUrgente = minutos >= 15
              const esDomicilio = pedido.tipo === "domicilio"

              return (
                <article
                  key={pedido.id}
                  className={`bg-gray-800 rounded-xl border-2 overflow-hidden flex flex-col transition-all ${
                    esUrgente
                      ? "border-red-500 shadow-lg shadow-red-500/20"
                      : "border-yellow-500"
                  }`}
                >
                  {/* Cabecera de la tarjeta */}
                  <header
                    className={`px-4 py-3 ${
                      esDomicilio
                        ? "bg-gradient-to-r from-purple-700 to-purple-600"
                        : "bg-gray-700"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          {esDomicilio ? (
                            <>
                              <Truck size={18} /> Domicilio
                            </>
                          ) : (
                            `Mesa ${pedido.mesa}`
                          )}
                        </h3>
                        <p
                          className={`text-xs mt-0.5 ${
                            esDomicilio ? "text-purple-100" : "text-gray-400"
                          }`}
                        >
                          Orden #{idVisible}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide ${
                            esUrgente
                              ? "bg-red-900 text-red-200"
                              : "bg-yellow-900 text-yellow-200"
                          }`}
                        >
                          {esUrgente ? "Urgente" : "En proceso"}
                        </span>
                        <p
                          className={`text-xs mt-1.5 flex items-center gap-1 justify-end ${
                            esUrgente ? "text-red-300 font-semibold" : "text-gray-400"
                          }`}
                        >
                          <Clock size={12} />
                          {minutos} min
                        </p>
                      </div>
                    </div>

                    {esDomicilio && (
                      <div className="mt-3 text-xs space-y-0.5 bg-black/20 rounded p-2 text-purple-50">
                        <p className="truncate">👤 {pedido.cliente}</p>
                        <p>📱 {pedido.telefono}</p>
                        <p className="truncate">📍 {pedido.direccion}</p>
                      </div>
                    )}
                  </header>

                  {/* Lista de platos */}
                  <div className="px-4 py-3 flex-1">
                    <div className="space-y-1.5">
                      {pedido.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-gray-700/60 rounded-lg p-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="bg-orange-500 text-white px-2 py-0.5 rounded-full text-xs font-bold min-w-[1.75rem] text-center">
                              {item.cantidad}
                            </span>
                            <span className="font-medium text-white text-sm flex-1 leading-snug">
                              {item.nombre}
                            </span>
                          </div>
                          {item.notas && (
                            <div className="mt-1.5 ml-9 px-2 py-1 bg-yellow-900/40 border-l-2 border-yellow-500 rounded text-xs text-yellow-200">
                              📝 {item.notas}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {pedido.notasCliente && (
                      <div className="mt-3 bg-yellow-900/30 border border-yellow-500/40 rounded p-2">
                        <p className="text-yellow-200 text-xs">
                          <strong>Notas del cliente:</strong>{" "}
                          {pedido.notasCliente}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Botón único: Marcar Listo */}
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => confirmarMarcarListo(pedido)}
                      disabled={enCarga}
                      aria-label={`Marcar orden ${idVisible} como lista`}
                      className="w-full min-h-[60px] bg-green-600 hover:bg-green-700 active:scale-95 disabled:bg-gray-600 disabled:scale-100 disabled:cursor-not-allowed text-white rounded-lg text-base font-bold transition-all flex items-center justify-center gap-2 shadow-md"
                    >
                      {enCarga ? (
                        "Procesando..."
                      ) : (
                        <>
                          <CheckCircle size={22} />
                          Marcar Listo
                        </>
                      )}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>

      {/* MODAL DE CONFIRMACIÓN / FEEDBACK */}
      {modalConfirmacion && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border-2 border-gray-700 shadow-2xl">
            {modalConfirmacion.tipo === "confirmar" && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle
                    className="text-orange-400 flex-shrink-0"
                    size={32}
                  />
                  <h3 className="text-xl font-bold text-white">
                    {modalConfirmacion.titulo}
                  </h3>
                </div>
                <p className="text-gray-300 text-base mb-8 ml-1">
                  {modalConfirmacion.mensaje}
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={modalConfirmacion.onCancelar}
                    aria-label="Cancelar"
                    className="flex-1 min-h-[64px] bg-gray-600 hover:bg-gray-500 active:scale-95 text-white rounded-lg text-lg font-bold transition-all shadow"
                  >
                    ✕ Cancelar
                  </button>
                  <button
                    onClick={modalConfirmacion.onConfirmar}
                    aria-label="Confirmar"
                    autoFocus
                    className="flex-1 min-h-[64px] bg-green-600 hover:bg-green-700 active:scale-95 text-white rounded-lg text-lg font-bold transition-all shadow"
                  >
                    ✓ Confirmar
                  </button>
                </div>
              </>
            )}
            {modalConfirmacion.tipo === "exito" && (
              <div className="flex flex-col items-center text-center py-2">
                <CheckCircle className="text-green-400 mb-3" size={56} />
                <p className="text-white font-semibold text-lg">
                  {modalConfirmacion.mensaje}
                </p>
              </div>
            )}
            {modalConfirmacion.tipo === "error" && (
              <div className="flex flex-col items-center text-center py-2">
                <AlertCircle className="text-red-400 mb-3" size={56} />
                <p className="text-red-400 font-semibold text-lg">
                  {modalConfirmacion.mensaje}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CocinaView