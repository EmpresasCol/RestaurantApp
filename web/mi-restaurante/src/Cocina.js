import { useState, useEffect, useRef } from "react"
import { Users, ChefHat, Clock, CheckCircle, Truck } from "lucide-react"
import { useAuth } from "./context/AuthContext"
import * as api from "./services/api"
import { getDomiciliosActivos, actualizarEstadoDomicilio } from "./services/domiciliosApi"
import VoiceControlCocina from "./components/VoiceControlCocina.js"

function Cocina({ pedidos = [], onActualizarPedidos }) {
  const { usuario } = useAuth()
  const [filtroMesa, setFiltroMesa] = useState("todas")
  const [cargandoEstado, setCargandoEstado] = useState(null)
  const [modalConfirmacion, setModalConfirmacion] = useState(null)
  const [todosLosPedidos, setTodosLosPedidos] = useState([])
  const todosLosPedidosRef = useRef([])

  useEffect(() => {
    todosLosPedidosRef.current = todosLosPedidos
  }, [todosLosPedidos])

  useEffect(() => {
    cargarTodosLosDatos()
  }, [pedidos])

  useEffect(() => {
    const interval = setInterval(() => {
      cargarDomiciliosSoloActualizacion()
    }, 5000)
    return () => clearInterval(interval)
  }, [pedidos])

  const cargarTodosLosDatos = async () => {
    try {
      const pedidosMesas = pedidos || []
      const domiciliosData = await getDomiciliosActivos()

      const domiciliosTransformados = Array.isArray(domiciliosData)
        ? domiciliosData
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
        : []

      const pedidosMesasTransformados = pedidosMesas.map((p) => ({
        ...p,
        tipo: "mesa",
      }))

      const combinados = [...pedidosMesasTransformados, ...domiciliosTransformados]
      setTodosLosPedidos(combinados)
    } catch (error) {
      console.error("Error al cargar datos:", error)
    }
  }

  const cargarDomiciliosSoloActualizacion = async () => {
    try {
      const domiciliosData = await getDomiciliosActivos()

      const domiciliosTransformados = Array.isArray(domiciliosData)
        ? domiciliosData
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
        : []

      const pedidosMesasTransformados = pedidos.map((p) => ({
        ...p,
        tipo: "mesa",
      }))

      const combinados = [...pedidosMesasTransformados, ...domiciliosTransformados]
      setTodosLosPedidos(combinados)
    } catch (error) {
      console.error("Error al actualizar domicilios:", error)
    }
  }

  const calcularTiempoTranscurrido = (horaInicio) => {
    const ahora = new Date()
    return Math.floor((ahora - horaInicio) / 60000)
  }

  const puedeModificarEstados = () => {
    if (!usuario) return false
    const rol = usuario.rol?.toLowerCase()
    return rol === "administrador" || rol === "caja"
  }

  const puedeFiltrarMesas = () => {
    if (!usuario) return false
    const rol = usuario.rol?.toLowerCase()
    return rol === "administrador" || rol === "caja"
  }

  const cambiarEstadoPedido = async (pedido, nuevoEstado) => {
    const pedidoId = pedido.tipo === "domicilio" ? pedido.domicilioId : pedido.id
    setCargandoEstado(pedidoId)
    try {
      if (pedido.tipo === "domicilio") {
        await actualizarEstadoDomicilio(pedido.domicilioId, "Listo")
      } else {
        await api.actualizarEstadoPedido(pedidoId, nuevoEstado)
      }

      if (onActualizarPedidos) {
        await onActualizarPedidos()
      }
      await cargarTodosLosDatos()

      setModalConfirmacion({
        tipo: "exito",
        mensaje:
          pedido.tipo === "domicilio"
            ? "🚲 Domicilio listo para envío"
            : `Pedido marcado como ${nuevoEstado === "Listo" ? "Listo" : "Entregado"}`,
      })

      setTimeout(() => setModalConfirmacion(null), 2000)
    } catch (error) {
      console.error("Error al actualizar estado:", error)
      setModalConfirmacion({
        tipo: "error",
        mensaje: "Error al actualizar el estado del pedido",
      })
    } finally {
      setCargandoEstado(null)
    }
  }

  const marcarPedidoListoPorVoz = async (pedidoId, tipoEspecificado = null) => {
    const pedidosActuales = todosLosPedidosRef.current

    let pedido = null

    if (tipoEspecificado === "mesa") {
      pedido = pedidosActuales.find(
        (p) => p.tipo === "mesa" && String(p.id) === String(pedidoId) && p.estado === "EnProceso",
      )
    } else if (tipoEspecificado === "domicilio") {
      pedido = pedidosActuales.find(
        (p) => p.tipo === "domicilio" && String(p.domicilioId) === String(pedidoId) && p.estado === "EnPreparacion",
      )
    }

    if (pedido) {
      await cambiarEstadoPedido(pedido, "Listo")
    } else {
      const tipoMensaje = tipoEspecificado === "mesa" ? "pedido" : "domicilio"
      setModalConfirmacion({
        tipo: "error",
        mensaje: `❌ No se encontró ${tipoMensaje} #${pedidoId} en proceso`,
      })
      setTimeout(() => setModalConfirmacion(null), 3000)
    }
  }

  const confirmarCambioEstado = (pedido, nuevoEstado, numeroMesa) => {
    setModalConfirmacion({
      tipo: "confirmar",
      titulo: `¿Marcar como ${nuevoEstado}?`,
      mensaje: `${numeroMesa} - ${pedido.tipo === "domicilio" ? "Domicilio" : "Pedido"} #${pedido.tipo === "domicilio" ? pedido.domicilioId : pedido.id}`,
      pedido,
      nuevoEstado,
      onConfirmar: () => {
        cambiarEstadoPedido(pedido, nuevoEstado)
        setModalConfirmacion(null)
      },
      onCancelar: () => setModalConfirmacion(null),
    })
  }

  const mesasUnicas = [...new Set(todosLosPedidos.map((p) => p.mesa))].sort((a, b) => {
    const aNum = typeof a === "number" ? a : 999
    const bNum = typeof b === "number" ? b : 999
    return aNum - bNum
  })

  const pedidosFiltrados = todosLosPedidos
    .filter((pedido) => pedido.estado !== "Pagado" && pedido.estado !== "Cancelado")
    .filter((pedido) => {
      if (!puedeFiltrarMesas()) return true
      if (filtroMesa === "todas") return true
      return pedido.mesa.toString() === filtroMesa
    })
    .sort((a, b) => new Date(a.hora) - new Date(b.hora))

  const getEstadoColor = (estado) => {
    switch (estado) {
      case "EnProceso":
        return "border-yellow-500 bg-yellow-900/20"
      case "Listo":
        return "border-green-500 bg-green-900/20"
      case "Entregado":
        return "border-blue-500 bg-blue-900/20"
      case "Pagado":
        return "border-purple-500 bg-purple-900/20"
      case "Cancelado":
        return "border-red-500 bg-red-900/20"
      case "EnPreparacion":
        return "border-yellow-500 bg-yellow-900/20"
      case "EnCamino":
        return "border-blue-500 bg-blue-900/20"
      default:
        return "border-gray-500"
    }
  }

  const getEstadoTexto = (estado) => {
    switch (estado) {
      case "EnProceso":
        return { texto: "En Proceso", color: "text-yellow-400" }
      case "Listo":
        return { texto: "Listo para Entregar", color: "text-green-400" }
      case "Entregado":
        return { texto: "Entregado", color: "text-blue-400" }
      case "Pagado":
        return { texto: "Pagado", color: "text-purple-400" }
      case "Cancelado":
        return { texto: "Cancelado", color: "text-red-400" }
      case "EnPreparacion":
        return { texto: "En Preparación", color: "text-yellow-400" }
      case "EnCamino":
        return { texto: "En Camino", color: "text-blue-400" }
      default:
        return { texto: estado, color: "text-gray-400" }
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-full mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChefHat className="text-orange-500" size={28} />
              <div>
                <h1 className="text-xl font-bold">Órdenes de Cocina</h1>
                <p className="text-sm text-gray-400">Restaurante Délice</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-base font-semibold">{new Date().toLocaleTimeString()}</p>
              <p className="text-xs text-gray-400">{new Date().toLocaleDateString()}</p>
              {usuario && (
                <p className="text-xs text-gray-500 mt-1">
                  {usuario.nombre} ({usuario.rol})
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-full mx-auto px-4 py-4">
        {puedeFiltrarMesas() && mesasUnicas.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setFiltroMesa("todas")}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${
                filtroMesa === "todas" ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              Todas ({pedidosFiltrados.length})
            </button>
            {mesasUnicas.map((mesa) => {
              const pedidosMesa = todosLosPedidos.filter(
                (p) => p.mesa === mesa && p.estado !== "Pagado" && p.estado !== "Cancelado",
              )
              return (
                <button
                  key={mesa}
                  onClick={() => setFiltroMesa(mesa.toString())}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${
                    filtroMesa === mesa.toString()
                      ? "bg-orange-500 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {typeof mesa === "number" ? `Mesa ${mesa}` : mesa} ({pedidosMesa.length})
                </button>
              )
            })}
          </div>
        )}

        {pedidosFiltrados.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <ChefHat className="mx-auto text-gray-500 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No hay órdenes</h3>
            <p className="text-gray-500">Las órdenes aparecerán aquí cuando se creen</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {pedidosFiltrados.map((pedido) => {
              const estadoInfo = getEstadoTexto(pedido.estado)

              return (
                <div
                  key={pedido.id}
                  className={`bg-gray-800 rounded-lg border-2 overflow-hidden transition-all hover:shadow-xl ${getEstadoColor(pedido.estado)}`}
                >
                  <div
                    className={`p-3 border-b border-gray-600 ${
                      pedido.tipo === "domicilio" ? "bg-gradient-to-r from-purple-600 to-purple-500" : "bg-gray-700"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          Orden #{pedido.tipo === "domicilio" ? pedido.domicilioId : pedido.id}
                        </h3>
                        <p className="text-sm text-gray-300 flex items-center gap-1 mt-1">
                          {pedido.tipo === "domicilio" ? (
                            <>
                              <Truck size={14} />
                              {pedido.mesa}
                            </>
                          ) : (
                            <>
                              <Users size={14} />
                              Mesa {pedido.mesa}
                            </>
                          )}
                        </p>

                        {pedido.tipo === "domicilio" && (
                          <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-white text-purple-700">
                            🚲 DOMICILIO
                          </span>
                        )}

                        <span
                          className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${estadoInfo.color} bg-gray-800`}
                        >
                          {estadoInfo.texto}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-gray-300">
                          <Clock size={14} />
                          <span className="text-xs">{calcularTiempoTranscurrido(pedido.hora)} min</span>
                        </div>
                        <p className="text-xs text-gray-400">{pedido.hora.toLocaleTimeString()}</p>
                      </div>
                    </div>

                    {pedido.tipo === "domicilio" && (
                      <div className="text-sm space-y-1 bg-white/10 rounded p-2 mt-2">
                        <p>👤 {pedido.cliente}</p>
                        <p>📱 {pedido.telefono}</p>
                        <p>📍 {pedido.direccion}</p>
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <h4 className="text-sm font-semibold text-orange-400 mb-2">Platos:</h4>
                    <div className="space-y-2">
                      {pedido.items.map((item, index) => (
                        <div key={index} className="bg-gray-700 p-2 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded-full text-xs font-bold min-w-[1.5rem] text-center">
                              {item.cantidad}
                            </span>
                            <span className="font-medium text-white text-sm truncate">{item.nombre}</span>
                          </div>
                          {item.notas && (
                            <div className="mt-1.5 ml-7 p-1.5 bg-yellow-800 border-l-2 border-yellow-500 rounded">
                              <p className="text-xs text-yellow-200">📝 {item.notas}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {pedido.notasCliente && (
                    <div className="px-3 pb-2">
                      <div className="bg-yellow-900/30 border border-yellow-500/50 rounded p-2">
                        <p className="text-yellow-300 text-xs">
                          <strong>Notas:</strong> {pedido.notasCliente}
                        </p>
                      </div>
                    </div>
                  )}

                  {puedeModificarEstados() && (
                    <div className="px-3 pb-3 pt-2 border-t border-gray-600">
                      <div className="flex gap-2">
                        {pedido.estado === "EnProceso" && (
                          <button
                            onClick={() =>
                              confirmarCambioEstado(
                                pedido,
                                pedido.tipo === "domicilio" ? "Listo" : "Listo",
                                pedido.mesa,
                              )
                            }
                            disabled={cargandoEstado === (pedido.tipo === "domicilio" ? pedido.domicilioId : pedido.id)}
                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-1 rounded text-xs font-semibold transition-colors"
                          >
                            {cargandoEstado === (pedido.tipo === "domicilio" ? pedido.domicilioId : pedido.id)
                              ? "Procesando..."
                              : "✓ Listo"}
                          </button>
                        )}
                        {pedido.estado === "Listo" && (
                          <button
                            onClick={() => confirmarCambioEstado(pedido, "Entregado", pedido.mesa)}
                            disabled={cargandoEstado === (pedido.tipo === "domicilio" ? pedido.domicilioId : pedido.id)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-1 rounded text-xs font-semibold transition-colors"
                          >
                            {cargandoEstado === (pedido.tipo === "domicilio" ? pedido.domicilioId : pedido.id)
                              ? "Procesando..."
                              : "📦 Entregado"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modalConfirmacion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-700">
            {modalConfirmacion.tipo === "confirmar" && (
              <>
                <h3 className="text-lg font-bold text-white mb-2">{modalConfirmacion.titulo}</h3>
                <p className="text-gray-300 mb-6">{modalConfirmacion.mensaje}</p>
                <div className="flex gap-3">
                  <button
                    onClick={modalConfirmacion.onCancelar}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={modalConfirmacion.onConfirmar}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded font-semibold transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </>
            )}
            {modalConfirmacion.tipo === "exito" && (
              <>
                <CheckCircle className="text-green-400 mb-3" size={40} />
                <p className="text-white font-semibold">{modalConfirmacion.mensaje}</p>
              </>
            )}
            {modalConfirmacion.tipo === "error" && (
              <>
                <p className="text-red-400 font-semibold">{modalConfirmacion.mensaje}</p>
              </>
            )}
          </div>
        </div>
      )}

      <VoiceControlCocina onMarcarListo={marcarPedidoListoPorVoz} />
    </div>
  )
}

export default Cocina
