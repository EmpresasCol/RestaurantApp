// src/Cocina.js
// Pantalla de órdenes de cocina.
// - Sin control por voz (eliminado por baja viabilidad en entorno laboral pesado).
// - Cada comanda expone botones grandes (touch-friendly, >=56px) con modal de
//   confirmación/cancelación para evitar marcados accidentales.
// - Los cocineros pueden modificar estados (antes solo admin/caja).

import { useState, useEffect } from "react"
import { ChefHat, Clock, CheckCircle, Truck, AlertCircle } from "lucide-react"
import { useAuth } from "./context/AuthContext"
import * as api from "./services/api"
import { getDomiciliosActivos, actualizarEstadoDomicilio } from "./services/domiciliosApi"

function Cocina({ pedidos = [], onActualizarPedidos }) {
  const { usuario } = useAuth()
  const [filtroMesa, setFiltroMesa] = useState("todas")
  const [cargandoEstado, setCargandoEstado] = useState(null)
  const [modalConfirmacion, setModalConfirmacion] = useState(null)
  const [todosLosPedidos, setTodosLosPedidos] = useState([])

  // Carga inicial / cuando cambian los pedidos del padre
  useEffect(() => {
    cargarTodosLosDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos])

  // Polling de domicilios cada 5s (evita recargar pedidos de mesa para no
  // duplicar tráfico con el polling del padre)
  useEffect(() => {
    const interval = setInterval(() => {
      cargarDomiciliosSoloActualizacion()
    }, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      setTodosLosPedidos([...pedidosMesasTransformados, ...domiciliosTransformados])
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

      const pedidosMesasTransformados = (pedidos || []).map((p) => ({
        ...p,
        tipo: "mesa",
      }))

      setTodosLosPedidos([...pedidosMesasTransformados, ...domiciliosTransformados])
    } catch (error) {
      console.error("Error al actualizar domicilios:", error)
    }
  }

  const calcularTiempoTranscurrido = (horaInicio) => {
    const ahora = new Date()
    return Math.floor((ahora - horaInicio) / 60000)
  }

  // Cocina, administrador y caja pueden modificar estados desde esta pantalla.
  const puedeModificarEstados = () => {
    if (!usuario) return false
    const rol = usuario.rol?.toLowerCase()
    return rol === "administrador" || rol === "caja" || rol === "cocina"
  }

  // El filtro por mesa sigue siendo de admin/caja (no es función operativa de cocina).
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
            : `Pedido marcado como ${nuevoEstado}`,
      })

      setTimeout(() => setModalConfirmacion(null), 1800)
    } catch (error) {
      console.error("Error al actualizar estado:", error)
      setModalConfirmacion({
        tipo: "error",
        mensaje: "Error al actualizar el estado del pedido",
      })
      setTimeout(() => setModalConfirmacion(null), 2500)
    } finally {
      setCargandoEstado(null)
    }
  }

  const confirmarCambioEstado = (pedido, nuevoEstado, numeroMesa) => {
    setModalConfirmacion({
      tipo: "confirmar",
      titulo: `¿Marcar como ${nuevoEstado}?`,
      mensaje: `${numeroMesa} - ${
        pedido.tipo === "domicilio" ? "Domicilio" : "Pedido"
      } #${pedido.tipo === "domicilio" ? pedido.domicilioId : pedido.id}`,
      onConfirmar: () => {
        cambiarEstadoPedido(pedido, nuevoEstado)
        setModalConfirmacion(null)
      },
      onCancelar: () => setModalConfirmacion(null),
    })
  }

  // ----- Derivados memoizables (cómputo barato, se mantiene inline por simplicidad) -----

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
              const idVisible = pedido.tipo === "domicilio" ? pedido.domicilioId : pedido.id
              const enCarga = cargandoEstado === idVisible

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
                          Orden #{idVisible}
                        </h3>
                        <p className="text-sm text-gray-300 flex items-center gap-1 mt-1">
                          {pedido.tipo === "domicilio" ? (
                            <>
                              <Truck size={14} /> Domicilio
                            </>
                          ) : (
                            <>Mesa {pedido.mesa}</>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs font-semibold ${estadoInfo.color}`}>
                          {estadoInfo.texto}
                        </div>
                        <p className="text-xs text-gray-400 flex items-center gap-1 justify-end mt-1">
                          <Clock size={12} />
                          {calcularTiempoTranscurrido(pedido.hora)} min
                        </p>
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

                  {/*
                    Botones touch-friendly:
                    - min-h-[56px] cumple Target Size AAA (WCAG 2.5.5).
                    - text-base + font-bold para legibilidad a distancia.
                    - active:scale-95 para feedback táctil claro.
                    - aria-label para accesibilidad / lectores de pantalla.
                  */}
                  {puedeModificarEstados() && (pedido.estado === "EnProceso" || pedido.estado === "EnPreparacion" || pedido.estado === "Listo") && (
                    <div className="px-3 pb-3 pt-2 border-t border-gray-600">
                      {(pedido.estado === "EnProceso" || pedido.estado === "EnPreparacion") && (
                        <button
                          onClick={() => confirmarCambioEstado(pedido, "Listo", pedido.mesa)}
                          disabled={enCarga}
                          aria-label={`Marcar orden ${idVisible} como lista`}
                          className="w-full min-h-[56px] bg-green-600 hover:bg-green-700 active:scale-95 disabled:bg-gray-600 disabled:scale-100 text-white py-3 rounded-lg text-base font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
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
                      )}
                      {pedido.estado === "Listo" && (
                        <button
                          onClick={() => confirmarCambioEstado(pedido, "Entregado", pedido.mesa)}
                          disabled={enCarga}
                          aria-label={`Marcar orden ${idVisible} como entregada`}
                          className="w-full min-h-[56px] bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:bg-gray-600 disabled:scale-100 text-white py-3 rounded-lg text-base font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                          {enCarga ? "Procesando..." : "📦 Marcar Entregado"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/*
        Modal de confirmación / feedback.
        - Botones grandes (min-h-[64px]) bien separados (gap-4) para evitar
          toques accidentales en pantallas táctiles con manos ocupadas.
        - Cancelar a la izquierda, Confirmar a la derecha (convención Material).
        - Backdrop oscuro reduce ambigüedad de zona activa.
      */}
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
                  <AlertCircle className="text-orange-400 flex-shrink-0" size={32} />
                  <h3 className="text-xl font-bold text-white">{modalConfirmacion.titulo}</h3>
                </div>
                <p className="text-gray-300 text-base mb-8 ml-1">{modalConfirmacion.mensaje}</p>
                <div className="flex gap-4">
                  <button
                    onClick={modalConfirmacion.onCancelar}
                    aria-label="Cancelar acción"
                    className="flex-1 min-h-[64px] bg-gray-600 hover:bg-gray-500 active:scale-95 text-white py-4 rounded-lg text-lg font-bold transition-all shadow-lg"
                  >
                    ✕ Cancelar
                  </button>
                  <button
                    onClick={modalConfirmacion.onConfirmar}
                    aria-label="Confirmar acción"
                    autoFocus
                    className="flex-1 min-h-[64px] bg-green-600 hover:bg-green-700 active:scale-95 text-white py-4 rounded-lg text-lg font-bold transition-all shadow-lg"
                  >
                    ✓ Confirmar
                  </button>
                </div>
              </>
            )}
            {modalConfirmacion.tipo === "exito" && (
              <div className="flex flex-col items-center text-center py-2">
                <CheckCircle className="text-green-400 mb-3" size={56} />
                <p className="text-white font-semibold text-lg">{modalConfirmacion.mensaje}</p>
              </div>
            )}
            {modalConfirmacion.tipo === "error" && (
              <div className="flex flex-col items-center text-center py-2">
                <AlertCircle className="text-red-400 mb-3" size={56} />
                <p className="text-red-400 font-semibold text-lg">{modalConfirmacion.mensaje}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Cocina